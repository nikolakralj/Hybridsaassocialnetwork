-- Close readiness: a purchase order blocks invoice-ready only when the
-- project opts in. Existing projects stay off, so a missing PO or a failed
-- document read does not stop the month close.

ALTER TABLE public.wg_projects
  ADD COLUMN IF NOT EXISTS require_purchase_order BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.wg_projects.require_purchase_order IS
  'When true, close readiness requires a usable purchase order linked to the worker or their organization. Off by default.';
