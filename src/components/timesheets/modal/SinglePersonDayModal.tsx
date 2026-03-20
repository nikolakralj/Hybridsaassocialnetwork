import { useState } from "react";
import { Clock, Calendar, Trash2, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { ScrollArea } from "../../ui/scroll-area";
import { cn } from "../../ui/utils";
import { MultiTaskEditor } from "../forms/MultiTaskEditor";
import { toast } from "sonner";
import type { TimesheetEntry, EntryDetail } from "../../../types";

interface SinglePersonDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
  personInitials: string;
  date: string;
  existingEntries?: EntryDetail[];
  onSave?: (personId: string, tasks: EntryDetail[]) => void;
  onDelete?: (personId: string, entryIds: string[]) => void;
  onApplyToOthers?: () => void; // NEW: Trigger "Apply to Others" flow
  userRole?: "individual" | "company_owner" | "agency_owner";
  hourlyRate?: number;
}

export function SinglePersonDayModal({
  isOpen,
  onClose,
  personId,
  personName,
  personInitials,
  date,
  existingEntries = [],
  onSave,
  onDelete,
  onApplyToOthers,
  userRole = "individual",
  hourlyRate,
}: SinglePersonDayModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalHours =
    existingEntries?.reduce((sum, entry) => sum + entry.hours, 0) || 0;
  const status = existingEntries?.[0]?.status || "draft";
  const taskCount = existingEntries?.length || 0;

  const handleSave = async (tasks: EntryDetail[]) => {
    if (!onSave) return;

    setIsSubmitting(true);
    try {
      await onSave(personId, tasks);
      toast.success("Time entry saved successfully");
      onClose();
    } catch (error) {
      toast.error("Failed to save time entry");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !existingEntries?.length) return;

    const entryIds = existingEntries.map((e) => e.id);

    setIsSubmitting(true);
    try {
      await onDelete(personId, entryIds);
      toast.success("Time entry deleted");
      onClose();
    } catch (error) {
      toast.error("Failed to delete time entry");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl mb-1">
                Timesheet Entry
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4" />
                {formattedDate}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Main Content - Scrollable */}
        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)]">
          <div className="px-6 py-4">
            {/* Person Card - Matches MultiPersonDayModal style */}
            <div className="border rounded-lg overflow-hidden">
              {/* Person Header - Always expanded, no click handler */}
              <div className="p-3 border-b bg-accent/5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-brand/10 flex items-center justify-center font-medium text-accent-brand flex-shrink-0">
                    {personInitials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-medium">{personName}</div>
                    </div>

                    <div className="text-sm text-muted-foreground mb-2">
                      {taskCount} {taskCount === 1 ? "task" : "tasks"} ·{" "}
                      {totalHours}h total
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="gap-1.5">
                        <Clock className="w-3 h-3" />
                        <span
                          className={cn(
                            "font-semibold",
                            totalHours > 8 && "text-orange-600",
                            totalHours > 12 && "text-red-600"
                          )}
                        >
                          {totalHours}h
                        </span>
                      </Badge>
                      <Badge
                        variant={
                          status === "approved"
                            ? "default"
                            : status === "submitted"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize"
                      >
                        {status}
                      </Badge>
                      {onApplyToOthers && existingEntries?.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={onApplyToOthers}
                          disabled={isSubmitting}
                          className="h-7 gap-1.5 text-xs"
                        >
                          <Copy className="w-3 h-3" />
                          Apply to Others
                        </Button>
                      )}
                      {onDelete && existingEntries?.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleDelete}
                          disabled={isSubmitting}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Task Editor - Always visible, matches calendar style */}
              {existingEntries.length > 0 || onSave ? (
                <div className="p-4 bg-accent/5">
                  <MultiTaskEditor
                    personId={personId}
                    personName={personName}
                    date={new Date(date)}
                    existingEntries={existingEntries}
                    onSave={handleSave}
                    onCancel={onClose}
                    isSubmitting={isSubmitting}
                    userRole={userRole}
                    hourlyRate={hourlyRate}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No entries for this day</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
