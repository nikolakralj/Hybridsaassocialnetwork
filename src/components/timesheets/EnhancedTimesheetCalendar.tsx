import { useState, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Copy, Users, Zap,
  Download, Send, X, Check, GripVertical
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { Input } from "../ui/input";
import { TeamTimesheetCreator } from "./TeamTimesheetCreator";
import { toast } from "sonner";

interface PersonChip {
  id: string;
  name: string;
  avatar: string;
  hourlyRate: number;
}

interface DayEntry {
  date: Date;
  hours: number;
  task: string;
  notes: string;
  persons: PersonChip[];
}

export function EnhancedTimesheetCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<Map<string, DayEntry>>(new Map());
  const [selectedPersons, setSelectedPersons] = useState<Set<string>>(new Set(["p1"]));
  const [showTeamCreator, setShowTeamCreator] = useState(false);
  const [draggedEntry, setDraggedEntry] = useState<DayEntry | null>(null);
  const [quickAddDay, setQuickAddDay] = useState<Date | null>(null);
  const [quickAddHours, setQuickAddHours] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Available persons
  const allPersons: PersonChip[] = [
    { id: "p1", name: "Sarah Chen", avatar: "SC", hourlyRate: 120 },
    { id: "p2", name: "Mike Johnson", avatar: "MJ", hourlyRate: 110 },
    { id: "p3", name: "Lisa Park", avatar: "LP", hourlyRate: 95 },
  ];

  // Get calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const calendarDays: (Date | null)[] = [];
  const startOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push(null);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const togglePerson = (id: string) => {
    setSelectedPersons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        if (newSet.size > 1) { // Keep at least one
          newSet.delete(id);
        }
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleQuickAdd = (date: Date, hours: number) => {
    const key = formatDateKey(date);
    const selectedPersonsList = allPersons.filter(p => selectedPersons.has(p.id));
    
    setEntries(prev => {
      const newMap = new Map(prev);
      newMap.set(key, {
        date,
        hours,
        task: "Development",
        notes: "",
        persons: selectedPersonsList,
      });
      return newMap;
    });
    
    setQuickAddDay(null);
    setQuickAddHours("");
    toast.success(`${hours}h added for ${selectedPersonsList.length} person${selectedPersonsList.length !== 1 ? 's' : ''}`);
  };

  const handleDragStart = (entry: DayEntry) => {
    setDraggedEntry(entry);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetDate: Date) => {
    if (!draggedEntry) return;
    
    const key = formatDateKey(targetDate);
    setEntries(prev => {
      const newMap = new Map(prev);
      newMap.set(key, {
        ...draggedEntry,
        date: targetDate,
      });
      return newMap;
    });
    
    setDraggedEntry(null);
    toast.success(`Entry copied to ${formatShortDate(targetDate)}`);
  };

  const handleFillWeek = (week: (Date | null)[]) => {
    const weekdays = week.filter(d => d && d.getDay() !== 0 && d.getDay() !== 6) as Date[];
    const selectedPersonsList = allPersons.filter(p => selectedPersons.has(p.id));
    
    setEntries(prev => {
      const newMap = new Map(prev);
      weekdays.forEach(date => {
        newMap.set(formatDateKey(date), {
          date,
          hours: 8,
          task: "Development",
          notes: "",
          persons: selectedPersonsList,
        });
      });
      return newMap;
    });
    
    toast.success(`Filled ${weekdays.length} days for ${selectedPersonsList.length} person${selectedPersonsList.length !== 1 ? 's' : ''}`);
  };

  const getDayEntry = (date: Date | null): DayEntry | undefined => {
    if (!date) return undefined;
    return entries.get(formatDateKey(date));
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

  const monthlyHours = Array.from(entries.values()).reduce((sum, e) => sum + e.hours, 0);

  return (
    <div className="space-y-6">
      {/* Header with Person Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">Timesheet Calendar</h2>
          <p className="text-sm text-muted-foreground">
            {formatMonthYear(currentDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTeamCreator(true)}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            Create Team Timesheet
          </Button>
        </div>
      </div>

      {/* Person Selector Chips */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Users className="w-5 h-5 text-accent-brand" />
          <p className="font-medium">Logging Time For:</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {allPersons.map((person) => {
            const isSelected = selectedPersons.has(person.id);
            return (
              <button
                key={person.id}
                onClick={() => togglePerson(person.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border-2 apple-transition
                  ${isSelected 
                    ? 'border-accent-brand bg-accent-brand/10' 
                    : 'border-border hover:border-accent-brand/50'
                  }
                `}
              >
                <Avatar className="w-6 h-6 bg-accent-brand/10 text-accent-brand flex items-center justify-center text-xs">
                  {person.avatar}
                </Avatar>
                <span className="font-medium">{person.name}</span>
                {isSelected && <Check className="w-4 h-4 text-accent-brand" />}
              </button>
            );
          })}
        </div>

        {selectedPersons.size > 1 && (
          <div className="mt-3 p-3 bg-accent-brand/10 rounded-lg flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent-brand" />
            <p className="text-sm">
              <span className="font-medium">{selectedPersons.size} people selected</span> 
              {" "}· Hours will be logged for all selected team members
            </p>
          </div>
        )}
      </Card>

      {/* Calendar */}
      <Card className="overflow-hidden">
        {/* Month Navigation */}
        <div className="p-4 border-b border-border bg-accent/30">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <h3 className="m-0">{formatMonthYear(currentDate)}</h3>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
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
              <div key={weekIndex} className="space-y-2">
                {/* Week Actions */}
                <div className="flex items-center justify-end gap-2 px-2">
                  <p className="text-xs text-muted-foreground">Week {weekIndex + 1}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFillWeek(week)}
                    className="h-7 text-xs gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    Fill Week
                  </Button>
                </div>

                {/* Week Row */}
                <div className="grid grid-cols-7 gap-2">
                  {week.map((date, dayIndex) => {
                    const entry = getDayEntry(date);
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
                          handleDrop(date);
                        }}
                      >
                        <div
                          draggable={!!entry}
                          onDragStart={() => entry && handleDragStart(entry)}
                          className={`
                            w-full min-h-[100px] rounded-lg border-2 p-2 apple-transition
                            ${today ? 'border-accent-brand bg-accent-brand/5' : 'border-border'}
                            ${weekend ? 'bg-accent/20' : 'bg-card'}
                            ${entry ? 'hover:border-accent-brand hover:apple-shadow-md cursor-move' : 'hover:border-accent-brand/50'}
                            flex flex-col
                          `}
                        >
                          {/* Day Number */}
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-semibold ${today ? 'text-accent-brand' : ''}`}>
                              {date.getDate()}
                            </span>
                            {entry && (
                              <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                            )}
                          </div>

                          {/* Entry or Quick Add */}
                          {entry ? (
                            <div className="space-y-1">
                              <p className="font-semibold text-accent-brand">{entry.hours}h</p>
                              <p className="text-xs text-muted-foreground truncate">{entry.task}</p>
                              {entry.persons.length > 1 && (
                                <div className="flex -space-x-1">
                                  {entry.persons.slice(0, 3).map((person) => (
                                    <Avatar 
                                      key={person.id}
                                      className="w-5 h-5 bg-accent-brand/10 text-accent-brand flex items-center justify-center text-xs border border-card"
                                    >
                                      {person.avatar}
                                    </Avatar>
                                  ))}
                                  {entry.persons.length > 3 && (
                                    <div className="w-5 h-5 rounded-full bg-muted border border-card flex items-center justify-center text-xs">
                                      +{entry.persons.length - 3}
                                    </div>
                                  )}
                                </div>
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
                          ) : (
                            <button
                              onClick={() => setQuickAddDay(date)}
                              className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 apple-transition"
                            >
                              <Plus className="w-5 h-5 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="border-t-2 border-border bg-accent/30 p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
              <p className="text-2xl font-semibold text-accent-brand">{monthlyHours}h</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Days Logged</p>
              <p className="text-2xl font-semibold">
                {Array.from(entries.values()).filter(e => e.hours > 0).length}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Team Members</p>
              <p className="text-2xl font-semibold">{selectedPersons.size}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-4 bg-accent/20">
        <p className="text-sm font-medium mb-2">💡 Quick Tips</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>• <span className="font-medium">Click "+"</span> on any day for inline quick-add</p>
          <p>• <span className="font-medium">Drag entries</span> to copy them to other days</p>
          <p>• <span className="font-medium">Select multiple people</span> to log hours for the whole team</p>
          <p>• <span className="font-medium">Use "Fill Week"</span> to quickly populate weekdays</p>
          <p>• <span className="font-medium">Keyboard:</span> Enter to save, Esc to cancel, C to copy previous</p>
        </div>
      </Card>

      {/* Team Timesheet Creator */}
      <TeamTimesheetCreator
        open={showTeamCreator}
        onOpenChange={setShowTeamCreator}
        onCreateTeamTimesheet={(members, pattern) => {
          console.log("Team timesheet created:", members, pattern);
          // Implementation would create entries for all selected members
        }}
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
