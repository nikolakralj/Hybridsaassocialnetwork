import { useState } from "react";
import { User, Calendar, Clock, ChevronRight, Search, Filter } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Avatar } from "../ui/avatar";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { BatchApprovalBar } from "./BatchApprovalBar";
import { toast } from "sonner";

interface Contractor {
  id: string;
  name: string;
  avatar: string;
  role: string;
  hourlyRate: number;
  timesheetStatus: "draft" | "submitted" | "approved" | "rejected" | "none";
  currentMonthHours: number;
  lastSubmitted?: Date;
}

interface ContractorTimesheetBrowserProps {
  projectId: string;
  projectName: string;
  contractors: Contractor[];
  month: Date;
  showRates?: boolean; // Role-based
  onOpenTimesheet: (contractorId: string, contractorName: string) => void;
}

export function ContractorTimesheetBrowser({
  projectId,
  projectName,
  contractors,
  month,
  showRates = true,
  onOpenTimesheet,
}: ContractorTimesheetBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredContractors = contractors.filter(contractor => {
    const matchesSearch = contractor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         contractor.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || contractor.timesheetStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const toggleSelected = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
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

  const handleBatchApprove = () => {
    const count = selectedIds.size;
    toast.success(`Approved ${count} timesheet${count !== 1 ? 's' : ''}`);
    setSelectedIds(new Set());
  };

  const handleBatchReject = () => {
    const count = selectedIds.size;
    toast.error(`Rejected ${count} timesheet${count !== 1 ? 's' : ''}`);
    setSelectedIds(new Set());
  };

  // Prepare selected timesheets for batch bar
  const selectedTimesheets = contractors
    .filter(c => selectedIds.has(c.id))
    .map(c => ({
      contractorId: c.id,
      contractorName: c.name,
      hours: c.currentMonthHours,
      amount: showRates ? c.currentMonthHours * c.hourlyRate : undefined,
      status: c.timesheetStatus === "none" ? "draft" as const : c.timesheetStatus,
    }));

  return (
    <div className="space-y-6">
      {/* Batch Approval Bar */}
      <BatchApprovalBar
        selectedTimesheets={selectedTimesheets}
        showRates={showRates}
        onApproveAll={handleBatchApprove}
        onRejectAll={handleBatchReject}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* Header */}
      <div>
        <h3 className="mb-1">Individual Contractor Timesheets</h3>
        <p className="text-sm text-muted-foreground">
          View and manage each contractor's timesheet for {monthName}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contractors..."
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="none">Not Started</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contractor Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredContractors.map((contractor) => (
          <Card
            key={contractor.id}
            className={`p-5 hover:border-accent-brand hover:apple-shadow-md apple-transition cursor-pointer ${
              selectedIds.has(contractor.id) ? 'border-accent-brand bg-accent-brand/5' : ''
            }`}
            onClick={() => onOpenTimesheet(contractor.id, contractor.name)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Selection checkbox */}
                <div onClick={(e) => toggleSelected(contractor.id, e)}>
                  <Checkbox
                    checked={selectedIds.has(contractor.id)}
                    className="border-2"
                  />
                </div>
                
                <Avatar className="w-12 h-12 bg-accent-brand/10 text-accent-brand flex items-center justify-center">
                  {contractor.avatar}
                </Avatar>
                <div>
                  <p className="font-semibold">{contractor.name}</p>
                  <p className="text-sm text-muted-foreground">{contractor.role}</p>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                {contractor.timesheetStatus === "draft" && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Draft
                  </Badge>
                )}
                {contractor.timesheetStatus === "submitted" && (
                  <Badge variant="default" className="gap-1.5 bg-warning">
                    <Clock className="w-3.5 h-3.5" />
                    Pending
                  </Badge>
                )}
                {contractor.timesheetStatus === "approved" && (
                  <Badge variant="default" className="gap-1.5 bg-success">
                    <Clock className="w-3.5 h-3.5" />
                    Approved
                  </Badge>
                )}
                {contractor.timesheetStatus === "rejected" && (
                  <Badge variant="destructive" className="gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Rejected
                  </Badge>
                )}
                {contractor.timesheetStatus === "none" && (
                  <Badge variant="outline" className="gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Not Started
                  </Badge>
                )}
              </div>

              {/* Hours */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Hours this month:</span>
                <span className="font-semibold text-accent-brand">
                  {contractor.currentMonthHours}h
                </span>
              </div>

              {/* Last submitted */}
              {contractor.lastSubmitted && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last submitted:</span>
                  <span className="text-sm">
                    {contractor.lastSubmitted.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
              )}

              {/* Hourly rate */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Rate:</span>
                <span className="text-sm font-medium">${contractor.hourlyRate}/hr</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full mt-4 gap-2"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTimesheet(contractor.id, contractor.name);
              }}
            >
              <Calendar className="w-4 h-4" />
              Open Timesheet
            </Button>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredContractors.length === 0 && (
        <Card className="p-12 text-center">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="mb-2">No contractors found</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery || statusFilter !== "all" 
              ? "Try adjusting your filters" 
              : "No contractors assigned to this project yet"}
          </p>
        </Card>
      )}

      {/* Help Card */}
      <Card className="p-4 bg-accent/20">
        <p className="text-sm font-medium mb-2">💡 When to use this view:</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>• When each contractor has <span className="font-medium">completely different schedules</span></p>
          <p>• When hours vary <span className="font-medium">day-by-day</span> per person</p>
          <p>• When you need to <span className="font-medium">review one person's full month</span></p>
          <p>• When bulk entry won't work (everyone is different)</p>
        </div>
      </Card>
    </div>
  );
}
