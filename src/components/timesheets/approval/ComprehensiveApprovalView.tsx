import { useState, useMemo } from "react";
import { Filter } from "lucide-react";
import { WorkQueuePanel } from "./WorkQueuePanel";
import { PersonPeriodCard } from "./PersonPeriodCard";
import { ReviewDrawer } from "./ReviewDrawer";
import { BulkActionToolbar } from "./BulkActionToolbar";
import { MonthSelector } from "./MonthSelector";
import { Button } from "../../ui/button";
import { ScrollArea } from "../../ui/scroll-area";
import { toast } from "sonner";
import {
  demoPeople,
  demoTimesheetPeriods,
  demoContracts,
  demoQuickFilters,
  demoQueueCounts,
  type DemoTimesheetPeriod,
} from "./demo-data-comprehensive";

type QueueFilter = "all" | "submitted" | "amended" | "dueSoon" | "overdue";

interface ComprehensiveApprovalViewProps {
  userRole?: "project-approver" | "finance-approver";
  showCost?: boolean;
}

export function ComprehensiveApprovalView({
  userRole = "project-approver",
  showCost = true,
}: ComprehensiveApprovalViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [activeFilter, setActiveFilter] = useState<QueueFilter>("all");
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<Set<string>>(new Set());
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
  const [reviewingPeriodId, setReviewingPeriodId] = useState<string | null>(null);
  const [showWorkQueue, setShowWorkQueue] = useState(true);

  // Filter periods based on active filter
  const filteredPeriods = useMemo(() => {
    let filtered = demoTimesheetPeriods;

    // Apply queue filter
    if (activeFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter((period) => {
        switch (activeFilter) {
          case "submitted":
            return period.status === "submitted";
          case "amended":
            return period.status === "amended";
          case "dueSoon":
            const hoursUntilDue = (period.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
            return period.status !== "approved" && hoursUntilDue >= 0 && hoursUntilDue < 24;
          case "overdue":
            return period.status !== "approved" && period.dueAt < now;
          default:
            return true;
        }
      });
    }

    // Apply quick filters
    if (selectedQuickFilters.size > 0) {
      filtered = filtered.filter((period) => {
        const person = demoPeople.find(p => p.id === period.personId);
        if (!person) return false;

        // Check if person matches any selected filter
        return Array.from(selectedQuickFilters).some(filterId => {
          if (filterId === "team-eng") return ["Senior Developer", "Developer", "DevOps Engineer"].includes(person.role);
          if (filterId === "team-design") return person.role === "Designer";
          if (filterId === "team-qa") return person.role === "QA Engineer";
          if (filterId === "agency-creative") return person.company === "CreativeLab";
          if (filterId === "agency-tech") return person.company === "TechStaff Inc";
          if (filterId === "company-acme") return person.company === "Acme Corp";
          return false;
        });
      });
    }

    return filtered;
  }, [activeFilter, selectedQuickFilters]);

  // Get period being reviewed
  const reviewingPeriod = reviewingPeriodId 
    ? demoTimesheetPeriods.find(p => p.id === reviewingPeriodId)
    : null;

  const reviewingPerson = reviewingPeriod
    ? demoPeople.find(p => p.id === reviewingPeriod.personId)
    : null;

  const reviewingContract = reviewingPeriod
    ? demoContracts.find(c => c.id === reviewingPeriod.contractId)
    : null;

  // Handlers
  const handleCounterClick = (type: QueueFilter) => {
    setActiveFilter(type === activeFilter ? "all" : type);
  };

  const handleFilterToggle = (filterId: string) => {
    const newFilters = new Set(selectedQuickFilters);
    if (newFilters.has(filterId)) {
      newFilters.delete(filterId);
    } else {
      newFilters.add(filterId);
    }
    setSelectedQuickFilters(newFilters);
  };

  const handleSelectPeriod = (periodId: string) => {
    const newSelection = new Set(selectedPeriods);
    if (newSelection.has(periodId)) {
      newSelection.delete(periodId);
    } else {
      newSelection.add(periodId);
    }
    setSelectedPeriods(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedPeriods.size === filteredPeriods.length) {
      setSelectedPeriods(new Set());
    } else {
      setSelectedPeriods(new Set(filteredPeriods.map(p => p.id)));
    }
  };

  const handleBulkApprove = () => {
    toast.success(`Approved ${selectedPeriods.size} timesheet${selectedPeriods.size > 1 ? 's' : ''}`);
    setSelectedPeriods(new Set());
  };

  const handleBulkReject = () => {
    const reason = prompt("Reason for rejection:");
    if (reason) {
      toast.error(`Rejected ${selectedPeriods.size} timesheet${selectedPeriods.size > 1 ? 's' : ''}`);
      setSelectedPeriods(new Set());
    }
  };

  const handleBulkRequestChanges = () => {
    const comment = prompt("Request changes:");
    if (comment) {
      toast.info(`Requested changes from ${selectedPeriods.size} contributor${selectedPeriods.size > 1 ? 's' : ''}`);
      setSelectedPeriods(new Set());
    }
  };

  const handleBulkExport = () => {
    toast.success(`Exporting ${selectedPeriods.size} timesheet${selectedPeriods.size > 1 ? 's' : ''}...`);
  };

  const handleApproveAll = (periodId: string, comment?: string) => {
    const period = demoTimesheetPeriods.find(p => p.id === periodId);
    const person = demoPeople.find(p => p.id === period?.personId);
    toast.success(
      `Approved timesheet for ${person?.name} - ${period?.totalHours}h`,
      { description: comment }
    );
    setReviewingPeriodId(null);
  };

  const handleRejectAll = (periodId: string, reason: string) => {
    const period = demoTimesheetPeriods.find(p => p.id === periodId);
    const person = demoPeople.find(p => p.id === period?.personId);
    toast.error(
      `Rejected timesheet for ${person?.name}`,
      { description: reason }
    );
    setReviewingPeriodId(null);
  };

  const handleRequestChanges = (periodId: string, comment: string) => {
    const period = demoTimesheetPeriods.find(p => p.id === periodId);
    const person = demoPeople.find(p => p.id === period?.personId);
    toast.info(
      `Requested changes from ${person?.name}`,
      { description: comment }
    );
    setReviewingPeriodId(null);
  };

  return (
    <div className="flex h-[calc(100vh-200px)] gap-0">
      {/* Work Queue Panel - Left Sidebar */}
      {showWorkQueue && (
        <div className="w-80 flex-shrink-0 border-r">
          <WorkQueuePanel
            counts={demoQueueCounts}
            filters={demoQuickFilters}
            selectedFilters={selectedQuickFilters}
            onFilterToggle={handleFilterToggle}
            onCounterClick={handleCounterClick}
            activeCounter={activeFilter !== "all" ? activeFilter : undefined}
          />
        </div>
      )}

      {/* Main Queue Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold mb-1">Approval Queue</h2>
              <p className="text-sm text-muted-foreground">
                {filteredPeriods.length} timesheet{filteredPeriods.length !== 1 ? 's' : ''} pending review
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {!showWorkQueue && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWorkQueue(true)}
                  className="gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Show Filters
                </Button>
              )}
              {showWorkQueue && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWorkQueue(false)}
                >
                  Hide Filters
                </Button>
              )}
              <MonthSelector
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
              />
            </div>
          </div>

          {/* Bulk Selection */}
          {filteredPeriods.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedPeriods.size === filteredPeriods.length}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-muted-foreground">
                {selectedPeriods.size > 0
                  ? `${selectedPeriods.size} selected`
                  : "Select all"}
              </span>
            </div>
          )}
        </div>

        {/* Queue List */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {filteredPeriods.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No timesheets match your filters</p>
              </div>
            ) : (
              filteredPeriods.map((period) => {
                const person = demoPeople.find(p => p.id === period.personId);
                if (!person) return null;

                return (
                  <PersonPeriodCard
                    key={period.id}
                    personId={person.id}
                    personName={person.name}
                    personInitials={person.initials}
                    role={person.role}
                    company={person.company}
                    periodStart={period.periodStart}
                    periodEnd={period.periodEnd}
                    totalHours={period.totalHours}
                    overtimeHours={period.overtimeHours}
                    estimatedCost={period.estimatedCost}
                    status={period.status}
                    submittedAt={period.submittedAt}
                    dueAt={period.dueAt}
                    flags={period.flags}
                    onReview={() => setReviewingPeriodId(period.id)}
                    onApprove={() => handleApproveAll(period.id)}
                    onReject={() => {
                      const reason = prompt("Reason for rejection:");
                      if (reason) handleRejectAll(period.id, reason);
                    }}
                    onSendBack={() => {
                      const comment = prompt("Request changes:");
                      if (comment) handleRequestChanges(period.id, comment);
                    }}
                    isSelected={selectedPeriods.has(period.id)}
                    onSelect={() => handleSelectPeriod(period.id)}
                    showCost={showCost}
                  />
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Review Drawer */}
      {reviewingPeriod && reviewingPerson && (
        <ReviewDrawer
          isOpen={!!reviewingPeriodId}
          onClose={() => setReviewingPeriodId(null)}
          people={[reviewingPerson]}
          periodStart={reviewingPeriod.periodStart}
          periodEnd={reviewingPeriod.periodEnd}
          dayGroups={reviewingPeriod.dayGroups}
          contract={reviewingContract}
          auditTrail={reviewingPeriod.auditTrail}
          onApproveAll={(comment) => handleApproveAll(reviewingPeriod.id, comment)}
          onRejectAll={(reason) => handleRejectAll(reviewingPeriod.id, reason)}
          onRequestChanges={(comment) => handleRequestChanges(reviewingPeriod.id, comment)}
          onApproveDay={(date) => {
            toast.success(`Approved ${date.toLocaleDateString()}`);
          }}
          onRejectDay={(date, reason) => {
            toast.error(`Rejected ${date.toLocaleDateString()}`, { description: reason });
          }}
          onApproveEntry={(entryId) => {
            toast.success("Entry approved");
          }}
          onRejectEntry={(entryId, reason) => {
            toast.error("Entry rejected", { description: reason });
          }}
          showCost={showCost}
          slaDueAt={reviewingPeriod.dueAt}
        />
      )}

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedPeriods.size}
        onApprove={handleBulkApprove}
        onReject={handleBulkReject}
        onRequestChanges={handleBulkRequestChanges}
        onExport={handleBulkExport}
        onClearSelection={() => setSelectedPeriods(new Set())}
        isVisible={selectedPeriods.size > 0}
      />
    </div>
  );
}
