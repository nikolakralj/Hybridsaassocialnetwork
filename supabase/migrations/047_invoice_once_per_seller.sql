-- 047_invoice_once_per_seller.sql
-- Pass-through billing: an approved week is billed once per hop of the chain
-- (Sub bills Agency, Agency bills Client). The 035 issue check refused the
-- second invoice because it looked for the week on ANY live invoice in the
-- project. It now looks only at live invoices from the same seller party.
-- Checks 1 (approved week) and 2 (buyer is a party the seller bills) are
-- unchanged. NOT APPLIED.
--
-- Note for review: branch grok/p0-6-invoice-gate (041) replaces this trigger
-- with a server gate; whichever lands second must keep the per-seller scope.

BEGIN;

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
BEGIN
  IF NEW.status <> 'issued' OR (TG_OP = 'UPDATE' AND OLD.status = 'issued') THEN
    RETURN NEW;
  END IF;

  -- 2. The buyer is a party the seller bills.
  SELECT graph INTO v_graph FROM wg_projects WHERE id = NEW.project_id;
  IF NEW.from_party_id IS NULL OR NEW.to_party_id IS NULL OR NEW.from_party_id = NEW.to_party_id
     OR NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(v_graph->'edges', '[]'::jsonb)) e
       WHERE e->>'source' = NEW.from_party_id
         AND e->>'target' = NEW.to_party_id
         AND coalesce(e->'data'->>'edgeType', e->>'type') IN ('billsTo', 'subcontracts', 'bills_to')
     ) THEN
    RAISE EXCEPTION 'This invoice''s buyer is not a party the seller bills in this project. Check who bills whom on the project graph.'
      USING ERRCODE = '23514';
  END IF;

  FOREACH v_key IN ARRAY coalesce(NEW.timesheet_ids, ARRAY[]::text[]) LOOP
    v_base := split_part(v_key, '@', 1);
    v_part := nullif(split_part(v_key, '@', 2), '');
    IF v_base !~ ':[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Invoice timesheet key % is not a week.', v_key USING ERRCODE = '23514';
    END IF;
    v_person := left(v_base, length(v_base) - 11);
    v_week := right(v_base, 10)::date;
    v_uid := wg_resolve_timesheet_person(NEW.project_id, v_person);

    -- 1. The week exists in this project and is approved.
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

    -- 3. Not already on another live invoice from the same seller.
    SELECT i.invoice_number INTO v_conflict
    FROM wg_invoices i, unnest(coalesce(i.timesheet_ids, ARRAY[]::text[])) other_key
    WHERE i.project_id = NEW.project_id
      AND i.id <> NEW.id
      -- 047: once per SELLER. Pass-through billing puts the same approved
      -- week on the Sub->Agency invoice and on the Agency->Client invoice.
      AND i.from_party_id = NEW.from_party_id
      AND i.status IN ('issued', 'partially_paid', 'paid', 'overdue')
      AND right(split_part(other_key, '@', 1), 10) = v_week::text
      AND wg_resolve_timesheet_person(
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
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wg_check_invoice_can_issue() FROM PUBLIC, anon, authenticated;

COMMIT;
