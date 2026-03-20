import { useState, useMemo } from "react";
import { Circle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Trash2, Plus, Copy, Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Card } from "../../ui/card";
import { Separator } from "../../ui/separator";
import { ScrollArea } from "../../ui/scroll-area";
import { Avatar, AvatarFallback } from "../../ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import { SinglePersonDayModal } from "./SinglePersonDayModal";
import { ApplyToOthersDialog } from "../ApplyToOthersDialog";
import { MultiTaskEditor } from "../forms/MultiTaskEditor";
import { cn } from "../../ui/utils";
import { toast } from "sonner";
import type { Person } from "../../../types/people";
import type { TimesheetEntry } from "../../../utils/api/timesheets";

export type EntryStatus = "draft" | "submitted" | "approved" | "rejected";

export interface PersonEntry {
  personId: string;
  personName: string;
  personInitials: string;
  hours: number;
  task: string;
  notes?: string;
  status: EntryStatus;
  billableAmount?: number;
}

export interface VarianceException {
  type: "variance" | "missing" | "conflict" | "overtime";
  personName: string;
  message: string;
  severity: "warning" | "error" | "info";
}

type UserRole = 
  | "individual-contributor"
  | "team-lead"
  | "company-owner"
  | "agency-owner"
  | "client";

interface MultiPersonDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  entries: (TimesheetEntry & { personId?: string; personName?: string })[];
  people: Person[];
  selectedPeopleIds: Set<string>;
  onAddEntry?: (personId: string, hours: number, task: string, notes?: string) => void;
  onUpdateEntry?: (entryId: string, updates: Partial<TimesheetEntry>) => Promise<void>;
  onDeleteEntry?: (entryId: string) => Promise<void>;
  onBulkUpdate?: (entryIds: string[], updates: Partial<TimesheetEntry>) => Promise<void>;
  onSavePersonTasks?: (personId: string, tasks: any[]) => Promise<void>;
  onDeleteAll?: () => void;
  onApplyToOthers?: (params: {
    templatePersonId: string;
    targetPersonIds: string[];
    dateRangeType: 'day' | 'week' | 'month';
    overwriteExisting: boolean;
  }) => Promise<void>;
  userRole?: UserRole;
  hourlyRate?: number;
}

interface PersonGroup {
  person: Person;
  entries: TimesheetEntry[];
  totalHours: number;
}

const statusConfig = {
  draft: { label: "Draft", icon: Circle, color: "text-muted-foreground" },
  submitted: { label: "Submitted", icon: Clock, color: "text-yellow-600" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-green-600" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-600" },
};

