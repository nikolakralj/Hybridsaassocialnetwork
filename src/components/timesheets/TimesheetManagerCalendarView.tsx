import { useState } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, Clock,
  AlertCircle, XCircle, Download, Filter, Users, DollarSign,
  TrendingUp, MessageSquare, X, ExternalLink
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { BatchApprovalBar } from "./BatchApprovalBar";

interface ContributorEntry {
  id: string;
  contractor: {
    id: string;
    name: string;
    avatar: string;
    role: string;
    hourlyRate: number;
  };
  hours: number;
  task: string;
  notes: string;
  startTime?: string;
  endTime?: string;
  status: "draft" | "submitted" | "approved" | "rejected";
}

interface DayAggregate {
  date: Date;
  totalHours: number;
  totalCost: number;
  contributors: ContributorEntry[];
  statusBreakdown: {
    approved: number;
    pending: number;
    rejected: number;
    draft: number;
  };
}

export function TimesheetManagerCalendarView({ 
  onViewIndividualTimesheet,
  selectedContractor = "all"
}: { 
  onViewIndividualTimesheet?: (contractorId: string, contractorName: string) => void;
  selectedContractor?: string;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayAggregate | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [filterTask, setFilterTask] = useState<string>("all");
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<ContributorEntry | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedContractorIds, setSelectedContractorIds] = useState<Set<string>>(new Set());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Mock data - aggregate entries by day
  const [dayAggregates] = useState<Map<string, DayAggregate>>(
    generateMockAggregates(year, month)
  );

  // Get calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const calendarDays: (Date | null)[] = [];
  const startOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push(null);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  // Calculate totals
  const monthlyHours = Array.from(dayAggregates.values()).reduce(
    (sum, day) => sum + day.totalHours, 0
  );
  const monthlyCost = Array.from(dayAggregates.values()).reduce(
    (sum, day) => sum + day.totalCost, 0
  );

  const uniqueContractors = new Set<string>();
  dayAggregates.forEach(day => {
    day.contributors.forEach(c => uniqueContractors.add(c.contractor.id));
  });

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (date: Date) => {
    const key = formatDateKey(date);
    const aggregate = dayAggregates.get(key);
    if (aggregate) {
      setSelectedDay(aggregate);
      setShowDayModal(true);
    }
  };

  const handleApprove = (entry: ContributorEntry) => {
    setSelectedEntry(entry);
    setShowReviewDialog(true);
  };

  const confirmApprove = () => {
    if (!selectedEntry) return;
    toast.success(`Approved ${selectedEntry.hours}h for ${selectedEntry.contractor.name}`);
    setShowReviewDialog(false);
    setReviewNotes("");
    // Update entry status in real app
  };

  const handleReject = (entry: ContributorEntry) => {
    setSelectedEntry(entry);
    setShowReviewDialog(true);
  };

  const handleBulkApprove = () => {
    if (!selectedDay) return;
    const pendingCount = selectedDay.contributors.filter(c => c.status === "submitted").length;
    toast.success(`Approved ${pendingCount} entries for ${formatDate(selectedDay.date)}`);
    setShowDayModal(false);
  };

  const handleBatchApprove = () => {
    const count = selectedContractorIds.size;
    toast.success(`Approved timesheets for ${count} contractor${count !== 1 ? 's' : ''}`);
    setSelectedContractorIds(new Set());
  };

  const handleBatchReject = () => {
    const count = selectedContractorIds.size;
    toast.error(`Rejected timesheets for ${count} contractor${count !== 1 ? 's' : ''}`);
    setSelectedContractorIds(new Set());
  };

  // Prepare batch approval data - aggregate by contractor
  const contractorTimesheets = new Map<string, { 
    name: string; 
    hours: number; 
    amount: number;
    status: "draft" | "submitted" | "approved" | "rejected";
  }>();

  dayAggregates.forEach(day => {
    day.contributors.forEach(entry => {
      const existing = contractorTimesheets.get(entry.contractor.id);
      if (existing) {
        existing.hours += entry.hours;
        existing.amount += entry.hours * entry.contractor.hourlyRate;
      } else {
        contractorTimesheets.set(entry.contractor.id, {
          name: entry.contractor.name,
          hours: entry.hours,
          amount: entry.hours * entry.contractor.hourlyRate,
          status: entry.status,
        });
      }
    });
  });

  const selectedTimesheets = Array.from(selectedContractorIds)
    .map(id => {
      const ts = contractorTimesheets.get(id);
      if (!ts) return null;
      return {
        contractorId: id,
        contractorName: ts.name,
        hours: ts.hours,
        amount: ts.amount,
        status: ts.status,
      };
    })
    .filter(Boolean) as any[];

  const getDayAggregate = (date: Date | null): DayAggregate | undefined => {
    if (!date) return undefined;
    return dayAggregates.get(formatDateKey(date));
  };

  const getWeekTotal = (week: (Date | null)[]): number => {
    return week.reduce((sum, date) => {
      if (!date) return sum;
      const agg = getDayAggregate(date);
      return sum + (agg?.totalHours || 0);
    }, 0);
  };

  const getDayStatusColor = (agg: DayAggregate): string => {
    const { approved, pending, rejected, draft } = agg.statusBreakdown;
    const total = approved + pending + rejected + draft;
    
    if (total === 0) return "";
    if (rejected > 0) return "border-destructive bg-destructive/10";
    if (pending > 0) return "border-warning bg-warning/10";
    if (approved === total) return "border-success bg-success/10";
    return "";
  };

  const getDayStatusIcon = (agg: DayAggregate) => {
    const { approved, pending, rejected } = agg.statusBreakdown;
    
    if (rejected > 0) return <XCircle className="w-3 h-3 text-destructive" />;
    if (pending > 0) return <Clock className="w-3 h-3 text-warning" />;
    if (approved > 0) return <CheckCircle2 className="w-3 h-3 text-success" />;
    return null;
  };

  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isWeekend = (date: Date | null): boolean => {
    if (!date) return false;
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Filter contributors
  const filteredContributors = selectedDay?.contributors.filter(c => {
    if (selectedContractor !== "all" && c.contractor.id !== selectedContractor) return false;
    if (filterTask !== "all" && c.task !== filterTask) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Batch Approval Bar */}
      <BatchApprovalBar
        selectedTimesheets={selectedTimesheets}
        showRates={true} // In real app, role-based
        onApproveAll={handleBatchApprove}
        onRejectAll={handleBatchReject}
        onClearSelection={() => setSelectedContractorIds(new Set())}
      />

      {/* Quick Filters */}
      {selectedContractor !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Task Filter:</span>
          <Select value={filterTask} onValueChange={setFilterTask}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All tasks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tasks</SelectItem>
              <SelectItem value="Development">Development</SelectItem>
              <SelectItem value="UI Design">UI Design</SelectItem>
              <SelectItem value="Code Review">Code Review</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Calendar Card */}
      <Card className="overflow-hidden">
        {/* Month Navigation */}
        <div className="p-4 border-b border-border bg-accent/30">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handlePreviousMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <h3 className="m-0">{formatMonthYear(currentDate)}</h3>

            <Button variant="ghost" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="space-y-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-2">
                {week.map((date, dayIndex) => {
                    const agg = getDayAggregate(date);
                    const today = isToday(date);
                    const weekend = isWeekend(date);

                    if (!date) {
                      return (
                        <div 
                          key={dayIndex} 
                          className="aspect-square rounded-lg bg-transparent"
                          aria-hidden="true"
                        />
                      );
                    }

                    return (
                      <button
                        key={dayIndex}
                        onClick={() => agg && handleDayClick(date)}
                        disabled={!agg}
                        className={`
                          aspect-square rounded-lg border-2 p-2 apple-transition
                          ${today ? 'border-accent-brand bg-accent-brand/5' : 'border-border'}
                          ${weekend ? 'bg-accent/20' : 'bg-card'}
                          ${agg ? 'hover:border-accent-brand hover:apple-shadow-md cursor-pointer' : 'cursor-default'}
                          ${agg ? getDayStatusColor(agg) : ''}
                          flex flex-col items-center justify-between
                        `}
                      >
                        {/* Day Number */}
                        <div className={`text-sm font-semibold ${today ? 'text-accent-brand' : ''}`}>
                          {date.getDate()}
                        </div>

                        {/* Aggregate Info */}
                        {agg && agg.totalHours > 0 ? (
                          <div className="space-y-1.5 w-full">
                            <div className="text-center">
                              <p className="font-semibold text-accent-brand">{agg.totalHours}h</p>
                            </div>
                            
                            {/* Mini Avatars - show unique contributors */}
                            {selectedContractor === "all" && (
                              <div className="flex items-center justify-center gap-0.5">
                                {(() => {
                                  // Get unique contractors for this day
                                  const uniqueContractors = Array.from(
                                    new Map(
                                      agg.contributors.map(entry => [
                                        entry.contractor.id,
                                        entry.contractor
                                      ])
                                    ).values()
                                  );
                                  return (
                                    <>
                                      {uniqueContractors.slice(0, 3).map((contractor, idx) => (
                                        <div
                                          key={idx}
                                          className="w-5 h-5 rounded-full bg-accent border border-background flex items-center justify-center text-[8px] font-medium"
                                          title={contractor.name}
                                        >
                                          {contractor.avatar}
                                        </div>
                                      ))}
                                      {uniqueContractors.length > 3 && (
                                        <div className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] font-medium">
                                          +{uniqueContractors.length - 3}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            
                            {/* Status Indicator */}
                            <div className="flex items-center justify-center">
                              {getDayStatusIcon(agg)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">--</div>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Summary Footer */}
        <div className="border-t-2 border-border bg-accent/30 p-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
              <p className="text-2xl font-semibold text-accent-brand">{monthlyHours}h</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Active Contractors</p>
              <p className="text-2xl font-semibold">{uniqueContractors.size}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
              <p className="text-2xl font-semibold">
                ${monthlyCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Hours/Person</p>
              <p className="text-2xl font-semibold">
                {uniqueContractors.size > 0 
                  ? Math.round(monthlyHours / uniqueContractors.size)
                  : 0}h
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Status Legend */}
      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Status Indicators</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">All Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" />
            <span className="text-muted-foreground">Pending Review</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-muted-foreground">Has Rejections</span>
          </div>
        </div>
      </Card>

      {/* Day Drill-Down Modal */}
      <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedDay && formatDate(selectedDay.date)}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {selectedDay?.totalHours}h total
                </Badge>
                <Badge variant="secondary">
                  ${selectedDay?.totalCost.toLocaleString()}
                </Badge>
              </div>
            </DialogTitle>
            <DialogDescription>
              Detailed timesheet breakdown for all team members on this day.
            </DialogDescription>
          </DialogHeader>

          {selectedDay && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3 p-4 bg-accent/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contributors</p>
                  <p className="font-semibold">{selectedDay.contributors.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Approved</p>
                  <p className="font-semibold text-success">{selectedDay.statusBreakdown.approved}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pending</p>
                  <p className="font-semibold text-warning">{selectedDay.statusBreakdown.pending}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Rejected</p>
                  <p className="font-semibold text-destructive">{selectedDay.statusBreakdown.rejected}</p>
                </div>
              </div>

              {/* Contributors List */}
              <div className="space-y-3">
                {filteredContributors?.map((entry) => (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <Avatar className="w-10 h-10 bg-accent-brand/10 text-accent-brand flex items-center justify-center">
                          {entry.contractor.avatar}
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{entry.contractor.name}</p>
                            {onViewIndividualTimesheet && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onViewIndividualTimesheet(entry.contractor.id, entry.contractor.name)}
                                className="h-6 gap-1 text-xs"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View Full Timesheet
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{entry.contractor.role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {entry.status === "submitted" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(entry)}
                              className="gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(entry)}
                              className="gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </Button>
                          </>
                        )}
                        {entry.status === "approved" && (
                          <Badge variant="default" className="gap-1.5 bg-success">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approved
                          </Badge>
                        )}
                        {entry.status === "rejected" && (
                          <Badge variant="destructive" className="gap-1.5">
                            <XCircle className="w-3.5 h-3.5" />
                            Rejected
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Hours</p>
                        <p className="font-semibold">{entry.hours}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Task</p>
                        <Badge variant="secondary">{entry.task}</Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Time</p>
                        <p className="font-mono text-xs">
                          {entry.startTime && entry.endTime 
                            ? `${entry.startTime} - ${entry.endTime}`
                            : "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Cost</p>
                        <p className="font-semibold">
                          ${(entry.hours * entry.contractor.hourlyRate).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {entry.notes && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">{entry.notes}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDayModal(false)}>
              Close
            </Button>
            {selectedDay && selectedDay.statusBreakdown.pending > 0 && (
              <Button onClick={handleBulkApprove} className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Approve All Pending ({selectedDay.statusBreakdown.pending})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedEntry?.status === "submitted" ? "Review Entry" : "Entry Details"}
            </DialogTitle>
            <DialogDescription>
              {selectedEntry?.contractor.name} · {selectedEntry?.hours}h {selectedEntry?.task}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-accent/30 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hours:</span>
                  <span className="font-semibold">{selectedEntry.hours}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate:</span>
                  <span className="font-semibold">${selectedEntry.contractor.hourlyRate}/hr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold text-accent-brand">
                    ${(selectedEntry.hours * selectedEntry.contractor.hourlyRate).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedEntry.notes && (
                <div>
                  <label className="block mb-2 text-sm font-medium">Notes from Contractor</label>
                  <p className="text-sm p-3 bg-accent/30 rounded-lg">{selectedEntry.notes}</p>
                </div>
              )}

              <div>
                <label className="block mb-2 text-sm font-medium">
                  Manager Notes (Optional)
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add feedback or notes..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmApprove} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Mock data generator
function generateMockAggregates(year: number, month: number): Map<string, DayAggregate> {
  const map = new Map<string, DayAggregate>();
  
  const contractors = [
    { id: "c1", name: "Sarah Chen", avatar: "SC", role: "Senior Engineer", hourlyRate: 120 },
    { id: "c2", name: "Mike Johnson", avatar: "MJ", role: "Frontend Dev", hourlyRate: 110 },
    { id: "c3", name: "Lisa Park", avatar: "LP", role: "UI Designer", hourlyRate: 95 },
  ];

  // Generate entries for weekdays
  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, month, day);
    if (date.getMonth() !== month) break;
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    const contributors: ContributorEntry[] = contractors.map((c, i) => ({
      id: `entry-${day}-${i}`,
      contractor: c,
      hours: 8,
      task: ["Development", "UI Design", "Code Review"][i % 3],
      notes: `Worked on project tasks for ${date.toLocaleDateString()}`,
      startTime: "09:00",
      endTime: "17:00",
      status: day < 15 ? "approved" : day < 20 ? "submitted" : "draft",
    }));

    const totalHours = contributors.reduce((sum, c) => sum + c.hours, 0);
    const totalCost = contributors.reduce((sum, c) => sum + (c.hours * c.contractor.hourlyRate), 0);

    const statusBreakdown = {
      approved: contributors.filter(c => c.status === "approved").length,
      pending: contributors.filter(c => c.status === "submitted").length,
      rejected: contributors.filter(c => c.status === "rejected").length,
      draft: contributors.filter(c => c.status === "draft").length,
    };

    map.set(formatDateKey(date), {
      date,
      totalHours,
      totalCost,
      contributors,
      statusBreakdown,
    });
  }

  return map;
}

// Utility functions
function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
}
