-- 047_invoice_hop_pricing_once_per_seller.sql
-- Pass-through billing on top of 041 (grok/p0-6 server invoice gate).
-- REQUIRES 041 and 044. NOT APPLIED.
--
-- 041 prices every timesheet line from the worker's single bill rate
-- (wg_contract_rates) and refuses a week already on ANY live invoice of the
-- project. With per-link rates (044) a week is billed once per hop:
-- Sub -> Agency at the sub's link rate, Agency -> Client at the client rate.
-- This replaces 041's trigger function with the same function plus:
--   * the line rate comes from wg_link_rates for this seller -> buyer link
--     (worker-specific rate first, then the link's general rate); the legacy
--     per-person bill rate applies only on the final hop (buyer bills nobody),
--     so projects without link rates price exactly as under 041;
--   * "already billed" looks only at live invoices from the same seller.
-- And it lets a party's own decision-makers (044 wg_user_is_party_commercial:
-- Owner/Editor or approver scoped to that party, or its org admin/finance/
-- manager/approver) create invoices FROM their party, so the Sub can issue
-- Sub -> Agency. POLICY CHOICE for Nikola: 041 allowed only Owner/Editor of
-- the party or org admin/finance, and #19 makes other companies' approvers
-- Commenters, so without this nobody at the Sub could invoice.
--
-- Everything else in 041's function (approved-week check, duplicate keys,
-- month parts, recomputed totals, purchase-order gate) is unchanged.

BEGIN;

DO $guard$
BEGIN
  IF to_regprocedure('public.wg_invoice_line_amount(numeric,numeric)') IS NULL
     OR to_regprocedure('public.wg_invoice_caller_controls_party(text,text)') IS NULL THEN
    RAISE EXCEPTION '047 needs migration 041 (grok/p0-6-invoice-gate) applied first';
  END IF;
  IF to_regprocedure('public.wg_user_is_party_commercial(text,text)') IS NULL THEN
    RAISE EXCEPTION '047 needs migration 044 (link rates) applied first';
  END IF;
