import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import { Filter, RefreshCw, Search } from "lucide-react";
import { ApprovalTimeline } from "./ApprovalTimeline";
import type { UIApprovalItem } from "./ApprovalsWorkbench";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../ui/utils";

type WorkbenchStatus = "all" | "pending" | "approved" | "rejected";
type SortOrder = "newest" | "oldest" | "priority";

interface SubmissionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface SubmissionsViewProps {
  items: UIApprovalItem[];
  stats: SubmissionStats;
  loading: boolean;
  refreshing: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  sortBy: SortOrder;
  onSortByChange: (value: SortOrder) => void;
  statusFilter: WorkbenchStatus;
  onStatusFilterChange: (value: WorkbenchStatus) => void;
  onRefresh: () => void;
  onClearFilters: () => void;
  embedded?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const DESKTOP_COLUMNS = "grid-cols-[140px_minmax(0,1fr)_80px_120px_180px_120px]";
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function normalizeStatus(status: UIApprovalItem["status"]): "pending" | "approved" | "rejected" {
  if (status === "changes_requested") return "pending";
  return status;
}

function sanitizeDescriptor(value?: string | null): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized === "Unknown organization") return undefined;
  if (normalized === "Unknown person role") return undefined;
  return normalized;
}

function getPeriodLabel(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Unknown period";
  }
  return `${format(startDate, "MMM d")} \u2013 ${format(endDate, "MMM d")}`;
}

function getPeriodHeaderLabel(start: string): string {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return "Unknown period";
  return `Week of ${format(date, "MMM d, yyyy")}`;
}

function getRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const raw = formatDistanceToNowStrict(date, { addSuffix: true, roundingMethod: "floor" });
  if (/less than a minute/i.test(raw)) return "just now";

  const match = raw.match(/^(\d+)\s+([a-z]+)\s+ago$/i);
  if (!match) return raw;

  const amount = match[1];
  const unit = match[2].toLowerCase();
  const shorthand =
    unit.startsWith("minute") ? "m"
      : unit.startsWith("hour") ? "h"
        : unit.startsWith("day") ? "d"
          : unit.startsWith("week") ? "w"
            : unit.startsWith("month") ? "mo"
              : unit.startsWith("year") ? "y"
                : unit;

  return `${amount}${shorthand} ago`;
}

function getAbsoluteTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "PPpp");
}

function isPendingLaterLayer(item: UIApprovalItem): boolean {
  return normalizeStatus(item.status) === "pending" && (item.approvalTrail || []).some((entry) => entry.status === "approved");
}

function getStatusCopy(item: UIApprovalItem): { label: string; tone: "neutral" | "amber" | "emerald" | "rose" } {
  const normalized = normalizeStatus(item.status);
  if (normalized === "approved") return { label: "Approved", tone: "emerald" };
  if (normalized === "rejected") return { label: "Rejected", tone: "rose" };
  if (isPendingLaterLayer(item)) return { label: "In progress", tone: "amber" };
  return { label: "Pending", tone: "neutral" };
}

function StatusChip({ item }: { item: UIApprovalItem }) {
  const { label, tone } = getStatusCopy(item);
  const variant: "approvalPending" | "approvalInProgress" | "approvalApproved" | "approvalRejected" =
    tone === "amber"
      ? "approvalInProgress"
      : tone === "emerald"
        ? "approvalApproved"
        : tone === "rose"
          ? "approvalRejected"
          : "approvalPending";

  return (
    <Badge variant={variant} className="h-6 rounded-full px-2.5 text-xs font-medium">
      <span className="inline-block size-1.5 rounded-full bg-current" />
      <span>{label}</span>
    </Badge>
  );
}

