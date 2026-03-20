import { useState } from "react";
import { Users, Check, X, Zap, Copy, Edit2, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";

interface Contractor {
  id: string;
  name: string;
  avatar: string;
  role: string;
}

interface BulkTimesheetEntryProps {
  projectId: string;
  projectName: string;
  contractors: Contractor[];
  month: Date;
  onCreateEntries: (contractorIds: string[], pattern: EntryPattern) => void;
  onOpenIndividualTimesheet?: (contractorId: string, contractorName: string) => void;
}

interface EntryPattern {
  hours: number;
  task: string;
  notes: string;
  startDate: Date;
  endDate: Date;
  weekdays: number[]; // 0-6 (Sun-Sat)
}

interface ContractorOverride {
  contractorId: string;
  hours?: number;
  task?: string;
  notes?: string;
}

export function BulkTimesheetEntry({
  projectId,
  projectName,
  contractors,
  month,
  onCreateEntries,
  onOpenIndividualTimesheet,
}: BulkTimesheetEntryProps) {
  const [selectedContractors, setSelectedContractors] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [showOverridesView, setShowOverridesView] = useState(false);
  const [overrides, setOverrides] = useState<Map<string, ContractorOverride>>(new Map());
  const [pattern, setPattern] = useState<EntryPattern>({
    hours: 8,
    task: "Development",
    notes: "",
    startDate: new Date(month.getFullYear(), month.getMonth(), 1),
    endDate: new Date(month.getFullYear(), month.getMonth() + 1, 0),
    weekdays: [1, 2, 3, 4, 5], // Mon-Fri
  });

  const toggleContractor = (id: string) => {
    setSelectedContractors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContractors.size === contractors.length) {
      setSelectedContractors(new Set());
    } else {
      setSelectedContractors(new Set(contractors.map(c => c.id)));
    }
  };

  const handleCreate = () => {
    if (selectedContractors.size === 0) {
      toast.error("Please select at least one contractor");
      return;
    }

    // Apply overrides to pattern for each contractor
    const contractorsWithPatterns = Array.from(selectedContractors).map(contractorId => {
      const override = overrides.get(contractorId);
      return {
        contractorId,
        pattern: {
          ...pattern,
          hours: override?.hours ?? pattern.hours,
          task: override?.task ?? pattern.task,
          notes: override?.notes ?? pattern.notes,
        }
      };
    });

    onCreateEntries(Array.from(selectedContractors), pattern);
    
    toast.success(
      `Created entries for ${selectedContractors.size} contractor${selectedContractors.size !== 1 ? 's' : ''}`
    );
    
    setShowDialog(false);
    setSelectedContractors(new Set());
    setOverrides(new Map());
    setShowOverridesView(false);
  };

  const handleSetOverride = (contractorId: string, field: keyof ContractorOverride, value: any) => {
    setOverrides(prev => {
      const newOverrides = new Map(prev);
      const existing = newOverrides.get(contractorId) || { contractorId };
      newOverrides.set(contractorId, { ...existing, [field]: value });
      return newOverrides;
    });
  };

  const handleClearOverride = (contractorId: string) => {
    setOverrides(prev => {
      const newOverrides = new Map(prev);
      newOverrides.delete(contractorId);
      return newOverrides;
    });
  };

  const getEffectiveValue = (contractorId: string, field: 'hours' | 'task' | 'notes') => {
    const override = overrides.get(contractorId);
    return override?.[field] ?? pattern[field];
  };

  const selectedList = contractors.filter(c => selectedContractors.has(c.id));
  
  // Calculate total days that will be created
  const daysInRange = [];
  const current = new Date(pattern.startDate);
  while (current <= pattern.endDate) {
    if (pattern.weekdays.includes(current.getDay())) {
      daysInRange.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  const totalEntries = selectedContractors.size * daysInRange.length;
  const totalHours = totalEntries * pattern.hours;

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="outline"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Users className="w-4 h-4" />
        Bulk Entry (Multiple People)
      </Button>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-brand" />
              Bulk Timesheet Entry
            </DialogTitle>
            <DialogDescription>
              Create identical entries for multiple contractors at once. Each person gets their own separate timesheet entries.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Info Card */}
            <Card className="p-4 bg-accent-brand/10 border-accent-brand/20">
              <p className="text-sm font-medium mb-2">💡 How it works:</p>
              <div className="space-y-1 text-sm text-muted-foreground mb-3">
                <p>1. Select contractors and set default hours/task</p>
                <p>2. Click <span className="font-medium">"Customize"</span> to override for specific people</p>
                <p>3. Each contractor gets their own separate timesheet entries</p>
                <p className="text-xs mt-2 text-accent-brand">
                  Example: Sarah & Mike (8h), but Lisa only works 6h → Override just Lisa!
                </p>
              </div>
              
              <div className="pt-3 border-t border-accent-brand/20">
                <p className="text-sm font-medium mb-2">⚠️ When bulk entry won't work:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Each contractor has <span className="font-medium">completely different hours every day</span></p>
                  <p>• Schedules are too irregular for patterns</p>
                  <p>• Each person needs custom details per day</p>
                </div>
                {onOpenIndividualTimesheet && (
                  <p className="text-xs mt-3 text-muted-foreground">
                    In those cases, use the contractor browser to open each person's timesheet individually.
                  </p>
                )}
              </div>
            </Card>

            {/* Contractor Selection */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="font-medium">Select Contractors</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="gap-2"
                >
                  {selectedContractors.size === contractors.length ? (
                    <>
                      <X className="w-4 h-4" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Select All
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {contractors.map((contractor) => {
                  const isSelected = selectedContractors.has(contractor.id);
                  return (
                    <button
                      key={contractor.id}
                      onClick={() => toggleContractor(contractor.id)}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border-2 apple-transition text-left
                        ${isSelected 
                          ? 'border-accent-brand bg-accent-brand/5' 
                          : 'border-border hover:border-accent-brand/50'
                        }
                      `}
                    >
                      <div className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                        ${isSelected ? 'border-accent-brand bg-accent-brand' : 'border-border'}
                      `}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      
                      <Avatar className="w-10 h-10 bg-accent-brand/10 text-accent-brand flex items-center justify-center">
                        {contractor.avatar}
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{contractor.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{contractor.role}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Preview */}
              {selectedContractors.size > 0 && (
                <div className="mt-4 p-3 bg-accent/30 rounded-lg">
                  <p className="text-sm font-medium mb-2">
                    Selected: {selectedContractors.size} contractor{selectedContractors.size !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedList.map((contractor) => (
                      <Badge
                        key={contractor.id}
                        variant="secondary"
                        className="gap-1.5 pr-1"
                      >
                        {contractor.name}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleContractor(contractor.id);
                          }}
                          className="ml-1 hover:bg-accent rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Entry Pattern */}
            <div className="border-t border-border pt-6">
              <label className="font-medium mb-4 block">Entry Details</label>

              <div className="space-y-4">
                {/* Hours and Task */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm">Hours per Day</label>
                    <Input
                      type="number"
                      value={pattern.hours}
                      onChange={(e) => setPattern({ ...pattern, hours: parseFloat(e.target.value) || 0 })}
                      min="0"
                      max="24"
                      step="0.5"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm">Task</label>
                    <Input
                      value={pattern.task}
                      onChange={(e) => setPattern({ ...pattern, task: e.target.value })}
                      placeholder="e.g., Development, Design..."
                    />
                  </div>
                </div>

                {/* Working Days */}
                <div>
                  <label className="block mb-2 text-sm">Working Days</label>
                  <div className="flex gap-2">
                    {[
                      { day: 1, name: "Mon" },
                      { day: 2, name: "Tue" },
                      { day: 3, name: "Wed" },
                      { day: 4, name: "Thu" },
                      { day: 5, name: "Fri" },
                      { day: 6, name: "Sat" },
                      { day: 0, name: "Sun" },
                    ].map(({ day, name }) => {
                      const isSelected = pattern.weekdays.includes(day);
                      return (
                        <Button
                          key={day}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setPattern({
                              ...pattern,
                              weekdays: isSelected
                                ? pattern.weekdays.filter(d => d !== day)
                                : [...pattern.weekdays, day],
                            });
                          }}
                          className="flex-1"
                        >
                          {name}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick presets */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPattern({ ...pattern, weekdays: [1, 2, 3, 4, 5] })}
                  >
                    Mon-Fri
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPattern({ ...pattern, weekdays: [1, 2, 3, 4] })}
                  >
                    Mon-Thu
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPattern({ ...pattern, weekdays: [1, 2, 3, 4, 5, 6, 0] })}
                  >
                    Every Day
                  </Button>
                </div>
              </div>
            </div>

            {/* Per-Person Customization */}
            {selectedContractors.size > 0 && (
              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <label className="font-medium">Per-Person Customization</label>
                    <p className="text-sm text-muted-foreground">
                      Override hours or details for specific contractors
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOverridesView(!showOverridesView)}
                    className="gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    {showOverridesView ? "Hide" : "Customize"}
                  </Button>
                </div>

                {showOverridesView && (
                  <div className="space-y-3 mb-4">
                    {selectedList.map((contractor) => {
                      const hasOverride = overrides.has(contractor.id);
                      const effectiveHours = getEffectiveValue(contractor.id, 'hours');
                      const effectiveTask = getEffectiveValue(contractor.id, 'task');
                      
                      return (
                        <div
                          key={contractor.id}
                          className={`p-4 rounded-lg border-2 ${
                            hasOverride 
                              ? 'border-warning bg-warning/5' 
                              : 'border-border bg-card'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10 bg-accent-brand/10 text-accent-brand flex items-center justify-center">
                              {contractor.avatar}
                            </Avatar>
                            
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold">{contractor.name}</p>
                                  <p className="text-sm text-muted-foreground">{contractor.role}</p>
                                </div>
                                {hasOverride && (
                                  <div className="flex gap-2">
                                    {onOpenIndividualTimesheet && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setShowDialog(false);
                                          onOpenIndividualTimesheet(contractor.id, contractor.name);
                                        }}
                                        className="gap-1 text-xs"
                                      >
                                        <ArrowRight className="w-3 h-3" />
                                        Open Full Timesheet
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleClearOverride(contractor.id)}
                                      className="gap-1 text-xs"
                                    >
                                      <X className="w-3 h-3" />
                                      Reset
                                    </Button>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block mb-1 text-xs text-muted-foreground">
                                    Hours/Day {hasOverride && overrides.get(contractor.id)?.hours && "(Custom)"}
                                  </label>
                                  <Input
                                    type="number"
                                    value={effectiveHours}
                                    onChange={(e) => handleSetOverride(contractor.id, 'hours', parseFloat(e.target.value) || 0)}
                                    min="0"
                                    max="24"
                                    step="0.5"
                                    className={hasOverride && overrides.get(contractor.id)?.hours ? 'border-warning' : ''}
                                  />
                                </div>

                                <div>
                                  <label className="block mb-1 text-xs text-muted-foreground">
                                    Task {hasOverride && overrides.get(contractor.id)?.task && "(Custom)"}
                                  </label>
                                  <Input
                                    value={effectiveTask}
                                    onChange={(e) => handleSetOverride(contractor.id, 'task', e.target.value)}
                                    placeholder="e.g., Development"
                                    className={hasOverride && overrides.get(contractor.id)?.task ? 'border-warning' : ''}
                                  />
                                </div>
                              </div>

                              {hasOverride && (
                                <p className="text-xs text-warning flex items-center gap-1">
                                  <Edit2 className="w-3 h-3" />
                                  Custom settings for this contractor
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Summary */}
                <div className="p-4 bg-accent-brand/10 border border-accent-brand/20 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium">What will be created:</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contractors:</span>
                      <span className="font-semibold">{selectedContractors.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Days (per person):</span>
                      <span className="font-semibold">{daysInRange.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total entries:</span>
                      <span className="font-semibold">{totalEntries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">With customizations:</span>
                      <span className="font-semibold text-warning">{overrides.size} contractor{overrides.size !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">Total hours:</span>
                      <span className="font-semibold text-accent-brand">{totalHours}h</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    ℹ️ Each contractor will get their own separate timesheet entries that they can edit before submitting.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={selectedContractors.size === 0}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              Create {totalEntries} Entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