export function MultiPersonDayModal({
  open,
  onOpenChange,
  date,
  entries,
  people,
  selectedPeopleIds,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onBulkUpdate,
  onSavePersonTasks,
  onDeleteAll,
  onApplyToOthers,
  userRole = "company-owner",
  hourlyRate = 75,
}: MultiPersonDayModalProps) {
  const [exceptionsOpen, setExceptionsOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [applyDialogPerson, setApplyDialogPerson] = useState<Person | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  
  // Auto-expand people without entries (so they can add data)
  const [expandedPersonIds, setExpandedPersonIds] = useState<Set<string>>(() => {
    const autoExpand = new Set<string>();
    // Auto-expand people who don't have entries yet
    selectedPeopleIds.forEach(personId => {
      const hasEntries = entries.some(e => (e.personId || e.userId) === personId);
      if (!hasEntries) {
        autoExpand.add(personId);
      }
    });
    return autoExpand;
  });

  // Ensure props are always safe to use
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safePeople = Array.isArray(people) ? people : [];
  const safeSelectedPeopleIds = selectedPeopleIds instanceof Set ? selectedPeopleIds : new Set<string>();

  // Calculate aggregates
  const totalHours = safeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const totalBillable = safeEntries.reduce((sum, e) => sum + (e.billableAmount || 0), 0);
  const uniquePeople = new Set(safeEntries.map(e => e.personId)).size;

  // Find people with entries
  const peopleWithEntries = safePeople.filter(p => 
    safeEntries.some(e => e.personId === p.id)
  );

  // Group entries by person
  const personGroups: PersonGroup[] = safePeople
    .filter(p => safeSelectedPeopleIds.has(p.id)) // ✅ Show ALL selected people, not just those with entries
    .map(person => {
      const personEntries = safeEntries.filter(e => (e.personId || e.userId) === person.id);
      const totalHours = personEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
      return { person, entries: personEntries, totalHours };
    });

  // Calculate exceptions/variances
  const exceptions: VarianceException[] = [];
  
  // Check for variance (different hours)
  const hoursSet = new Set(safeEntries.map(e => e.hours || 0));
  if (hoursSet.size > 1 && safeEntries.length > 0) {
    safeEntries.forEach(entry => {
      const avgHours = totalHours / safeEntries.length;
      const entryHours = entry.hours || 0;
      const variance = Math.abs(entryHours - avgHours);
      if (variance > 1) {
        exceptions.push({
          type: "variance",
          personName: entry.personName || 'Unknown',
          message: `${entryHours}h (${variance.toFixed(1)}h ${entryHours > avgHours ? 'over' : 'under'} average)`,
          severity: variance > 2 ? "warning" : "info",
        });
      }
    });
  }

  // Check for overtime
  safeEntries.forEach(entry => {
    const entryHours = entry.hours || 0;
    if (entryHours > 8) {
      exceptions.push({
        type: "overtime",
        personName: entry.personName || 'Unknown',
        message: `${entryHours}h logged (${entryHours - 8}h overtime)`,
        severity: entryHours > 10 ? "error" : "warning",
      });
    }
  });

  // Check for missing entries (selected people without entries)
  safeSelectedPeopleIds.forEach(personId => {
    if (!safeEntries.some(e => (e.personId || e.userId) === personId)) {
      const person = safePeople.find(p => p.id === personId);
      if (person) {
        exceptions.push({
          type: "missing",
          personName: person.name,
          message: "No entry for this day",
          severity: "info",
        });
      }
    }
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { 
      weekday: "long", 
      month: "long", 
      day: "numeric",
      year: "numeric"
    });
  };

  const handleEdit = (entryId: string) => {
    setEditingEntryId(entryId);
  };

  const handleSaveEdit = async (entryId: string, updates: Partial<TimesheetEntry>) => {
    if (!onUpdateEntry) return;
    
    setIsSubmitting(true);
    try {
      await onUpdateEntry(entryId, updates);
      setEditingEntryId(null);
    } catch (error) {
      console.error('Failed to update entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
  };

  const handleDelete = async (entryId: string) => {
    if (!onDeleteEntry) return;
    
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    setIsSubmitting(true);
    try {
      await onDeleteEntry(entryId);
    } catch (error) {
      console.error('Failed to delete entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSave = async (entryIds: string[], updates: Partial<TimesheetEntry>) => {
    if (!onBulkUpdate) return;
    
    setIsSubmitting(true);
    try {
      await onBulkUpdate(entryIds, updates);
      toast.success('Entries updated successfully');
    } catch (error) {
      console.error('Failed to bulk update:', error);
      toast.error(`Failed to update entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle save person tasks
  const handleSavePersonTasks = async (personId: string, tasks: any[]) => {
    if (!onSavePersonTasks) return;

    setIsSubmitting(true);
    try {
      await onSavePersonTasks(personId, tasks);
      toast.success('Tasks updated successfully');
    } catch (error) {
      console.error('Failed to save tasks:', error);
      toast.error(`Failed to save tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPersonEdit = (personId: string) => {
    // Cancel is now a no-op since we don't collapse - user can just close the modal
  };

  const handleDeletePerson = async (personId: string, entryIds: string[]) => {
    if (!onDeleteEntry) return;
    if (!confirm('Delete all tasks for this person?')) return;

    setIsSubmitting(true);
    try {
      await Promise.all(entryIds.map(id => onDeleteEntry(id)));
      toast.success('Entries deleted successfully');
    } catch (error) {
      console.error('Failed to delete entries:', error);
      toast.error(`Failed to delete entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyToOthers = async (params: {
    targetPersonIds: string[];
    dateRangeType: 'day' | 'week' | 'month';
    overwriteExisting: boolean;
  }) => {
    if (!onApplyToOthers || !applyDialogPerson) {
      console.log('⚠️ MODAL: Cannot apply - onApplyToOthers or applyDialogPerson is missing');
      return;
    }

    console.log('📤 MODAL: Calling onApplyToOthers with:', {
      templatePersonId: applyDialogPerson.id,
      templatePersonName: applyDialogPerson.name,
      ...params,
    });

    try {
      await onApplyToOthers({
        templatePersonId: applyDialogPerson.id,
        ...params,
      });
      console.log('✅ MODAL: onApplyToOthers completed successfully');
      toast.success(`Timesheet applied to ${params.targetPersonIds.length} ${params.targetPersonIds.length === 1 ? 'employee' : 'employees'}`);
    } catch (error) {
      console.error('❌ MODAL: Failed to apply timesheet:', error);
      toast.error(`Failed to apply timesheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error; // Re-throw so dialog can handle it
    }
  };

  const togglePersonExpanded = (personId: string) => {
    setExpandedPersonIds(prev => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col gap-0">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent-brand" />
            {formatDate(date)}
          </DialogTitle>
          <DialogDescription>
            {uniquePeople} {uniquePeople === 1 ? "person" : "people"} · {totalHours}h total
            {totalBillable > 0 && ` · ${totalBillable.toLocaleString()}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0">
          <div className="space-y-6 pb-4">
            {/* Entries by Person - Collapsible */}
            <div>
              {personGroups.length > 0 ? (
                <div className="space-y-3">
                  {/* Expand/Collapse All Button */}
                  {personGroups.length > 1 && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (expandedPersonIds.size === personGroups.length) {
                            setExpandedPersonIds(new Set());
                          } else {
                            setExpandedPersonIds(new Set(personGroups.map(g => g.person.id)));
                          }
                        }}
                        className="text-xs h-7"
                      >
                        {expandedPersonIds.size === personGroups.length ? (
                          <>
                            <ChevronUp className="w-3 h-3 mr-1" />
                            Collapse All
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3 mr-1" />
                            Expand All
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {personGroups.map(({ person, entries: personEntries, totalHours }) => {
                    const isExpanded = expandedPersonIds.has(person.id);
                    
                    return (
                      <div
                        key={person.id}
                        className="border rounded-lg overflow-hidden"
                      >
                        {/* Person Header - Clickable to expand/collapse */}
                        <div 
                          className={cn(
                            "p-3 cursor-pointer hover:bg-accent/5 apple-transition",
                            isExpanded && "border-b bg-accent/5"
                          )}
                          onClick={() => togglePersonExpanded(person.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-accent-brand/10 flex items-center justify-center font-medium text-accent-brand flex-shrink-0">
                              {person.initials}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="font-medium">{person.name}</div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                )}
                              </div>
                              
                              <div className="text-sm text-muted-foreground mb-2">
                                {personEntries.length} {personEntries.length === 1 ? 'task' : 'tasks'} · {totalHours}h total
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  <span className={cn(
                                    "font-semibold",
                                    totalHours > 8 && "text-orange-600",
                                    totalHours > 12 && "text-red-600"
                                  )}>
                                    {totalHours}h
                                  </span>
                                </Badge>
                                <Badge 
                                  variant={
                                    personEntries[0]?.status === 'approved' ? 'default' :
                                    personEntries[0]?.status === 'submitted' ? 'secondary' :
                                    'outline'
                                  }
                                  className="capitalize"
                                >
                                  {personEntries[0]?.status || 'draft'}
                                </Badge>
                                {onApplyToOthers && personEntries.length > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('👤 Opening "Apply to Others" dialog for:', {
                                        person: person.name,
                                        personId: person.id,
                                        entriesCount: personEntries.length,
                                        entries: personEntries.map(e => ({
                                          id: e.id,
                                          hours: e.hours,
                                          category: e.taskCategory,
                                          userId: e.userId,
                                          personId: e.personId,
                                        })),
                                      });
                                      setApplyDialogPerson(person);
                                      setShowApplyDialog(true);
                                    }}
                                    disabled={isSubmitting}
                                    className="h-7 gap-1.5 text-xs"
                                  >
                                    <Copy className="w-3 h-3" />
                                    Apply to Others
                                  </Button>
                                )}
                                {onDeleteEntry && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePerson(person.id, personEntries.map(e => e.id));
                                    }}
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

                        {/* Collapsible Editor */}
                        {isExpanded && onSavePersonTasks && (
                          <div className="p-4 bg-accent/5">
                            <MultiTaskEditor
                              personId={person.id}
                              personName={person.name}
                              date={date}
                              existingEntries={personEntries}
                              onSave={(tasks) => handleSavePersonTasks(person.id, tasks)}
                              onCancel={() => handleCancelPersonEdit(person.id)}
                              isSubmitting={isSubmitting}
                              userRole={userRole}
                              hourlyRate={hourlyRate}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No entries for this day</p>
                </div>
              )}
            </div>

            {/* Exceptions Table */}
            {exceptions.length > 0 && (
              <Collapsible open={exceptionsOpen} onOpenChange={setExceptionsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span>Exceptions & Alerts</span>
                      <Badge variant="secondary">{exceptions.length}</Badge>
                    </div>
                    {exceptionsOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="border rounded-lg divide-y">
                    {exceptions.map((exception, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-3 flex items-start gap-3",
                          exception.severity === "error" && "bg-red-50/50",
                          exception.severity === "warning" && "bg-yellow-50/50",
                          exception.severity === "info" && "bg-blue-50/50"
                        )}
                      >
                        <AlertTriangle
                          className={cn(
                            "w-4 h-4 mt-0.5 flex-shrink-0",
                            exception.severity === "error" && "text-red-600",
                            exception.severity === "warning" && "text-yellow-600",
                            exception.severity === "info" && "text-blue-600"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{exception.personName}</p>
                          <p className="text-sm text-muted-foreground">{exception.message}</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "flex-shrink-0 text-xs",
                            exception.severity === "error" && "border-red-600 text-red-600",
                            exception.severity === "warning" && "border-yellow-600 text-yellow-600",
                            exception.severity === "info" && "border-blue-600 text-blue-600"
                          )}
                        >
                          {exception.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4 border-t">
          {onDeleteAll && entries.length > 0 && (
            <Button variant="destructive" onClick={onDeleteAll} className="gap-2">
              <Trash2 className="w-4 h-4" />
              Delete All
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Apply to Others Dialog */}
      {applyDialogPerson && (
        <ApplyToOthersDialog
          open={showApplyDialog}
          onOpenChange={setShowApplyDialog}
          templatePerson={applyDialogPerson}
          templateDate={date}
          templateEntries={safeEntries.filter(e => (e.personId || e.userId) === applyDialogPerson.id)}
          allPeople={safePeople}
          onApply={handleApplyToOthers}
        />
      )}
    </Dialog>
  );
}