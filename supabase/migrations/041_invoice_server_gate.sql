-- 041: Creating or issuing an invoice is checked on the server.
--
-- The browser does not decide the parties, the timesheets, or the money.
-- On insert, and when a draft is issued:
--   * the caller controls from_party (their party, not merely project ownership)
--   * to_party is a party that from_party bills
--   * every timesheet key is an approved week of this project
--   * subtotal, tax and total are recomputed. Timesheet lines use the stored
--     bill rate and the week's hours. A missing rate is refused, not invented.
--   * when the project requires a purchase order, issuing needs a signed one
--   * a week already on a live invoice cannot be issued again
--
-- wg_create_invoice is what the app calls. The trigger also covers a direct
-- insert, including service_role, because auth.uid() must be the caller.

BEGIN;

CREATE OR REPLACE FUNCTION public.wg_invoice_caller_controls_party(p_project_id text, p_party_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND p_party_id IS NOT NULL AND (
    public.wg_user_can_access_project_party(
      p_project_id, p_party_id, ARRAY['org_admin', 'org_finance']
    )
    OR EXISTS (
      SELECT 1
      FROM wg_project_members m
      WHERE m.project_id = p_project_id
        AND m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
        AND m.scope = p_party_id
        AND m.role IN ('Owner', 'Editor')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.wg_invoice_line_amount(p_quantity numeric, p_unit_price numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round(COALESCE(p_quantity, 0) * COALESCE(p_unit_price, 0), 2);
$$;

CREATE OR REPLACE FUNCTION public.wg_check_invoice_can_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
  v_base text;
  v_part text;
  v_person text;
  v_uid uuid;
  v_week date;
  v_found integer;
  v_unapproved integer;
  v_graph jsonb;
  v_conflict text;
  v_rate numeric;
  v_rate_type text;
  v_rate_currency text;
  v_hours numeric;
  v_days integer;
  v_qty numeric;
  v_amount numeric;
  v_subtotal numeric := 0;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_unit numeric;
  v_require_po boolean;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('issued', 'paid', 'partially_paid', 'overdue') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to create an invoice.' USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You cannot create an invoice for another user.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.wg_invoice_caller_controls_party(NEW.project_id, NEW.from_party_id) THEN
    RAISE EXCEPTION 'You cannot issue an invoice from a party you do not control.'
      USING ERRCODE = '42501';
  END IF;

  SELECT graph, COALESCE(require_purchase_order, false)
  INTO v_graph, v_require_po
  FROM wg_projects
  WHERE id = NEW.project_id;

  IF NEW.from_party_id IS NULL OR NEW.to_party_id IS NULL OR NEW.from_party_id = NEW.to_party_id
     OR NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(COALESCE(v_graph->'edges', '[]'::jsonb)) e
       WHERE e->>'source' = NEW.from_party_id
         AND e->>'target' = NEW.to_party_id
         AND COALESCE(e->'data'->>'edgeType', e->>'type') IN ('billsTo', 'subcontracts', 'bills_to')
     ) THEN
    RAISE EXCEPTION 'This invoice''s buyer is not a party the seller bills in this project.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(array_length(NEW.timesheet_ids, 1), 0) > 0 THEN
    FOREACH v_key IN ARRAY NEW.timesheet_ids LOOP
      v_base := split_part(v_key, '@', 1);
      v_part := nullif(split_part(v_key, '@', 2), '');
      IF v_base !~ ':[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RAISE EXCEPTION 'Invoice timesheet key % is not a week.', v_key USING ERRCODE = '23514';
      END IF;
      v_person := left(v_base, length(v_base) - 11);
      v_week := right(v_base, 10)::date;
      v_uid := public.wg_resolve_timesheet_person(NEW.project_id, v_person);

      SELECT count(*), count(*) FILTER (WHERE w.status <> 'approved')
        INTO v_found, v_unapproved
      FROM wg_timesheet_weeks w
      WHERE w.project_id = NEW.project_id
        AND w.week_start = v_week
        AND w.user_id = v_uid;

      IF v_found = 0 OR v_unapproved > 0 THEN
        RAISE EXCEPTION 'Timesheet % is not an approved week in this project, so it cannot be invoiced.', v_key
          USING ERRCODE = '23514';
      END IF;

      SELECT r.amount, r.rate_type, r.currency
        INTO v_rate, v_rate_type, v_rate_currency
      FROM wg_contract_rates r
      WHERE r.project_id = NEW.project_id
        AND r.rate_scope = 'bill'
        AND r.effective_to IS NULL
        AND r.amount > 0
        AND (
          r.subject_graph_node_id = v_person
          OR (v_uid IS NOT NULL AND (r.subject_user_id = v_uid OR r.subject_graph_node_id = v_uid::text))
        )
      ORDER BY r.effective_from DESC NULLS LAST, r.created_at DESC
      LIMIT 1;

      IF v_rate IS NULL THEN
        RAISE EXCEPTION 'Missing billing rate for timesheet %.', v_key USING ERRCODE = '23514';
      END IF;
      IF v_rate_currency IS NOT NULL AND upper(v_rate_currency) <> upper(NEW.currency) THEN
        RAISE EXCEPTION 'Timesheet % is billed in %, not %.', v_key, v_rate_currency, NEW.currency
          USING ERRCODE = '23514';
      END IF;

      SELECT w.total_hours,
             (
               SELECT count(*)::integer
               FROM jsonb_array_elements(COALESCE(w.data->'days', '[]'::jsonb)) d
               WHERE COALESCE(public.wg_safe_numeric(d->>'hours'), public.wg_safe_numeric(d->>'totalHours'), 0) > 0
             )
        INTO v_hours, v_days
      FROM wg_timesheet_weeks w
      WHERE w.project_id = NEW.project_id
        AND w.week_start = v_week
        AND w.user_id = v_uid
      LIMIT 1;

      IF v_rate_type = 'fixed' THEN
        v_qty := 1;
      ELSIF v_rate_type = 'daily' THEN
        v_qty := COALESCE(v_days, 0);
      ELSE
        v_qty := COALESCE(v_hours, 0);
      END IF;
      v_amount := public.wg_invoice_line_amount(v_qty, v_rate);
      v_subtotal := v_subtotal + v_amount;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'id', 'ts:' || v_key,
        'description', 'Approved hours ' || v_week::text,
        'quantity', v_qty,
        'unitPrice', v_rate,
        'amount', v_amount,
        'timesheetId', v_key
      ));

      IF NEW.status = 'issued' THEN
        SELECT i.invoice_number INTO v_conflict
        FROM wg_invoices i, unnest(COALESCE(i.timesheet_ids, ARRAY[]::text[])) other_key
        WHERE i.project_id = NEW.project_id
          AND i.id <> NEW.id
          AND i.status IN ('issued', 'partially_paid', 'paid', 'overdue')
          AND right(split_part(other_key, '@', 1), 10) = v_week::text
          AND public.wg_resolve_timesheet_person(
                NEW.project_id,
                left(split_part(other_key, '@', 1), length(split_part(other_key, '@', 1)) - 11)
              ) = v_uid
          AND (
            v_part IS NULL
            OR nullif(split_part(other_key, '@', 2), '') IS NULL
            OR nullif(split_part(other_key, '@', 2), '') = v_part
          )
        LIMIT 1;
        IF v_conflict IS NOT NULL THEN
          RAISE EXCEPTION 'Timesheet % is already billed on invoice %.', v_key, v_conflict
            USING ERRCODE = '23505';
        END IF;
      END IF;
    END LOOP;
    NEW.line_items := v_lines;
  ELSE
    FOR v_line IN
      SELECT value FROM jsonb_array_elements(COALESCE(NEW.line_items, '[]'::jsonb))
    LOOP
      v_unit := COALESCE(
        public.wg_safe_numeric(v_line->>'unitPrice'),
        public.wg_safe_numeric(v_line->>'unit_price'),
        0
      );
      v_amount := public.wg_invoice_line_amount(public.wg_safe_numeric(v_line->>'quantity'), v_unit);
      v_line := jsonb_set(v_line, '{amount}', to_jsonb(v_amount), true);
      v_lines := v_lines || jsonb_build_array(v_line);
      v_subtotal := v_subtotal + v_amount;
    END LOOP;
    NEW.line_items := v_lines;
  END IF;

  NEW.subtotal := round(v_subtotal, 2);
  NEW.tax_total := round(NEW.subtotal * COALESCE(NEW.tax_rate, 0) / 100, 2);
  NEW.total := NEW.subtotal + NEW.tax_total;

  IF NEW.status = 'issued' AND v_require_po AND NOT (
    EXISTS (
      SELECT 1 FROM wg_documents d
      WHERE d.project_id = NEW.project_id
        AND d.type = 'purchase_order'
        AND d.status = 'signed'
        AND (d.expires_at IS NULL OR d.expires_at > now())
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_graph->'nodes', '[]'::jsonb)) n
      WHERE n->>'type' = 'po'
        AND COALESCE(n->'data'->>'poNumber', n->'data'->>'po_number', '') <> ''
        AND COALESCE(n->'data'->>'status', n->'data'->>'poStatus', '') IN ('signed', 'active')
    )
  ) THEN
    RAISE EXCEPTION 'A signed purchase order is required before this invoice can be issued.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wg_check_invoice_can_issue() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_invoice_caller_controls_party(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_invoice_caller_controls_party(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_invoice_line_amount(numeric, numeric) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS wg_invoices_insert_access ON public.wg_invoices;
