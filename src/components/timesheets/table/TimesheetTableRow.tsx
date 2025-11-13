import { useState } from "react";
import { format, eachDayOfInterval, isToday, isWeekend } from "date-fns";
import { EditableTableCell } from "./EditableTableCell";
import { QuickEditPopover } from "./QuickEditPopover";
import { ApplyToOthersDialog } from "../ApplyToOthersDialog";
import { SinglePersonDayModal } from "../modal/SinglePersonDayModal";
import type { TimesheetEntry, EntryDetail } from "../../../types";
import type { Person } from "../../../types/people";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { toast } from "sonner@2.0.3";

interface ContractorData {
  id: string;
  name: string;
  role: string;
  entries: Record<string, TimesheetEntry>;
}

interface TimesheetTableRowProps {
  contractor: ContractorData;
  allContractors: ContractorData[];
  days: Date[]; // ✅ NEW: Receive filtered days directly from parent
  startDate: Date; // Keep for backward compatibility with copy logic
  endDate: Date; // Keep for backward compatibility with copy logic
  onEntriesChange?: (date: Date, entries: TimesheetEntry) => void;
  onUpdateContractorEntries?: (contractorId: string, date: Date, entries: TimesheetEntry) => void;
  onUpdateEntry?: (entryId: string, updates: Partial<TimesheetEntry>) => Promise<void>;
  onDeleteEntry?: (entryId: string) => Promise<void>;
  onBulkUpdate?: (entryIds: string[], updates: Partial<TimesheetEntry>) => Promise<void>;
  onSavePersonTasks?: (personId: string, tasks: any[]) => Promise<void>;
}

