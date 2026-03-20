import { useState } from "react";
import {
  CheckCircle2, XCircle, Clock, ChevronDown, Download,
  Eye, MessageSquare, Filter, TrendingUp, AlertTriangle
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { Checkbox } from "../ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { BatchApprovalBar } from "./BatchApprovalBar";

interface DayEntry {
  date: Date;
  hours: number;
  task: string;
  notes: string;
  status: "draft" | "submitted" | "approved" | "rejected";
}

interface ContractorTimesheet {
  id: string;
  contractor: {
    id: string;
    name: string;
    avatar: string;
    role: string;
    hourlyRate: number;
  };
  entries: DayEntry[];
  totalHours: number;
  totalCost: number;
  daysWorked: number;
  variance: number; // vs previous month
}

export function TimesheetManagerListView({ 
  selectedContractor = "all" 
}: { 
  selectedContractor?: string 
}) {
  const [currentDate] = useState(new Date());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Mock data
  const [timesheets] = useState<ContractorTimesheet[]>([
    {
      id: "ts-c1",
      contractor: {
        id: "c1",
        name: "Sarah Chen",
        avatar: "SC",
        role: "Senior Engineer",
        hourlyRate: 120,
      },
      entries: generateMockEntries(year, month, 160),
      totalHours: 160,
      totalCost: 19200,
      daysWorked: 20,
      variance: 5,
    },
    {
      id: "ts-c2",
      contractor: {
        id: "c2",
        name: "Mike Johnson",
        avatar: "MJ",
        role: "Frontend Developer",
        hourlyRate: 110,
      },
      entries: generateMockEntries(year, month, 152),
      totalHours: 152,
      totalCost: 16720,
      daysWorked: 19,
      variance: -8,
    },
    {
      id: "ts-c3",
      contractor: {
        id: "c3",
        name: "Lisa Park",
        avatar: "LP",
        role: "UI Designer",
        hourlyRate: 95,
      },
      entries: generateMockEntries(year, month, 80),
      totalHours: 80,
      totalCost: 7600,
      daysWorked: 10,
      variance: 0,
    },
  ]);

  // Filter timesheets based on selected contractor
  const filteredTimesheets = selectedContractor === "all" 
    ? timesheets 
    : timesheets.filter(ts => ts.contractor.id === selectedContractor);

  const totalHours = filteredTimesheets.reduce((sum, ts) => sum + ts.totalHours, 0);
  const totalCost = filteredTimesheets.reduce((sum, ts) => sum + ts.totalCost, 0);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTimesheets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTimesheets.map(ts => ts.id)));
    }
  };

  const handleBulkApprove = () => {
    const count = selectedIds.size;
    toast.success(`Approved ${count} timesheet${count !== 1 ? 's' : ''}`);
    setSelectedIds(new Set());
  };

  const handleBulkReject = () => {
    const count = selectedIds.size;
    toast.error(`Rejected ${count} timesheet${count !== 1 ? 's' : ''}`);
    setSelectedIds(new Set());
  };

  // Prepare data for batch approval bar
  const selectedTimesheets = filteredTimesheets
    .filter(ts => selectedIds.has(ts.id))
    .map(ts => {
      const submittedCount = ts.entries.filter(e => e.status === "submitted").length;
      const approvedCount = ts.entries.filter(e => e.status === "approved").length;
      const status = submittedCount > 0 ? "submitted" : approvedCount > 0 ? "approved" : "draft";
      
      return {
        contractorId: ts.contractor.id,
        contractorName: ts.contractor.name,
        hours: ts.totalHours,
        amount: ts.totalCost,
        status: status as "draft" | "submitted" | "approved" | "rejected",
      };
    });

  const handleApprove = (id: string, name: string) => {
    toast.success(`Approved timesheet for ${name}`);
  };

  const handleReject = (id: string, name: string) => {
    toast.error(`Rejected timesheet for ${name}`);
  };

  const getVarianceDisplay = (variance: number) => {
    if (variance === 0) return { text: "Same as last month", color: "text-muted-foreground", icon: null };
    if (variance > 0) return { 
      text: `+${variance}h vs last month`, 
      color: "text-warning", 
      icon: <TrendingUp className="w-3.5 h-3.5" />
    };
    return { 
      text: `${variance}h vs last month`, 
      color: "text-accent-brand", 
      icon: <TrendingUp className="w-3.5 h-3.5 rotate-180" />
    };
  };

  const getStatusBadge = (entries: DayEntry[]) => {
    const pending = entries.filter(e => e.status === "submitted").length;
    const approved = entries.filter(e => e.status === "approved").length;
    const rejected = entries.filter(e => e.status === "rejected").length;

    if (rejected > 0) {
      return (
        <Badge variant="destructive" className="gap-1.5">
          <XCircle className="w-3.5 h-3.5" />
          {rejected} Rejected
        </Badge>
      );
    }
    if (pending > 0) {
      return (
        <Badge variant="default" className="gap-1.5 bg-warning">
          <Clock className="w-3.5 h-3.5" />
          {pending} Pending
        </Badge>
      );
    }
    if (approved > 0) {
      return (
        <Badge variant="default" className="gap-1.5 bg-success">
          <CheckCircle2 className="w-3.5 h-3.5" />
          All Approved
        </Badge>
      );
    }
    return null;
  };

  // Get days (columns)
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  const days: Date[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  return (
    <div className="space-y-6">
      {/* Batch Approval Bar */}
      <BatchApprovalBar
        selectedTimesheets={selectedTimesheets}
        showRates={true} // In real app, this would be role-based
        onApproveAll={handleBulkApprove}
        onRejectAll={handleBulkReject}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">Team List View</h2>
          <p className="text-sm text-muted-foreground">
            {formatMonthYear(currentDate)} · {timesheets.length} contractors
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending only</SelectItem>
              <SelectItem value="approved">Approved only</SelectItem>
              <SelectItem value="rejected">Rejected only</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
          <p className="text-2xl font-semibold text-accent-brand">{totalHours}h</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
          <p className="text-2xl font-semibold">${totalCost.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Avg Hours/Person</p>
          <p className="text-2xl font-semibold">
            {filteredTimesheets.length > 0 ? Math.round(totalHours / filteredTimesheets.length) : 0}h
          </p>
        </Card>
      </div>

      {/* Timesheets List */}
      <div className="space-y-3">
        {filteredTimesheets.map((ts) => {
          const isExpanded = expandedIds.has(ts.id);
          const isSelected = selectedIds.has(ts.id);
          const variance = getVarianceDisplay(ts.variance);

          return (
            <Card key={ts.id} className="overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(ts.id)}>
                {/* Contractor Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelected(ts.id)}
                    />

                    <Avatar className="w-12 h-12 bg-accent-brand/10 text-accent-brand flex items-center justify-center">
                      {ts.contractor.avatar}
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="m-0">{ts.contractor.name}</h3>
                        <Badge variant="secondary">{ts.contractor.role}</Badge>
                        {getStatusBadge(ts.entries)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {ts.totalHours}h ({ts.daysWorked} days)
                        </div>
                        <div className={`flex items-center gap-1.5 ${variance.color}`}>
                          {variance.icon}
                          {variance.text}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
                      <p className="text-xl font-semibold text-accent-brand">
                        ${ts.totalCost.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="w-4 h-4" />
                          {isExpanded ? "Hide" : "View"} Details
                          <ChevronDown className={`w-4 h-4 apple-transition ${isExpanded ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(ts.id, ts.contractor.name)}
                        className="gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleApprove(ts.id, ts.contractor.name)}
                        className="gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Daily Breakdown */}
                <CollapsibleContent>
                  <div className="border-t border-border bg-accent/20 p-6">
                    <h4 className="mb-4">Daily Breakdown</h4>

                    {/* Table View */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-accent/50">
                          <tr>
                            <th className="text-left p-2 font-medium">Date</th>
                            <th className="text-left p-2 font-medium">Hours</th>
                            <th className="text-left p-2 font-medium">Task</th>
                            <th className="text-left p-2 font-medium">Notes</th>
                            <th className="text-left p-2 font-medium">Status</th>
                            <th className="text-right p-2 font-medium">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ts.entries
                            .filter(e => e.hours > 0)
                            .map((entry, idx) => (
                            <tr key={idx} className="border-t border-border hover:bg-accent/30">
                              <td className="p-2">
                                <div>
                                  <p className="font-medium">{formatDayName(entry.date)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatShortDate(entry.date)}
                                  </p>
                                </div>
                              </td>
                              <td className="p-2 font-semibold">{entry.hours}h</td>
                              <td className="p-2">
                                <Badge variant="secondary">{entry.task}</Badge>
                              </td>
                              <td className="p-2 text-muted-foreground max-w-xs truncate">
                                {entry.notes}
                              </td>
                              <td className="p-2">
                                {entry.status === "approved" && (
                                  <Badge variant="default" className="bg-success gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Approved
                                  </Badge>
                                )}
                                {entry.status === "submitted" && (
                                  <Badge variant="default" className="bg-warning gap-1">
                                    <Clock className="w-3 h-3" />
                                    Pending
                                  </Badge>
                                )}
                                {entry.status === "rejected" && (
                                  <Badge variant="destructive" className="gap-1">
                                    <XCircle className="w-3 h-3" />
                                    Rejected
                                  </Badge>
                                )}
                              </td>
                              <td className="p-2 text-right font-semibold">
                                ${(entry.hours * ts.contractor.hourlyRate).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-accent/50 border-t-2 border-border">
                          <tr>
                            <td colSpan={5} className="p-2 font-semibold">Total</td>
                            <td className="p-2 text-right font-semibold text-accent-brand">
                              ${ts.totalCost.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Mock data generator
function generateMockEntries(year: number, month: number, totalHours: number): DayEntry[] {
  const entries: DayEntry[] = [];
  const hoursPerDay = 8;
  const daysNeeded = Math.ceil(totalHours / hoursPerDay);
  
  let dayCount = 0;
  for (let day = 1; day <= 31 && dayCount < daysNeeded; day++) {
    const date = new Date(year, month, day);
    if (date.getMonth() !== month) break;
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    entries.push({
      date,
      hours: hoursPerDay,
      task: ["Development", "UI Design", "Code Review"][dayCount % 3],
      notes: `Worked on project tasks`,
      status: day < 15 ? "approved" : day < 20 ? "submitted" : "draft",
    });
    
    dayCount++;
  }

  return entries;
}

// Utility functions
function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
