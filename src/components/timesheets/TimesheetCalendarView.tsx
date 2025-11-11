import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Copy, Plus, List, LayoutGrid } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isSaturday, isSunday, isWithinInterval, addMonths, subMonths } from 'date-fns';
import { TimesheetEntryDialog } from './TimesheetEntryDialog';
import { ApplyToOthersDialog } from './ApplyToOthersDialog';
import { useTimesheetEntries, useTimesheetPeriods } from '../../utils/api/timesheets-hooks';
import type { TimesheetEntry as BaseEntry } from '../../utils/api/timesheets-hooks';
import { useMonthContextSafe } from '../../contexts/MonthContext';

type WorkType = "regular" | "travel" | "overtime" | "oncall";

interface DayEntry {
  date: Date;
  hours: number;
  tasks: Array<{
    id: string;
    hours: number;
    workType: WorkType;
    taskCategory: string;
    task: string;
    notes: string;
    billable: boolean;
    tags: string[];
    // ✅ Add time tracking fields
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
  }>;
  status: "draft" | "submitted" | "approved" | "rejected";
}

type UserRole = 
  | "individual-contributor"
  | "company-owner"
  | "agency-owner";

interface TimesheetCalendarViewProps {
  contractorName?: string;
  hourlyRate?: number;
  mode?: "contractor" | "manager";
  userRole?: UserRole;
  userId?: string; // ✅ NEW: Accept userId prop to know which contractor's data to save
  companyId?: string; // ✅ NEW: Accept companyId prop
}

// Drag & Drop Types
const ItemTypes = {
  DAY_ENTRY: 'DAY_ENTRY'
};

interface DragItem {
  type: string;
  entry: DayEntry;
  sourceDate: string;
}

