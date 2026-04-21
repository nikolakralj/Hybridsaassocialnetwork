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
  resolveGraphNodeToUserId,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import { useWorkGraphContext } from "../../contexts/WorkGraphContext";
import type { ApprovalSubjectSnapshot } from "../../utils/api/approvals-supabase";

export interface UIApprovalItem {
  id: string;
  objectType: "timesheet" | "expense" | "invoice" | "contract" | "deliverable" | string;
  notes?: string | null;
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
  currentApproverName?: string;
  submitterOrg?: string;
  routeLabel?: string;
  approvalTrail?: Array<{
    approvalLayer: number;
    approverName: string;
    status: "pending" | "approved" | "rejected" | "changes_requested";
    submittedAt?: string;
    decidedAt?: string;
  }>;
  gating: {
    blocked: boolean;
    reasons: string[];
  };
  sla: {
    breached: boolean;
  };
  submittedAt: string;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  subjectSnapshot?: ApprovalSubjectSnapshot | null;
}

interface ApprovalsWorkbenchProps {
  projectFilter?: string;
  statusFilter?: "all" | "pending" | "approved" | "rejected";
  viewerNodeId?: string;
  viewerName?: string;
  viewScope?: "inbox" | "submitted" | "all";
  embedded?: boolean;
}

type WorkbenchStatus = "all" | "pending" | "approved" | "rejected";
type SortOrder = "newest" | "oldest" | "priority";
type NameDirEntry = { name?: string; type?: string; orgId?: string };
type ApprovalDirParty = { id: string; name?: string };

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

function resolveSubmitterOrgName(
  projectId: string | undefined,
  submitterId: string | undefined,
  nameDirectory: Record<string, Record<string, NameDirEntry>>,
  approvalDirectory: Record<string, ApprovalDirParty[]>,
): string | undefined {
  if (!projectId || !submitterId) return undefined;
  const nameDir = nameDirectory[projectId] || {};
  const approvalDir = approvalDirectory[projectId] || [];
  const orgId = nameDir[submitterId]?.orgId;
  if (!orgId) return undefined;
  return approvalDir.find((party) => party.id === orgId)?.name || nameDir[orgId]?.name || orgId;
}

function parseSubmitterIdFromSubjectId(subjectId?: string): string | undefined {
  if (!subjectId) return undefined;
  const parts = subjectId.split(":");
  if (parts.length < 2) return undefined;
  return parts.slice(0, -1).join(":");
}

function sanitizeSubmitterName(value?: string | null): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized === "Me") return undefined;
  return normalized;
}

function resolveSubmitterId(item: {
  subjectId?: string;
  subjectSnapshot?: ApprovalSubjectSnapshot | null;
  timesheetData?: { submitterId?: string };
  person?: { id: string };
}): string | undefined {
  return (
    item.timesheetData?.submitterId
    || item.subjectSnapshot?.submitterId
    || parseSubmitterIdFromSubjectId(item.subjectId)
    || item.person?.id
  );
}

function resolveSubmitterDisplayName(
  item: {
    projectId?: string;
    subjectId?: string;
    subjectType?: string;
    subjectSnapshot?: ApprovalSubjectSnapshot | null;
    timesheetData?: { submitterId?: string; contractorName?: string };
    person?: { id: string; name: string };
  },
  nameDirectory: Record<string, Record<string, NameDirEntry>>,
): string {
  const submitterId = resolveSubmitterId(item);
  const nameDir = item.projectId ? (nameDirectory[item.projectId] || {}) : {};
  return (
    (submitterId ? sanitizeSubmitterName(nameDir[submitterId]?.name) : undefined)
    || sanitizeSubmitterName(item.subjectSnapshot?.submitterName)
    || sanitizeSubmitterName(item.timesheetData?.contractorName)
    || sanitizeSubmitterName(item.person?.name)
    || item.subjectSnapshot?.title
    || (item.subjectType === "timesheet" ? "Submitted timesheet" : "Unknown")
  );
}

