import { useState } from "react";
import { 
  CheckCircle2, XCircle, MessageSquare, Calendar, Clock, 
  User, DollarSign, ChevronDown, Eye, Download, AlertTriangle,
  CalendarDays, LayoutList
} from "lucide-react";
import { TimesheetManagerCalendarView } from "./TimesheetManagerCalendarView";
import { TimesheetManagerListView } from "./TimesheetManagerListView";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Avatar } from "../ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { toast } from "sonner";

interface PendingTimesheet {
  id: string;
  contractor: {
    id: string;
    name: string;
    avatar: string;
    role: string;
    hourlyRate: number;
  };
  weekStart: Date;
  weekEnd: Date;
  totalHours: number;
  totalAmount: number;
  submittedAt: Date;
  entries: Array<{
    date: Date;
    hours: number;
    task: string;
    notes: string;
  }>;
  previousWeekHours?: number;
  averageWeeklyHours?: number;
}

interface TimesheetApprovalViewProps {
  onViewIndividualTimesheet?: (contractorId: string, contractorName: string) => void;
}

export function TimesheetApprovalView({ onViewIndividualTimesheet }: TimesheetApprovalViewProps = {}) {
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "cards">("calendar");
  const [selectedTimesheet, setSelectedTimesheet] = useState<PendingTimesheet | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Mock data
  const [pendingTimesheets, setPendingTimesheets] = useState<PendingTimesheet[]>([
    {
      id: "ts-001",
      contractor: {
        id: "c1",
        name: "Sarah Chen",
        avatar: "SC",
        role: "Senior Robotics Engineer",
        hourlyRate: 120,
      },
      weekStart: new Date(2024, 0, 8),
      weekEnd: new Date(2024, 0, 14),
      totalHours: 40,
      totalAmount: 4800,
      submittedAt: new Date(2024, 0, 14, 16, 30),
      previousWeekHours: 38,
      averageWeeklyHours: 39.5,
      entries: [
        { date: new Date(2024, 0, 8), hours: 8, task: "UI Design", notes: "Worked on navigation redesign" },
        { date: new Date(2024, 0, 9), hours: 8, task: "Development", notes: "Implemented new dashboard" },
        { date: new Date(2024, 0, 10), hours: 8, task: "Code Review", notes: "Reviewed PRs from team" },
        { date: new Date(2024, 0, 11), hours: 8, task: "Client Meeting", notes: "Sprint planning" },
        { date: new Date(2024, 0, 12), hours: 8, task: "Testing/QA", notes: "End-to-end testing" },
      ],
    },
    {
      id: "ts-002",
      contractor: {
        id: "c2",
        name: "Mike Johnson",
        avatar: "MJ",
        role: "Controls Engineer",
        hourlyRate: 110,
      },
      weekStart: new Date(2024, 0, 8),
      weekEnd: new Date(2024, 0, 14),
      totalHours: 35,
      totalAmount: 3850,
      submittedAt: new Date(2024, 0, 14, 17, 15),
      previousWeekHours: 40,
      averageWeeklyHours: 37.2,
      entries: [
        { date: new Date(2024, 0, 8), hours: 7, task: "Development", notes: "API integration" },
        { date: new Date(2024, 0, 9), hours: 7, task: "Development", notes: "Database optimization" },
        { date: new Date(2024, 0, 10), hours: 7, task: "Testing/QA", notes: "Unit tests" },
        { date: new Date(2024, 0, 11), hours: 7, task: "Code Review", notes: "PR reviews" },
        { date: new Date(2024, 0, 12), hours: 7, task: "Planning", notes: "Next sprint planning" },
      ],
    },
    {
      id: "ts-003",
      contractor: {
        id: "c3",
        name: "Lisa Park",
        avatar: "LP",
        role: "UI/UX Designer",
        hourlyRate: 95,
      },
      weekStart: new Date(2024, 0, 8),
      weekEnd: new Date(2024, 0, 14),
      totalHours: 20,
      totalAmount: 1900,
      submittedAt: new Date(2024, 0, 14, 14, 45),
      previousWeekHours: 20,
      averageWeeklyHours: 20,
      entries: [
        { date: new Date(2024, 0, 8), hours: 4, task: "UI Design", notes: "Mockup revisions" },
        { date: new Date(2024, 0, 9), hours: 4, task: "UI Design", notes: "Component library" },
        { date: new Date(2024, 0, 10), hours: 4, task: "Client Meeting", notes: "Design review" },
        { date: new Date(2024, 0, 11), hours: 4, task: "UI Design", notes: "Final designs" },
        { date: new Date(2024, 0, 12), hours: 4, task: "Planning", notes: "Next sprint prep" },
      ],
    },
  ]);

  const totalPendingAmount = pendingTimesheets.reduce((sum, ts) => sum + ts.totalAmount, 0);
  const totalPendingHours = pendingTimesheets.reduce((sum, ts) => sum + ts.totalHours, 0);

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const handleApprove = (timesheet: PendingTimesheet) => {
    setSelectedTimesheet(timesheet);
    setShowApproveDialog(true);
  };

  const handleReject = (timesheet: PendingTimesheet) => {
    setSelectedTimesheet(timesheet);
    setShowRejectDialog(true);
  };

  const confirmApprove = () => {
    if (!selectedTimesheet) return;
    
    setPendingTimesheets(prev => prev.filter(ts => ts.id !== selectedTimesheet.id));
    toast.success(`Timesheet approved for ${selectedTimesheet.contractor.name}`);
    setShowApproveDialog(false);
    setSelectedTimesheet(null);
    setReviewNotes("");
  };

  const confirmReject = () => {
    if (!selectedTimesheet || !reviewNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    
    setPendingTimesheets(prev => prev.filter(ts => ts.id !== selectedTimesheet.id));
    toast.success(`Timesheet rejected and returned to ${selectedTimesheet.contractor.name}`);
    setShowRejectDialog(false);
    setSelectedTimesheet(null);
    setReviewNotes("");
  };

  const getHoursVariance = (current: number, previous?: number): { text: string; color: string; isNormal: boolean } => {
    if (!previous) return { text: "", color: "", isNormal: true };
    
    const diff = current - previous;
    const percentDiff = (diff / previous) * 100;
    
    if (Math.abs(percentDiff) < 10) {
      return { text: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}h (normal)`, color: "text-muted-foreground", isNormal: true };
    } else if (percentDiff > 10) {
      return { text: `+${diff.toFixed(1)}h (↑${percentDiff.toFixed(0)}%)`, color: "text-warning", isNormal: false };
    } else {
      return { text: `${diff.toFixed(1)}h (↓${Math.abs(percentDiff).toFixed(0)}%)`, color: "text-accent-brand", isNormal: false };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">Timesheet Approvals</h2>
          <p className="text-sm text-muted-foreground">
            {pendingTimesheets.length} timesheet{pendingTimesheets.length !== 1 ? 's' : ''} pending review
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="gap-2"
            >
              <CalendarDays className="w-4 h-4" />
              Calendar
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <LayoutList className="w-4 h-4" />
              List
            </Button>
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              Cards
            </Button>
          </div>
          
          {pendingTimesheets.length > 0 && viewMode === "cards" && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Pending</p>
              <p className="text-xl font-semibold text-accent-brand">
                ${totalPendingAmount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{totalPendingHours} hours</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Conditional Rendering */}
      {viewMode === "calendar" ? (
        <TimesheetManagerCalendarView 
          onViewIndividualTimesheet={onViewIndividualTimesheet}
        />
      ) : viewMode === "list" ? (
        <TimesheetManagerListView />
      ) : (
        <>
          {/* Original Cards View */}

      {/* Quick Actions */}
      {pendingTimesheets.length > 0 && (
        <Card className="p-4 bg-accent/30 border-accent-brand/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="font-medium">Action Required</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                Review timesheets to process payments on time
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export All
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Pending Timesheets List */}
      {pendingTimesheets.length > 0 ? (
        <div className="space-y-4">
          {pendingTimesheets.map((timesheet) => {
            const variance = getHoursVariance(timesheet.totalHours, timesheet.previousWeekHours);
            const isExpanded = expandedIds.has(timesheet.id);
            
            return (
              <Card key={timesheet.id} className="overflow-hidden">
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(timesheet.id)}>
                  {/* Header */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        <Avatar className="w-12 h-12 bg-accent-brand/10 text-accent-brand flex items-center justify-center">
                          {timesheet.contractor.avatar}
                        </Avatar>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="m-0">{timesheet.contractor.name}</h3>
                            <Badge variant="secondary">{timesheet.contractor.role}</Badge>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              {formatDateRange(timesheet.weekStart, timesheet.weekEnd)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              Submitted {formatRelativeTime(timesheet.submittedAt)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <DollarSign className="w-4 h-4" />
                              ${timesheet.contractor.hourlyRate}/hr
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm text-muted-foreground mb-1">Total</p>
                        <p className="text-2xl font-semibold mb-1">{timesheet.totalHours} hrs</p>
                        <p className="font-semibold text-accent-brand">
                          ${timesheet.totalAmount.toLocaleString()}
                        </p>
                        {variance.text && (
                          <p className={`text-xs mt-1 ${variance.color}`}>
                            {variance.text}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="p-3 bg-accent/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Days Worked</p>
                        <p className="font-semibold">{timesheet.entries.length} days</p>
                      </div>
                      <div className="p-3 bg-accent/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Avg Hours/Day</p>
                        <p className="font-semibold">
                          {(timesheet.totalHours / timesheet.entries.length).toFixed(1)} hrs
                        </p>
                      </div>
                      <div className="p-3 bg-accent/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Weekly Average</p>
                        <p className="font-semibold">{timesheet.averageWeeklyHours} hrs</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="w-4 h-4" />
                          {isExpanded ? "Hide" : "View"} Details
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      
                      <div className="flex-1" />
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleReject(timesheet)}
                        className="gap-2 hover:bg-destructive/10 hover:border-destructive/20"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                      
                      <Button 
                        size="sm" 
                        onClick={() => handleApprove(timesheet)}
                        className="gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <CollapsibleContent>
                    <div className="border-t border-border bg-accent/20">
                      <div className="p-6">
                        <h4 className="mb-4">Daily Breakdown</h4>
                        <div className="space-y-2">
                          {timesheet.entries.map((entry, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className="w-20">
                                  <p className="font-medium">{formatDayName(entry.date)}</p>
                                  <p className="text-xs text-muted-foreground">{formatShortDate(entry.date)}</p>
                                </div>
                                <Badge variant="secondary" className="w-32">
                                  {entry.task}
                                </Badge>
                                <p className="text-sm text-muted-foreground flex-1">{entry.notes}</p>
                              </div>
                              <div className="text-right w-20">
                                <p className="font-semibold">{entry.hours} hrs</p>
                                <p className="text-xs text-muted-foreground">
                                  ${(entry.hours * timesheet.contractor.hourlyRate).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h3 className="mb-2">All Caught Up!</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            There are no pending timesheets to review. New submissions will appear here.
          </p>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Timesheet</DialogTitle>
            <DialogDescription>
              Confirm approval for {selectedTimesheet?.contractor.name}'s timesheet
            </DialogDescription>
          </DialogHeader>
          
          {selectedTimesheet && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center p-4 bg-accent/30 rounded-lg">
                <div>
                  <p className="font-medium">{selectedTimesheet.contractor.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateRange(selectedTimesheet.weekStart, selectedTimesheet.weekEnd)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">{selectedTimesheet.totalHours} hrs</p>
                  <p className="text-sm text-accent-brand font-semibold">
                    ${selectedTimesheet.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">
                  Notes for Contractor (Optional)
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Great work this week! Looking forward to next sprint..."
                  rows={3}
                />
              </div>

              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <p className="text-sm">
                  ✓ Invoice will be automatically generated<br />
                  ✓ Payment will be processed within 5 business days<br />
                  ✓ Contractor will be notified via email
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmApprove} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Approve & Generate Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
            <DialogDescription>
              Please provide feedback for {selectedTimesheet?.contractor.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTimesheet && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center p-4 bg-accent/30 rounded-lg">
                <div>
                  <p className="font-medium">{selectedTimesheet.contractor.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateRange(selectedTimesheet.weekStart, selectedTimesheet.weekEnd)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">{selectedTimesheet.totalHours} hrs</p>
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">
                  Reason for Rejection <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Please clarify hours for Tuesday and provide more detail in notes..."
                  rows={4}
                  className="border-destructive/50"
                />
              </div>

              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-sm">
                  ⚠️ The timesheet will be returned to the contractor<br />
                  ⚠️ They can make corrections and resubmit<br />
                  ⚠️ Payment will be delayed until approval
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmReject}
              className="gap-2"
              disabled={!reviewNotes.trim()}
            >
              <XCircle className="w-4 h-4" />
              Reject & Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}

// Utility functions
function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