END
$guard$;

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
    OR public.wg_user_is_party_commercial(p_project_id, p_party_id)
  );
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
  v_po_ok boolean;
  v_node text;
  v_final_hop boolean;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('issued', 'paid', 'partially_paid', 'overdue') THEN
    RETURN NEW;
  END IF;

  -- Who may write wg_invoices is enforced by RLS (wg_invoices_insert_access /
  -- wg_invoices_update_access) and, on the app's path, by wg_create_invoice.
  -- This trigger enforces facts about the invoice itself, regardless of who
  -- (or what role, including service_role) is writing it.

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
    -- Two keys in the same invoice must not name the same week, even when one
    -- spells the person as an auth uid and the other as a graph node id, or
    -- one is the whole week and the other is a month part of it. Comparing
    -- raw text (exact duplicates) is not enough.
    IF EXISTS (
      SELECT 1
      FROM unnest(NEW.timesheet_ids) WITH ORDINALITY AS a(key_a, ord_a)
      JOIN unnest(NEW.timesheet_ids) WITH ORDINALITY AS b(key_b, ord_b)
        ON a.ord_a < b.ord_b
      WHERE right(split_part(a.key_a, '@', 1), 10) = right(split_part(b.key_b, '@', 1), 10)
        AND public.wg_resolve_timesheet_person(
              NEW.project_id,
              left(split_part(a.key_a, '@', 1), length(split_part(a.key_a, '@', 1)) - 11)
            ) = public.wg_resolve_timesheet_person(
              NEW.project_id,
              left(split_part(b.key_b, '@', 1), length(split_part(b.key_b, '@', 1)) - 11)
            )
        AND (
          nullif(split_part(a.key_a, '@', 2), '') IS NULL
          OR nullif(split_part(b.key_b, '@', 2), '') IS NULL
          OR nullif(split_part(a.key_a, '@', 2), '') = nullif(split_part(b.key_b, '@', 2), '')
        )
    ) THEN
      RAISE EXCEPTION 'This invoice lists the same timesheet week more than once.'
        USING ERRCODE = '23514';
    END IF;

    FOREACH v_key IN ARRAY NEW.timesheet_ids LOOP
      v_base := split_part(v_key, '@', 1);
      v_part := nullif(split_part(v_key, '@', 2), '');
      IF v_base !~ ':[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RAISE EXCEPTION 'Invoice timesheet key % is not a week.', v_key USING ERRCODE = '23514';
      END IF;
      v_person := left(v_base, length(v_base) - 11);
      v_week := right(v_base, 10)::date;
      IF v_part IS NOT NULL AND (
        v_part !~ '^[0-9]{4}-[0-9]{2}$'
        OR v_part < to_char(v_week, 'YYYY-MM')
        OR v_part > to_char((v_week + 6), 'YYYY-MM')
      ) THEN
        RAISE EXCEPTION 'Invoice timesheet key % is not a month of this week.', v_key USING ERRCODE = '23514';
      END IF;
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

      -- 047: price the hop this invoice is for (seller -> buyer). A rate on
      -- that link for this worker wins, then the link's general rate. The
      -- legacy per-person bill rate (wg_contract_rates) prices only the final
      -- hop (the buyer bills nobody), as before 044.
      v_rate := NULL; v_rate_type := NULL; v_rate_currency := NULL;
      SELECT m.graph_node_id INTO v_node
      FROM wg_project_members m
      WHERE m.project_id = NEW.project_id AND v_uid IS NOT NULL AND m.user_id = v_uid
      ORDER BY m.accepted_at DESC NULLS LAST
      LIMIT 1;
      IF to_regclass('public.wg_link_rates') IS NOT NULL THEN
        SELECT lr.amount, lr.rate_type, lr.currency
          INTO v_rate, v_rate_type, v_rate_currency
        FROM wg_link_rates lr
        WHERE lr.project_id = NEW.project_id
          AND lr.link_kind = 'supply'
          AND lr.seller_party_id = NEW.from_party_id
          AND lr.buyer_party_id = NEW.to_party_id
          AND lr.amount > 0
          AND (lr.effective_from IS NULL OR lr.effective_from <= v_week)
          AND (lr.effective_to IS NULL OR lr.effective_to >= v_week)
          AND (
            (lr.subject_graph_node_id IS NULL AND lr.subject_user_id IS NULL)
            OR lr.subject_graph_node_id IN (v_person, v_node)
            OR (v_uid IS NOT NULL AND lr.subject_user_id = v_uid)
          )
        ORDER BY (lr.subject_graph_node_id IS NULL AND lr.subject_user_id IS NULL),
                 lr.effective_from DESC NULLS LAST, lr.created_at DESC
        LIMIT 1;
      END IF;

      v_final_hop := NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(v_graph->'edges', '[]'::jsonb)) e
        WHERE e->>'source' = NEW.to_party_id
          AND COALESCE(e->'data'->>'edgeType', e->>'type') IN ('billsTo', 'subcontracts', 'bills_to')
      );
      IF v_rate IS NULL AND v_final_hop THEN
        SELECT r.amount, r.rate_type, r.currency
          INTO v_rate, v_rate_type, v_rate_currency
        FROM wg_contract_rates r
        WHERE r.project_id = NEW.project_id
          AND r.rate_scope = 'bill'
          AND r.amount > 0
          AND (r.effective_from IS NULL OR r.effective_from <= v_week)
          AND (r.effective_to IS NULL OR r.effective_to >= v_week)
          AND (
            r.subject_graph_node_id = v_person
            OR (v_uid IS NOT NULL AND (r.subject_user_id = v_uid OR r.subject_graph_node_id = v_uid::text))
          )
        ORDER BY r.effective_from DESC NULLS LAST, r.created_at DESC
        LIMIT 1;
      END IF;

      IF v_rate IS NULL THEN
        RAISE EXCEPTION 'Missing billing rate for timesheet %.', v_key USING ERRCODE = '23514';
      END IF;
      IF v_rate_currency IS NOT NULL AND upper(v_rate_currency) <> upper(NEW.currency) THEN
        RAISE EXCEPTION 'Timesheet % is billed in %, not %.', v_key, v_rate_currency, NEW.currency
          USING ERRCODE = '23514';
      END IF;

      -- A key ending in @YYYY-MM bills only the days in that month.
      SELECT COALESCE(sum(slice.hours), 0),
             COALESCE(count(*) FILTER (WHERE slice.hours > 0), 0)::integer
        INTO v_hours, v_days
      FROM wg_timesheet_weeks w
      CROSS JOIN LATERAL (
        SELECT COALESCE(public.wg_safe_numeric(d->>'hours'), public.wg_safe_numeric(d->>'totalHours'), 0) AS hours,
               (v_week + (
                 CASE lower(trim(COALESCE(d->>'day', '')))
                   WHEN 'mon' THEN 0 WHEN 'monday' THEN 0
                   WHEN 'tue' THEN 1 WHEN 'tues' THEN 1 WHEN 'tuesday' THEN 1
                   WHEN 'wed' THEN 2 WHEN 'wednesday' THEN 2
                   WHEN 'thu' THEN 3 WHEN 'thur' THEN 3 WHEN 'thurs' THEN 3 WHEN 'thursday' THEN 3
                   WHEN 'fri' THEN 4 WHEN 'friday' THEN 4
                   WHEN 'sat' THEN 5 WHEN 'saturday' THEN 5
                   WHEN 'sun' THEN 6 WHEN 'sunday' THEN 6
                   ELSE (day_ord.ordinality - 1)::integer
                 END
               ))::date AS day_date
        FROM jsonb_array_elements(COALESCE(w.data->'days', '[]'::jsonb)) WITH ORDINALITY AS day_ord(d, ordinality)
      ) slice
      WHERE w.project_id = NEW.project_id
        AND w.week_start = v_week
        AND w.user_id = v_uid
        AND (v_part IS NULL OR to_char(slice.day_date, 'YYYY-MM') = v_part);

      IF v_part IS NULL THEN
        SELECT w.total_hours INTO v_hours
        FROM wg_timesheet_weeks w
        WHERE w.project_id = NEW.project_id
          AND w.week_start = v_week
          AND w.user_id = v_uid
        LIMIT 1;
      END IF;

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

      IF NEW.status IN ('issued', 'paid', 'partially_paid', 'overdue') THEN
        -- Hold this week (not just this month-part) until the insert commits,
        -- so a whole-week issue and a month-part issue of the same week
        -- cannot both pass the check before either row is visible.
        PERFORM pg_advisory_xact_lock(hashtextextended(
          NEW.project_id || ':' || COALESCE(v_uid::text, v_person) || ':' || v_week::text,
          0
        ));
        SELECT i.invoice_number INTO v_conflict
        FROM wg_invoices i, unnest(COALESCE(i.timesheet_ids, ARRAY[]::text[])) other_key
        WHERE i.project_id = NEW.project_id
          AND i.id <> NEW.id
          AND i.status IN ('issued', 'partially_paid', 'paid', 'overdue')
          -- 047: once per seller. Sub->Agency and Agency->Client may both bill the week.
          AND i.from_party_id = NEW.from_party_id
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
          RAISE EXCEPTION 'Timesheet % is already billed by this seller on invoice %.', v_key, v_conflict
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

  IF v_require_po AND NEW.status IN ('issued', 'paid', 'partially_paid', 'overdue') THEN
    v_po_ok := false;

    -- wg_documents may not exist on every deployment yet; a PO signed there is
    -- one way to satisfy the gate, not a hard dependency of this trigger.
    IF to_regclass('public.wg_documents') IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM wg_documents d
        WHERE d.project_id = NEW.project_id
          AND d.type = 'purchase_order'
          AND d.status = 'signed'
          AND (d.expires_at IS NULL OR d.expires_at > now())
          AND (
            (d.from_party = NEW.from_party_id AND d.to_party = NEW.to_party_id)
            OR (d.from_party = NEW.to_party_id AND d.to_party = NEW.from_party_id)
          )
          AND (
            COALESCE(d.data->>'workerId', d.data->>'personId', d.data->>'subjectGraphNodeId', '') = ''
            OR COALESCE(d.data->>'workerId', d.data->>'personId', d.data->>'subjectGraphNodeId') IN (
              SELECT left(split_part(k, '@', 1), length(split_part(k, '@', 1)) - 11)
              FROM unnest(COALESCE(NEW.timesheet_ids, ARRAY[]::text[])) k
            )
          )
      ) INTO v_po_ok;
    END IF;

    IF NOT v_po_ok THEN
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(v_graph->'nodes', '[]'::jsonb)) n
        WHERE n->>'type' = 'po'
          AND COALESCE(n->'data'->>'poNumber', n->'data'->>'po_number', '') <> ''
          AND COALESCE(n->'data'->>'status', n->'data'->>'poStatus', '') IN ('signed', 'active')
          AND COALESCE(n->'data'->>'partyId', n->'data'->>'orgId', n->'data'->>'fromPartyId', '') IN (NEW.from_party_id, NEW.to_party_id)
          AND (
            COALESCE(n->'data'->>'workerId', n->'data'->>'personId', n->'data'->>'subjectGraphNodeId', '') = ''
            OR COALESCE(n->'data'->>'workerId', n->'data'->>'personId', n->'data'->>'subjectGraphNodeId') IN (
              SELECT left(split_part(k, '@', 1), length(split_part(k, '@', 1)) - 11)
              FROM unnest(COALESCE(NEW.timesheet_ids, ARRAY[]::text[])) k
            )
          )
      ) INTO v_po_ok;
    END IF;

    IF NOT v_po_ok THEN
      RAISE EXCEPTION 'A signed purchase order is required before this invoice can be issued.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wg_check_invoice_can_issue() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wg_invoice_caller_controls_party(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wg_invoice_caller_controls_party(text, text) TO authenticated;

COMMIT;
