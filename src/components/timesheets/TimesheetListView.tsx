import { useState } from "react";
import { 
  GripVertical, Plus, Copy, Trash2, Calendar,
  TrendingUp, Download, Send, ChevronDown
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

interface DayEntry {
  date: Date;
  hours: number;
  task: string;
  notes: string;
  status: "draft" | "submitted" | "approved" | "rejected";
}

interface TimesheetListViewProps {
  contractorName?: string;
  hourlyRate?: number;
}

export function TimesheetListView({ 
  contractorName = "Current User",
  hourlyRate = 95
}: TimesheetListViewProps) {
  const [currentDate] = useState(new Date());
  const [entries, setEntries] = useState<Map<string, DayEntry>>(new Map());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get all days in month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  const allDays: Date[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    allDays.push(new Date(year, month, day));
  }
  
  // Group by weeks
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  allDays.forEach((date, index) => {
    currentWeek.push(date);
    if (date.getDay() === 0 || index === allDays.length - 1) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  const getEntry = (date: Date): DayEntry | undefined => {
    return entries.get(formatDateKey(date));
  };

  const updateEntry = (date: Date, field: keyof DayEntry, value: any) => {
    const key = formatDateKey(date);
    const existing = entries.get(key);
    
    setEntries(prev => {
      const newMap = new Map(prev);
      newMap.set(key, {
        date,
        hours: existing?.hours || 0,
        task: existing?.task || "",
        notes: existing?.notes || "",
        status: "draft",
        [field]: value,
      });
      return newMap;
    });
  };

  const copyEntry = (fromDate: Date, toDate: Date) => {
    const fromKey = formatDateKey(fromDate);
    const fromEntry = entries.get(fromKey);
    
    if (!fromEntry) return;
    
    const toKey = formatDateKey(toDate);
    setEntries(prev => {
      const newMap = new Map(prev);
      newMap.set(toKey, {
        ...fromEntry,
        date: toDate,
        status: "draft",
      });
      return newMap;
    });
    
    toast.success(`Copied ${fromEntry.hours}h to ${formatShortDate(toDate)}`);
  };

  const deleteEntry = (date: Date) => {
    const key = formatDateKey(date);
    setEntries(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
    toast.success("Entry deleted");
  };

  const fillWeek = (week: Date[], hours: number, task: string) => {
    const weekdays = week.filter(d => d.getDay() !== 0 && d.getDay() !== 6);
    
    setEntries(prev => {
      const newMap = new Map(prev);
      weekdays.forEach(date => {
        newMap.set(formatDateKey(date), {
          date,
          hours,
          task,
          notes: "",
          status: "draft",
        });
      });
      return newMap;
    });
    
    toast.success(`Filled ${weekdays.length} days with ${hours}h ${task}`);
  };

  const copyPreviousDay = (date: Date) => {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    copyEntry(prevDay, date);
  };

  const toggleWeek = (weekIndex: number) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekIndex)) {
        newSet.delete(weekIndex);
      } else {
        newSet.add(weekIndex);
      }
      return newSet;
    });
  };

  const getWeekTotal = (week: Date[]): number => {
    return week.reduce((sum, date) => {
      const entry = getEntry(date);
      return sum + (entry?.hours || 0);
    }, 0);
  };

  const monthlyHours = Array.from(entries.values()).reduce((sum, e) => sum + e.hours, 0);
  const monthlyPay = monthlyHours * hourlyRate;

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">List View</h2>
          <p className="text-sm text-muted-foreground">
            {formatMonthYear(currentDate)} · Quick bulk entry
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="p-4 bg-accent/30">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <p className="font-medium mb-1">Smart Fill</p>
            <p className="text-muted-foreground">Quickly fill common patterns</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const thisWeek = weeks.find(w => w.some(d => isToday(d)));
                if (thisWeek) fillWeek(thisWeek, 8, "Development");
              }}
            >
              Fill This Week (8h)
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                weeks.forEach(week => fillWeek(week, 8, "Development"));
              }}
            >
              Fill All Weeks (8h)
            </Button>
          </div>
        </div>
      </Card>

      {/* Weeks List */}
      <div className="space-y-3">
        {weeks.map((week, weekIndex) => {
          const weekTotal = getWeekTotal(week);
          const isExpanded = expandedWeeks.has(weekIndex);
          const weekStart = week[0];
          const weekEnd = week[week.length - 1];
          
          return (
            <Card key={weekIndex} className="overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleWeek(weekIndex)}>
                {/* Week Header */}
                <CollapsibleTrigger asChild>
                  <div className="p-4 bg-accent/30 hover:bg-accent/50 cursor-pointer apple-transition flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-5 h-5 apple-transition ${isExpanded ? 'rotate-180' : ''}`} />
                      <div>
                        <p className="font-semibold">
                          Week {weekIndex + 1}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateRange(weekStart, weekEnd)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-lg">{weekTotal}h</p>
                        <p className="text-xs text-muted-foreground">
                          ${(weekTotal * hourlyRate).toLocaleString()}
                        </p>
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          fillWeek(week, 8, "Development");
                        }}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Fill Week
                      </Button>
                    </div>
                  </div>
                </CollapsibleTrigger>

                {/* Week Days */}
                <CollapsibleContent>
                  <div className="divide-y divide-border">
                    {week.map((date, dayIndex) => {
                      const entry = getEntry(date);
                      const today = isToday(date);
                      const weekend = isWeekend(date);
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`p-4 hover:bg-accent/30 apple-transition ${
                            today ? 'bg-accent-brand/5 border-l-2 border-l-accent-brand' : ''
                          } ${weekend ? 'bg-accent/20' : ''}`}
                        >
                          <div className="grid grid-cols-12 gap-4 items-center">
                            {/* Drag Handle */}
                            <div className="col-span-1 flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                            </div>

                            {/* Date */}
                            <div className="col-span-2">
                              <p className="font-semibold">{formatDayName(date)}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatShortDate(date)}
                              </p>
                              {weekend && (
                                <Badge variant="secondary" className="text-xs mt-1">Weekend</Badge>
                              )}
                            </div>

                            {/* Hours */}
                            <div className="col-span-2">
                              <Input
                                type="number"
                                value={entry?.hours || ""}
                                onChange={(e) => updateEntry(date, "hours", parseFloat(e.target.value) || 0)}
                                placeholder="0.0"
                                className="h-9"
                                min="0"
                                max="24"
                                step="0.5"
                              />
                            </div>

                            {/* Task */}
                            <div className="col-span-3">
                              <Select
                                value={entry?.task || ""}
                                onValueChange={(v) => updateEntry(date, "task", v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select task" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Development">Development</SelectItem>
                                  <SelectItem value="UI Design">UI Design</SelectItem>
                                  <SelectItem value="Code Review">Code Review</SelectItem>
                                  <SelectItem value="Client Meeting">Client Meeting</SelectItem>
                                  <SelectItem value="Planning">Planning</SelectItem>
                                  <SelectItem value="Testing/QA">Testing/QA</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Notes */}
                            <div className="col-span-3">
                              <Input
                                value={entry?.notes || ""}
                                onChange={(e) => updateEntry(date, "notes", e.target.value)}
                                placeholder="What did you work on?"
                                className="h-9"
                              />
                            </div>

                            {/* Actions */}
                            <div className="col-span-1 flex items-center gap-1 justify-end">
                              {dayIndex > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyPreviousDay(date)}
                                  className="h-8 w-8 p-0"
                                  title="Copy previous day (C)"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              )}
                              {entry && entry.hours > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteEntry(date)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Pay estimate for this day */}
                          {entry && entry.hours > 0 && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              ${(entry.hours * hourlyRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Monthly Summary */}
      <Card className="p-6 bg-accent/30">
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
            <p className="text-3xl font-semibold text-accent-brand">{monthlyHours}h</p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Days Worked</p>
            <p className="text-3xl font-semibold">
              {Array.from(entries.values()).filter(e => e.hours > 0).length}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Pay</p>
            <p className="text-3xl font-semibold">
              ${monthlyPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </Card>

      {/* Submit Button */}
      {monthlyHours > 0 && (
        <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg border border-border">
          <div className="text-sm">
            <p className="font-medium">Ready to submit?</p>
            <p className="text-muted-foreground">
              {monthlyHours} hours · ${monthlyPay.toLocaleString()}
            </p>
          </div>
          
          <Button className="gap-2">
            <Send className="w-4 h-4" />
            Submit Month
          </Button>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <Card className="p-4 bg-accent/20">
        <p className="text-sm font-medium mb-2">⌨️ Keyboard Shortcuts</p>
        <div className="grid md:grid-cols-3 gap-3 text-sm text-muted-foreground">
          <div>
            <kbd className="px-2 py-1 bg-card border border-border rounded text-xs font-semibold">Tab</kbd>
            <span className="ml-2">Next field</span>
          </div>
          <div>
            <kbd className="px-2 py-1 bg-card border border-border rounded text-xs font-semibold">C</kbd>
            <span className="ml-2">Copy previous</span>
          </div>
          <div>
            <kbd className="px-2 py-1 bg-card border border-border rounded text-xs font-semibold">Enter</kbd>
            <span className="ml-2">Save & next</span>
          </div>
        </div>
      </Card>
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

function formatDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}