CREATE POLICY wg_invoices_insert_access
  ON public.wg_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.wg_invoice_caller_controls_party(project_id, from_party_id)
  );

CREATE OR REPLACE FUNCTION public.wg_create_invoice(p_invoice jsonb)
RETURNS public.wg_invoices
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.wg_invoices;
  v_timesheets text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to create an invoice.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(p_invoice->>'created_by', '') IS NOT NULL
     AND (p_invoice->>'created_by')::uuid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You cannot create an invoice for another user.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  INTO v_timesheets
  FROM jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(p_invoice->'timesheet_ids') = 'array' THEN p_invoice->'timesheet_ids'
      ELSE '[]'::jsonb
    END
  );

  INSERT INTO public.wg_invoices (
    project_id, template_id, invoice_number, from_party_id, to_party_id,
    from_party_name, to_party_name, from_address, to_address, tax_rate,
    from_tax_id, to_tax_id, from_iban, issue_date, due_date, delivery_date,
    currency, line_items, subtotal, tax_total, total, status, timesheet_ids,
    en16931_xml, pdf_url, payment_ref, notes, created_by
  ) VALUES (
    p_invoice->>'project_id',
    NULLIF(p_invoice->>'template_id', ''),
    p_invoice->>'invoice_number',
    p_invoice->>'from_party_id',
    p_invoice->>'to_party_id',
    NULLIF(p_invoice->>'from_party_name', ''),
    NULLIF(p_invoice->>'to_party_name', ''),
    NULLIF(p_invoice->>'from_address', ''),
    NULLIF(p_invoice->>'to_address', ''),
    COALESCE(public.wg_safe_numeric(p_invoice->>'tax_rate'), 0),
    NULLIF(p_invoice->>'from_tax_id', ''),
    NULLIF(p_invoice->>'to_tax_id', ''),
    NULLIF(p_invoice->>'from_iban', ''),
    COALESCE((p_invoice->>'issue_date')::date, CURRENT_DATE),
    (p_invoice->>'due_date')::date,
    NULLIF(p_invoice->>'delivery_date', '')::date,
    COALESCE(NULLIF(p_invoice->>'currency', ''), 'EUR'),
    COALESCE(p_invoice->'line_items', '[]'::jsonb),
    COALESCE(public.wg_safe_numeric(p_invoice->>'subtotal'), 0),
    COALESCE(public.wg_safe_numeric(p_invoice->>'tax_total'), 0),
    COALESCE(public.wg_safe_numeric(p_invoice->>'total'), 0),
    COALESCE(NULLIF(p_invoice->>'status', ''), 'draft'),
    v_timesheets,
    NULLIF(p_invoice->>'en16931_xml', ''),
    NULLIF(p_invoice->>'pdf_url', ''),
    NULLIF(p_invoice->>'payment_ref', ''),
    NULLIF(p_invoice->>'notes', ''),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.wg_create_invoice(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_create_invoice(jsonb) TO authenticated;

COMMIT;
