import { useState, useEffect } from "react";
import { Clock, ChevronDown, ChevronUp, Calendar, Plus, X, Zap, AlertCircle, CheckCircle2, Trash2, Car, Moon } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

// Work types with rate multipliers
type WorkType = "regular" | "travel" | "overtime" | "oncall";

interface WorkTypeConfig {
  label: string;
  icon: React.ReactNode;
  rateMultiplier: number;
  description: string;
}

const workTypeConfigs: Record<WorkType, WorkTypeConfig> = {
  regular: {
    label: "Regular Work",
    icon: <Clock className="w-4 h-4" />,
    rateMultiplier: 1.0,
    description: "Standard billable hours"
  },
  travel: {
    label: "Travel Time",
    icon: <Car className="w-4 h-4" />,
    rateMultiplier: 0.5,
    description: "50% of standard rate"
  },
  overtime: {
    label: "Overtime",
    icon: <Zap className="w-4 h-4" />,
    rateMultiplier: 1.5,
    description: "1.5x standard rate"
  },
  oncall: {
    label: "On-Call",
    icon: <Moon className="w-4 h-4" />,
    rateMultiplier: 0.75,
    description: "75% of standard rate"
  }
};

// Task categories for the task dropdown
type TaskCategory = "Development" | "Design" | "Meeting" | "Code Review" | "Testing" | "Documentation" | "Planning" | "Bug Fixes" | "Research" | "Travel" | "On-Call Support";

const taskCategories: TaskCategory[] = [
  "Development",
  "Design",
  "Meeting",
  "Code Review",
  "Testing",
  "Documentation",
  "Planning",
  "Bug Fixes",
  "Research",
  "Travel",
  "On-Call Support"
];

interface Task {
  id: string;
  hours: number;
  workType: WorkType;
  taskCategory: TaskCategory;
  task: string;
  notes: string;
  billable: boolean;
  tags: string[];
  detailsExpanded: boolean;
  // Per-task time tracking
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  showTimeCalculator?: boolean;
}

interface DayEntry {
  date: Date;
  hours: number;
  tasks: Task[];
  status: "draft" | "submitted" | "approved" | "rejected";
}

type UserRole = 
  | "individual-contributor"
  | "team-lead"
  | "company-owner"
  | "agency-owner"
  | "client";

interface EnhancedDayEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  entry?: DayEntry;
  userRole: UserRole;
  hourlyRate?: number;
  onSave: (date: Date, hours: number, tasks: Task[]) => void;
  lastUsedWorkType?: WorkType;
  commonPattern?: { hours: number; workType: WorkType };
}