function OverviewField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </p>
      <p className="m-0 mt-1 text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function DailyBreakdownGrid({ daySummary }: { daySummary: Array<{ day: string; hours: number }> | undefined }) {
  if (!daySummary || daySummary.length === 0) {
    return (
      <p className="m-0 text-sm text-muted-foreground">
        No daily breakdown captured for this submission.
      </p>
    );
  }

  const maxHours = Math.max(...daySummary.map((entry) => entry.hours), 1);

  return (
    <div className="grid grid-cols-5 gap-2">
      {WEEK_DAYS.map((day) => {
        const entry = daySummary.find((item) => item.day === day || item.day?.startsWith(day));
        const hours = entry?.hours ?? 0;
        const fillPct = maxHours > 0 ? Math.max((hours / maxHours) * 100, hours > 0 ? 24 : 0) : 0;

        return (
          <div key={day} className="rounded-lg border border-border/60 bg-muted/20 p-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {day}
              </span>
              <span className="text-xs font-medium text-foreground">{hours > 0 ? `${hours}h` : "\u2014"}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubmissionRow({
  item,
  index,
  active,
  onOpen,
  rowRef,
}: {
  item: UIApprovalItem;
  index: number;
  active: boolean;
  onOpen: (item: UIApprovalItem, index: number) => void;
  rowRef: (node: HTMLDivElement | null) => void;
}) {
  const periodLabel = getPeriodLabel(item.period.start, item.period.end);
  const submittedRelative = getRelativeTime(item.submittedAt);
  const submittedAbsolute = getAbsoluteTime(item.submittedAt);
  const showAmount = item.canViewRates && item.amount !== null;
  const waitingName = normalizeStatus(item.status) === "pending"
    ? sanitizeDescriptor(item.currentApproverName || item.partyName) || null
    : null;

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      aria-label={`Open submission for ${item.project.name}`}
      className={cn(
        "grid items-center gap-4 border-b border-border/50 px-4 py-2 text-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring",
        DESKTOP_COLUMNS,
        active && "bg-muted/60",
      )}
      onClick={() => {
        const selection = window.getSelection?.()?.toString().trim();
        if (selection) return;
        onOpen(item, index);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item, index);
        }
      }}
    >
      <div className="min-w-0">
        <div className="whitespace-nowrap font-medium text-foreground">{periodLabel}</div>
      </div>

      <div className="min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block max-w-[24ch] truncate font-medium text-foreground">
              {item.project.name}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{item.project.name}</TooltipContent>
        </Tooltip>
      </div>

      <div className="text-right font-medium text-foreground">
        {showAmount ? currencyFormatter.format(item.amount as number) : `${item.hours}h`}
      </div>

      <div>
        <StatusChip item={item} />
      </div>

      <div className="min-w-0">
        {waitingName ? (
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-[10px] font-semibold">
                {waitingName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm text-foreground">{waitingName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">{"\u2014"}</span>
        )}
      </div>

      <div className="text-right">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="whitespace-nowrap text-sm text-foreground">
              {submittedRelative}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{submittedAbsolute}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function SubmissionCard({
  item,
  index,
  active,
  onOpen,
  rowRef,
}: {
  item: UIApprovalItem;
  index: number;
  active: boolean;
  onOpen: (item: UIApprovalItem, index: number) => void;
  rowRef: (node: HTMLDivElement | null) => void;
}) {
  const showAmount = item.canViewRates && item.amount !== null;
  const waitingName = normalizeStatus(item.status) === "pending"
    ? sanitizeDescriptor(item.currentApproverName || item.partyName) || null
    : null;

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      className={cn(
        "rounded-xl border border-border/60 bg-background/90 p-4 text-sm shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring",
        active && "bg-muted/60",
      )}
      onClick={() => {
        const selection = window.getSelection?.()?.toString().trim();
        if (selection) return;
        onOpen(item, index);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item, index);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 font-medium text-foreground">{item.project.name}</p>
          <p className="m-0 mt-1 text-xs text-muted-foreground">
            {getPeriodLabel(item.period.start, item.period.end)}
          </p>
        </div>
        <StatusChip item={item} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="m-0 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">Total</p>
          <p className="m-0 mt-1 font-medium text-foreground">
            {showAmount ? currencyFormatter.format(item.amount as number) : `${item.hours}h`}
          </p>
        </div>

        <div className="text-right">
          <p className="m-0 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">Submitted</p>
          <p className="m-0 mt-1 font-medium text-foreground">{getRelativeTime(item.submittedAt)}</p>
        </div>

        <div className="col-span-2">
          <p className="m-0 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">Waiting on</p>
        {waitingName ? (
            <div className="mt-2 flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-[10px] font-semibold">
                  {waitingName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-foreground">{waitingName}</span>
            </div>
          ) : (
            <p className="m-0 mt-1 text-sm text-muted-foreground">{"\u2014"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SubmissionsView({
  items,
  stats,
  loading,
  refreshing,
  searchQuery,
  onSearchQueryChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortByChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  onClearFilters,
  embedded = false,
}: SubmissionsViewProps) {
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  const effectiveSortBy: Exclude<SortOrder, "priority"> = sortBy === "priority" ? "newest" : sortBy;
  const activeFilters =
    searchQuery.trim().length > 0 || typeFilter !== "all" || statusFilter !== "all" || effectiveSortBy !== "newest";

  const selectedSubmission = useMemo(
    () => items.find((item) => item.id === selectedSubmissionId) || null,
    [items, selectedSubmissionId],
  );

  const openSubmission = (item: UIApprovalItem, index: number) => {
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}${window.location.search}#submission/${item.id}`;
      window.history.replaceState(null, "", url);
    }

    setSelectedSubmissionId(item.id);
    setActiveRowIndex(index);
  };

  const closeSubmission = () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    setSelectedSubmissionId(null);
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncFromHash = () => {
      const match = window.location.hash.match(/^#submission\/([^/?#]+)/);
      setSelectedSubmissionId(match?.[1] ? decodeURIComponent(match[1]) : null);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    if (selectedSubmissionId) {
      const index = items.findIndex((item) => item.id === selectedSubmissionId);
      if (index >= 0) {
        setActiveRowIndex(index);
      }
    }
  }, [items, selectedSubmissionId]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveRowIndex(0);
      return;
    }

    setActiveRowIndex((current) => Math.min(current, items.length - 1));
  }, [items.length]);

  useEffect(() => {
    if (selectedSubmission) return;
    const row = rowRefs.current[activeRowIndex];
    row?.focus();
  }, [activeRowIndex, selectedSubmission]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTypingField) return;

      if (event.key === "Escape" && selectedSubmission) {
        event.preventDefault();
        closeSubmission();
        return;
      }

      if (selectedSubmission) return;
      if (items.length === 0) return;

      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        setActiveRowIndex((current) => {
          const nextIndex = event.key === "j"
            ? Math.min(current + 1, items.length - 1)
            : Math.max(current - 1, 0);
          rowRefs.current[nextIndex]?.focus();
          return nextIndex;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSubmission, items.length, selectedSubmission]);

  const emptyState = stats.total === 0;
  const filteredEmpty = !emptyState && items.length === 0;

  const statusPills: Array<{ value: WorkbenchStatus; label: string }> = [
    { value: "all", label: `All (${stats.total})` },
    { value: "pending", label: `Pending (${stats.pending})` },
    { value: "approved", label: `Approved (${stats.approved})` },
    { value: "rejected", label: `Rejected (${stats.rejected})` },
  ];

  const formatStatusHint = () => {
    if (statusFilter === "pending") return "Showing pending submissions and items already in progress.";
    if (statusFilter === "approved") return "Showing completed submissions only.";
    if (statusFilter === "rejected") return "Showing rejected submissions only.";
    return "Showing the full audit trail for submitted work.";
  };

  const clearAllFilters = () => {
    onClearFilters();
  };

  return (
    <div className={cn("space-y-4", embedded ? "space-y-4" : "space-y-5")}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className={cn("m-0 tracking-tight text-foreground", embedded ? "text-xl font-semibold" : "text-2xl font-semibold")}>
            {embedded ? "My submissions" : "Submission history"}
          </h2>
          <p className="mt-1 mb-0 text-sm text-muted-foreground">
            Audit trail of items you've submitted. Decisions, approvers, and timestamps are preserved.
          </p>
        </div>
        <Badge variant="outline" className="self-start rounded-full px-3">
          {items.length} result{items.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusPills.map((pill) => {
          const isActive = statusFilter === pill.value;
          return (
            <Button
              key={pill.value}
              size="sm"
              variant={isActive ? "default" : "outline"}
              onClick={() => onStatusFilterChange(pill.value)}
              className="h-8 rounded-full px-4"
            >
              {pill.label}
            </Button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">{formatStatusHint()}</span>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search by person, project, or type"
            className="h-10 pl-9"
          />
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-[repeat(3,minmax(0,1fr))]">
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger className="h-10 w-full min-w-0 text-sm xl:min-w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="timesheet">Timesheets</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
            </SelectContent>
          </Select>

          <Select value={effectiveSortBy} onValueChange={(value) => onSortByChange(value as SortOrder)}>
            <SelectTrigger className="h-10 w-full min-w-0 text-sm xl:min-w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={onRefresh} className="h-10 w-full gap-1.5">
            {refreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {activeFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filters active</span>
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="ml-auto h-8 px-3">
            Clear filters
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/80 py-20 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Loading submissions...
        </div>
      ) : emptyState ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/80 px-4 py-14 text-center sm:px-6">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
            <h3 className="m-0 text-base font-semibold text-foreground">You haven't submitted anything yet.</h3>
            <p className="m-0 text-sm text-muted-foreground">
              Once you submit a timesheet or other approval item, it will appear here with the full decision trail.
            </p>
            <Button
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("changeTab", { detail: "timesheets" }));
                }
              }}
            >
              Go to the Timesheets tab
            </Button>
          </div>
        </div>
      ) : filteredEmpty ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/80 px-4 py-12 text-center sm:px-6">
          <p className="m-0 text-base font-semibold text-foreground">No submissions match your filters.</p>
          <p className="mx-auto mt-2 mb-0 max-w-xl text-sm text-muted-foreground">
            Try a broader search or clear the filters to see the full audit trail again.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" onClick={clearAllFilters}>
              Clear filters
            </Button>
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-background/90">
            <div className={cn("hidden items-center gap-4 border-b border-border/60 px-4 py-2 xl:grid", DESKTOP_COLUMNS)}>
              <div className="text-xs font-medium text-muted-foreground">Period</div>
              <div className="text-xs font-medium text-muted-foreground">Project</div>
              <div className="text-right text-xs font-medium text-muted-foreground">Total</div>
              <div className="text-xs font-medium text-muted-foreground">Status</div>
              <div className="text-xs font-medium text-muted-foreground">Waiting on</div>
              <div className="text-right text-xs font-medium text-muted-foreground">Submitted</div>
            </div>

            <div className="hidden xl:block">
              {items.map((item, index) => (
                <SubmissionRow
                  key={item.id}
                  item={item}
                  index={index}
                  active={index === activeRowIndex && !selectedSubmission}
                  onOpen={openSubmission}
                  rowRef={(node) => {
                    rowRefs.current[index] = node;
                  }}
                />
              ))}
            </div>

            <div className="space-y-3 p-4 xl:hidden">
              {items.map((item, index) => (
                <SubmissionCard
                  key={item.id}
                  item={item}
                  index={index}
                  active={index === activeRowIndex && !selectedSubmission}
                  onOpen={openSubmission}
                  rowRef={(node) => {
                    rowRefs.current[index] = node;
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <Sheet open={Boolean(selectedSubmission)} onOpenChange={(open) => !open && closeSubmission()}>
        <SheetContent
          side="right"
          className="w-[480px] max-w-none overflow-y-auto sm:w-[540px] sm:max-w-none"
        >
          {selectedSubmission ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border/60 px-6 pb-5 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-xl">
                      {selectedSubmission.project.name}
                    </SheetTitle>
                    <SheetDescription className="mt-2 text-sm text-muted-foreground">
                      {getPeriodHeaderLabel(selectedSubmission.period.start)} {"\u00b7"} {selectedSubmission.hours}h {"\u00b7"} Submitted{" "}
                      {getRelativeTime(selectedSubmission.submittedAt)}
                    </SheetDescription>
                  </div>

                  <StatusChip item={selectedSubmission} />
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-5 px-6 py-6">
                <section className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
                  <h4 className="m-0 text-sm font-semibold text-foreground">Overview</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <OverviewField label="Submitter" value={selectedSubmission.person.name} />
                    <OverviewField label="Project" value={selectedSubmission.project.name} />
                    <OverviewField
                      label="Period"
                      value={getPeriodLabel(selectedSubmission.period.start, selectedSubmission.period.end)}
                    />
                    <OverviewField label="Total hours" value={`${selectedSubmission.hours}h`} />
                    {selectedSubmission.canViewRates && selectedSubmission.amount !== null ? (
                      <OverviewField
                        label="Amount"
                        value={currencyFormatter.format(selectedSubmission.amount)}
                      />
                    ) : null}
                    <OverviewField label="Submitted at" value={getAbsoluteTime(selectedSubmission.submittedAt)} />
                  </div>
                </section>

                {selectedSubmission.objectType === "timesheet" ? (
                  <section className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
                    <h4 className="m-0 text-sm font-semibold text-foreground">Daily breakdown</h4>
                    <DailyBreakdownGrid daySummary={selectedSubmission.subjectSnapshot?.daySummary} />
                  </section>
                ) : null}

                <section className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
                  <h4 className="m-0 text-sm font-semibold text-foreground">Approval timeline</h4>
                  <ApprovalTimeline
                    submitterName={selectedSubmission.person.name}
                    submittedAt={selectedSubmission.submittedAt}
                    status={selectedSubmission.status}
                    approvalTrail={selectedSubmission.approvalTrail}
                    currentApproverName={sanitizeDescriptor(selectedSubmission.currentApproverName || selectedSubmission.partyName)}
                    submitterOrg={sanitizeDescriptor(selectedSubmission.submitterOrg || selectedSubmission.person.role)}
                    routeLabel={sanitizeDescriptor(selectedSubmission.routeLabel)}
                  />
                </section>
              </div>

              <SheetFooter className="border-t border-border/60 px-6 py-4">
                <Button className="w-full" onClick={closeSubmission}>
                  Close
                </Button>
              </SheetFooter>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
