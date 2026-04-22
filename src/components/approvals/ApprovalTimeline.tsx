import { useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../ui/utils";

export interface ApprovalTrailEntry {
  approvalLayer: number;
  approverName: string;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  submittedAt?: string;
  decidedAt?: string;
  notes?: string;
}

export interface ApprovalTimelineProps {
  submitterName: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  approvalTrail?: ApprovalTrailEntry[];
  currentApproverName?: string;
  submitterOrg?: string;
  routeLabel?: string;
}

type TimelineState = "done" | "current" | "pending" | "error";

interface TimelineNode {
  key: string;
  label: string;
  subtitle?: string;
  timestamp?: string;
  notes?: string;
  state: TimelineState;
}

function normalizeStatus(status: ApprovalTrailEntry["status"]): "pending" | "approved" | "rejected" {
  if (status === "changes_requested") return "pending";
  return status;
}

function formatRelative(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true });
}

function formatAbsolute(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "PPpp");
}

function StateDot({ state }: { state: TimelineState }) {
  const className = cn(
    "mt-1 size-2.5 shrink-0 rounded-full",
    state === "done" && "bg-emerald-500",
    state === "current" && "bg-amber-500",
    state === "pending" && "bg-muted border border-border",
    state === "error" && "bg-rose-500",
  );

  return <div className={className} />;
}

function TimelineNodeView({ node, isLast }: { node: TimelineNode; isLast: boolean }) {
  const relative = formatRelative(node.timestamp);
  const absolute = formatAbsolute(node.timestamp);

  return (
    <div className="flex gap-3">
      <div className="flex w-5 shrink-0 flex-col items-center">
        <StateDot state={node.state} />
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>

      <div className="min-w-0 pb-4">
        <p className={cn(
          "m-0 text-sm font-semibold",
          node.state === "current" && "text-amber-700 dark:text-amber-300",
          node.state === "error" && "text-rose-700 dark:text-rose-300",
        )}>
          {node.label}
        </p>

        {node.subtitle ? (
          <p className="m-0 mt-0.5 text-xs text-muted-foreground">
            {node.subtitle}
          </p>
        ) : null}

        {relative ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="m-0 mt-1 inline-flex cursor-default items-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {relative}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              {absolute}
            </TooltipContent>
          </Tooltip>
        ) : null}

        {node.notes ? (
          <p className="m-0 mt-1 text-xs italic text-muted-foreground">
            "{node.notes}"
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ApprovalTimeline({
  submitterName,
  submittedAt,
  status,
  approvalTrail,
  currentApproverName,
  submitterOrg,
  routeLabel,
}: ApprovalTimelineProps) {
  const nodes = useMemo(() => {
    const sortedTrail = [...(approvalTrail || [])].sort((left, right) => {
      if (left.approvalLayer !== right.approvalLayer) {
        return left.approvalLayer - right.approvalLayer;
      }
      return (left.decidedAt || left.submittedAt || "").localeCompare(right.decidedAt || right.submittedAt || "");
    });

    const timelineNodes: TimelineNode[] = [
      {
        key: "submitted",
        label: `Submitted by ${submitterName}`,
        subtitle: submitterOrg || undefined,
        timestamp: submittedAt,
        state: "done",
      },
    ];

    sortedTrail.forEach((entry, index) => {
      const normalizedStatus = normalizeStatus(entry.status);
      const isTerminalRejected = normalizedStatus === "rejected";

        timelineNodes.push({
          key: `${entry.approvalLayer}-${entry.approverName}-${index}`,
          label:
            normalizedStatus === "approved"
              ? `Approved by ${entry.approverName}`
              : isTerminalRejected
                ? `Rejected by ${entry.approverName}`
                : `Pending with ${entry.approverName}`,
          subtitle:
            normalizedStatus === "approved"
              ? routeLabel || `Step ${entry.approvalLayer}`
              : isTerminalRejected
                ? routeLabel || "Decision recorded"
                : routeLabel || "Current step",
          timestamp: entry.decidedAt || entry.submittedAt,
          notes: entry.notes,
          state:
          normalizedStatus === "approved"
            ? "done"
            : isTerminalRejected
              ? "error"
              : "current",
      });
    });

    const hasPendingTrail = sortedTrail.some((entry) => normalizeStatus(entry.status) === "pending");
    if (status === "pending" && currentApproverName && !hasPendingTrail) {
      timelineNodes.push({
        key: "awaiting",
        label: `Awaiting: ${currentApproverName}`,
        subtitle: "Current step",
        state: "pending",
      });
    }

    return timelineNodes;
  }, [approvalTrail, currentApproverName, status, submittedAt, submitterName]);

  if (nodes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {nodes.map((node, index) => (
        <TimelineNodeView
          key={node.key}
          node={node}
          isLast={index === nodes.length - 1}
        />
      ))}
    </div>
  );
}
