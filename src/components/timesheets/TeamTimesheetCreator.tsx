import { useState } from "react";
import { X, Plus, Users, Calendar, Copy, Check } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
  hourlyRate: number;
}

interface TeamTimesheetCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTeamTimesheet: (members: TeamMember[], pattern: TimesheetPattern) => void;
}

interface TimesheetPattern {
  hours: number;
  task: string;
  startDate: Date;
  endDate: Date;
  weekdays: number[]; // 1-5 for Mon-Fri
}

export function TeamTimesheetCreator({ 
  open, 
  onOpenChange,
  onCreateTeamTimesheet 
}: TeamTimesheetCreatorProps) {
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [pattern, setPattern] = useState<TimesheetPattern>({
    hours: 8,
    task: "Development",
    startDate: new Date(),
    endDate: new Date(),
    weekdays: [1, 2, 3, 4, 5], // Mon-Fri
  });

  // Mock team members
  const teamMembers: TeamMember[] = [
    { id: "c1", name: "Sarah Chen", avatar: "SC", role: "Senior Engineer", hourlyRate: 120 },
    { id: "c2", name: "Mike Johnson", avatar: "MJ", role: "Frontend Dev", hourlyRate: 110 },
    { id: "c3", name: "Lisa Park", avatar: "LP", role: "UI Designer", hourlyRate: 95 },
    { id: "c4", name: "Alex Kumar", avatar: "AK", role: "Backend Dev", hourlyRate: 115 },
    { id: "c5", name: "Emma Wilson", avatar: "EW", role: "QA Engineer", hourlyRate: 100 },
  ];

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => {
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
    if (selectedMembers.size === teamMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(teamMembers.map(m => m.id)));
    }
  };

  const handleCreate = () => {
    const selected = teamMembers.filter(m => selectedMembers.has(m.id));
    if (selected.length === 0) {
      toast.error("Please select at least one team member");
      return;
    }

    onCreateTeamTimesheet(selected, pattern);
    toast.success(`Team timesheet created for ${selected.length} member${selected.length !== 1 ? 's' : ''}`);
    onOpenChange(false);
  };

  const selectedMembersList = teamMembers.filter(m => selectedMembers.has(m.id));
  const totalEstimate = selectedMembersList.reduce((sum, m) => 
    sum + (pattern.hours * m.hourlyRate * 5), 0 // 5 days
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-brand" />
            Create Team Timesheet
          </DialogTitle>
          <DialogDescription>
            Select team members who will share the same schedule this week
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Team Member Selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="font-medium">Select Team Members</label>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="gap-2"
              >
                {selectedMembers.size === teamMembers.length ? (
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
              {teamMembers.map((member) => {
                const isSelected = selectedMembers.has(member.id);
                return (
                  <Card
                    key={member.id}
                    className={`p-4 cursor-pointer apple-transition ${
                      isSelected 
                        ? 'border-accent-brand bg-accent-brand/5' 
                        : 'hover:border-accent-brand/50'
                    }`}
                    onClick={() => toggleMember(member.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <Avatar className="w-10 h-10 bg-accent-brand/10 text-accent-brand flex items-center justify-center">
                        {member.avatar}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{member.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{member.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">${member.hourlyRate}/hr</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Selected Members Preview */}
            {selectedMembers.size > 0 && (
              <div className="mt-4 p-3 bg-accent/30 rounded-lg">
                <p className="text-sm font-medium mb-2">
                  Selected: {selectedMembers.size} member{selectedMembers.size !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedMembersList.map((member) => (
                    <Badge
                      key={member.id}
                      variant="secondary"
                      className="gap-1.5 pr-1"
                    >
                      {member.name}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMember(member.id);
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

          {/* Schedule Pattern */}
          <div className="border-t border-border pt-6">
            <label className="font-medium mb-4 block">Schedule Pattern</label>

            <div className="space-y-4">
              {/* Hours per day */}
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
                  <label className="block mb-2 text-sm">Default Task</label>
                  <Input
                    value={pattern.task}
                    onChange={(e) => setPattern({ ...pattern, task: e.target.value })}
                    placeholder="e.g., Development, Design..."
                  />
                </div>
              </div>

              {/* Days of week */}
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
                  All Days
                </Button>
              </div>
            </div>
          </div>

          {/* Estimate */}
          {selectedMembers.size > 0 && (
            <div className="border-t border-border pt-6">
              <div className="p-4 bg-accent-brand/10 border border-accent-brand/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Weekly Estimate</p>
                  <p className="text-xl font-semibold text-accent-brand">
                    ${totalEstimate.toLocaleString()}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    {selectedMembers.size} member{selectedMembers.size !== 1 ? 's' : ''} × {pattern.hours}h/day × {pattern.weekdays.length} days
                  </p>
                  <p className="text-xs">
                    Each person can still adjust their individual hours after creation
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={selectedMembers.size === 0}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            Create Team Timesheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