export function EnhancedDayEntryModal({ 
  open, 
  onOpenChange, 
  date, 
  entry,
  userRole,
  hourlyRate,
  onSave,
  lastUsedWorkType = "regular",
  commonPattern
}: EnhancedDayEntryModalProps) {
  // Multi-task state
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Validation state
  const [validationError, setValidationError] = useState("");
  
  // Role-based visibility
  const canSeeBilling = userRole === "company-owner" || userRole === "agency-owner";
  const showRates = canSeeBilling && hourlyRate;
  const showBreakdown = canSeeBilling;

  // Initialize from existing entry or create default task
  useEffect(() => {
    if (entry && entry.tasks.length > 0) {
      // 🐛 DEBUG: Log what we're loading
      console.log('🔄 EnhancedDayEntryModal loading entry:', entry);
      
      setTasks(entry.tasks.map(t => ({
        ...t,
        detailsExpanded: !!(t.task || t.notes || t.tags?.length > 0),
        // ✅ PRESERVE time tracking fields from database
        startTime: t.startTime,
        endTime: t.endTime,
        breakMinutes: t.breakMinutes || 0,
        showTimeCalculator: false,
      })));
    } else {
      // Create one default task
      const defaultHours = commonPattern?.hours || 0;
      const defaultWorkType = lastUsedWorkType;
      
      setTasks([{
        id: `task-${Date.now()}`,
        hours: defaultHours,
        workType: defaultWorkType,
        taskCategory: "Development",
        task: "",
        notes: "",
        billable: true,
        tags: [],
        detailsExpanded: false,
        startTime: undefined,
        endTime: undefined,
        breakMinutes: 0,
        showTimeCalculator: false,
      }]);
    }
    setValidationError("");
  }, [entry, open, lastUsedWorkType, commonPattern]);

  // Add new task
  const handleAddTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      hours: 0,
      workType: "regular",
      taskCategory: "Development",
      task: "",
      notes: "",
      billable: true,
      tags: [],
      detailsExpanded: false,
      startTime: undefined,
      endTime: undefined,
      breakMinutes: 0,
      showTimeCalculator: false,
    };
    setTasks([...tasks, newTask]);
  };

  // Remove task
  const handleRemoveTask = (id: string) => {
    if (tasks.length === 1) {
      // Don't remove the last task, just reset it
      setTasks([{
        ...tasks[0],
        hours: 0,
        task: "",
        notes: "",
        tags: [],
        startTime: undefined,
        endTime: undefined,
        breakMinutes: 0,
        showTimeCalculator: false,
      }]);
    } else {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  // Update task field
  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    // 🐛 DEBUG: Log field updates
    console.log('📝 handleUpdateTask called:', {
      taskId: id,
      updates,
      currentTasks: tasks,
    });
    
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
    setValidationError("");
  };

  // Auto-fill time calculator when hours are entered
  const handleHoursBlur = (taskId: string, hours: number) => {
    if (hours > 0 && hours <= 24) {
      const task = tasks.find(t => t.id === taskId);
      // Only auto-fill if times aren't already set
      if (task && !task.startTime && !task.endTime) {
        const startHour = 9; // 9 AM
        const endHour = startHour + Math.floor(hours);
        const endMin = Math.round((hours % 1) * 60);
        
        const startTime = `${String(startHour).padStart(2, '0')}:00`;
        const endTimeHour = endHour >= 12 ? endHour : endHour + 12; // Ensure PM
        const endTime = `${String(endTimeHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
        
        handleUpdateTask(taskId, {
          startTime,
          endTime,
          breakMinutes: 0,
        });
      }
    }
  };

  // Time calculator per task
  const calculateFromTimes = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.startTime || !task.endTime) return;
    
    const [startHour, startMin] = task.startTime.split(':').map(Number);
    const [endHour, endMin] = task.endTime.split(':').map(Number);
    
    if (isNaN(startHour) || isNaN(endHour)) return;
    
    const startTotalMin = startHour * 60 + (startMin || 0);
    const endTotalMin = endHour * 60 + (endMin || 0);
    
    let workMinutes = endTotalMin - startTotalMin;
    if (workMinutes < 0) workMinutes += 24 * 60;
    
    workMinutes -= (task.breakMinutes || 0);
    const hours = Math.max(0, workMinutes / 60);
    
    handleUpdateTask(taskId, { hours: parseFloat(hours.toFixed(2)) });
  };

  // Validation
  const validateEntry = (): boolean => {
    const totalHours = tasks.reduce((sum, t) => sum + (t.hours || 0), 0);
    
    if (totalHours === 0) {
      setValidationError("Please enter hours worked");
      return false;
    }
    
    if (totalHours > 24) {
      setValidationError("Total hours cannot exceed 24 in a day");
      return false;
    }
    
    // Check each task has hours
    const hasInvalidTask = tasks.some(t => t.hours > 0 && !t.taskCategory);
    if (hasInvalidTask) {
      setValidationError("Please select a task category for all entries");
      return false;
    }
    
    setValidationError("");
    return true;
  };

  // Calculate totals with rates
  const calculateTotals = () => {
    const breakdown = tasks
      .filter(t => t.hours > 0)
      .map(t => {
        const rate = showRates && hourlyRate
          ? hourlyRate * workTypeConfigs[t.workType].rateMultiplier
          : 0;
        const pay = showRates && t.billable ? t.hours * rate : 0;
        return {
          task: t,
          hours: t.hours,
          rate,
          pay,
          billable: t.billable
        };
      });
    
    return {
      totalHours: breakdown.reduce((sum, b) => sum + b.hours, 0),
      totalPay: breakdown.reduce((sum, b) => sum + b.pay, 0),
      breakdown
    };
  };

  const totals = calculateTotals();

  // Handle save
  const handleSave = () => {
    if (!validateEntry()) return;
    
    const tasksToSave = tasks
      .filter(t => t.hours > 0)
      .map(t => ({
        ...t,
        task: t.task || t.taskCategory
      }));
    
    onSave(date, totals.totalHours, tasksToSave);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      // Cmd/Ctrl + Enter: Save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, tasks]);

  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span>{formatDate(date)}</span>
            </div>
            {isWeekend && (
              <Badge variant="secondary" className="text-xs">Weekend</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {userRole === "individual-contributor" 
              ? "Log your hours for manager review"
              : "Enter time and billing details"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tasks */}
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <div key={task.id} className="border border-border rounded-lg overflow-hidden">
                {/* Task Header */}
                <div className="p-3 bg-accent/10 space-y-3">
                  {tasks.length > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Task {index + 1}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTask(task.id)}
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Hours + Work Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`hours-${task.id}`} className="text-xs mb-1">Hours</Label>
                      <Input
                        id={`hours-${task.id}`}
                        type="number"
                        value={task.hours || ""}
                        onChange={(e) => handleUpdateTask(task.id, { hours: parseFloat(e.target.value) || 0 })}
                        onBlur={(e) => handleHoursBlur(task.id, parseFloat(e.target.value) || 0)}
                        placeholder="8"
                        min="0"
                        max="24"
                        step="0.25"
                        autoFocus={index === 0}
                      />
                    </div>

                    <div>
                      <Label htmlFor={`work-type-${task.id}`} className="text-xs mb-1 flex items-center gap-1">
                        Work Type
                        {showBreakdown && (
                          <span className="text-muted-foreground">({workTypeConfigs[task.workType].rateMultiplier}x)</span>
                        )}
                      </Label>
                      <Select 
                        value={task.workType} 
                        onValueChange={(v) => handleUpdateTask(task.id, { workType: v as WorkType })}
                      >
                        <SelectTrigger id={`work-type-${task.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(workTypeConfigs).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                {config.icon}
                                <span>{config.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Show rate if applicable */}
                  {showRates && task.hours > 0 && (
                    <div className="flex items-center justify-between p-2 bg-accent/30 rounded text-sm">
                      <div className="text-muted-foreground">
                        {task.hours}h @ ${(hourlyRate * workTypeConfigs[task.workType].rateMultiplier).toFixed(2)}/hr
                      </div>
                      {task.billable ? (
                        <div className="font-semibold text-accent-brand">
                          ${(task.hours * hourlyRate * workTypeConfigs[task.workType].rateMultiplier).toFixed(2)}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Non-billable</Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Time Calculator (OUTSIDE expandable details) */}
                <div className="border-t border-border">
                  {task.showTimeCalculator ? (
                    <div className="p-3 bg-accent/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Time Calculator
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateTask(task.id, { showTimeCalculator: false })}
                          className="h-6 px-2 text-xs"
                        >
                          Hide
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <Label htmlFor={`start-time-${task.id}`} className="text-xs">Start</Label>
                          <Input
                            id={`start-time-${task.id}`}
                            type="time"
                            value={task.startTime || ""}
                            onChange={(e) => handleUpdateTask(task.id, { startTime: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`end-time-${task.id}`} className="text-xs">End</Label>
                          <Input
                            id={`end-time-${task.id}`}
                            type="time"
                            value={task.endTime || ""}
                            onChange={(e) => handleUpdateTask(task.id, { endTime: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`break-${task.id}`} className="text-xs">Break (min)</Label>
                          <Input
                            id={`break-${task.id}`}
                            type="number"
                            value={task.breakMinutes || 0}
                            onChange={(e) => handleUpdateTask(task.id, { breakMinutes: parseInt(e.target.value) || 0 })}
                            className="h-9"
                            min="0"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => calculateFromTimes(task.id)}
                            className="w-full h-9"
                            disabled={!task.startTime || !task.endTime}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                      {task.startTime && task.endTime && (
                        <p className="text-xs text-muted-foreground">
                          Time range: {task.startTime} - {task.endTime}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdateTask(task.id, { showTimeCalculator: true })}
                      className="w-full text-xs text-muted-foreground hover:text-foreground border-b border-border rounded-none"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Use time calculator
                    </Button>
                  )}
                </div>

                {/* Expandable Details */}
                <div className="border-t border-border">
                  <button
                    onClick={() => handleUpdateTask(task.id, { detailsExpanded: !task.detailsExpanded })}
                    className="w-full p-3 flex items-center justify-between bg-accent/5 hover:bg-accent/10 apple-transition"
                  >
                    <span className="text-sm font-medium flex items-center gap-2">
                      {task.detailsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Add Details
                      {(task.task || task.notes || task.tags.length > 0 || task.taskCategory !== "Development") && !task.detailsExpanded && (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      )}
                    </span>
                  </button>

                  {task.detailsExpanded && (
                    <div className="p-3 space-y-3 border-t border-border">
                      {/* Task Category (MOVED INSIDE expandable details) */}
                      <div>
                        <Label htmlFor={`category-${task.id}`} className="text-xs mb-1">Task Category</Label>
                        <Select 
                          value={task.taskCategory} 
                          onValueChange={(v) => handleUpdateTask(task.id, { taskCategory: v as TaskCategory })}
                        >
                          <SelectTrigger id={`category-${task.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {taskCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Specific Task */}
                      <div>
                        <Label htmlFor={`task-${task.id}`} className="text-xs mb-1">
                          Specific Task <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id={`task-${task.id}`}
                          value={task.task}
                          onChange={(e) => handleUpdateTask(task.id, { task: e.target.value })}
                          placeholder="e.g., Authentication module, Client site visit..."
                        />
                      </div>

                      {/* Notes */}
                      <div>
                        <Label htmlFor={`notes-${task.id}`} className="text-xs mb-1">
                          Notes <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                          id={`notes-${task.id}`}
                          value={task.notes}
                          onChange={(e) => handleUpdateTask(task.id, { notes: e.target.value })}
                          placeholder="What did you work on?"
                          rows={2}
                        />
                      </div>

                      {/* Billable Toggle (owners only) */}
                      {canSeeBilling && (
                        <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-card">
                          <Label htmlFor={`billable-${task.id}`} className="text-xs cursor-pointer">
                            Billable to {userRole === "company-owner" ? "Agency" : "Client"}
                          </Label>
                          <Switch
                            id={`billable-${task.id}`}
                            checked={task.billable}
                            onCheckedChange={(checked) => handleUpdateTask(task.id, { billable: checked })}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Another Task */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddTask}
            className="w-full gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Another Task
          </Button>

          {/* Validation Error */}
          {validationError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {validationError}
              </p>
            </div>
          )}

          {/* Summary */}
          {totals.totalHours > 0 && (
            <div className="space-y-3">
              {/* Breakdown by work type */}
              {totals.breakdown.length > 1 && (
                <div className="p-3 bg-accent/20 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Breakdown by Type</p>
                  {totals.breakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {workTypeConfigs[item.task.workType].icon}
                        <span>{workTypeConfigs[item.task.workType].label}</span>
                        {item.task.startTime && item.task.endTime && (
                          <span className="text-xs text-muted-foreground">
                            ({item.task.startTime} - {item.task.endTime})
                          </span>
                        )}
                        {!item.billable && showRates && (
                          <Badge variant="secondary" className="text-xs h-5">Non-billable</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{item.hours.toFixed(2)}h</span>
                        {showRates && item.billable && item.rate > 0 && (
                          <>
                            <span className="text-muted-foreground">×</span>
                            <span className="text-muted-foreground">${item.rate.toFixed(2)}/hr</span>
                            <span className="text-muted-foreground">=</span>
                            <span className="font-medium">${item.pay.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              <div className="p-4 bg-accent-brand/10 border border-accent-brand/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total for {formatDate(date, true)}</p>
                    <p className="text-xl font-semibold">{totals.totalHours.toFixed(2)} hours</p>
                  </div>
                  {showRates && totals.totalPay > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {userRole === "company-owner" ? "Billable to agency" : "Billable to client"}
                      </p>
                      <p className="text-xl font-semibold text-accent-brand">
                        ${totals.totalPay.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                {!showRates && (
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-accent-brand/20">
                    ✓ Your hours will be reviewed and approved by your manager
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tips */}
          {userRole === "individual-contributor" && tasks.length === 1 && !tasks[0].detailsExpanded && (
            <div className="p-3 bg-accent/20 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">
                💡 <strong>Multiple work types?</strong> Use "Add Another Task" to log travel time, overtime, or on-call separately with different time ranges.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {totals.totalHours > 0 && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={() => { onSave(date, 0, []); onOpenChange(false); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear entry
              </Button>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={totals.totalHours === 0 || !!validationError}
            className="gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Save Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(date: Date, short: boolean = false): string {
  if (short) {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  }
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
}