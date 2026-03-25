import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import {
  approveItem,
  bulkApprove,
  getApprovalQueue,
  rejectItem,
  type ApprovalQueueFilters,
} from "../../utils/api/approvals-supabase";
import { GraphOverlayModal } from "./GraphOverlayModal";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";

export interface UIApprovalItem {
  id: string;
  objectType: "timesheet" | "expense" | "invoice" | "contract" | "deliverable" | string;
  project: {
    id: string;
    name: string;
  };
  stepOrder: number;
  totalSteps: number;
  policyVersion: number;
  partyId: string;
  partyName: string;
  period: { start: string; end: string };
  person: {
    id: string;
    name: string;
    role?: string;
  };
  hours: number;
  amount: number | null;
  canViewRates: boolean;
  gating: {
    blocked: boolean;
    reasons: string[];
  };
  sla: {
    breached: boolean;
  };
  submittedAt: string;
  status: "pending" | "approved" | "rejected" | "changes_requested";
}

interface ApprovalsWorkbenchProps {
  projectFilter?: string;
  statusFilter?: "all" | "pending" | "approved" | "rejected";
  viewerNodeId?: string;
  embedded?: boolean;
}

type WorkbenchStatus = "all" | "pending" | "approved" | "rejected";
type SortOrder = "newest" | "oldest" | "priority";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function ApprovalsWorkbench({
  projectFilter,
  statusFilter: externalStatusFilter,
  viewerNodeId,
  embedded = false,
}: ApprovalsWorkbenchProps = {}) {
  const { user } = useAuth();
  const [items, setItems] = useState<UIApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [selectedGraphItem, setSelectedGraphItem] = useState<UIApprovalItem | null>(null);
  const [rejectingItem, setRejectingItem] = useState<UIApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<WorkbenchStatus>(externalStatusFilter ?? "pending");
  const [sortBy, setSortBy] = useState<SortOrder>("newest");
  const [refreshing, setRefreshing] = useState(false);
  const [approvingItemId, setApprovingItemId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const effectiveStatusFilter = externalStatusFilter ?? statusFilter;

  useEffect(() => {
    if (externalStatusFilter) {
      setStatusFilter(externalStatusFilter);
    }
  }, [externalStatusFilter]);

  useEffect(() => {
    void loadApprovals();
  }, [user?.id, projectFilter, viewerNodeId, effectiveStatusFilter, typeFilter]);

  async function loadApprovals() {
    setLoading(true);
    setRefreshing(true);

    try {
      const filters: ApprovalQueueFilters = {
        status: effectiveStatusFilter === "all" ? undefined : effectiveStatusFilter,
        subjectType: typeFilter === "all" ? undefined : (typeFilter as ApprovalQueueFilters["subjectType"]),
        projectId: projectFilter,
        approverNodeId: viewerNodeId || undefined,
        approverUserId: !viewerNodeId ? user?.id : undefined,
      };

      const data = await getApprovalQueue(filters);

      const transformedItems = (data || []).map((item) => ({
        id: item.id,
        objectType: item.subjectType,
        project: {
          id: item.projectId,
          name: item.projectName || "Unknown Project",
        },
        stepOrder: item.approvalLayer,
        totalSteps: item.approvalLayer,
        policyVersion: 1,
        partyId: item.approverUserId,
        partyName: item.approverName,
        period: {
          start: item.timesheetData?.weekStart || "",
          end: item.timesheetData?.weekEnd || "",
        },
        person: {
          id: item.approverUserId,
          name: item.timesheetData?.contractorName || "Unknown",
          role: "Contractor",
        },
        hours: item.timesheetData?.totalHours || 0,
        amount:
          item.timesheetData?.hourlyRate && item.timesheetData?.totalHours
            ? item.timesheetData.totalHours * item.timesheetData.hourlyRate
            : null,
        canViewRates: !!item.timesheetData?.hourlyRate,
        gating: {
          blocked: false,
          reasons: [],
        },
        sla: {
          breached: false,
        },
        submittedAt: item.submittedAt || new Date().toISOString(),
        status: item.status,
      }));

      setItems(transformedItems);
    } catch (error) {
      toast.error("Failed to load approvals");
      console.error("Load error:", error);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const searchText = `${item.person.name} ${item.project.name} ${item.objectType}`.toLowerCase();
        if (searchQuery && !searchText.includes(searchQuery.toLowerCase())) return false;
        if (effectiveStatusFilter !== "all" && item.status !== effectiveStatusFilter) return false;
        if (typeFilter !== "all" && item.objectType !== typeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          if (a.sla.breached && !b.sla.breached) return -1;
          if (!a.sla.breached && b.sla.breached) return 1;
        }

        const aTs = new Date(a.submittedAt).getTime();
        const bTs = new Date(b.submittedAt).getTime();

        if (sortBy === "oldest") return aTs - bTs;
        return bTs - aTs;
      });
  }, [effectiveStatusFilter, items, searchQuery, sortBy, typeFilter]);

  const stats = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      approved: items.filter((item) => item.status === "approved").length,
      rejected: items.filter((item) => item.status === "rejected").length,
    }),
    [items],
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 || typeFilter !== "all" || effectiveStatusFilter !== "all" || sortBy !== "newest";

  const selectableItemIds = useMemo(
    () => filteredItems.filter((item) => item.status === "pending" && !item.gating.blocked).map((item) => item.id),
    [filteredItems],
  );

  const selectableItemIdsKey = selectableItemIds.join("|");

  useEffect(() => {
    setSelectedItems((current) => {
      const next = new Set(Array.from(current).filter((id) => selectableItemIds.includes(id)));
      return next.size === current.size ? current : next;
    });
  }, [selectableItemIds, selectableItemIdsKey]);

  const allSelectableSelected =
    selectableItemIds.length > 0 && selectableItemIds.every((itemId) => selectedItems.has(itemId));

  const handleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedItems(new Set());
      return;
    }

    setSelectedItems(new Set(selectableItemIds));
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedItems((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleApprove = async (itemId: string) => {
    setApprovingItemId(itemId);

    try {
      await approveItem(itemId, { approvedBy: user?.id || "current-user" });
      toast.success("Approval recorded");
      await loadApprovals();
    } catch (error) {
      toast.error("Failed to approve");
    } finally {
      setApprovingItemId(null);
    }
  };

  const openRejectDialog = (item: UIApprovalItem) => {
    setRejectingItem(item);
    setRejectReason("");
  };

  const closeRejectDialog = (force = false) => {
    if (rejectSubmitting && !force) return;
    setRejectingItem(null);
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectingItem || !rejectReason.trim()) return;

    setRejectSubmitting(true);

    try {
      await rejectItem(rejectingItem.id, {
        rejectedBy: user?.id || "current-user",
        reason: rejectReason.trim(),
      });
      toast.success("Rejection recorded");
      closeRejectDialog(true);
      await loadApprovals();
    } catch (error) {
      toast.error("Failed to reject");
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.size === 0) return;

    setBulkApproving(true);

    try {
      await bulkApprove({
        approvedBy: user?.id || "current-user",
        itemIds: Array.from(selectedItems),
      });
      toast.success(`Approved ${selectedItems.size} item${selectedItems.size === 1 ? "" : "s"}`);
      setSelectedItems(new Set());
      await loadApprovals();
    } catch (error) {
      toast.error("Failed to bulk approve");
    } finally {
      setBulkApproving(false);
    }
  };

  const handleViewGraph = (item: UIApprovalItem) => {
    setSelectedGraphItem(item);
    setShowGraphModal(true);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setSortBy("newest");

    if (!externalStatusFilter) {
      setStatusFilter("pending");
    }
  };

  const formatObjectType = (type: string) => {
    if (!type) return "Item";
    const normalized = type.replace(/[_-]/g, " ");
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const formatDate = (value: string) => {
    if (!value) return "N/A";
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return value;
    return shortDateFormatter.format(parsedDate);
  };

  const formatPeriod = (start: string, end: string) => {
    if (!start && !end) return "N/A";
    if (!start) return formatDate(end);
    if (!end) return formatDate(start);
    return `${formatDate(start)} to ${formatDate(end)}`;
  };

  const getEmptyTitle = () => {
    if (effectiveStatusFilter === "pending") return "No pending approvals";
    if (searchQuery.trim()) return "No matches for your search";
    return "No approvals found";
  };

  const getEmptyDescription = () => {
    if (effectiveStatusFilter === "pending") {
      return "You are caught up for now. New requests will appear here as soon as they are submitted.";
    }

    if (hasActiveFilters) {
      return "Try clearing filters or refreshing the workspace to widen the queue.";
    }

    return "There are no approvals in this view right now.";
  };

  return (
    <div className={cn("space-y-4", embedded ? "space-y-4" : "space-y-5")}>
      {!embedded && (
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="m-0 text-2xl font-semibold tracking-tight text-foreground">
              {projectFilter ? "Project approvals" : "Approvals workbench"}
            </h2>
            <p className="mt-1 mb-0 text-sm text-muted-foreground">
              Review and resolve approval requests with pending work kept at the front of the queue.
            </p>
          </div>
        </div>
      )}

      <section
        className={cn(
          "rounded-2xl border border-border/60 bg-muted/10 p-4 sm:p-5",
          embedded && "border-border/50 bg-background/60",
        )}
      >
        <div className="flex flex-col gap-4 border-b border-border/60 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={effectiveStatusFilter === "pending" ? "default" : "secondary"} className="rounded-full px-3">
                Pending {stats.pending}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3">
                Total {stats.total}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3">
                Approved {stats.approved}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3">
                Rejected {stats.rejected}
              </Badge>
            </div>

            {!externalStatusFilter && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button
                  size="sm"
                  variant={statusFilter === "pending" ? "default" : "outline"}
                  onClick={() => setStatusFilter("pending")}
                  className="rounded-full"
                >
                  Pending first
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                  className="rounded-full"
                >
                  All statuses
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by person, project, or type"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 pl-9"
              />
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-[repeat(4,minmax(0,1fr))]">
              {!externalStatusFilter && (
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as WorkbenchStatus)}>
                  <SelectTrigger className="h-10 w-full min-w-0 text-sm xl:min-w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Select value={typeFilter} onValueChange={setTypeFilter}>
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

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOrder)}>
                <SelectTrigger className="h-10 w-full min-w-0 text-sm xl:min-w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => void loadApprovals()}
                className="h-10 w-full gap-1.5"
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {selectedItems.size > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="m-0 text-sm font-medium text-emerald-950">
                  {selectedItems.size} pending item{selectedItems.size === 1 ? "" : "s"} selected
                </p>
                <p className="m-0 text-xs text-emerald-800/80">
                  Only active, non-blocked approvals are available for bulk approval.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto">
                <Button
                  onClick={handleBulkApprove}
                  className="h-9 w-full bg-emerald-600 hover:bg-emerald-700 md:min-w-[170px]"
                  disabled={bulkApproving}
                >
                  {bulkApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Approve selected
                </Button>
                <Button
                  onClick={() => setSelectedItems(new Set())}
                  variant="outline"
                  className="h-9 w-full md:min-w-[120px]"
                  disabled={bulkApproving}
                >
                  Clear selection
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/80 px-4 py-12 text-center sm:px-6">
              <h3 className="m-0 text-base font-semibold">{getEmptyTitle()}</h3>
              <p className="mx-auto mt-2 mb-0 max-w-xl text-sm text-muted-foreground">{getEmptyDescription()}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {hasActiveFilters && (
                  <Button size="sm" variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void loadApprovals()} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh queue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={allSelectableSelected}
                      onCheckedChange={() => handleSelectAll()}
                      disabled={selectableItemIds.length === 0}
                    />
                    <div>
                      <p className="m-0 text-sm font-medium text-foreground">Select all actionable approvals</p>
                      <p className="m-0 text-xs text-muted-foreground">
                        {selectableItemIds.length} of {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"} can be bulk approved
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{filteredItems.length} results</span>
                </div>
              </div>

              {filteredItems.map((item) => {
                const isPending = item.status === "pending";
                const isBlocked = item.gating.blocked;
                const isSelectable = isPending && !isBlocked;
                const isApproving = approvingItemId === item.id;
                const showAmount = item.canViewRates && item.amount !== null;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/60 bg-background/90 p-4 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => handleToggleItem(item.id)}
                          disabled={!isSelectable}
                          className="mt-1"
                        />

                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="m-0 text-sm font-semibold text-foreground">
                              {formatObjectType(item.objectType)} approval
                            </h3>
                            <Badge
                              variant={
                                item.status === "approved"
                                  ? "default"
                                  : item.status === "rejected"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="capitalize"
                            >
                              {item.status.replace("_", " ")}
                            </Badge>
                            <Badge variant="outline" className="text-[11px]">
                              Step {item.stepOrder} of {item.totalSteps}
                            </Badge>
                            {item.sla.breached && (
                              <Badge variant="destructive" className="text-[11px]">
                                SLA breached
                              </Badge>
                            )}
                            {isBlocked && (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                                Action blocked
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="m-0 text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">{item.person.name}</span> in{" "}
                              <span className="font-medium text-foreground">{item.project.name}</span>
                            </p>
                            {item.person.role && (
                              <p className="m-0 text-xs text-muted-foreground">{item.person.role}</p>
                            )}
                          </div>

                          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                                Submitted
                              </p>
                              <p className="mt-1 mb-0 flex items-center gap-1.5 text-sm text-foreground">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {formatDate(item.submittedAt)}
                              </p>
                            </div>

                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                                Current approver
                              </p>
                              <p className="mt-1 mb-0 text-sm text-foreground">{item.partyName || "Unassigned"}</p>
                            </div>

                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                                Period
                              </p>
                              <p className="mt-1 mb-0 text-sm text-foreground">
                                {formatPeriod(item.period.start, item.period.end)}
                              </p>
                            </div>

                            <div className="rounded-lg bg-muted/40 px-3 py-2">
                              <p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                                Summary
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground">
                                <span>{item.hours} hours</span>
                                {showAmount ? (
                                  <span>{currencyFormatter.format(item.amount)}</span>
                                ) : (
                                  <span className="text-muted-foreground">Rate masked</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isBlocked && item.gating.reasons.length > 0 && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{item.gating.reasons.join(", ")}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 xl:w-[220px] xl:shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewGraph(item)}
                          className="h-9 w-full justify-center xl:justify-start"
                        >
                          <Eye className="h-4 w-4" />
                          View path
                        </Button>

                        {isPending ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                            <Button
                              size="sm"
                              onClick={() => void handleApprove(item.id)}
                              className="h-9 w-full bg-emerald-600 hover:bg-emerald-700"
                              disabled={isBlocked || isApproving}
                            >
                              {isApproving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              {isBlocked ? "Blocked" : "Approve"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRejectDialog(item)}
                              className="h-9 w-full"
                              disabled={isApproving}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                            This request is {item.status.replace("_", " ")}.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!rejectingItem} onOpenChange={(open) => !open && closeRejectDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject approval request</DialogTitle>
            <DialogDescription>
              {rejectingItem
                ? `Add a reason for rejecting ${rejectingItem.person.name}'s ${formatObjectType(rejectingItem.objectType).toLowerCase()} approval in ${rejectingItem.project.name}.`
                : "Add a reason for the rejection."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="approval-reject-reason" className="text-sm font-medium text-foreground">
              Rejection reason
            </label>
            <Textarea
              id="approval-reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Explain what needs to change before this can be approved."
              className="min-h-28"
              disabled={rejectSubmitting}
            />
            <p className="m-0 text-xs text-muted-foreground">A reason is required before the request can be rejected.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRejectDialog} disabled={rejectSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleReject()} disabled={!rejectReason.trim() || rejectSubmitting}>
              {rejectSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showGraphModal && selectedGraphItem && (
        <GraphOverlayModal
          item={selectedGraphItem}
          open={showGraphModal}
          onClose={() => {
            setShowGraphModal(false);
            setSelectedGraphItem(null);
          }}
          onApprovalComplete={() => {
            void loadApprovals();
          }}
        />
      )}
    </div>
  );
}
