import { useMemo } from "react";
import { Check, Clock3, UserRound, XCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { cn } from "../ui/utils";
import type { UIApprovalItem } from "./ApprovalsWorkbench";

interface ApprovalPathSheetProps {
  open: boolean;
  onClose: () => void;
  item: UIApprovalItem | null;
}

type RouteStatus = "approved" | "current" | "waiting" | "rejected" | "changes_requested";

interface RouteStep {
  step: number;
  partyName?: string;
  approverName: string;
  status: RouteStatus;
  decidedAt?: string;
  notes?: string;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value?: string): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : dateFormatter.format(date);
}

function formatDateTime(value?: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : dateTimeFormatter.format(date);
}

function formatCurrency(amount: number, currency?: string): string {
  const normalizedCurrency = currency && /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : "EUR";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: normalizedCurrency,
  }).format(amount);
}

function statusLabel(status: RouteStatus): string {
  if (status === "approved") return "Approved";
  if (status === "current") return "Current";
  if (status === "rejected") return "Rejected";
  if (status === "changes_requested") return "Changes requested";
  return "Waiting";
}

function statusClasses(status: RouteStatus): string {
  return cn(
    "border-transparent",
    status === "approved" && "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
    status === "current" && "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    status === "waiting" && "bg-muted text-muted-foreground",
    status === "rejected" && "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
    status === "changes_requested" && "bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-200",
  );
}

function PathDot({ status, step }: { status: RouteStatus; step: number }) {
  return (
    <div
      className={cn(
        "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
        status === "approved" && "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
        status === "current" && "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
        status === "waiting" && "border-border bg-muted text-muted-foreground",
        status === "rejected" && "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
        status === "changes_requested" && "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
      )}
    >
      {status === "approved" ? <Check className="size-4" /> : status === "rejected" ? <XCircle className="size-4" /> : step}
    </div>
  );
}

export function ApprovalPathSheet({ open, onClose, item }: ApprovalPathSheetProps) {
  const routeSteps = useMemo<RouteStep[]>(() => {
    if (!item) return [];

    const trailByLayer = new Map(
      (item.approvalTrail || []).map((entry) => [entry.approvalLayer, entry]),
    );
    const snapshotRoute = [...(item.subjectSnapshot?.approvalRoute || [])].sort((left, right) => left.step - right.step);

    if (snapshotRoute.length === 0) {
      return (item.approvalTrail || []).map((entry) => ({
        step: entry.approvalLayer,
        approverName: entry.approverName,
        status:
          entry.status === "approved"
            ? "approved"
            : entry.status === "rejected"
              ? "rejected"
              : entry.status === "changes_requested"
                ? "changes_requested"
                : entry.approvalLayer === item.stepOrder
                  ? "current"
                  : "waiting",
        decidedAt: entry.decidedAt,
        notes: entry.notes,
      }));
    }

    return snapshotRoute.map((step) => {
      const trail = trailByLayer.get(step.step);
      const canNameAssignee = step.step <= item.stepOrder + 1;
      let status: RouteStatus = "waiting";

      if (trail?.status === "approved" || step.step < item.stepOrder) status = "approved";
      if (trail?.status === "rejected") status = "rejected";
      if (trail?.status === "changes_requested") status = "changes_requested";
      if (step.step === item.stepOrder && item.status === "pending") status = "current";
      if (step.step === item.stepOrder && item.status === "approved") status = "approved";
      if (step.step === item.stepOrder && item.status === "rejected") status = "rejected";
      if (step.step === item.stepOrder && item.status === "changes_requested") status = "changes_requested";

      return {
        step: step.step,
        partyName: canNameAssignee ? step.partyName : undefined,
        approverName: canNameAssignee ? step.approverName : "Later approver",
        status,
        decidedAt: trail?.decidedAt,
        notes: trail?.notes,
      };
    });
  }, [item]);

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/70 px-6 pb-5 pt-6 text-left">
          <p className="m-0 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Approval path</p>
          <SheetTitle className="text-xl">{item.person.name}</SheetTitle>
          <SheetDescription>
            {item.project.name} - {formatDate(item.period.start)} to {formatDate(item.period.end)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 px-6 py-6">
          <section className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
            <div>
              <p className="m-0 text-xs text-muted-foreground">Hours</p>
              <p className="m-0 mt-1 font-semibold">{item.hours}h</p>
            </div>
            <div>
              <p className="m-0 text-xs text-muted-foreground">Submitted</p>
              <p className="m-0 mt-1 font-medium">{formatDateTime(item.submittedAt)}</p>
            </div>
            <div>
              <p className="m-0 text-xs text-muted-foreground">Status</p>
              <Badge className={cn("mt-1", statusClasses(item.status === "pending" ? "current" : item.status))}>
                {item.status === "pending" ? "Pending" : statusLabel(item.status)}
              </Badge>
            </div>
            {item.canViewRates && item.amount !== null ? (
              <div>
                <p className="m-0 text-xs text-muted-foreground">Amount</p>
                <p className="m-0 mt-1 font-semibold">
                  {formatCurrency(item.amount, item.subjectSnapshot?.currency)}
                </p>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="approval-route-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 id="approval-route-heading" className="m-0 text-sm font-semibold">Decision route</h3>
                <p className="m-0 mt-1 text-xs text-muted-foreground">Recorded actors and the direct next assignee only.</p>
              </div>
              <Badge variant="outline">{routeSteps.length} {routeSteps.length === 1 ? "step" : "steps"}</Badge>
            </div>

            <div>
              <div className="flex gap-3">
                <div className="flex w-7 shrink-0 flex-col items-center">
                  <div className="mt-1 flex size-7 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <UserRound className="size-4" />
                  </div>
                  {routeSteps.length > 0 ? <div className="min-h-8 w-px flex-1 bg-border" /> : null}
                </div>
                <div className="min-w-0 pb-5">
                  <p className="m-0 text-sm font-semibold">Submitted by {item.person.name}</p>
                  <p className="m-0 mt-0.5 text-xs text-muted-foreground">{item.submitterOrg || item.person.role}</p>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">{formatDateTime(item.submittedAt)}</p>
                </div>
              </div>

              {routeSteps.map((step, index) => (
                <div key={`${step.step}-${step.approverName}`} className="flex gap-3">
                  <div className="flex w-7 shrink-0 flex-col items-center">
                    <PathDot status={step.status} step={step.step} />
                    {index < routeSteps.length - 1 ? <div className="min-h-8 w-px flex-1 bg-border" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-semibold">{step.approverName}</p>
                        <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                          Step {step.step}{step.partyName ? ` - ${step.partyName}` : ""}
                        </p>
                      </div>
                      <Badge className={statusClasses(step.status)}>{statusLabel(step.status)}</Badge>
                    </div>
                    {step.decidedAt ? <p className="m-0 mt-1 text-xs text-muted-foreground">{formatDateTime(step.decidedAt)}</p> : null}
                    {step.notes ? <p className="m-0 mt-2 text-xs italic text-muted-foreground">&quot;{step.notes}&quot;</p> : null}
                  </div>
                </div>
              ))}

              {routeSteps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No approval route was recorded for this submission.
                </div>
              ) : null}
            </div>
          </section>

          {item.gating.blocked && item.gating.reasons.length > 0 ? (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold">
                <Clock3 className="size-4" />
                Approval blocked
              </div>
              <p className="m-0 mt-2">{item.gating.reasons.join(" - ")}</p>
            </section>
          ) : null}
        </div>

        <SheetFooter className="sticky bottom-0 border-t border-border/70 bg-background/95 px-6 py-4 backdrop-blur">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
