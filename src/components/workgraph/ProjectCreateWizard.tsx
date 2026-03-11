// Phase 5 M5.1: Project Creation Wizard
// Multi-step wizard for creating collaborative projects

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Building2,
  CalendarIcon,
  Users,
  FileText,
  Check,
  Plus,
  X,
  Mail,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { Project, ProjectMember, ProjectRole, WorkWeek } from '../../types/collaboration';
import { CompanySearchDialog } from './CompanySearchDialog';
import { createProject } from '../../utils/api/projects-supabase';
import { toast } from 'sonner@2.0.3';

export interface ProjectCreateWizardProps {
  open: boolean;
  onClose: () => void;
  onCreate?: (project: Partial<Project>, members: Partial<ProjectMember>[]) => Promise<void>;
  onSuccess?: (projectId: string) => void; // Called after project created
}

type Step = 'basic' | 'parties' | 'collaborators' | 'review';

export function ProjectCreateWizard({ open, onClose, onCreate, onSuccess }: ProjectCreateWizardProps) {
  const [step, setStep] = useState<Step>('basic');
  const [loading, setLoading] = useState(false);

  // Basic info
  const [name, setName] = useState('');
  const [region, setRegion] = useState<'US' | 'EU' | 'UK'>('US');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [workWeek, setWorkWeek] = useState<WorkWeek>({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });

  // Parties
  const [selectedParties, setSelectedParties] = useState<any[]>([]);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [newPartyEmails, setNewPartyEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');

  // Collaborators
  const [collaborators, setCollaborators] = useState<Partial<ProjectMember>[]>([]);
  const [collabEmail, setCollabEmail] = useState('');
  const [collabRole, setCollabRole] = useState<ProjectRole>('Editor');

  const steps: Step[] = ['basic', 'parties', 'collaborators', 'review'];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  function handleNext() {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  }

  function handleBack() {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  }

  function toggleWorkDay(day: keyof WorkWeek) {
    setWorkWeek(prev => ({ ...prev, [day]: !prev[day] }));
  }

  function addParty(party: any) {
    if (!selectedParties.find(p => p.id === party.id)) {
      setSelectedParties([...selectedParties, party]);
    }
  }

  function removeParty(partyId: string) {
    setSelectedParties(selectedParties.filter(p => p.id !== partyId));
  }

  function addNewPartyEmail() {
    if (emailInput && emailInput.includes('@')) {
      setNewPartyEmails([...newPartyEmails, emailInput]);
      setEmailInput('');
    }
  }

  function removeNewPartyEmail(email: string) {
    setNewPartyEmails(newPartyEmails.filter(e => e !== email));
  }

  function addCollaborator() {
    if (collabEmail && collabEmail.includes('@')) {
      setCollaborators([
        ...collaborators,
        {
          userEmail: collabEmail,
          role: collabRole,
          invitedAt: new Date().toISOString(),
        },
      ]);
      setCollabEmail('');
      setCollabRole('Editor');
    }
  }

  function removeCollaborator(email: string) {
    setCollaborators(collaborators.filter(c => c.userEmail !== email));
  }

  async function handleCreate() {
    setLoading(true);
    try {
      const project: Partial<Project> = {
        name,
        region,
        currency,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        workWeek,
      };

      // Use custom onCreate if provided, otherwise use default API
      if (onCreate) {
        await onCreate(project, collaborators);
      } else {
        // Default: Create project via API
        const result = await createProject(project, collaborators);
        
        toast.success('Project created!', {
          description: `${result.project.name} is ready. Opening workspace...`,
        });
        
        // Call success callback with project ID
        if (onSuccess) {
          onSuccess(result.project.id);
        }
      }
      
      // Reset form and close
      onClose();
      
      // Reset all state for next time
      setTimeout(() => {
        setStep('basic');
        setName('');
        setStartDate(undefined);
        setEndDate(undefined);
        setSelectedParties([]);
        setNewPartyEmails([]);
        setCollaborators([]);
      }, 500);
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  }

  const canProceed = {
    basic: !!name && !!startDate,
    parties: selectedParties.length > 0 || newPartyEmails.length > 0,
    collaborators: true, // Optional step
    review: true,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Create New Project
            </DialogTitle>
            <DialogDescription>
              Set up a collaborative workspace for your multi-party project
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span className={step === 'basic' ? 'font-medium text-blue-600' : ''}>
                Basic Info
              </span>
              <span className={step === 'parties' ? 'font-medium text-blue-600' : ''}>
                Add Parties
              </span>
              <span className={step === 'collaborators' ? 'font-medium text-blue-600' : ''}>
                Invite Team
              </span>
              <span className={step === 'review' ? 'font-medium text-blue-600' : ''}>
                Review
              </span>
            </div>
          </div>

          <Separator />

          {/* Step Content */}
          <ScrollArea className="max-h-[500px] pr-4">
            {step === 'basic' && (
              <BasicInfoStep
                name={name}
                setName={setName}
                region={region}
                setRegion={setRegion}
                currency={currency}
                setCurrency={setCurrency}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                workWeek={workWeek}
                toggleWorkDay={toggleWorkDay}
              />
            )}

            {step === 'parties' && (
              <PartiesStep
                selectedParties={selectedParties}
                removeParty={removeParty}
                onAddExisting={() => setShowCompanySearch(true)}
                newPartyEmails={newPartyEmails}
                emailInput={emailInput}
                setEmailInput={setEmailInput}
                addNewPartyEmail={addNewPartyEmail}
                removeNewPartyEmail={removeNewPartyEmail}
              />
            )}

            {step === 'collaborators' && (
              <CollaboratorsStep
                collaborators={collaborators}
                collabEmail={collabEmail}
                setCollabEmail={setCollabEmail}
                collabRole={collabRole}
                setCollabRole={setCollabRole}
                addCollaborator={addCollaborator}
                removeCollaborator={removeCollaborator}
              />
            )}

            {step === 'review' && (
              <ReviewStep
                name={name}
                region={region}
                currency={currency}
                startDate={startDate}
                endDate={endDate}
                workWeek={workWeek}
                selectedParties={selectedParties}
                newPartyEmails={newPartyEmails}
                collaborators={collaborators}
              />
            )}
          </ScrollArea>

          <DialogFooter className="gap-2">
            {currentStepIndex > 0 && (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            <div className="flex-1" />
            {currentStepIndex < steps.length - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed[step]}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Create Project
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Search Dialog */}
      <CompanySearchDialog
        open={showCompanySearch}
        onClose={() => setShowCompanySearch(false)}
        onSelect={(company) => {
          addParty(company);
          setShowCompanySearch(false);
        }}
      />
    </>
  );
}

// ============================================================================
// Step Components
// ============================================================================

function BasicInfoStep({
  name,
  setName,
  region,
  setRegion,
  currency,
  setCurrency,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  workWeek,
  toggleWorkDay,
}: any) {
  return (
    <div className="space-y-6">
      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Project Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Website Redesign Q1 2025"
          autoFocus
        />
      </div>

      {/* Region & Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="region">Region *</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger id="region">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="EU">European Union</SelectItem>
              <SelectItem value="UK">United Kingdom</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">For compliance and data residency</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency *</Label>
          <Select value={currency} onValueChange={setCurrency as any}>
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {startDate ? format(startDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date (Optional)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {endDate ? format(endDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Work Week */}
      <div className="space-y-2">
        <Label>Default Work Week</Label>
        <div className="flex gap-2">
          {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
            <button
              key={day}
              onClick={() => toggleWorkDay(day)}
              className={`
                flex-1 py-2 px-1 rounded border-2 text-xs font-medium transition-all
                ${workWeek[day]
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
                }
              `}
            >
              {day.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PartiesStep({
  selectedParties,
  removeParty,
  onAddExisting,
  newPartyEmails,
  emailInput,
  setEmailInput,
  addNewPartyEmail,
  removeNewPartyEmail,
}: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-2">Add Organizations</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select existing companies or invite new ones to the project
        </p>

        {/* Existing Companies */}
        <div className="space-y-3">
          <Button onClick={onAddExisting} variant="outline" className="w-full">
            <Building2 className="w-4 h-4 mr-2" />
            Attach Existing Company
          </Button>

          {selectedParties.length > 0 && (
            <div className="space-y-2">
              {selectedParties.map((party) => (
                <div key={party.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium">{party.name}</div>
                      <div className="text-xs text-gray-500">{party.type}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParty(party.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* Invite New Companies */}
        <div>
          <h4 className="font-medium mb-3">Or Invite New Company</h4>
          <div className="flex gap-2">
            <Input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="company@example.com"
              onKeyDown={(e) => e.key === 'Enter' && addNewPartyEmail()}
            />
            <Button onClick={addNewPartyEmail} disabled={!emailInput.includes('@')}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {newPartyEmails.length > 0 && (
            <div className="mt-3 space-y-2">
              {newPartyEmails.map((email) => (
                <div key={email} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{email}</span>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeNewPartyEmail(email)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CollaboratorsStep({
  collaborators,
  collabEmail,
  setCollabEmail,
  collabRole,
  setCollabRole,
  addCollaborator,
  removeCollaborator,
}: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-2">Invite Team Members</h3>
        <p className="text-sm text-gray-500 mb-4">
          Add collaborators and assign roles (optional - you can invite later)
        </p>

        {/* Add Collaborator */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={collabEmail}
              onChange={(e) => setCollabEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="flex-1"
            />
            <Select value={collabRole} onValueChange={setCollabRole as any}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Editor">Editor</SelectItem>
                <SelectItem value="Contributor">Contributor</SelectItem>
                <SelectItem value="Commenter">Commenter</SelectItem>
                <SelectItem value="Viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addCollaborator} disabled={!collabEmail.includes('@')}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Role Descriptions */}
          <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-1">
            <div><strong>Editor:</strong> Can edit all nodes and contracts</div>
            <div><strong>Contributor:</strong> Can edit their organization's nodes only</div>
            <div><strong>Commenter:</strong> Can add comments but not edit</div>
            <div><strong>Viewer:</strong> Read-only access</div>
          </div>
        </div>

        {/* Collaborator List */}
        {collaborators.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="font-medium text-sm">Invited ({collaborators.length})</h4>
            {collaborators.map((collab: any) => (
              <div key={collab.userEmail} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-medium">{collab.userEmail}</div>
                    <div className="text-xs text-gray-500">{collab.role}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCollaborator(collab.userEmail)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewStep({
  name,
  region,
  currency,
  startDate,
  endDate,
  workWeek,
  selectedParties,
  newPartyEmails,
  collaborators,
}: any) {
  const workDays = Object.entries(workWeek)
    .filter(([_, enabled]) => enabled)
    .map(([day]) => day.slice(0, 3).toUpperCase());

  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-3">Project Summary</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name:</span>
              <span className="font-medium">{name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Region:</span>
              <span>{region}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Currency:</span>
              <span>{currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Start Date:</span>
              <span>{startDate ? format(startDate, 'PPP') : 'Not set'}</span>
            </div>
            {endDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">End Date:</span>
                <span>{format(endDate, 'PPP')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Work Week:</span>
              <span>{workDays.join(', ')}</span>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-2">Organizations ({selectedParties.length + newPartyEmails.length})</h4>
          <div className="space-y-1 text-sm">
            {selectedParties.map((party: any) => (
              <div key={party.id} className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span>{party.name}</span>
              </div>
            ))}
            {newPartyEmails.map((email) => (
              <div key={email} className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>{email}</span>
                <Badge variant="secondary" className="text-xs">Pending</Badge>
              </div>
            ))}
          </div>
        </div>

        {collaborators.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-2">Team Members ({collaborators.length})</h4>
              <div className="space-y-1 text-sm">
                {collaborators.map((collab: any) => (
                  <div key={collab.userEmail} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{collab.userEmail}</span>
                    </div>
                    <Badge variant="outline">{collab.role}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Project workspace will be created with a collaborative canvas</li>
          <li>Invitations will be sent to all team members</li>
          <li>Organizations will be added as Party nodes</li>
          <li>You can start building the approval flow and contracts</li>
        </ul>
      </div>
    </div>
  );
}