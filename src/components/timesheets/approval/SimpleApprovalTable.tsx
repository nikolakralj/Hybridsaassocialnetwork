import { useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "../../ui/avatar";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { toast } from "sonner";

interface ContractorRow {
  id: string;
  name: string;
  initials: string;
  role: string;
  defaultHours: string;
  thisMonth: {
    total: number;
    approved: number;
    pending: number;
  };
  status: "pending" | "approved" | "rejected";
}

interface SimpleApprovalTableProps {
  contractors: ContractorRow[];
  onApprove: (contractorIds: string[]) => void;
  onReject: (contractorIds: string[]) => void;
  onReview: (contractorId: string) => void;
}

export function SimpleApprovalTable({
  contractors,
  onApprove,
  onReject,
  onReview,
}: SimpleApprovalTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Get unique roles
  const roles = Array.from(new Set(contractors.map(c => c.role)));

  // Filter contractors
  const filteredContractors = contractors.filter(c => {
    if (roleFilter !== "all" && c.role !== roleFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  // Toggle selection
  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContractors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContractors.map(c => c.id)));
    }
  };

  const handleBulkApprove = () => {
    onApprove(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBulkReject = () => {
    onReject(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const getStatusBadge = (status: ContractorRow["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team Contractors</h3>
          <p className="text-sm text-muted-foreground">
            {filteredContractors.length} contractor{filteredContractors.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map(role => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                onClick={handleBulkApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkReject}
                className="border-red-600 text-red-700 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="w-12 p-4 text-left">
                <Checkbox
                  checked={selectedIds.size === filteredContractors.length && filteredContractors.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th className="p-4 text-left text-sm font-medium">Contractor</th>
              <th className="p-4 text-left text-sm font-medium">Role</th>
              <th className="p-4 text-left text-sm font-medium">Default Hours</th>
              <th className="p-4 text-left text-sm font-medium">This Month</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
              <th className="p-4 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContractors.map((contractor, index) => (
              <tr
                key={contractor.id}
                className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                  selectedIds.has(contractor.id) ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                }`}
              >
                <td className="p-4">
                  <Checkbox
                    checked={selectedIds.has(contractor.id)}
                    onCheckedChange={() => toggleSelect(contractor.id)}
                  />
                </td>
                
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">
                        {contractor.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{contractor.name}</span>
                  </div>
                </td>

                <td className="p-4 text-sm text-muted-foreground">
                  {contractor.role}
                </td>

                <td className="p-4 text-sm text-muted-foreground">
                  {contractor.defaultHours}
                </td>

                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {contractor.thisMonth.total}h total
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {contractor.thisMonth.approved}h approved • {contractor.thisMonth.pending}h pending
                    </span>
                  </div>
                </td>

                <td className="p-4">
                  {getStatusBadge(contractor.status)}
                </td>

                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onReview(contractor.id)}
                    >
                      Review
                    </Button>
                    {contractor.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onApprove([contractor.id])}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onReject([contractor.id])}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredContractors.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            No contractors match your filters
          </div>
        )}
      </div>
    </div>
  );
}
