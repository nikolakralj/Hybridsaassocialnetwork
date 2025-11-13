import { useState, useCallback } from "react";
import { format, eachWeekOfInterval, startOfWeek, endOfWeek, eachDayOfInterval, isWeekend, isSameWeek } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TimesheetTableRow } from "./TimesheetTableRow";
import type { TimesheetEntry } from "../../../types";
import { Button } from "../../ui/button";

interface ContractorData {
  id: string;
  name: string;
  role: string;
  entries: Record<string, TimesheetEntry>;
}

interface MonthlyTableProps {
  contractors: ContractorData[];
  startDate: Date;
  endDate: Date;
  onEntriesChange?: (contractorId: string, date: Date, entries: TimesheetEntry) => void;
  onUpdateEntry?: (entryId: string, updates: Partial<TimesheetEntry>) => Promise<void>;
  onDeleteEntry?: (entryId: string) => Promise<void>;
  onBulkUpdate?: (entryIds: string[], updates: Partial<TimesheetEntry>) => Promise<void>;
  onSavePersonTasks?: (personId: string, tasks: any[]) => Promise<void>;
}

export function MonthlyTable({ 
  contractors, 
  startDate, 
  endDate, 
  onEntriesChange,
  onUpdateEntry,
  onDeleteEntry,
  onBulkUpdate,
  onSavePersonTasks
}: MonthlyTableProps) {
  // 🔍 DEBUG: Log the date range we receive
  console.log('🟢 MonthlyTable received:', {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });
  
  const weeks = eachWeekOfInterval(
    { start: startDate, end: endDate },
    { weekStartsOn: 1 }
  );
  
  // 🔍 DEBUG: Log how many weeks were generated
  console.log('🟢 MonthlyTable generated', weeks.length, 'weeks:', weeks.map(w => format(w, 'yyyy-MM-dd')));

  // Track which weeks are expanded (default to current week expanded)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(
    new Set([format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')])
  );

  const toggleWeek = (weekStart: Date) => {
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekKey)) {
        next.delete(weekKey);
      } else {
        next.add(weekKey);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedWeeks(new Set(weeks.map(w => format(w, 'yyyy-MM-dd'))));
  };

  const collapseAll = () => {
    setExpandedWeeks(new Set());
  };

  const handleEntriesChange = useCallback((contractorId: string) => (date: Date, entries: TimesheetEntry) => {
    if (onEntriesChange) {
      onEntriesChange(contractorId, date, entries);
    }
  }, [onEntriesChange]);

  const handleUpdateContractorEntries = useCallback((contractorId: string, date: Date, entries: TimesheetEntry) => {
    if (onEntriesChange) {
      onEntriesChange(contractorId, date, entries);
    }
  }, [onEntriesChange]);

  // Calculate month totals
  const monthTotal = contractors.reduce((sum, contractor) => {
    return sum + Object.values(contractor.entries).reduce((s, entry) => {
      return s + (entry?.entries?.reduce((total, e) => total + (e.hours || 0), 0) || 0);
    }, 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
          >
            Collapse All
          </Button>
        </div>
        <div className="text-sm text-gray-600">
          Month Total: <span className="tabular-nums">{monthTotal.toFixed(1)}h</span>
        </div>
      </div>

      {/* Week-by-Week Tables */}
      <div className="space-y-3">
        {weeks.map((weekStart) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          const weekKey = format(weekStart, 'yyyy-MM-dd');
          const isExpanded = expandedWeeks.has(weekKey);
          
          // Generate all 7 days of the week
          const allDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
          
          // STRICT FILTERING: Only show days within the selected month period
          // This prevents September dates from showing in October view
          const days = allDays.filter(day => day >= startDate && day <= endDate);

          // Calculate week totals
          const weekTotal = contractors.reduce((sum, contractor) => {
            return sum + days.reduce((s, day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const entry = contractor.entries[dateKey];
              return s + (entry?.entries?.reduce((total, e) => total + (e.hours || 0), 0) || 0);
            }, 0);
          }, 0);

          // Count pending approvals for this week
          const pendingCount = contractors.reduce((count, contractor) => {
            return count + days.filter(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const entry = contractor.entries[dateKey];
              return entry?.entries?.some(e => e.status === 'submitted' || e.status === 'pending');
            }).length;
          }, 0);

          return (
            <div key={weekKey} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Week Header - Collapsible */}
              <button
                onClick={() => toggleWeek(weekStart)}
                className="w-full bg-gray-50 hover:bg-gray-100 transition-colors px-4 py-3 flex items-center justify-between border-b border-gray-200"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-600" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  )}
                  <span className="text-sm">
                    Week {format(weekStart, 'w')} • {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {pendingCount > 0 && (
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      {pendingCount} pending
                    </span>
                  )}
                  <span className="text-sm tabular-nums text-gray-600">
                    {weekTotal.toFixed(1)}h
                  </span>
                </div>
              </button>

              {/* Week Table - Expandable */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="sticky left-0 bg-gray-50 px-4 py-2 text-left text-xs uppercase tracking-wide text-gray-600 border-r border-gray-200 z-10 min-w-[200px]">
                          Contractor
                        </th>
                        {days.map((day) => (
                          <th
                            key={format(day, 'yyyy-MM-dd')}
                            className={`px-2 py-2 text-center text-xs uppercase tracking-wide border-r border-gray-200 min-w-[80px] ${
                              isWeekend(day) ? 'bg-gray-100 text-gray-500' : 'text-gray-600'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              <span>{format(day, 'EEE')}</span>
                              <span className="text-base">{format(day, 'd')}</span>
                            </div>
                          </th>
                        ))}
                        <th className="sticky right-0 bg-gray-50 px-4 py-2 text-center text-xs uppercase tracking-wide text-gray-600 border-l border-gray-200 z-10 min-w-[100px]">
                          Week Total
                        </th>
                        <th className="sticky right-0 bg-gray-50 px-4 py-2 text-center text-xs uppercase tracking-wide text-gray-600 border-l border-gray-200 z-10 min-w-[120px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {contractors.length === 0 ? (
                        <tr>
                          <td colSpan={days.length + 3} className="px-4 py-6 text-center text-gray-500 text-sm">
                            No contractors selected
                          </td>
                        </tr>
                      ) : (
                        contractors.map((contractor) => (
                          <TimesheetTableRow
                            key={contractor.id}
                            contractor={contractor}
                            allContractors={contractors}
                            days={days}
                            startDate={weekStart}
                            endDate={weekEnd}
                            onEntriesChange={handleEntriesChange(contractor.id)}
                            onUpdateContractorEntries={handleUpdateContractorEntries}
                            onUpdateEntry={onUpdateEntry}
                            onDeleteEntry={onDeleteEntry}
                            onBulkUpdate={onBulkUpdate}
                            onSavePersonTasks={onSavePersonTasks}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Month Summary */}
      {contractors.length > 0 && (
        <div className="border-2 border-gray-300 rounded-lg bg-gray-50 p-4">
          <div className="space-y-1">
            <div className="text-sm uppercase tracking-wide text-gray-600">
              {format(startDate, 'MMMM yyyy')} Total
            </div>
            <div className="text-2xl tabular-nums">
              {monthTotal.toFixed(1)} hours
            </div>
          </div>
        </div>
      )}
    </div>
  );
}