// Draggable Day Cell Component
function DraggableDay({ 
  date, 
  entry, 
  onDayClick, 
  today, 
  weekend, 
  getStatusColor, 
  getStatusIcon,
  hoveredDay,
  setHoveredDay,
  handleQuickAdd,
  formatDateKey,
  commonPattern,
  onDragEnd
}: any) {
  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    type: ItemTypes.DAY_ENTRY,
    item: (): DragItem => ({
      type: ItemTypes.DAY_ENTRY,
      entry: entry!,
      sourceDate: formatDateKey(date)
    }),
    end: (item, monitor) => {
      const dropResult = monitor.getDropResult<{ targetDate: string }>();
      if (item && dropResult) {
        onDragEnd(item, dropResult);
      }
    },
    canDrag: () => !!entry && entry.status === 'draft', // Only draft entries can be dragged
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [entry, date]);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.DAY_ENTRY,
    drop: (item: DragItem) => {
      return { targetDate: formatDateKey(date) };
    },
    canDrop: (item: DragItem) => {
      // Can drop on any day except the source
      return formatDateKey(date) !== item.sourceDate;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  }), [date]);

  // Combine drag and drop refs
  const ref = useRef<HTMLDivElement>(null);
  drag(drop(ref));

  const dropHighlight = isOver && canDrop ? 'ring-2 ring-accent-brand ring-offset-2 bg-accent-brand/20' : '';
  const canDropHint = !isOver && canDrop ? 'ring-1 ring-accent-brand/30' : '';

  return (
    <div
      ref={ref}
      className={`relative group ${dropHighlight} ${canDropHint} rounded-lg apple-transition`}
      onMouseEnter={() => setHoveredDay(date)}
      onMouseLeave={() => setHoveredDay(null)}
    >
      <button
        onClick={() => onDayClick(date)}
        className={`
          w-full aspect-square rounded-lg border-2 p-2 apple-transition
          hover:border-accent-brand hover:apple-shadow-md
          ${today ? 'border-accent-brand bg-accent-brand/5' : 'border-border'}
          ${weekend ? 'bg-accent/20' : 'bg-card'}
          ${entry ? 'hover:bg-accent-brand/10' : 'hover:bg-accent/30'}
          ${isDragging ? 'opacity-50 cursor-grabbing' : entry?.status === 'draft' ? 'cursor-grab' : ''}
          flex flex-col items-center justify-between relative
        `}
      >
        {/* Drag Handle - only show on draft entries */}
        {entry && entry.status === 'draft' && (
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 apple-transition">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
        )}

        {/* Day Number */}
        <div className={`text-sm font-semibold ${today ? 'text-accent-brand' : ''}`}>
          {date.getDate()}
        </div>

        {/* Hours */}
        {entry && entry.hours > 0 ? (
          <div className="space-y-1 w-full">
            <div className="text-center">
              <p className="font-semibold text-accent-brand">{entry.hours}h</p>
            </div>
            {/* Status Indicator */}
            <div className={`flex items-center justify-center ${getStatusColor(entry.status)}`}>
              {getStatusIcon(entry.status)}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100">
            <Plus className="w-4 h-4" />
          </div>
        )}

        {/* Drop indicator overlay */}
        {isOver && canDrop && (
          <div className="absolute inset-0 rounded-lg bg-accent-brand/10 border-2 border-accent-brand flex items-center justify-center pointer-events-none">
            <Copy className="w-6 h-6 text-accent-brand" />
          </div>
        )}
      </button>
      
      {/* Quick Add Popover */}
      {hoveredDay && formatDateKey(hoveredDay) === formatDateKey(date) && !entry && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-10 bg-card border border-border rounded-lg apple-shadow-lg p-2 flex gap-1 opacity-0 group-hover:opacity-100 apple-transition pointer-events-none group-hover:pointer-events-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleQuickAdd(date, 4);
            }}
            className="h-7 text-xs"
          >
            4h
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleQuickAdd(date, 8);
            }}
            className="h-7 text-xs"
          >
            8h
          </Button>
          {commonPattern && (
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                handleQuickAdd(date, commonPattern.hours);
              }}
              className="h-7 text-xs gap-1"
            >
              <Zap className="w-3 h-3" />
              {commonPattern.hours}h
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Main calendar component wrapped in DND context
function TimesheetCalendarContent({ 
  contractorName = "Current User",
  hourlyRate = 95,
  mode = "contractor",
  userRole = "individual-contributor",
  userId = 'user-freelancer-3', // ✅ CHANGED: Default to James Kim for testing
  companyId = 'company-1' // ✅ NEW: Default to company-1
}: TimesheetCalendarViewProps) {
  // ✅ Use shared month context instead of local state
  const { selectedMonth, setSelectedMonth } = useMonthContextSafe();
  const currentDate = selectedMonth;
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  
  // ✅ REPLACED: Use database hooks instead of useState
  // Calculate date range for the current month
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  
  // Fetch entries from database
  const { data: entriesArray = [], isLoading: isLoadingEntries } = useTimesheetEntries({
    userId: userId,
    companyId: companyId,
    startDate: formatDateForAPI(monthStart),
    endDate: formatDateForAPI(monthEnd),
  });
  
  // Save mutation
  const saveEntryMutation = useSaveTimesheetEntry();
  const bulkSaveMutation = useBulkSaveTimesheetEntries();
  
  // Convert database entries array to Map for existing calendar code
  const entries = useMemo(() => {
    const map = new Map<string, DayEntry>();
    
    entriesArray.forEach((entry: TimesheetEntry) => {
      const dateKey = entry.date; // Already in YYYY-MM-DD format
      const existing = map.get(dateKey);
      
      if (existing) {
        // Multiple entries for same day - combine them
        existing.hours += entry.hours || 0;
        existing.tasks.push({
          id: entry.id || `task-${Date.now()}`,
          hours: entry.hours || 0,
          workType: (entry.workType as WorkType) || 'regular',
          taskCategory: entry.taskCategory || 'Development',
          task: entry.taskDescription || '',
          notes: entry.notes || '',
          billable: entry.billable ?? true,
          tags: [],
          startTime: entry.startTime,
          endTime: entry.endTime,
          breakMinutes: entry.breakMinutes,
        });
      } else {
        // First entry for this day
        map.set(dateKey, {
          date: new Date(entry.date),
          hours: entry.hours || 0,
          tasks: [{
            id: entry.id || `task-${Date.now()}`,
            hours: entry.hours || 0,
            workType: (entry.workType as WorkType) || 'regular',
            taskCategory: entry.taskCategory || 'Development',
            task: entry.taskDescription || '',
            notes: entry.notes || '',
            billable: entry.billable ?? true,
            tags: [],
            startTime: entry.startTime,
            endTime: entry.endTime,
            breakMinutes: entry.breakMinutes,
          }],
          status: entry.status as any || 'draft',
        });
      }
    });
    
    console.log(`📊 Loaded ${entriesArray.length} entries from database, ${map.size} days`);
    return map;
  }, [entriesArray]);
  
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(true);
  const [draggedEntry, setDraggedEntry] = useState<DragItem | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'c' && selectedDay) {
        // Copy previous day
        const prevDay = new Date(selectedDay);
        prevDay.setDate(prevDay.getDate() - 1);
        handleCopyDay(prevDay, selectedDay);
      } else if (e.key === 'Enter' && selectedDay) {
        handleDayClick(selectedDay);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDay]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = lastDay.getDate();
  
  // Build calendar grid (start from Monday)
  const calendarDays: (Date | null)[] = [];
  
  // Add empty cells for days before month starts (Monday = 0, Sunday = 6)
  const startOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }
  
  // Calculate totals
  const monthlyHours = Array.from(entries.values()).reduce((sum, entry) => sum + entry.hours, 0);
  const monthlyPay = monthlyHours * hourlyRate;
  
  // Previous month comparison
  const previousMonthHours = 156; // Mock data
  const variance = monthlyHours - previousMonthHours;
  const percentChange = previousMonthHours > 0 ? (variance / previousMonthHours) * 100 : 0;
  
  // Week totals
  const weeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7).filter(Boolean) as Date[]);
  }
  
  const getWeekTotal = (week: Date[]): number => {
    return week.reduce((sum, date) => {
      const key = formatDateKey(date);
      const entry = entries.get(key);
      return sum + (entry?.hours || 0);
    }, 0);
  };

  const handlePreviousMonth = () => {
    setSelectedMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(new Date(year, month + 1, 1));
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setShowDayModal(true);
  };

  const handleSaveDay = (date: Date, hours: number, tasks: DayEntry['tasks']) => {
    // ✅ Save to database instead of local state
    const task = tasks[0]; // Take first task for now
    
    // 🐛 DEBUG: Log what we're receiving from the modal
    console.log('🔍 handleSaveDay called with:', {
      date,
      hours,
      tasks,
      firstTask: task,
      workType: task?.workType,
      taskCategory: task?.taskCategory,
      taskDescription: task?.task,
    });
    
    const entryData = {
      userId: userId,
      companyId: companyId,
      date: formatDateForAPI(date),
      hours: hours,
      status: 'draft' as const,
      // ✅ FIXED: Save all task fields
      workType: task?.workType || 'regular',
      taskCategory: task?.taskCategory || 'Development',
      taskDescription: task?.task || '',
      notes: task?.notes || '',
      billable: task?.billable ?? true,
      // ✅ Include time tracking fields
      startTime: task?.startTime,
      endTime: task?.endTime,
      breakMinutes: task?.breakMinutes,
    };
    
    // 🐛 DEBUG: Log what we're sending to the API
    console.log('🚀 Sending to API:', entryData);
    
    saveEntryMutation.mutate(entryData);
    
    setShowDayModal(false);
    // Toast will be shown by the mutation hook
  };

  const handleSubmitMonth = () => {
    if (monthlyHours === 0) {
      toast.error("Please log hours before submitting");
      return;
    }
    
    // TODO: Mark all entries as submitted in database
    // This would require a bulk update API endpoint
    toast.success(`${formatMonthYear(currentDate)} timesheet submitted for approval`);
  };

  const handleCopyLastMonth = () => {
    toast.success("Last month's timesheet copied");
    // In real app, fetch previous month's data
  };

  const handleCopyDay = (fromDate: Date, toDate: Date) => {
    const fromEntry = getDayEntry(fromDate);
    if (!fromEntry) {
      toast.error("No entry to copy");
      return;
    }
    
    // ✅ Copy to database
    const task = fromEntry.tasks[0];
    saveEntryMutation.mutate({
      userId: userId,
      companyId: companyId,
      date: formatDateForAPI(toDate),
      hours: fromEntry.hours,
      status: 'draft',
      taskDescription: task?.task || 'Development',
      notes: task?.notes || '',
      billable: task?.billable ?? true,
    });
  };

  // Drag & Drop Handler
  const handleDragDrop = (item: DragItem, dropResult: { targetDate: string } | null) => {
    if (!dropResult || !dropResult.targetDate) return;
    
    const targetDateKey = dropResult.targetDate;
    const sourceEntry = item.entry;
    
    // ✅ Copy to database via drag & drop
    const targetDate = new Date(targetDateKey);
    const task = sourceEntry.tasks[0];
    
    saveEntryMutation.mutate({
      userId: userId,
      companyId: companyId,
      date: formatDateForAPI(targetDate),
      hours: sourceEntry.hours,
      status: 'draft',
      taskDescription: task?.task || 'Development',
      notes: task?.notes || '',
      billable: task?.billable ?? true,
    });
  };

  // Monitor drag end
  useEffect(() => {
    const handleDragEnd = (e: DragEvent) => {
      setDraggedEntry(null);
    };
    
    window.addEventListener('dragend', handleDragEnd);
    return () => window.removeEventListener('dragend', handleDragEnd);
  }, []);

  const handleQuickAdd = (date: Date, hours: number) => {
    // ✅ Save to database
    saveEntryMutation.mutate({
      userId: userId,
      companyId: companyId,
      date: formatDateForAPI(date),
      hours: hours,
      status: 'draft',
      taskDescription: 'Development',
      notes: '',
      billable: true,
    });
  };

  const handleFillWeekdays = (weekStart: Date, hours: number) => {
    const weekdays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        weekdays.push(date);
      }
    }
    
    // ✅ Save all weekdays to database using bulk mutation
    bulkSaveMutation.mutate(
      weekdays.map(date => ({
        userId: userId,
        companyId: companyId,
        date: formatDateForAPI(date),
        hours: hours,
        status: 'draft' as const,
        taskDescription: 'Development',
        notes: '',
        billable: true,
      }))
    );
  };
  
  // Detect most common pattern
  const getMostCommonPattern = (): { hours: number; workType: WorkType } | null => {
    const patterns = new Map<string, number>();
    entries.forEach(entry => {
      const task = entry.tasks[0];
      if (task) {
        const key = `${entry.hours}-${task.workType || ""}`;
        patterns.set(key, (patterns.get(key) || 0) + 1);
      }
    });
    
    let mostCommon: { hours: number; workType: WorkType } | null = null;
    let maxCount = 0;
    
    patterns.forEach((count, key) => {
      if (count > maxCount) {
        const [hours, workType] = key.split('-');
        mostCommon = { hours: parseFloat(hours), workType: workType as WorkType };
        maxCount = count;
      }
    });
    
    return maxCount >= 3 ? mostCommon : null;
  };
  
  const commonPattern = getMostCommonPattern();
  
  // Get last used work type
  const getLastUsedWorkType = (): WorkType => {
    const sortedEntries = Array.from(entries.values()).sort((a, b) => 
      b.date.getTime() - a.date.getTime()
    );
    return sortedEntries[0]?.tasks[0]?.workType || "regular";
  };
  
  const lastUsedWorkType = getLastUsedWorkType();

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

  const getDayEntry = (date: Date | null): DayEntry | undefined => {
    if (!date) return undefined;
    return entries.get(formatDateKey(date));
  };

  const getStatusColor = (status: DayEntry['status']) => {
    switch (status) {
      case "draft": return "text-muted-foreground";
      case "submitted": return "text-warning";
      case "approved": return "text-success";
      case "rejected": return "text-destructive";
    }
  };

  const getStatusIcon = (status: DayEntry['status']) => {
    switch (status) {
      case "draft": return <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />;
      case "submitted": return <Clock className="w-3.5 h-3.5" />;
      case "approved": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "rejected": return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">Monthly Timesheet</h2>
          <p className="text-sm text-muted-foreground">
            {contractorName} · ${hourlyRate}/hour
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLastMonth} className="gap-2">
            <Copy className="w-4 h-4" />
            Copy Last Month
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Drag & Drop Hint */}
      <Card className="p-4 bg-gradient-subtle border-accent-brand/20">
        <div className="flex items-start gap-3">
          <GripVertical className="w-5 h-5 text-accent-brand flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">✨ Drag & Drop to Copy Entries</p>
            <p className="text-sm text-muted-foreground">
              Click and drag any <strong>Draft</strong> entry to another day to quickly copy hours, tasks, and notes. 
              Perfect for filling repetitive schedules!
            </p>
          </div>
        </div>
      </Card>

      {/* Smart Suggestions */}
      {showSmartSuggestions && commonPattern && (
        <Card className="p-4 bg-accent-brand/10 border-accent-brand/20">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-accent-brand flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Smart Fill Detected</p>
                <p className="text-sm text-muted-foreground mb-3">
                  We noticed you usually log <span className="font-semibold text-foreground">{commonPattern.hours}h of {commonPattern.task}</span>. 
                  Want to auto-fill the rest of the month?
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    onClick={() => {
                      const firstWeek = weeks[0];
                      if (firstWeek) {
                        const monday = firstWeek.find(d => d.getDay() === 1);
                        if (monday) handleFillWeekdays(monday, commonPattern.hours);
                      }
                      setShowSmartSuggestions(false);
                    }}
                  >
                    Fill This Week
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      weeks.forEach(week => {
                        const monday = week.find(d => d.getDay() === 1) || week[0];
                        handleFillWeekdays(monday, commonPattern.hours);
                      });
                      setShowSmartSuggestions(false);
                    }}
                  >
                    Fill All Weeks
                  </Button>
                  <Button 
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowSmartSuggestions(false)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Calendar Card */}
      <Card className="overflow-hidden">
        {/* Month Navigation */}
        <div className="p-4 border-b border-border bg-accent/30">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handlePreviousMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <h3 className="m-0">{formatMonthYear(currentDate)}</h3>
            
            <Button variant="ghost" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="space-y-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }, (_, dayIndex) => {
                    const cellIndex = weekIndex * 7 + dayIndex;
                    const date = calendarDays[cellIndex];
                    const entry = getDayEntry(date);
                    const today = isToday(date);
                    const weekend = isWeekend(date);

                    if (!date) {
                      return (
                        <div 
                          key={dayIndex} 
                          className="aspect-square rounded-lg bg-transparent"
                          aria-hidden="true"
                        />
                      );
                    }

                    return (
                      <DraggableDay
                        key={dayIndex}
                        date={date}
                        entry={entry}
                        onDayClick={handleDayClick}
                        today={today}
                        weekend={weekend}
                        getStatusColor={getStatusColor}
                        getStatusIcon={getStatusIcon}
                        hoveredDay={hoveredDay}
                        setHoveredDay={setHoveredDay}
                        handleQuickAdd={handleQuickAdd}
                        formatDateKey={formatDateKey}
                        commonPattern={commonPattern}
                        onDragEnd={handleDragDrop}
                      />
                    );
                  })}
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Summary Footer */}
        <div className="border-t-2 border-border bg-accent/30 p-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
              <p className="text-2xl font-semibold text-accent-brand">{monthlyHours}h</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Days Worked</p>
              <p className="text-2xl font-semibold">
                {Array.from(entries.values()).filter(e => e.hours > 0).length}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Estimated Pay</p>
              <p className="text-2xl font-semibold">
                ${monthlyPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">vs. Last Month</p>
              <div className="flex items-center gap-2">
                {variance > 0 ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-success" />
                    <p className="text-2xl font-semibold text-success">
                      +{Math.abs(variance)}h
                    </p>
                  </>
                ) : variance < 0 ? (
                  <>
                    <TrendingDown className="w-5 h-5 text-muted-foreground" />
                    <p className="text-2xl font-semibold text-muted-foreground">
                      -{Math.abs(variance)}h
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-semibold text-muted-foreground">--</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Status Legend</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">Draft</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" />
            <span className="text-muted-foreground">Pending Approval</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-muted-foreground">Rejected</span>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      {monthlyHours > 0 && (
        <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg border border-border">
          <div className="text-sm">
            <p className="font-medium">Ready to submit {formatMonthYear(currentDate)}?</p>
            <p className="text-muted-foreground">
              You've logged {monthlyHours} hours for ${monthlyPay.toLocaleString()}
            </p>
          </div>
          
          <Button onClick={handleSubmitMonth} className="gap-2">
            <Send className="w-4 h-4" />
            Submit Month for Approval
          </Button>
        </div>
      )}

      {/* Day Entry Modal */}
      {selectedDay && (
        <EnhancedDayEntryModal
          open={showDayModal}
          onOpenChange={setShowDayModal}
          date={selectedDay}
          entry={getDayEntry(selectedDay)}
          userRole={userRole}
          hourlyRate={hourlyRate}
          onSave={handleSaveDay}
          lastUsedWorkType={lastUsedWorkType}
          commonPattern={commonPattern}
        />
      )}
    </div>
  );
}

// Main Export with DndProvider wrapper
export function TimesheetCalendarView(props: TimesheetCalendarViewProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <TimesheetCalendarContent {...props} />
    </DndProvider>
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