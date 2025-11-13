import { useState } from "react";
import { 
  Calendar, Clock, ChevronLeft, ChevronRight, Plus, Save, Send,
  Copy, Trash2, CheckCircle2, XCircle, AlertCircle, Download,
  MessageSquare, Info, LayoutList, CalendarDays
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner@2.0.3";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { TimesheetCalendarView } from "./TimesheetCalendarView";
import { TimesheetListView } from "./TimesheetListView";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

interface TimesheetEntry {
  id: string;
  date: Date;
  hours: number;
  startTime?: string;
  endTime?: string;
  breakMinutes: number;
  notes: string;
  projectTask?: string;
}

interface Timesheet {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  entries: TimesheetEntry[];
  status: "draft" | "submitted" | "approved" | "manager_approved" | "rejected";
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  totalHours: number;
}

interface TimesheetModuleProps {
  projectId?: string;
  contractorId?: string;
  contractorName?: string;
  hourlyRate?: number;
  mode?: "contractor" | "manager";
}

export function TimesheetModule({ 
  contractorName = "Current User",
  hourlyRate = 95,
  mode = "contractor"
}: TimesheetModuleProps) {
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "weekly">("calendar");
  const [currentWeek, setCurrentWeek] = useState(getWeekStart(new Date()));
  const [trackingMode, setTrackingMode] = useState<"hours" | "time">("hours");
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  
  // Mock timesheet data
  const [timesheet, setTimesheet] = useState<Timesheet>({
    id: "ts-001",
    weekStart: currentWeek,
    weekEnd: getWeekEnd(currentWeek),
    entries: generateDefaultEntries(currentWeek),
    status: "draft",
    totalHours: 0,
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() + i);
    return date;
  });

  const totalHours = timesheet.entries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalPay = totalHours * hourlyRate;

  const handlePreviousWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() - 7);
    setCurrentWeek(newWeek);
    setTimesheet({
      ...timesheet,
      weekStart: newWeek,
      weekEnd: getWeekEnd(newWeek),
      entries: generateDefaultEntries(newWeek),
      status: "draft",
    });
  };

  const handleNextWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + 7);
    setCurrentWeek(newWeek);
    setTimesheet({
      ...timesheet,
      weekStart: newWeek,
      weekEnd: getWeekEnd(newWeek),
      entries: generateDefaultEntries(newWeek),
      status: "draft",
    });
  };

  const handleUpdateEntry = (entryId: string, field: keyof TimesheetEntry, value: any) => {
    setTimesheet(prev => ({
      ...prev,
      entries: prev.entries.map(entry => {
        if (entry.id === entryId) {
          const updated = { ...entry, [field]: value };
          
          // Auto-calculate hours from time if in time mode
          if (trackingMode === "time" && (field === "startTime" || field === "endTime" || field === "breakMinutes")) {
            if (updated.startTime && updated.endTime) {
              const hours = calculateHoursFromTime(updated.startTime, updated.endTime, updated.breakMinutes);
              updated.hours = hours;
            }
          }
          
          return updated;
        }
        return entry;
      })
    }));
  };

  const handleCopyPreviousWeek = () => {
    toast.success("Previous week's timesheet copied");
    // In real app, fetch previous week's data
  };

  const handleSaveDraft = () => {
    toast.success("Timesheet saved as draft");
  };

  const handleSubmit = () => {
    if (totalHours === 0) {
      toast.error("Please add hours before submitting");
      return;
    }
    setShowSubmitDialog(true);
  };

  const confirmSubmit = () => {
    setTimesheet(prev => ({
      ...prev,
      status: "submitted",
      submittedAt: new Date(),
    }));
    setShowSubmitDialog(false);
    toast.success("Timesheet submitted for approval");
  };

  const getStatusBadge = (status: Timesheet["status"]) => {
    const variants = {
      draft: { variant: "secondary" as const, icon: AlertCircle, text: "Draft" },
      submitted: { variant: "default" as const, icon: Clock, text: "Pending Approval" },
      approved: { variant: "default" as const, icon: CheckCircle2, text: "Approved", color: "bg-success" },
      manager_approved: { variant: "default" as const, icon: CheckCircle2, text: "Approved", color: "bg-success" },
      rejected: { variant: "destructive" as const, icon: XCircle, text: "Rejected" },
    };
    
    const config = variants[status];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={`gap-1.5 ${config.color || ""}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.text}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">Timesheet</h2>
          <p className="text-sm text-muted-foreground">
            {contractorName} · ${hourlyRate}/hour
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
              variant={viewMode === "weekly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("weekly")}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Weekly
            </Button>
          </div>
          {viewMode === "weekly" && getStatusBadge(timesheet.status)}
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>
      
      {/* Conditional Rendering */}
      {viewMode === "calendar" ? (
        <TimesheetCalendarView
          contractorName={contractorName}
          hourlyRate={hourlyRate}
          mode={mode}
        />
      ) : viewMode === "list" ? (
        <TimesheetListView
          contractorName={contractorName}
          hourlyRate={hourlyRate}
        />
      ) : (
        <>
          {/* Original Weekly View */}

      {/* Week Navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-accent-brand" />
            <div className="text-center">
              <p className="font-semibold">
                {formatDateRange(timesheet.weekStart, timesheet.weekEnd)}
              </p>
              <p className="text-sm text-muted-foreground">Week {getWeekNumber(currentWeek)}</p>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Tracking Mode:</label>
            <Tabs value={trackingMode} onValueChange={(v) => setTrackingMode(v as "hours" | "time")}>
              <TabsList className="h-8">
                <TabsTrigger value="hours" className="text-xs">Hours Only</TabsTrigger>
                <TabsTrigger value="time" className="text-xs">Start/End Time</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleCopyPreviousWeek} className="gap-2">
            <Copy className="w-4 h-4" />
            Copy Previous Week
          </Button>
        </div>
      </Card>

      {/* Timesheet Grid */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-accent/50 border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium w-32">Date</th>
                {trackingMode === "time" && (
                  <>
                    <th className="text-left p-4 font-medium w-28">Start Time</th>
                    <th className="text-left p-4 font-medium w-28">End Time</th>
                    <th className="text-left p-4 font-medium w-28">Break (min)</th>
                  </>
                )}
                <th className="text-left p-4 font-medium w-24">Hours</th>
                <th className="text-left p-4 font-medium w-48">Project/Task</th>
                <th className="text-left p-4 font-medium flex-1">Notes</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {timesheet.entries.map((entry, index) => {
                const isWeekend = entry.date.getDay() === 0 || entry.date.getDay() === 6;
                return (
                  <tr 
                    key={entry.id} 
                    className={`border-b border-border hover:bg-accent/30 apple-transition ${
                      isWeekend ? 'bg-accent/20' : ''
                    }`}
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{formatDayName(entry.date)}</p>
                        <p className="text-xs text-muted-foreground">{formatShortDate(entry.date)}</p>
                      </div>
                    </td>
                    
                    {trackingMode === "time" && (
                      <>
                        <td className="p-4">
                          <Input
                            type="time"
                            value={entry.startTime || ""}
                            onChange={(e) => handleUpdateEntry(entry.id, "startTime", e.target.value)}
                            className="h-9"
                            disabled={timesheet.status !== "draft"}
                          />
                        </td>
                        <td className="p-4">
                          <Input
                            type="time"
                            value={entry.endTime || ""}
                            onChange={(e) => handleUpdateEntry(entry.id, "endTime", e.target.value)}
                            className="h-9"
                            disabled={timesheet.status !== "draft"}
                          />
                        </td>
                        <td className="p-4">
                          <Input
                            type="number"
                            value={entry.breakMinutes || 0}
                            onChange={(e) => handleUpdateEntry(entry.id, "breakMinutes", parseInt(e.target.value) || 0)}
                            className="h-9"
                            min="0"
                            max="480"
                            disabled={timesheet.status !== "draft"}
                          />
                        </td>
                      </>
                    )}
                    
                    <td className="p-4">
                      <Input
                        type="number"
                        value={entry.hours || ""}
                        onChange={(e) => handleUpdateEntry(entry.id, "hours", parseFloat(e.target.value) || 0)}
                        className="h-9 font-semibold"
                        min="0"
                        max="24"
                        step="0.25"
                        placeholder="0.00"
                        disabled={timesheet.status !== "draft" || trackingMode === "time"}
                      />
                    </td>
                    
                    <td className="p-4">
                      <Select
                        value={entry.projectTask || ""}
                        onValueChange={(v) => handleUpdateEntry(entry.id, "projectTask", v)}
                        disabled={timesheet.status !== "draft"}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select task" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="design">UI Design</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="review">Code Review</SelectItem>
                          <SelectItem value="meeting">Client Meeting</SelectItem>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="testing">Testing/QA</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    
                    <td className="p-4">
                      <Input
                        value={entry.notes}
                        onChange={(e) => handleUpdateEntry(entry.id, "notes", e.target.value)}
                        placeholder="What did you work on?"
                        className="h-9"
                        disabled={timesheet.status !== "draft"}
                      />
                    </td>
                    
                    <td className="p-4">
                      {entry.hours > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateEntry(entry.id, "hours", 0)}
                          disabled={timesheet.status !== "draft"}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-accent/50 border-t-2 border-border">
              <tr>
                <td colSpan={trackingMode === "time" ? 4 : 1} className="p-4 font-semibold">
                  Total
                </td>
                <td className="p-4">
                  <div className="font-semibold text-lg text-accent-brand">
                    {totalHours.toFixed(2)} hrs
                  </div>
                </td>
                <td colSpan={3} className="p-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Estimated Pay</p>
                    <p className="font-semibold text-lg">${totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Summary Card */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Regular Hours</p>
          <p className="text-2xl font-semibold">{totalHours.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">@ ${hourlyRate}/hr</p>
        </Card>
        
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Days Worked</p>
          <p className="text-2xl font-semibold">
            {timesheet.entries.filter(e => e.hours > 0).length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">of 7 days</p>
        </Card>
        
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Payment</p>
          <p className="text-2xl font-semibold text-accent-brand">
            ${totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Before taxes</p>
        </Card>
      </div>

      {/* Review Section (if submitted/approved/rejected) */}
      {timesheet.status !== "draft" && timesheet.reviewNotes && (
        <Card className="p-6 border-accent-brand/50">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-accent-brand flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium mb-1">Manager Review</p>
              <p className="text-sm text-muted-foreground mb-2">{timesheet.reviewNotes}</p>
              {timesheet.reviewedAt && (
                <p className="text-xs text-muted-foreground">
                  Reviewed by {timesheet.reviewedBy} on {formatDate(timesheet.reviewedAt)}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      {timesheet.status === "draft" && (
        <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>
              Timesheets are due every Friday by 5 PM. 
              {totalHours > 0 && ` You have ${totalHours.toFixed(1)} hours logged this week.`}
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveDraft} className="gap-2">
              <Save className="w-4 h-4" />
              Save Draft
            </Button>
            <Button onClick={handleSubmit} className="gap-2">
              <Send className="w-4 h-4" />
              Submit for Approval
            </Button>
          </div>
        </div>
      )}

      {timesheet.status === "submitted" && (
        <Card className="p-6 bg-accent/30 text-center">
          <Clock className="w-12 h-12 text-accent-brand mx-auto mb-3" />
          <h3 className="mb-2">Timesheet Submitted</h3>
          <p className="text-muted-foreground mb-4">
            Your timesheet is pending manager approval. You'll be notified once it's reviewed.
          </p>
          <p className="text-sm text-muted-foreground">
            Submitted on {formatDate(timesheet.submittedAt!)}
          </p>
        </Card>
      )}

      {timesheet.status === "approved" && (
        <Card className="p-6 bg-success/10 border-success/50 text-center">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
          <h3 className="mb-2">Timesheet Approved</h3>
          <p className="text-muted-foreground mb-4">
            Your timesheet has been approved. Payment will be processed within 5 business days.
          </p>
          <p className="text-sm text-muted-foreground">
            Approved on {formatDate(timesheet.reviewedAt!)}
          </p>
        </Card>
      )}

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Timesheet?</DialogTitle>
            <DialogDescription>
              Please review your timesheet before submitting. Once submitted, you won't be able to make changes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="flex justify-between p-3 bg-accent/30 rounded-lg">
              <span className="text-sm font-medium">Total Hours:</span>
              <span className="font-semibold">{totalHours.toFixed(2)} hours</span>
            </div>
            <div className="flex justify-between p-3 bg-accent/30 rounded-lg">
              <span className="text-sm font-medium">Days Worked:</span>
              <span className="font-semibold">{timesheet.entries.filter(e => e.hours > 0).length} days</span>
            </div>
            <div className="flex justify-between p-3 bg-accent-brand/10 rounded-lg border border-accent-brand/20">
              <span className="text-sm font-medium">Estimated Payment:</span>
              <span className="font-semibold text-accent-brand">${totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSubmit} className="gap-2">
              <Send className="w-4 h-4" />
              Submit Timesheet
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
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  return new Date(d.setDate(diff));
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function generateDefaultEntries(weekStart: Date): TimesheetEntry[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return {
      id: `entry-${i}`,
      date,
      hours: 0,
      breakMinutes: 0,
      notes: "",
    };
  });
}

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

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function calculateHoursFromTime(startTime: string, endTime: string, breakMinutes: number): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  
  let workMinutes = endTotalMin - startTotalMin;
  if (workMinutes < 0) workMinutes += 24 * 60; // Handle overnight
  
  workMinutes -= breakMinutes;
  
  return Math.max(0, workMinutes / 60);
}