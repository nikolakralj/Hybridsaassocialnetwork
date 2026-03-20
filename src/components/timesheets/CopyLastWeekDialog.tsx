import { useState } from "react";
import { Copy, Calendar, Users, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { toast } from "sonner";

interface CopyLastWeekDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractors: Array<{
    id: string;
    name: string;
    initials: string;
  }>;
  onConfirm: (selectedContractorIds: string[], targetWeekStart: Date) => void;
}

export function CopyLastWeekDialog({
  open,
  onOpenChange,
  contractors,
  onConfirm,
}: CopyLastWeekDialogProps) {
  const [selectedContractorIds, setSelectedContractorIds] = useState<Set<string>>(
    new Set(contractors.map(c => c.id))
  );

  const today = new Date();
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(today.getDate() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6);

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

  const allSelected = selectedContractorIds.size === contractors.length;
  const someSelected = selectedContractorIds.size > 0 && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedContractorIds(new Set());
    } else {
      setSelectedContractorIds(new Set(contractors.map(c => c.id)));
    }
  };

  const handleToggleContractor = (id: string) => {
    const newSelection = new Set(selectedContractorIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedContractorIds(newSelection);
  };

  const handleConfirm = () => {
    if (selectedContractorIds.size === 0) {
      toast.error("Please select at least one contractor");
      return;
    }

    onConfirm(Array.from(selectedContractorIds), thisWeekStart);
    toast.success(
      `Copied last week's hours for ${selectedContractorIds.size} contractor${
        selectedContractorIds.size !== 1 ? 's' : ''
      }`
    );
    onOpenChange(false);
  };

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  // Mock data - in real app, fetch from API
  const lastWeekTotal = 120; // Total hours from last week

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            Copy Last Week's Hours
          </DialogTitle>
          <DialogDescription>
            Copy timesheet entries from last week to this week for selected contractors
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Range Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-accent/30 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Copy From</span>
              </div>
              <p className="font-semibold">{formatDateRange(lastWeekStart, lastWeekEnd)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {lastWeekTotal}h total logged
              </p>
            </div>

            <div className="p-4 bg-accent-brand/5 rounded-lg border border-accent-brand/30">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-accent-brand" />
                <span className="text-sm font-medium text-accent-brand">Copy To</span>
              </div>
              <p className="font-semibold">{formatDateRange(thisWeekStart, thisWeekEnd)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                This week (current)
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning mb-1">Important</p>
              <p className="text-muted-foreground">
                This will copy all hours, tasks, and notes from last week. Existing entries
                for this week will not be overwritten.
              </p>
            </div>
          </div>

          {/* Contractor Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Select Contractors</span>
                <Badge variant="secondary">{selectedContractorIds.size} selected</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="gap-2"
              >
                <Checkbox checked={allSelected || someSelected} />
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="space-y-2 max-h-[240px] overflow-y-auto border border-border rounded-lg p-2">
              {contractors.map((contractor) => {
                const isSelected = selectedContractorIds.has(contractor.id);
                
                return (
                  <div
                    key={contractor.id}
                    onClick={() => handleToggleContractor(contractor.id)}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg apple-transition cursor-pointer
                      ${isSelected ? 'bg-accent-brand/5 border-accent-brand/30' : 'bg-card hover:bg-accent/30'}
                      border
                    `}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleContractor(contractor.id)}
                    />
                    <div className="w-8 h-8 rounded-full bg-accent-brand/10 flex items-center justify-center text-xs font-medium text-accent-brand">
                      {contractor.initials}
                    </div>
                    <span className="font-medium">{contractor.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedContractorIds.size === 0}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Hours for {selectedContractorIds.size} Contractor
            {selectedContractorIds.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