export function ApprovalsWorkbench({
  projectFilter,
  statusFilter: externalStatusFilter,
  viewerNodeId,
  viewerName,
  viewScope = "inbox",
  embedded = false,
}: ApprovalsWorkbenchProps = {}) {
  const { user } = useAuth();
  const { nameDirectory, approvalDirectory, loadGraphContext } = useWorkGraphContext();
  const [items, setItems] = useState<UIApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [selectedGraphItem, setSelectedGraphItem] = useState<UIApprovalItem | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<UIApprovalItem | null>(null);
  const [rejectingItem, setRejectingItem] = useState<UIApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<WorkbenchStatus>(externalStatusFilter ?? "all");
  const [sortBy, setSortBy] = useState<SortOrder>("newest");
  const [refreshing, setRefreshing] = useState(false);
  const [approvingItemId, setApprovingItemId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const notifyApprovalMutation = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("workgraph-approvals-updated", {
      detail: {
        projectId: projectFilter || null,
        at: new Date().toISOString(),
      },
    }));
  };

  const effectiveStatusFilter = externalStatusFilter ?? statusFilter;

  useEffect(() => {
    if (externalStatusFilter) {
      setStatusFilter(externalStatusFilter);
    }
  }, [externalStatusFilter]);

  useEffect(() => {
    if (projectFilter && (!nameDirectory[projectFilter] || !approvalDirectory[projectFilter])) {
      void loadGraphContext(projectFilter);
    }
  }, [projectFilter, nameDirectory, approvalDirectory, loadGraphContext]);

  useEffect(() => {
    void loadApprovals();
  }, [user?.id, projectFilter, viewerNodeId, effectiveStatusFilter, typeFilter, viewScope]);

  useEffect(() => {
    const projectIds = Array.from(new Set(items.map((item) => item.project.id).filter(Boolean)));
    projectIds.forEach((projectId) => {
      if (!nameDirectory[projectId] || !approvalDirectory[projectId]) {
        void loadGraphContext(projectId);
      }
    });
  }, [items, nameDirectory, approvalDirectory, loadGraphContext]);

  useEffect(() => {
    setItems((current) => {
      let changed = false;
      const next = current.map((item) => {
        const resolvedSubmitterName = resolveSubmitterDisplayName({
          projectId: item.project.id,
          subjectType: item.objectType,
          subjectSnapshot: item.subjectSnapshot,
          person: item.person,
        }, nameDirectory);
        const submitterId = resolveSubmitterId({
          subjectSnapshot: item.subjectSnapshot,
          person: item.person,
        });
        const resolvedSubmitterOrg =
          item.subjectSnapshot?.submitterOrg ||
          resolveSubmitterOrgName(item.project.id, submitterId, nameDirectory, approvalDirectory) ||
          "Unknown organization";

        if (
          item.person.name === resolvedSubmitterName &&
          (item.submitterOrg || "Unknown organization") === resolvedSubmitterOrg &&
          (item.person.role || "Unknown organization") === resolvedSubmitterOrg
        ) {
          return item;
        }

        changed = true;
        return {
          ...item,
          person: {
            ...item.person,
            name: resolvedSubmitterName,
            role: resolvedSubmitterOrg,
          },
          submitterOrg: resolvedSubmitterOrg,
        };
      });

      return changed ? next : current;
    });
  }, [nameDirectory, approvalDirectory]);

  async function loadApprovals() {
    setLoading(true);
    setRefreshing(true);

    try {
      let submitterUserId: string | undefined;
      let submitterGraphNodeId: string | undefined;

      if (viewScope === "submitted") {
        if (viewerNodeId) {
          submitterGraphNodeId = viewerNodeId;
          try {
            submitterUserId = await resolveGraphNodeToUserId(projectFilter || "", viewerNodeId);
          } catch (error) {
            console.warn("[approvals] Failed to resolve submitter viewer identity", error);
          }
        } else {
          submitterUserId = user?.id;
        }
      }

      const filters: ApprovalQueueFilters = {
        status: effectiveStatusFilter === "all" ? undefined : effectiveStatusFilter,
        subjectType: typeFilter === "all" ? undefined : (typeFilter as ApprovalQueueFilters["subjectType"]),
        projectId: projectFilter,
        approverNodeId: viewScope === "inbox" ? (viewerNodeId || undefined) : undefined,
        approverUserId: viewScope === "inbox" && !viewerNodeId ? user?.id : undefined,
        submitterUserId,
        submitterGraphNodeId,
      };

      const data = await getApprovalQueue(filters);

      const transformedItems = (data || []).map((item) => {
        const subjectSnapshot = item.subjectSnapshot || null;
        const snapshotStart = subjectSnapshot?.periodStart || "";
        const snapshotEnd = subjectSnapshot?.periodEnd || "";
        const snapshotHours = typeof subjectSnapshot?.hours === "number" ? subjectSnapshot.hours : undefined;
        // Parse weekStart from subjectId format "personId:YYYY-MM-DD"
        const subjectParts = (item.subjectId || "").split(":");
        const parsedWeekStart = subjectParts.length >= 2
          ? subjectParts[subjectParts.length - 1]
          : "";
        const parsedWeekEnd = parsedWeekStart
          ? (() => {
              const d = new Date(parsedWeekStart);
              d.setDate(d.getDate() + 4);
              return d.toISOString().slice(0, 10);
            })()
          : "";

        // Resolve submitter name: use timesheetData if available, else approverName as party label
        const weekStart = item.timesheetData?.weekStart || snapshotStart || parsedWeekStart;
        const weekEnd = item.timesheetData?.weekEnd || snapshotEnd || parsedWeekEnd;
        const submitterId = resolveSubmitterId({
          subjectId: item.subjectId,
          subjectSnapshot,
          timesheetData: item.timesheetData,
        });
        const submitterName = resolveSubmitterDisplayName({
          projectId: item.projectId,
          subjectId: item.subjectId,
          subjectType: item.subjectType,
          subjectSnapshot,
          timesheetData: item.timesheetData,
        }, nameDirectory);
        const submitterOrgName = subjectSnapshot?.submitterOrg
          || resolveSubmitterOrgName(
            item.projectId,
            submitterId,
            nameDirectory,
            approvalDirectory,
          );
        const totalHours = snapshotHours ?? item.timesheetData?.totalHours ?? 0;

        return ({
        id: item.id,
        objectType: item.subjectType,
        notes: item.notes,
        project: {
          id: item.projectId,
          name: item.projectName || item.projectId || "Unknown Project",
        },
        stepOrder: item.approvalLayer,
        totalSteps: item.approvalLayer,
        policyVersion: 1,
        partyId: item.approverNodeId || item.approverUserId,
        partyName: item.approverName,
        period: {
          start: weekStart,
          end: weekEnd,
        },
        person: {
          id: submitterId || item.approverUserId,
          name: submitterName,
          role: submitterOrgName || "Unknown organization",
        },
        hours: totalHours,
        amount:
          subjectSnapshot?.amount ??
          (item.timesheetData?.hourlyRate && totalHours
            ? totalHours * item.timesheetData.hourlyRate
            : null),
        canViewRates: subjectSnapshot?.canViewRates ?? !!item.timesheetData?.hourlyRate,
        currentApproverName: subjectSnapshot?.currentApproverName || item.approverName,
        submitterOrg: subjectSnapshot?.submitterOrg || submitterOrgName || "Unknown organization",
        routeLabel: subjectSnapshot?.routeLabel,
        approvalTrail: item.approvalTrail,
        gating: {
          blocked: false,
          reasons: [],
        },
        sla: {
          breached: false,
        },
        submittedAt: item.submittedAt || new Date().toISOString(),
        status: item.status,
        subjectSnapshot,
        });
      });

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
      notifyApprovalMutation();
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
      notifyApprovalMutation();
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
      notifyApprovalMutation();
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

  const handleViewDetails = (item: UIApprovalItem) => {
    setSelectedDetailItem(item);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setSortBy("newest");

    if (!externalStatusFilter) {
      setStatusFilter("all");
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
              {viewScope === "submitted"
                ? (projectFilter ? "Submission history" : "My submissions")
                : (projectFilter ? "Project approvals" : "Approvals workbench")}
            </h2>
            <p className="mt-1 mb-0 text-sm text-muted-foreground">
              {viewScope === "submitted"
                ? "Review what you submitted and see the full approval trail after decisions are made."
                : "Review and resolve approval requests with pending work kept at the front of the queue."}
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
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                  className="rounded-full"
                >
                  All statuses
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "pending" ? "default" : "outline"}
                  onClick={() => setStatusFilter("pending")}
                  className="rounded-full"
                >
                  Pending first
                </Button>
              </div>
            )}
          </div>

          {effectiveStatusFilter === "pending" && (
            <p className="m-0 text-xs text-muted-foreground">
              {viewScope === "submitted"
                ? "Showing submitted items only. Switch to All statuses to see the full approval trail for your submissions."
                : "Showing pending items only. Switch to All statuses to see approved/rejected history."}
            </p>
          )}

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
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Approvers can review items row-by-row or bulk approve a whole month. Open a detail packet for context, keep the
                table as the fast scan surface, and use history for the audit trail.
              </div>

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

              <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/90">
                <table className="w-full min-w-[1240px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-background/95 text-left backdrop-blur supports-[backdrop-filter]:bg-background/85">
                    <tr className="border-b border-border/60">
                      <th className="px-3 py-2.5 w-[42px]"></th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Type</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Person</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Organization</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Project</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Period</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Hours / Amount</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current Approver</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Submitted</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const isPending = item.status === "pending";
                      const isBlocked = item.gating.blocked;
                      const isSelectable = isPending && !isBlocked;
                      const isApproving = approvingItemId === item.id;
                      const showAmount = item.canViewRates && item.amount !== null;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/10 even:bg-muted/[0.03]"
                        >
                          <td className="px-3 py-3 align-top">
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => handleToggleItem(item.id)}
                              disabled={!isSelectable}
                            />
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{formatObjectType(item.objectType)}</div>
                              <div className="text-xs text-muted-foreground">Step {item.stepOrder} of {item.totalSteps}</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="space-y-0.5">
                              <div className="font-medium text-foreground">{item.person.name}</div>
                              <div className="text-xs text-muted-foreground">{item.person.role || "Unknown person role"}</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="font-medium text-foreground">{item.person.role || "—"}</div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="font-medium text-foreground">
                              {item.project.name.startsWith("proj_") ? (
                                <span className="font-mono text-xs text-muted-foreground">{item.project.name}</span>
                              ) : item.project.name}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top text-muted-foreground">
                            {formatPeriod(item.period.start, item.period.end)}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{item.hours}h</div>
                              <div className="text-xs text-muted-foreground">
                                {showAmount ? currencyFormatter.format(item.amount) : "Rate masked"}
                              </div>
                              {item.subjectSnapshot?.daySummary?.length ? (
                                <DayMiniGrid daySummary={item.subjectSnapshot.daySummary} />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{item.partyName || "Unassigned"}</div>
                              <div className="text-xs text-muted-foreground">Step {item.stepOrder} of {item.totalSteps}</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="space-y-0.5">
                              <div className="font-medium text-foreground">{formatDate(item.submittedAt)}</div>
                              <div className="text-xs text-muted-foreground">Captured at submission</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-wrap gap-1.5">
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
                              {item.sla.breached ? <Badge variant="destructive">SLA</Badge> : null}
                              {isBlocked ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Blocked</Badge> : null}
                            </div>
                            {isBlocked && item.gating.reasons.length > 0 ? (
                              <div className="mt-1 text-xs text-amber-700">{item.gating.reasons.join(", ")}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => handleViewDetails(item)} className="h-8">
                                Details
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleViewGraph(item)} className="h-8">
                                Path
                              </Button>
                              {isPending ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => void handleApprove(item.id)}
                                    className="h-8 bg-emerald-600 hover:bg-emerald-700"
                                    disabled={isBlocked || isApproving}
                                  >
                                    {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => openRejectDialog(item)}
                                    className="h-8"
                                    disabled={isApproving}
                                  >
                                    Reject
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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

      <Sheet open={!!selectedDetailItem} onOpenChange={(open) => !open && setSelectedDetailItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedDetailItem && (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border/60 px-6 pb-5 pt-6 space-y-0">
                {/* Approver identity context — who is acting */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-emerald-700">
                        {(viewerName || user?.user_metadata?.full_name || user?.email || "?").slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Approving as</p>
                      <p className="m-0 text-sm font-medium text-foreground leading-tight">
                        {viewerName || user?.user_metadata?.full_name || user?.email || "You"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        selectedDetailItem.status === "approved"
                          ? "default"
                          : selectedDetailItem.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {selectedDetailItem.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      Step {selectedDetailItem.stepOrder} of {selectedDetailItem.totalSteps}
                    </Badge>
                  </div>
                </div>

                {/* What is being approved */}
                <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">
                      Submitted by
                    </Badge>
                    <span className="font-medium text-foreground">{selectedDetailItem.person.name}</span>
                    <span>•</span>
                    <span>{selectedDetailItem.submitterOrg || selectedDetailItem.person.role || "Unknown organization"}</span>
                  </div>

                  {selectedDetailItem.currentApproverName || selectedDetailItem.partyName ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">
                        Current approver
                      </Badge>
                      <span className="font-medium text-foreground">{selectedDetailItem.currentApproverName || selectedDetailItem.partyName}</span>
                      <span>•</span>
                      <span>Step {selectedDetailItem.stepOrder} of {selectedDetailItem.totalSteps}</span>
                    </div>
                  ) : null}

                  {/* Submitter row */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Approving for</p>
                      <p className="m-0 text-base font-semibold text-foreground leading-snug">{selectedDetailItem.person.name}</p>
                      <p className="m-0 text-xs text-muted-foreground">{selectedDetailItem.submitterOrg || selectedDetailItem.person.role || "Unknown organization"}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Project</p>
                      <p className="m-0 text-sm font-medium text-foreground leading-snug">
                        {selectedDetailItem.project.name.startsWith("proj_")
                          ? <span className="font-mono text-xs text-muted-foreground">{selectedDetailItem.project.name}</span>
                          : selectedDetailItem.project.name}
                      </p>
                    </div>
                  </div>

                  {/* Period + hours row */}
                  <div className="flex items-center gap-4 pt-1 border-t border-border/40">
                    <div>
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Period</p>
                      <p className="m-0 text-sm font-medium text-foreground">
                        {formatPeriod(selectedDetailItem.period.start, selectedDetailItem.period.end)}
                      </p>
                    </div>
                    <div>
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Hours</p>
                      <p className="m-0 text-sm font-semibold text-foreground">{selectedDetailItem.hours}h</p>
                    </div>
                    <div>
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Amount</p>
                      <p className="m-0 text-sm text-muted-foreground">
                        {selectedDetailItem.canViewRates && selectedDetailItem.amount !== null
                          ? currencyFormatter.format(selectedDetailItem.amount)
                          : "Rate masked"}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Submitted</p>
                      <p className="m-0 text-xs text-muted-foreground">{formatDate(selectedDetailItem.submittedAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Visually hidden title for accessibility */}
                <SheetTitle className="sr-only">
                  {`Decision packet — ${selectedDetailItem.person.name} · ${selectedDetailItem.person.role || "Unknown organization"} · ${formatPeriod(selectedDetailItem.period.start, selectedDetailItem.period.end)}`}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {`Review and act on the timesheet submitted by ${selectedDetailItem.person.name} from ${selectedDetailItem.person.role || "Unknown organization"} for ${selectedDetailItem.project.name}.`}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 px-6 py-6">

                {/* Timesheet grid — primary review surface */}
                <section className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <h4 className="m-0 text-sm font-semibold">Timesheet</h4>
                      <p className="mt-0.5 mb-0 text-xs text-muted-foreground">
                        {formatPeriod(selectedDetailItem.period.start, selectedDetailItem.period.end)}
                        {" · "}
                        {selectedDetailItem.hours}h total
                        {selectedDetailItem.canViewRates && selectedDetailItem.amount !== null
                          ? ` · ${currencyFormatter.format(selectedDetailItem.amount)}`
                          : " · Rate masked"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">Submitted {formatDate(selectedDetailItem.submittedAt)}</span>
                  </div>
                  <TimesheetDayGrid
                    daySummary={selectedDetailItem.subjectSnapshot?.daySummary ?? null}
                    weekStart={selectedDetailItem.period.start}
                  />
                </section>

                {/* Approval chain timeline */}
                <section className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
                  <h4 className="m-0 text-sm font-semibold">
                    {selectedDetailItem.approvalTrail && selectedDetailItem.approvalTrail.length > 1
                      ? "Approval trail"
                      : "Approval path"}
                  </h4>
                  {selectedDetailItem.approvalTrail && selectedDetailItem.approvalTrail.length > 1 ? (
                    <div className="space-y-2">
                      {selectedDetailItem.approvalTrail.map((step) => (
                        <ApprovalPathStep
                          key={`${selectedDetailItem.id}-${step.approvalLayer}`}
                          label={`${step.approverName} · Step ${step.approvalLayer}`}
                          sublabel={`${step.status.replace("_", " ")}${step.decidedAt ? ` · ${formatDate(step.decidedAt)}` : ""}`}
                          state={
                            step.status === "approved"
                              ? "done"
                              : step.status === "rejected"
                                ? "error"
                                : step.approvalLayer === selectedDetailItem.stepOrder
                                  ? "current"
                                  : "waiting"
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <ApprovalPathStep
                        label={selectedDetailItem.person.name}
                        sublabel={`Submitted ${formatDate(selectedDetailItem.submittedAt)}`}
                        state="done"
                      />
                      <ApprovalPathStep
                        label={selectedDetailItem.partyName || "Current approver"}
                        sublabel={`Step ${selectedDetailItem.stepOrder} of ${selectedDetailItem.totalSteps} · You`}
                        state="current"
                      />
                      {selectedDetailItem.totalSteps > selectedDetailItem.stepOrder ? (
                        <ApprovalPathStep
                          label="Next approver"
                          sublabel={`Step ${selectedDetailItem.stepOrder + 1} of ${selectedDetailItem.totalSteps} · Waiting`}
                          state="waiting"
                        />
                      ) : null}
                    </div>
                  )}
                </section>

                {/* Compact metadata */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <DetailTile label="Project" value={selectedDetailItem.project.name} />
                  <DetailTile label="Organization" value={selectedDetailItem.submitterOrg || selectedDetailItem.person.role || "Unknown"} />
                  <DetailTile label="Current approver" value={selectedDetailItem.currentApproverName || selectedDetailItem.partyName || "Unassigned"} />
                  <DetailTile label="Approval step" value={`Step ${selectedDetailItem.stepOrder} of ${selectedDetailItem.totalSteps}`} />
                  <DetailTile label="Rate visibility" value={selectedDetailItem.canViewRates ? "Visible" : "Masked"} />
                  <DetailTile label="Object type" value={formatObjectType(selectedDetailItem.objectType)} />
                </div>

                {selectedDetailItem.notes ? (
                  <section className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <h4 className="m-0 text-sm font-semibold">Note</h4>
                    <p className="m-0 text-sm text-muted-foreground">{selectedDetailItem.notes}</p>
                  </section>
                ) : null}
              </div>

              <div className="border-t border-border/60 px-6 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDetailItem(null);
                      setSelectedGraphItem(selectedDetailItem);
                      setShowGraphModal(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    View path
                  </Button>
                  {selectedDetailItem.status === "pending" ? (
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedDetailItem(null);
                          openRejectDialog(selectedDetailItem);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          setSelectedDetailItem(null);
                          void handleApprove(selectedDetailItem.id);
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <Badge variant={selectedDetailItem.status === "approved" ? "default" : "destructive"} className="capitalize">
                      {selectedDetailItem.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailTile({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="m-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">{label}</p>
      <p className={cn("mt-1 mb-0 text-sm", muted ? "text-muted-foreground" : "text-foreground")}>{value}</p>
    </div>
  );
}

// Compact Mon-Fri strip shown inline in the queue row
function DayMiniGrid({ daySummary }: { daySummary: Array<{ day: string; hours: number }> }) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="flex gap-1.5 pt-0.5">
      {DAYS.map((label) => {
        const entry = daySummary.find((d) => d.day === label || d.day?.startsWith(label));
        const hrs = entry?.hours ?? 0;
        return (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <span className={cn("text-[10px] leading-none font-medium", hrs > 0 ? "text-foreground" : "text-muted-foreground/40")}>
              {hrs > 0 ? `${hrs}h` : "—"}
            </span>
            <span className="text-[9px] leading-none text-muted-foreground/50">{label[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

// Full Mon-Fri grid for the decision packet — shows dates + hours + notes
function TimesheetDayGrid({
  daySummary,
  weekStart,
}: {
  daySummary: Array<{ day: string; hours: number; notes?: string }> | null;
  weekStart: string;
}) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  function getDateForDay(index: number): string {
    if (!weekStart) return DAYS[index];
    const base = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(base.getTime())) return DAYS[index];
    base.setDate(base.getDate() + index);
    return base.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  if (!daySummary?.length) {
    return (
      <p className="m-0 text-xs text-muted-foreground italic">
        Day breakdown not captured — submitted before snapshot migration.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {DAYS.map((label, index) => {
        const entry = daySummary.find((d) => d.day === label || d.day?.startsWith(label));
        const hrs = entry?.hours ?? 0;
        const hasHours = hrs > 0;
        return (
          <div
            key={label}
            className={cn(
              "rounded-lg px-2 py-2 text-center",
              hasHours ? "bg-emerald-50 border border-emerald-100" : "bg-muted/30 border border-transparent",
            )}
          >
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</p>
            <p className="m-0 text-[10px] text-muted-foreground/60 mb-1">{getDateForDay(index)}</p>
            <p className={cn("m-0 text-base font-semibold", hasHours ? "text-emerald-700" : "text-muted-foreground/30")}>
              {hasHours ? `${hrs}h` : "0"}
            </p>
            {entry?.notes ? (
              <p className="m-0 mt-1 text-[10px] text-muted-foreground leading-tight truncate" title={entry.notes}>
                {entry.notes}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// Vertical timeline step for the approval chain
function ApprovalPathStep({
  label,
  sublabel,
  state,
}: {
  label: string;
  sublabel: string;
  state: "done" | "current" | "waiting" | "error";
}) {
  const dotClass = cn(
    "h-2.5 w-2.5 rounded-full border-2 shrink-0 mt-0.5",
    state === "done" && "bg-emerald-500 border-emerald-500",
    state === "current" && "bg-white border-emerald-600 ring-2 ring-emerald-300",
    state === "waiting" && "bg-muted border-muted-foreground/30",
    state === "error" && "bg-rose-500 border-rose-500",
  );
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={dotClass} />
      </div>
      <div>
        <p className={cn(
          "m-0 text-sm font-medium",
          state === "waiting" && "text-muted-foreground",
          state === "error" && "text-rose-700",
          state !== "waiting" && state !== "error" && "text-foreground",
        )}>
          {label}
          {state === "current" ? <span className="ml-2 text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">← You</span> : null}
        </p>
        <p className={cn("m-0 text-xs", state === "error" ? "text-rose-600" : "text-muted-foreground")}>{sublabel}</p>
      </div>
    </div>
  );
}

