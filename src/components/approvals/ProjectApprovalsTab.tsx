import { useState } from "react";
import { CheckCircle2, Clock, AlertCircle, Filter, Download, Network } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ApprovalsWorkbench } from "./ApprovalsWorkbench";
import { Skeleton } from "../ui/skeleton";

interface ProjectApprovalsTabProps {
  projectId: string;
  projectName: string;
}

export function ProjectApprovalsTab({ projectId, projectName }: ProjectApprovalsTabProps) {
  const [viewMode, setViewMode] = useState<"queue" | "analytics">("queue");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  
  // Mock stats - will be replaced with real data
  const stats = {
    pending: 12,
    approved: 45,
    rejected: 3,
    totalWeek: 60,
    totalThisWeek: 15,
    avgApprovalTime: "4.2 hours",
  };

  return (
    <div className="space-y-6">
      {/* Project Approvals Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl m-0 mb-2">Approvals for {projectName}</h2>
          <p className="text-sm text-muted-foreground m-0">
            Review and approve timesheets and expenses for this project
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Network className="w-4 h-4" />
            View Graph
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground m-0">Pending</p>
              <p className="text-2xl m-0 mt-1">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground m-0">Approved</p>
              <p className="text-2xl m-0 mt-1">{stats.approved}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground m-0">Rejected</p>
              <p className="text-2xl m-0 mt-1">{stats.rejected}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground m-0">Avg Approval Time</p>
              <p className="text-2xl m-0 mt-1">{stats.avgApprovalTime}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* View Mode Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "queue" | "analytics")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="queue" className="gap-2">
              <Clock className="w-4 h-4" />
              Approval Queue
              {stats.pending > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              Analytics
              <Badge variant="outline" className="ml-2">New</Badge>
            </TabsTrigger>
          </TabsList>

          {viewMode === "queue" && (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Queue View */}
        <TabsContent value="queue" className="mt-6">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="m-0 mb-1">Approval Queue</h3>
                <p className="text-sm text-muted-foreground m-0">
                  {filterStatus === "all" 
                    ? "Showing all approvals for this project"
                    : `Showing ${filterStatus} approvals`
                  }
                </p>
              </div>
              
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                More Filters
              </Button>
            </div>

            {/* Embedded ApprovalsWorkbench (filtered to this project) */}
            <ApprovalsWorkbench 
              projectFilter={projectId}
              statusFilter={filterStatus}
              embedded={true}
            />
          </Card>
        </TabsContent>

        {/* Analytics View */}
        <TabsContent value="analytics" className="mt-6">
          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="m-0 mb-4">Approval Analytics</h3>
                <p className="text-sm text-muted-foreground m-0 mb-6">
                  Track approval performance and identify bottlenecks
                </p>
              </div>

              {/* Approval Trends Chart Placeholder */}
              <div className="border border-dashed border-border rounded-lg p-12 text-center">
                <div className="space-y-2">
                  <div className="text-muted-foreground">📊 Approval Trends</div>
                  <p className="text-sm text-muted-foreground m-0">
                    Chart showing approval volume over time
                  </p>
                  <Badge variant="outline" className="mt-2">Coming in Phase 8</Badge>
                </div>
              </div>

              {/* Approval Time by Person */}
              <div className="border border-dashed border-border rounded-lg p-12 text-center">
                <div className="space-y-2">
                  <div className="text-muted-foreground">⏱️ Approval Time by Person</div>
                  <p className="text-sm text-muted-foreground m-0">
                    Identify who approves fastest/slowest
                  </p>
                  <Badge variant="outline" className="mt-2">Coming in Phase 8</Badge>
                </div>
              </div>

              {/* SLA Compliance */}
              <div className="border border-dashed border-border rounded-lg p-12 text-center">
                <div className="space-y-2">
                  <div className="text-muted-foreground">✅ SLA Compliance</div>
                  <p className="text-sm text-muted-foreground m-0">
                    Track on-time vs late approvals
                  </p>
                  <Badge variant="outline" className="mt-2">Coming in Phase 8</Badge>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mini Graph Panel (Right Sidebar) */}
      <Card className="p-4 border-2 border-dashed border-border">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="m-0 text-sm">Quick Graph View</h4>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Network className="w-3 h-3" />
              Expand
            </Button>
          </div>
          
          <div className="bg-muted rounded-lg p-8 text-center">
            <div className="space-y-2">
              <Network className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground m-0">
                Mini graph showing approval path
              </p>
              <Badge variant="outline" className="mt-2">Phase 5 Day 6</Badge>
            </div>
          </div>

          <p className="text-xs text-muted-foreground m-0">
            Click items in the queue to see their approval path here
          </p>
        </div>
      </Card>
    </div>
  );
}
