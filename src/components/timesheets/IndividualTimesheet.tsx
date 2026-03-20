import { useState } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Copy, Send, GripVertical,
  Clock, CheckCircle2, AlertCircle, X, Save
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { SinglePersonDayModal } from "./modal/SinglePersonDayModal";
import { toast } from "sonner";

interface TimesheetEntry {
  id: string;
  date: Date;
  hours: number;
  task: string;
  notes: string;
  startTime?: string;
  endTime?: string;
  workType?: 'regular' | 'travel' | 'overtime';
  taskCategory?: 'Development' | 'Design' | 'Management';
}

type UserRole = 
  | "individual-contributor"
  | "team-lead"
  | "company-owner"
  | "agency-owner"
  | "client";

interface IndividualTimesheetProps {
  contractorId: string;
  contractorName: string;
  projectId: string;
  projectName: string;
  month: Date;
  status: "draft" | "submitted" | "approved" | "rejected";
  entries: TimesheetEntry[];
  userRole?: UserRole;  // NEW: What role is viewing?
  hourlyRate?: number;  // NEW: Optional - only provided if role permits
  onUpdateEntry: (entry: TimesheetEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onSubmit: () => void;
}

export function IndividualTimesheet({
  contractorId,
  contractorName,
  projectId,
  projectName,
  month,
  status,
  entries: initialEntries,
  userRole = "individual-contributor",  // Default to most restrictive
  hourlyRate,  // Optional - only provided for owners
  onUpdateEntry,
  onDeleteEntry,
  onSubmit,
}: IndividualTimesheetProps) {
  const [entries, setEntries] = useState<TimesheetEntry[]>(initialEntries);
  const [quickAddDay, setQuickAddDay] = useState<Date | null>(null);
  const [quickAddHours, setQuickAddHours] = useState("");
  const [draggedEntry, setDraggedEntry] = useState<TimesheetEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date>(new Date());

  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  // Get calendar grid
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const calendarDays: (Date | null)[] = [];
  const startOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push(null);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, monthIndex, day));
  }

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const entriesMap = new Map<string, TimesheetEntry>();
  entries.forEach(entry => {
    entriesMap.set(formatDateKey(entry.date), entry);
  });

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const daysWorked = entries.filter(e => e.hours > 0).length;

  const handleOpenModal = (date: Date) => {
    setModalDate(date);
    setModalOpen(true);
  };

  const handleSaveFromModal = (date: Date, hours: number, tasks: any[]) => {
    // For now, combine all tasks into one entry
    // In a full implementation, you'd save each task separately
    const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);
    const mainTask = tasks[0];
    
    const newEntry: TimesheetEntry = {
      id: `entry-${Date.now()}`,
      date,
      hours: totalHours,
      task: mainTask.name,
      notes: mainTask.notes,
    };
    
    setEntries([...entries, newEntry]);
    onUpdateEntry(newEntry);
    setModalOpen(false);
    toast.success(`${totalHours.toFixed(2)}h added to ${formatShortDate(date)}`);
  };

  const handleQuickAdd = (date: Date, hours: number) => {
    const newEntry: TimesheetEntry = {
      id: `entry-${Date.now()}`,
      date,
      hours,
      task: "Development", // Default task
      notes: "",
    };
    
    setEntries([...entries, newEntry]);
    onUpdateEntry(newEntry);
    setQuickAddDay(null);
    setQuickAddHours("");
    toast.success(`${hours}h added to ${formatShortDate(date)}`);
  };

  const handleDragStart = (entry: TimesheetEntry) => {
    setDraggedEntry(entry);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetDate: Date) => {
    if (!draggedEntry) return;
    
    const newEntry: TimesheetEntry = {
      ...draggedEntry,
      id: `entry-${Date.now()}`,
      date: targetDate,
    };
    
    setEntries([...entries, newEntry]);
    onUpdateEntry(newEntry);
    setDraggedEntry(null);
    toast.success(`Entry copied to ${formatShortDate(targetDate)}`);
  };

  const handleCopyPreviousDay = (date: Date) => {
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    
    const previousEntry = entriesMap.get(formatDateKey(previousDay));
    if (!previousEntry) {
      toast.error("No entry found for previous day");
      return;
    }
    
    handleDrop(date);
  };

  const handleSubmitTimesheet = () => {
    if (totalHours === 0) {
      toast.error("Cannot submit empty timesheet");
      return;
    }
    onSubmit();
    toast.success("Timesheet submitted for approval");
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

  const canEdit = status === "draft" || status === "rejected";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">{contractorName}'s Timesheet</h2>
          <p className="text-sm text-muted-foreground">
            {projectName} · {formatMonthYear(month)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          {status === "draft" && (
            <Badge variant="secondary" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Draft
            </Badge>
          )}
          {status === "submitted" && (
            <Badge variant="default" className="gap-1.5 bg-warning">
              <Clock className="w-3.5 h-3.5" />
              Pending Approval
            </Badge>
          )}
          {status === "approved" && (
            <Badge variant="default" className="gap-1.5 bg-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved
            </Badge>
          )}
          {status === "rejected" && (
            <Badge variant="destructive" className="gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Rejected - Revise
            </Badge>
          )}

          {/* Submit Button */}
          {canEdit && (
            <Button onClick={handleSubmitTimesheet} className="gap-2">
              <Send className="w-4 h-4" />
              Submit for Approval
            </Button>
          )}
        </div>
      </div>

      {/* Calendar */}
      <Card className="overflow-hidden">
        {/* Month Navigation */}
        <div className="p-4 border-b border-border bg-accent/30">
          <div className="flex items-center justify-between">
            <h3 className="m-0">{formatMonthYear(month)}</h3>
            <p className="text-sm text-muted-foreground">
              {totalHours}h · {daysWorked} days
            </p>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="space-y-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-2">
                {week.map((date, dayIndex) => {
                  const entry = date ? entriesMap.get(formatDateKey(date)) : undefined;
                  const today = isToday(date);
                  const weekend = isWeekend(date);

                  if (!date) {
                    return <div key={dayIndex} className="aspect-square" />;
                  }

                  const isQuickAdding = quickAddDay && 
                    formatDateKey(quickAddDay) === formatDateKey(date);

                  return (
                    <div
                      key={dayIndex}
                      className="relative group"
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (canEdit) handleDrop(date);
                      }}
                    >
                      <div
                        draggable={canEdit && !!entry}
                        onDragStart={() => entry && handleDragStart(entry)}
                        className={`
                          w-full min-h-[100px] rounded-lg border-2 p-2 apple-transition
                          ${today ? 'border-accent-brand bg-accent-brand/5' : 'border-border'}
                          ${weekend ? 'bg-accent/20' : 'bg-card'}
                          ${entry ? 'hover:border-accent-brand hover:apple-shadow-md' : 'hover:border-accent-brand/50'}
                          ${canEdit && entry ? 'cursor-move' : ''}
                          ${!canEdit ? 'opacity-75' : ''}
                          flex flex-col
                        `}
                      >
                        {/* Day Number */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-semibold ${today ? 'text-accent-brand' : ''}`}>
                            {date.getDate()}
                          </span>
                          {canEdit && entry && (
                            <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          )}
                        </div>

                        {/* Entry or Quick Add */}
                        {entry ? (
                          <div 
                            className="space-y-1 cursor-pointer"
                            onClick={() => canEdit && handleOpenModal(date)}
                          >
                            <p className="font-semibold text-accent-brand">{entry.hours}h</p>
                            <p className="text-xs text-muted-foreground truncate">{entry.task}</p>
                            {entry.notes && (
                              <p className="text-xs text-muted-foreground truncate" title={entry.notes}>
                                "{entry.notes}"
                              </p>
                            )}
                            {canEdit && (
                              <p className="text-xs text-accent-brand opacity-0 group-hover:opacity-100 apple-transition">
                                Click to edit
                              </p>
                            )}
                          </div>
                        ) : isQuickAdding ? (
                          <div className="flex-1 flex flex-col gap-1">
                            <Input
                              type="number"
                              value={quickAddHours}
                              onChange={(e) => setQuickAddHours(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && quickAddHours) {
                                  handleQuickAdd(date, parseFloat(quickAddHours));
                                } else if (e.key === 'Escape') {
                                  setQuickAddDay(null);
                                  setQuickAddHours("");
                                }
                              }}
                              placeholder="Hours"
                              className="h-8 text-sm"
                              autoFocus
                              min="0"
                              max="24"
                              step="0.5"
                              disabled={!canEdit}
                            />
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => quickAddHours && handleQuickAdd(date, parseFloat(quickAddHours))}
                                disabled={!quickAddHours}
                                className="h-6 text-xs flex-1"
                              >
                                Add
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setQuickAddDay(null);
                                  setQuickAddHours("");
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ) : canEdit ? (
                          <div className="flex-1 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 apple-transition">
                            <button
                              onClick={() => handleOpenModal(date)}
                              className="flex flex-col items-center justify-center w-full gap-1"
                            >
                              <Plus className="w-5 h-5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Add hours</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPreviousDay(date);
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                              title="Copy previous day"
                            >
                              <Copy className="w-3 h-3" />
                              Copy prev
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="border-t-2 border-border bg-accent/30 p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
              <p className="text-2xl font-semibold text-accent-brand">{totalHours}h</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Days Worked</p>
              <p className="text-2xl font-semibold">{daysWorked}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <p className="text-2xl font-semibold capitalize">{status}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Instructions */}
      {canEdit && (
        <Card className="p-4 bg-accent/20">
          <p className="text-sm font-medium mb-2">💡 Quick Tips</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>• <span className="font-medium">Click "+"</span> on any day to open detailed entry modal</p>
            <p>• <span className="font-medium">Click an entry</span> to edit it with full details</p>
            <p>• <span className="font-medium">Use time calculator</span> for start/end times + breaks</p>
            <p>• <span className="font-medium">Select work type</span> for different rates (travel, overtime, etc.)</p>
            <p>• <span className="font-medium">Drag entries</span> to copy them to other days</p>
            <p>• <span className="font-medium">Submit</span> when ready for manager review</p>
          </div>
        </Card>
      )}

      {/* Detailed Entry Modal */}
      <SinglePersonDayModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        personId={contractorId}
        personName={contractorName}
        personInitials={contractorName.split(' ').map(n => n[0]).join('')}
        date={formatDateKey(modalDate)}
        existingEntries={
          entries
            .filter(e => formatDateKey(e.date) === formatDateKey(modalDate))
            .map(entry => ({
              id: entry.id,
              description: entry.task,
              hours: entry.hours,
              notes: entry.notes,
              status: status,
            }))
        }
        onSave={(personId, tasks) => {
          // Convert tasks back to entries format and save
          tasks.forEach(task => {
            const entry = {
              id: task.id || `entry-${Date.now()}`,
              date: modalDate,
              hours: task.hours,
              task: task.description || "",
              notes: task.notes || "",
              startTime: task.startTime,
              endTime: task.endTime,
              workType: task.workType || 'regular',
              taskCategory: task.taskCategory || 'Development',
            };
            onUpdateEntry(entry);
          });
          setModalOpen(false);
        }}
        onDelete={(personId, entryIds) => {
          entryIds.forEach(id => onDeleteEntry(id));
          setModalOpen(false);
        }}
        userRole={
          userRole === "individual-contributor" ? "individual" :
          userRole === "company-owner" ? "company_owner" :
          userRole === "agency-owner" ? "agency_owner" :
          "individual"
        }
        hourlyRate={hourlyRate}
      />
    </div>
  );
}

// Utility functions
function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}