export function TimesheetTableRow({ 
  contractor,
  allContractors,
  days, // ✅ Use the filtered days from parent 
  startDate, 
  endDate, 
  onEntriesChange,
  onUpdateContractorEntries,
  onUpdateEntry,
  onDeleteEntry,
  onBulkUpdate,
  onSavePersonTasks
}: TimesheetTableRowProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [applyToOthersOpen, setApplyToOthersOpen] = useState(false);
  const [copySourceDate, setCopySourceDate] = useState<Date | null>(null);
  
  // ✅ FIXED: Use days from props instead of recalculating
  // This ensures we only render cells for days that exist in the table header
  
  const totalHours = days.reduce((sum, day) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const entry = contractor.entries[dateKey];
    return sum + (entry?.entries?.reduce((s, e) => s + (e.hours || 0), 0) || 0);
  }, 0);

  const handleQuickEdit = (date: Date, data: {
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
    totalHours: number;
  }) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    console.log('Quick edit for', contractor.name, 'on', dateKey, data);
    
    // Get existing entry or create new one
    const existingEntry = contractor.entries[dateKey];
    
    // Create updated entry
    const updatedEntry: TimesheetEntry = {
      date: dateKey,
      entries: existingEntry?.entries?.length 
        ? existingEntry.entries.map((e, idx) => {
            // Update first entry with new data
            if (idx === 0) {
              return {
                ...e,
                hours: data.totalHours,
                // Only set start/end times if they were provided (time-first mode)
                // If user entered hours-only, clear the time fields
                startTime: data.startTime,
                endTime: data.endTime,
                breakMinutes: data.breakMinutes,
              };
            }
            return e;
          })
        : [
            // Create new entry
            {
              id: `entry-${Date.now()}`,
              date: dateKey,
              hours: data.totalHours,
              startTime: data.startTime,
              endTime: data.endTime,
              breakMinutes: data.breakMinutes,
              taskDescription: 'Work',
              status: 'draft' as const,
            }
          ]
    };
    
    // Call the callback to update parent state
    if (onEntriesChange) {
      onEntriesChange(date, updatedEntry);
    }
    
    toast.success(`Updated ${contractor.name}'s hours to ${data.totalHours}h`);
  };

  const handleDetailedEdit = (date: Date) => {
    setSelectedDate(date);
    setModalOpen(true);
  };

  const handleCopyToOthers = (date: Date) => {
    setCopySourceDate(date);
    setApplyToOthersOpen(true);
  };

  const handleApplyToOthers = async (params: {
    targetPersonIds: string[];
    dateRangeType: 'day' | 'week' | 'month';
    overwriteExisting: boolean;
  }) => {
    if (!copySourceDate) return;

    console.log('Applying timesheet to others:', params);
    
    // Calculate date range
    const getDatesInRange = (): Date[] => {
      if (params.dateRangeType === 'day') {
        // Copy just this one day
        return [copySourceDate];
      }
      
      if (params.dateRangeType === 'week') {
        // Week: Find Monday of this week, then get all 7 days (Mon-Sun)
        const dayOfWeek = copySourceDate.getDay();
        const monday = new Date(copySourceDate);
        monday.setDate(copySourceDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        
        return Array.from({ length: 7 }, (_, i) => {
          const date = new Date(monday);
          date.setDate(monday.getDate() + i);
          return date;
        });
      }

      // Month: All days in the month
      const year = copySourceDate.getFullYear();
      const month = copySourceDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();

      return Array.from({ length: daysInMonth }, (_, i) => {
        return new Date(year, month, i + 1);
      });
    };

    const targetDates = getDatesInRange();
    
    // Copy entries to each target person for each date
    let copiedCount = 0;
    let skippedCount = 0;

    // ✅ FIX: Get the SOURCE entry from the TEMPLATE date (copySourceDate), not from each target date
    const sourceDateKey = format(copySourceDate, 'yyyy-MM-dd');
    const sourceEntry = contractor.entries[sourceDateKey];
    
    // If no source entry exists for the template date, abort
    if (!sourceEntry?.entries?.length) {
      toast.error('No timesheet entry found for the selected date');
      return;
    }

    for (const personId of params.targetPersonIds) {
      const targetContractor = allContractors.find(c => c.id === personId);
      if (!targetContractor) continue;

      for (const targetDate of targetDates) {
        const targetDateKey = format(targetDate, 'yyyy-MM-dd');
        
        // Check if target already has entries for this date
        const existingEntry = targetContractor.entries[targetDateKey];
        if (existingEntry?.entries?.length && !params.overwriteExisting) {
          skippedCount++;
          continue;
        }

        // Create new entries for this person/date
        const newEntries: EntryDetail[] = sourceEntry.entries.map((sourceDetail, idx) => ({
          id: `entry-${Date.now()}-${personId}-${targetDateKey}-${idx}`,
          date: targetDateKey,
          hours: sourceDetail.hours,
          startTime: sourceDetail.startTime,
          endTime: sourceDetail.endTime,
          breakMinutes: sourceDetail.breakMinutes,
          taskDescription: sourceDetail.taskDescription || 'Work',
          notes: sourceDetail.notes,
          status: 'draft' as const,
          personId: personId,
        }));

        const newEntry: TimesheetEntry = {
          date: targetDateKey,
          entries: newEntries,
        };

        // Apply the entry using the new callback
        if (onUpdateContractorEntries) {
          onUpdateContractorEntries(personId, targetDate, newEntry);
        }

        copiedCount++;
      }
    }

    // Show results
    const messages = [];
    if (copiedCount > 0) {
      messages.push(`Copied ${copiedCount} ${copiedCount === 1 ? 'day' : 'days'}`);
    }
    if (skippedCount > 0) {
      messages.push(`skipped ${skippedCount} existing`);
    }

    if (copiedCount > 0) {
      toast.success(messages.join(', '));
    } else if (skippedCount > 0) {
      toast.info(`All ${skippedCount} entries already exist. Use "Overwrite" to replace them.`);
    } else {
      toast.info('No entries to copy');
    }
  };

  // Calculate approval status
  const approvedDays = days.filter(day => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const entry = contractor.entries[dateKey];
    return entry?.entries?.some(e => e.status === 'approved');
  }).length;

  const pendingDays = days.filter(day => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const entry = contractor.entries[dateKey];
    return entry?.entries?.some(e => e.status === 'submitted' || e.status === 'pending');
  }).length;

  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50/50 transition-colors group">
        {/* Contractor Info */}
        <td className="sticky left-0 bg-white px-4 py-3 border-r border-gray-200 min-w-[200px]">
          <div className="flex flex-col gap-1">
            <span className="text-sm">{contractor.name}</span>
            <span className="text-xs text-gray-500">{contractor.role}</span>
          </div>
        </td>

        {/* Day Cells */}
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const entry = contractor.entries[dateKey];
          
          return (
            <EditableTableCell
              key={dateKey}
              date={day}
              entry={entry}
              onQuickEdit={(data) => handleQuickEdit(day, data)}
              onDetailedEdit={() => handleDetailedEdit(day)}
              onCopyToOthers={() => handleCopyToOthers(day)}
              isToday={isToday(day)}
              isWeekend={isWeekend(day)}
            />
          );
        })}

        {/* Total Column */}
        <td className="sticky right-0 bg-white px-4 py-3 border-l border-gray-200 text-center">
          <div className="flex flex-col gap-1 items-center">
            <span className="text-sm tabular-nums">
              {totalHours % 1 === 0 ? totalHours.toFixed(0) : totalHours.toFixed(1)}h
            </span>
            {pendingDays > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                {pendingDays} pending
              </Badge>
            )}
            {pendingDays === 0 && approvedDays > 0 && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                Approved
              </Badge>
            )}
          </div>
        </td>

        {/* Actions */}
        <td className="sticky right-0 bg-white px-4 py-3 border-l border-gray-200">
          {/* Actions removed - approval handled in OrganizationGroupedTable */}
        </td>
      </tr>

      {/* Detailed Edit Modal */}
      {selectedDate && (
        <SinglePersonDayModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          personId={contractor.id}
          personName={contractor.name}
          personInitials={contractor.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          date={format(selectedDate, 'yyyy-MM-dd')}
          existingEntries={(() => {
            const dateKey = format(selectedDate, 'yyyy-MM-dd');
            const dayEntry = contractor.entries[dateKey];
            return dayEntry?.entries || [];
          })()}
          onApplyToOthers={() => {
            // ✅ NEW: Trigger "Apply to Others" from the modal
            setCopySourceDate(selectedDate);
            setModalOpen(false); // Close modal first
            setApplyToOthersOpen(true); // Then open Apply to Others dialog
          }}
          onSave={onSavePersonTasks ? async (personId, tasks) => {
            // Extract the date from selectedDate state
            if (selectedDate) {
              const dateKey = format(selectedDate, 'yyyy-MM-dd');
              // Call parent with date context
              // Transform tasks into entries format
              const updatedEntry: TimesheetEntry = {
                date: dateKey,
                entries: tasks.map(task => ({
                  id: task.entryId || task.taskId || `entry-${Date.now()}-${Math.random()}`,
                  // ✅ FIX: Use correct field names matching API schema
                  taskCategory: task.taskCategory || 'Development',
                  taskDescription: task.task || task.notes || 'Work',
                  hours: parseFloat(task.hours) || 0,
                  startTime: task.startTime,
                  endTime: task.endTime,
                  breakMinutes: task.breakMinutes,
                  workType: task.workType || 'regular',
                  status: 'draft' as const,
                  notes: task.notes || '',
                }))
              };
              
              // Call onEntriesChange with the proper format
              if (onEntriesChange) {
                onEntriesChange(selectedDate, updatedEntry);
              }
            }
          } : undefined}
          onDelete={onDeleteEntry ? async (personId, entryIds) => {
            for (const entryId of entryIds) {
              await onDeleteEntry(entryId);
            }
          } : undefined}
          userRole="company_owner"
          hourlyRate={75}
        />
      )}

      {/* Apply to Others Dialog */}
      {copySourceDate && (
        <ApplyToOthersDialog
          open={applyToOthersOpen}
          onOpenChange={setApplyToOthersOpen}
          templatePerson={{
            id: contractor.id,
            name: contractor.name,
            initials: contractor.name.split(' ').map(n => n[0]).join('').toUpperCase(),
            role: contractor.role,
          }}
          templateDate={copySourceDate}
          templateEntries={(() => {
            const dateKey = format(copySourceDate, 'yyyy-MM-dd');
            const dayEntry = contractor.entries[dateKey];
            return dayEntry?.entries || [];
          })()}
          allPeople={allContractors.map(c => ({
            id: c.id,
            name: c.name,
            initials: c.name.split(' ').map(n => n[0]).join('').toUpperCase(),
            role: c.role,
          }))}
          onApply={handleApplyToOthers}
        />
      )}
    </>
  );
}