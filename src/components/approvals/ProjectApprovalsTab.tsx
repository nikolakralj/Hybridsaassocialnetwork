import { useState } from "react";
import { User } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ApprovalsWorkbench } from "./ApprovalsWorkbench";

interface ProjectApprovalsTabProps {
  projectId: string;
  projectName: string;
  viewerName?: string;
  viewerNodeId?: string;
}

type QueueStatus = "all" | "pending" | "approved" | "rejected";

const queueFilters: Array<{ value: QueueStatus; label: string }> = [
  { value: "pending", label: "Pending first" },
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function ProjectApprovalsTab({
  projectId,
  projectName,
  viewerName,
  viewerNodeId,
}: ProjectApprovalsTabProps) {
  const [viewMode, setViewMode] = useState<"queue" | "analytics">("queue");
  const [filterStatus, setFilterStatus] = useState<QueueStatus>("pending");

  return (
    <Tabs
      value={viewMode}
      onValueChange={(value) => setViewMode(value as "queue" | "analytics")}
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_0_rgb(0_0_0/0.05)]"
    >
      <div className="border-b border-border/60 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="uppercase tracking-[0.14em] text-[11px]">
                Approvals
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                {viewerName ? `Signed in as ${viewerName}` : "Using current account permissions"}
              </Badge>
            </div>

            <div className="space-y-1">
              <h2 className="m-0 text-2xl font-semibold tracking-tight text-foreground">
                Approval workspace
              </h2>
              <p className="m-0 max-w-3xl text-sm text-muted-foreground">
                Manage approval requests for {projectName} with pending items kept at the front of the queue.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="queue" className="min-w-[120px]">
                Queue
              </TabsTrigger>
              <TabsTrigger value="analytics" className="min-w-[120px]">
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {viewMode === "queue" && (
          <div className="mt-4 flex flex-wrap gap-2">
            {queueFilters.map((filter) => (
              <Button
                key={filter.value}
                size="sm"
                variant={filterStatus === filter.value ? "default" : "outline"}
                onClick={() => setFilterStatus(filter.value)}
                className="rounded-full px-4"
              >
                {filter.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <TabsContent value="queue" className="m-0 p-4 sm:p-6">
        <ApprovalsWorkbench
          projectFilter={projectId}
          statusFilter={filterStatus}
          viewerNodeId={viewerNodeId}
          embedded
        />
      </TabsContent>

      <TabsContent value="analytics" className="m-0 p-4 sm:p-6">
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center sm:px-6">
          <h3 className="m-0 text-lg font-semibold text-foreground">Analytics is staged for a later pass</h3>
          <p className="mx-auto mt-2 mb-0 max-w-2xl text-sm text-muted-foreground">
            This workspace is intentionally focused on queue throughput for now. Use the queue filters and workbench
            controls to keep approvals moving.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
