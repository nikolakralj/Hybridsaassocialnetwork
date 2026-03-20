import { useState, useRef } from "react";
import { 
  ChevronLeft, ChevronRight, Download, Users, GripVertical, Copy, Plus
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

type WorkType = "regular" | "travel" | "overtime" | "oncall";

interface ContractorEntry {
  contractorId: string;
  contractorName: string;
  contractorInitials: string;
  hours: number;
  tasks: Array<{
    id: string;
    hours: number;
    workType: WorkType;
    task: string;
    notes: string;
  }>;
  status: "draft" | "submitted" | "approved" | "rejected";
}

interface DayAggregate {
  date: Date;
  totalHours: number;
  contractors: ContractorEntry[];
}

// Drag & Drop Types
const ItemTypes = {
  AGGREGATE_DAY: 'AGGREGATE_DAY'
};

interface DragItem {
  type: string;
  aggregate: DayAggregate;
  sourceDate: string;
}

// Colors for contractor badges
const contractorColors = [
  'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'bg-green-500/10 text-green-600 border-green-500/20',
  'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'bg-pink-500/10 text-pink-600 border-pink-500/20'
];

// Draggable Aggregate Day Component
function DraggableAggregateDay({ 
  date, 
  aggregate, 
  onDayClick, 
  today, 
  weekend,
  formatDateKey,
  hoveredDay,
  setHoveredDay,
  onDragEnd
}: any) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.AGGREGATE_DAY,
    item: (): DragItem => ({
      type: ItemTypes.AGGREGATE_DAY,
      aggregate: aggregate!,
      sourceDate: formatDateKey(date)
    }),
    end: (item, monitor) => {
      const dropResult = monitor.getDropResult<{ targetDate: string }>();
      if (item && dropResult) {
        onDragEnd(item, dropResult);
      }
    },
    canDrag: () => !!aggregate && aggregate.contractors.length > 0,
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [aggregate, date]);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.AGGREGATE_DAY,
    drop: (item: DragItem) => {
      return { targetDate: formatDateKey(date) };
    },
    canDrop: (item: DragItem) => {
      return formatDateKey(date) !== item.sourceDate;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  }), [date]);

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
          ${aggregate ? 'hover:bg-accent-brand/10' : 'hover:bg-accent/30'}
          ${isDragging ? 'opacity-50 cursor-grabbing' : aggregate ? 'cursor-grab' : ''}
          flex flex-col items-start justify-between relative
        `}
      >
        {/* Drag Handle */}
        {aggregate && aggregate.contractors.length > 0 && (
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 apple-transition">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
        )}

        {/* Day Number */}
        <div className={`text-sm font-semibold ${today ? 'text-accent-brand' : ''}`}>
          {date.getDate()}
        </div>

        {/* Aggregate Data */}
        {aggregate && aggregate.totalHours > 0 ? (
          <div className="space-y-1 w-full">
            {/* Total Hours */}
            <div className="text-center">
              <p className="font-semibold text-accent-brand">{aggregate.totalHours}h</p>
            </div>
            
            {/* Contractor Initials */}
            <div className="flex flex-wrap gap-0.5 justify-center">
              {aggregate.contractors.slice(0, 3).map((contractor, idx) => (
                <span 
                  key={contractor.contractorId}
                  className={`text-[10px] px-1 py-0.5 rounded border ${contractorColors[idx % contractorColors.length]}`}
                >
                  {contractor.contractorInitials}
                </span>
              ))}
              {aggregate.contractors.length > 3 && (
                <span className="text-[10px] px-1 py-0.5 rounded border bg-muted text-muted-foreground">
                  +{aggregate.contractors.length - 3}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 w-full">
            <Plus className="w-4 h-4" />
          </div>
        )}

        {/* Drop indicator overlay */}
        {isOver && canDrop && (
          <div className="absolute inset-0 rounded-lg bg-accent-brand/10 border-2 border-accent-brand flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-1">
              <Copy className="w-6 h-6 text-accent-brand" />
              <span className="text-xs font-medium text-accent-brand">Copy All</span>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}

// Main Component
function TeamAggregateCalendarContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [aggregateData, setAggregateData] = useState<Map<string, DayAggregate>>(() => {
    const initialData = new Map<string, DayAggregate>();
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Sample contractors
    const contractors = [
      { id: 'c1', name: 'Sarah Chen', initials: 'SC' },
      { id: 'c2', name: 'Ian Mitchell', initials: 'IM' },
      { id: 'c3', name: 'Lisa Park', initials: 'LP' }
    ];
    
    // Add sample data for first two weeks
    for (let day = 1; day <= 10; day++) {
      const date = new Date(currentYear, currentMonth, day);
      if (date.getDay() !== 0 && date.getDay() !== 6) { // Weekdays only
        const contractorEntries: ContractorEntry[] = contractors.map(c => ({
          contractorId: c.id,
          contractorName: c.name,
          contractorInitials: c.initials,
          hours: 8,
          tasks: [{
            id: `task-${c.id}-${date.getTime()}`,
            hours: 8,
            workType: "regular",
            task: "Software Development",
            notes: ""
          }],
          status: "draft" as const
        }));
        
        initialData.set(formatDateKey(date), {
          date,
          totalHours: 24, // 3 contractors × 8h
          contractors: contractorEntries
        });
      }
    }
    return initialData;
  });
  
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  // Build calendar grid (start from Monday)
  const calendarDays: (Date | null)[] = [];
  const startOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }
  
  // Calculate totals
  const monthlyTotal = Array.from(aggregateData.values()).reduce(
    (sum, agg) => sum + agg.totalHours, 
    0
  );
  
  const uniqueContractors = new Set<string>();
  aggregateData.forEach(agg => {
    agg.contractors.forEach(c => uniqueContractors.add(c.contractorId));
  });
  const contractorCount = uniqueContractors.size;

  // Get breakdown by status
  const statusBreakdown = Array.from(aggregateData.values()).reduce((acc, agg) => {
    agg.contractors.forEach(c => {
      acc[c.status] = (acc[c.status] || 0) + c.hours;
    });
    return acc;
  }, {} as Record<string, number>);

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    const aggregate = getAggregate(date);
    if (aggregate) {
      toast.info(
        <div>
          <p className="font-medium">{formatShortDate(date)}</p>
          <p className="text-sm text-muted-foreground">
            {aggregate.totalHours}h across {aggregate.contractors.length} contractors
          </p>
        </div>
      );
    }
  };

  const handleDragDrop = (item: DragItem, dropResult: { targetDate: string } | null) => {
    if (!dropResult || !dropResult.targetDate) return;
    
    const targetDateKey = dropResult.targetDate;
    const sourceAggregate = item.aggregate;
    const targetDate = new Date(targetDateKey);
    
    // Copy pattern for ALL contractors
    setAggregateData(prev => {
      const newMap = new Map(prev);
      
      const newContractorEntries: ContractorEntry[] = sourceAggregate.contractors.map(contractor => ({
        ...contractor,
        tasks: contractor.tasks.map(task => ({
          ...task,
          id: `task-${contractor.contractorId}-${Date.now()}-${Math.random()}`
        })),
        status: "draft" // Reset to draft
      }));
      
      const newTotalHours = newContractorEntries.reduce((sum, c) => sum + c.hours, 0);
      
      newMap.set(targetDateKey, {
        date: targetDate,
        totalHours: newTotalHours,
        contractors: newContractorEntries
      });
      
      return newMap;
    });
    
    toast.success(
      <div>
        <p className="font-medium">Team pattern copied to {formatShortDate(targetDate)}</p>
        <p className="text-sm text-muted-foreground">
          {sourceAggregate.contractors.length} contractors × {sourceAggregate.totalHours / sourceAggregate.contractors.length}h each
        </p>
      </div>
    );
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

  const getAggregate = (date: Date | null): DayAggregate | undefined => {
    if (!date) return undefined;
    return aggregateData.get(formatDateKey(date));
  };

  // Build weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7).filter(Boolean) as Date[]);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-accent-brand" />
            <div>
              <h2 className="mb-0">All Contractors</h2>
              <p className="text-sm text-muted-foreground">
                Team aggregate view
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-2">
            <Users className="w-3 h-3" />
            {contractorCount} contractors
          </Badge>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export All
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Logged</p>
            <p className="text-2xl font-semibold text-accent-brand">{monthlyTotal}h</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Approved</p>
            <p className="text-2xl font-semibold text-success">{statusBreakdown.approved || 0}h</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Pending</p>
            <p className="text-2xl font-semibold text-warning">{statusBreakdown.submitted || 0}h</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Rejected</p>
            <p className="text-2xl font-semibold text-destructive">{statusBreakdown.rejected || 0}h</p>
          </div>
        </div>
      </Card>

      {/* Drag & Drop Hint */}
      <Card className="p-4 bg-gradient-subtle border-accent-brand/20">
        <div className="flex items-start gap-3">
          <GripVertical className="w-5 h-5 text-accent-brand flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">🚀 Drag & Drop Team Patterns</p>
            <p className="text-sm text-muted-foreground">
              Click and drag any day to copy the <strong>entire team's schedule</strong> to another day. 
              Perfect for filling repetitive weekly patterns across all contractors at once!
            </p>
          </div>
        </div>
      </Card>

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
                  const aggregate = getAggregate(date);
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
                    <DraggableAggregateDay
                      key={dayIndex}
                      date={date}
                      aggregate={aggregate}
                      onDayClick={handleDayClick}
                      today={today}
                      weekend={weekend}
                      formatDateKey={formatDateKey}
                      hoveredDay={hoveredDay}
                      setHoveredDay={setHoveredDay}
                      onDragEnd={handleDragDrop}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// Main Export with DndProvider
export function TeamAggregateCalendar() {
  return (
    <DndProvider backend={HTML5Backend}>
      <TeamAggregateCalendarContent />
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
