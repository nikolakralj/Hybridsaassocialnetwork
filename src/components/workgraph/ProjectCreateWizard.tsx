// ============================================================================
// ProjectCreateWizard — Connection-based supply chain builder
//
// Steps:
//   1. Basics — name, region, currency, dates, work week
//   2. Supply Chain — add parties + draw explicit connections (billsTo)
//   3. People — add people per party with permission toggles
//   4. Review — summary + live mini-graph SVG preview
// ============================================================================

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  Building2, CalendarIcon, Users, Check, Plus, X, ChevronRight,
  ChevronLeft, User, ArrowRight, Shield, Eye, Network, Sparkles,
  AlertTriangle, Info, Link2, Unlink, EyeOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Project, ProjectMember, ProjectRole, WorkWeek } from '../../types/collaboration';
import type { PartyType } from '../../types/workgraph';
import { CompanySearchDialog } from './CompanySearchDialog';
import { createProject, updateProject, type ProjectStorageSource } from '../../utils/api/projects-api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import {
  generateGraphFromWizard, validatePartyChain, computeDepths,
  type PartyEntry, type PersonEntry,
} from '../../utils/graph/auto-generate';

// ============================================================================
// Types & Constants
// ============================================================================

export interface ProjectCreateWizardProps {
  open: boolean;
  onClose: () => void;
  onCreate?: (project: Partial<Project>, members: Partial<ProjectMember>[]) => Promise<void>;
  onEditSave?: (payload: {
    parties: PartyEntry[];
    nodes: ReturnType<typeof generateGraphFromWizard>['nodes'];
    edges: ReturnType<typeof generateGraphFromWizard>['edges'];
  }) => Promise<void>;
  onSuccess?: (
    projectId: string,
    projectStartDate?: string | null,
    storageSource?: ProjectStorageSource
  ) => void;
  editMode?: boolean;
  initialParties?: PartyEntry[];
  initialProjectName?: string;
}

type Step = 'basic' | 'supply-chain' | 'people' | 'review';
const EMPTY_PARTIES: PartyEntry[] = [];

const PARTY_TYPE_OPTIONS: { value: PartyType; label: string; desc: string; color: string }[] = [
  { value: 'freelancer', label: 'Freelancer', desc: 'Independent worker', color: '#8b5cf6' },
  { value: 'contractor', label: 'Contractor', desc: 'Contracting company', color: '#6366f1' },
  { value: 'company', label: 'Company', desc: 'Employer / Staffing co', color: '#3b82f6' },
  { value: 'agency', label: 'Agency', desc: 'Recruiter / MSP', color: '#f59e0b' },
  { value: 'client', label: 'Client', desc: 'End client', color: '#10b981' },
];

function getPartyOption(type: PartyType) {
  return PARTY_TYPE_OPTIONS.find(o => o.value === type)!;
}

function getPartyIcon(type: PartyType): LucideIcon {
  switch (type) {
    case 'freelancer':
      return User;
    case 'contractor':
      return Shield;
    case 'company':
      return Building2;
    case 'agency':
      return Network;
    case 'client':
      return Eye;
    default:
      return Building2;
  }
}

function getDefaultWorkWeek(): WorkWeek {
  return {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  };
}

function cloneParties(parties: PartyEntry[]): PartyEntry[] {
  return parties.map((party) => ({
    ...party,
    billsTo: [...party.billsTo],
    people: party.people.map((person) => ({ ...person })),
  }));
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectCreateWizard({
  open,
  onClose,
  onCreate,
  onEditSave,
  onSuccess,
  editMode = false,
  initialParties,
  initialProjectName,
}: ProjectCreateWizardProps) {
  const safeInitialParties = useMemo(() => initialParties ?? EMPTY_PARTIES, [initialParties]);
  const safeInitialProjectName = initialProjectName ?? '';
  const steps: Step[] = editMode ? ['supply-chain', 'people'] : ['basic', 'supply-chain', 'people', 'review'];
  const [step, setStep] = useState<Step>(editMode ? 'supply-chain' : 'basic');
  const [loading, setLoading] = useState(false);
  const { user, accessToken } = useAuth();

  // Step 1 state
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [workWeek, setWorkWeek] = useState<WorkWeek>(getDefaultWorkWeek);

  // Step 2 state
  const [parties, setParties] = useState<PartyEntry[]>([]);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [searchTargetPartyId, setSearchTargetPartyId] = useState<string | null>(null);

  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => { if (currentStepIndex < steps.length - 1) setStep(steps[currentStepIndex + 1]); };
  const handleBack = () => { if (currentStepIndex > 0) setStep(steps[currentStepIndex - 1]); };
  const toggleWorkDay = (day: keyof WorkWeek) => setWorkWeek(prev => ({ ...prev, [day]: !prev[day] }));

  const resetWizardState = useCallback(() => {
    setStep(editMode ? 'supply-chain' : 'basic');
    setName(editMode ? safeInitialProjectName : '');
    setStartDate(undefined);
    setEndDate(undefined);
    setWorkWeek(getDefaultWorkWeek());
    
    if (editMode) {
      setParties(cloneParties(safeInitialParties));
    } else {
      setParties([
        {
          id: 'your-org',
          name: user?.user_metadata?.org_name || 'Your Organization',
          partyType: (user?.user_metadata?.org_type as PartyType) || 'agency',
          billsTo: [],
          organizationId: user?.id,
          people: [{ id: user?.id || 'me', name: user?.user_metadata?.full_name || 'Me', email: user?.email || '', canApprove: false }],
          isCreator: true,
        }
      ]);
    }
    setShowCompanySearch(false);
    setSearchTargetPartyId(null);
  }, [editMode, safeInitialParties, safeInitialProjectName, user]);

  useEffect(() => {
    if (!open) return;
    resetWizardState();
  }, [open, resetWizardState]);

  // ---- Party management ----
  const addParty = useCallback((partyType: PartyType, orgData?: any) => {
    const newParty: PartyEntry = {
      id: orgData?.id || `party-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: orgData?.name || '',
      partyType,
      billsTo: [],
      organizationId: orgData?.id,
      logo: orgData?.logo,
      people: [],
      isCreator: false,
    };
    setParties(prev => [...prev, newParty]);
    return newParty.id;
  }, []);

  const updateParty = useCallback((id: string, updates: Partial<PartyEntry>) => {
    setParties(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const removeParty = useCallback((id: string) => {
    setParties(prev => prev
      .filter(p => p.id !== id)
      .map(p => ({ ...p, billsTo: p.billsTo.filter(bt => bt !== id) }))
    );
  }, []);

  const toggleConnection = useCallback((sourceId: string, targetId: string) => {
    setParties(prev => prev.map(p => {
      if (p.id !== sourceId) return p;
      const has = p.billsTo.includes(targetId);
      return { ...p, billsTo: has ? p.billsTo.filter(x => x !== targetId) : [...p.billsTo, targetId] };
    }));
  }, []);

  const addPersonToParty = useCallback((partyId: string, person: PersonEntry) => {
    setParties(prev => prev.map(p =>
      p.id === partyId ? { ...p, people: [...p.people, person] } : p
    ));
  }, []);

  const removePersonFromParty = useCallback((partyId: string, personId: string) => {
    setParties(prev => prev.map(p =>
      p.id === partyId ? { ...p, people: p.people.filter(pe => pe.id !== personId) } : p
    ));
  }, []);

  const updatePersonInParty = useCallback((partyId: string, personId: string, updates: Partial<PersonEntry>) => {
    setParties(prev => prev.map(p =>
      p.id === partyId
        ? { ...p, people: p.people.map(pe => pe.id === personId ? { ...pe, ...updates } : pe) }
        : p
    ));
  }, []);

  const generatedGraph = useMemo(() => generateGraphFromWizard(parties, name), [parties, name]);
  const validationErrors = useMemo(() => validatePartyChain(parties), [parties]);
  const isDraftProject = useMemo(
    () => parties.length < 2 || !parties.some((party) => party.billsTo.length > 0),
    [parties]
  );

  // ---- Create ----
  async function handleCreate() {
    setLoading(true);
    try {
      if (editMode) {
        if (!onEditSave) {
          throw new Error('Edit supply chain handler is not configured.');
        }

        await onEditSave({
          parties: cloneParties(parties),
          nodes: generatedGraph.nodes,
          edges: generatedGraph.edges,
        });
        onClose();
        resetWizardState();
        return;
      }

      const allMembers = parties.flatMap(party =>
        party.people.map(person => ({
          id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          userId: person.id && person.id.match(/^[0-9a-f-]{36}$/) ? person.id : undefined,
          userName: person.name,
          userEmail: person.email,
          role: (person.canApprove ? 'Editor' : 'Contributor') as ProjectRole,
          scope: party.id,
          graphNodeId: person.id,
        }))
      );

      if (onCreate) {
        await onCreate({
          name,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          workWeek,
          status: isDraftProject ? 'draft' : 'active',
          supplyChainStatus: isDraftProject ? 'incomplete' : 'complete',
        }, allMembers);
      } else {
        const result = await createProject({
          name, description: '', region: 'EU',
          startDate: startDate?.toISOString(), endDate: endDate?.toISOString(), workWeek,
          ownerName: user?.user_metadata?.full_name || user?.email || 'Project Owner',
          ownerEmail: user?.email || '',
          ownerId: user?.id,
          parties: parties.map(p => ({
            id: p.id, name: p.name, partyType: p.partyType,
            billsTo: p.billsTo,
            people: p.people.map(person => ({
              id: person.id,
              name: person.name,
              email: person.email,
              canApprove: person.canApprove,
            })),
          })),
          status: isDraftProject ? 'draft' : 'active',
          supplyChainStatus: isDraftProject ? 'incomplete' : 'complete',
          members: allMembers,
        }, accessToken);

        const graph = generateGraphFromWizard(parties, name);
        try {
          await updateProject(result.project.id, {
            graph: { nodes: graph.nodes, edges: graph.edges },
            parties: parties.map(p => ({
              id: p.id, name: p.name, partyType: p.partyType,
              billsTo: p.billsTo, peopleCount: p.people.length,
            })),
          }, accessToken);
        } catch (e) { console.error('Failed to save graph:', e); }

        // Write approval-dir to sessionStorage immediately so Timesheets tab
        // can resolve approval routes without requiring the Graph tab to load first.
        const approvalParties = parties.map(p => ({
          id: p.id,
          name: p.name,
          partyType: p.partyType,
          billsTo: p.billsTo,
          people: p.people.map(person => ({
            id: person.id,
            name: person.name,
            email: person.email,
            canApprove: person.canApprove,
          })),
        }));
        const approvalDirPayload = JSON.stringify({ parties: approvalParties });
        sessionStorage.setItem(`workgraph-approval-dir:${result.project.id}`, approvalDirPayload);
        try { localStorage.setItem(`workgraph-approval-dir:${result.project.id}`, approvalDirPayload); } catch { /* quota */ }

        sessionStorage.setItem('currentProjectName', name);
        if (startDate) {
          sessionStorage.setItem('currentProjectStartDate', startDate.toISOString());
        } else {
          sessionStorage.removeItem('currentProjectStartDate');
        }
        if (typeof window !== 'undefined') {
          const detail = {
            projectId: result.project.id,
            projectName: name,
            projectStartDate: startDate ? startDate.toISOString() : null,
          };
          window.dispatchEvent(new CustomEvent('workgraph-project-changed', { detail }));
          window.dispatchEvent(new CustomEvent('workgraph-project-selected', { detail }));
        }
        toast.success(isDraftProject ? 'Draft project created!' : 'Project created!', {
          description: isDraftProject
            ? 'You can add more parties and connect the chain later from the workspace.'
            : `${graph.nodes.length} graph nodes generated.`,
        });
        if (onSuccess) {
          onSuccess(
            result.project.id,
            startDate ? startDate.toISOString() : null,
            result.project.storageSource === 'cloud' ? 'cloud' : undefined
          );
        }
      }

      onClose();
      setTimeout(() => { resetWizardState(); }, 500);
    } catch (error) {
      console.error(`Failed to ${editMode ? 'update supply chain' : 'create project'}:`, error);
      toast.error(editMode ? 'Failed to update supply chain' : 'Failed to create project', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  }

  const canProceed: Record<Step, boolean> = {
    'basic': !!name && !!startDate,
    'supply-chain': parties.length >= 1 && parties.every(p => p.name.trim() !== ''),
    'people': true,
    'review': true,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="!max-w-[96vw] lg:!max-w-6xl !max-h-[92vh] !grid !grid-rows-[auto_auto_auto_1fr_auto] overflow-hidden !w-[96vw] lg:!w-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/70 dark:from-slate-950 dark:to-slate-950 shadow-2xl">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Network className="w-5 h-5 text-blue-600" />
              {editMode ? 'Edit Supply Chain' : 'Create New Project'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
              {editMode
                ? 'Update parties and people, then merge the new supply chain into the current WorkGraph'
                : 'Define your supply chain, assign people, and auto-generate the WorkGraph'}
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2 bg-slate-200/70 dark:bg-slate-800" />
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              {(editMode ? ['Supply Chain', 'People'] : ['Basics', 'Supply Chain', 'People', 'Review']).map((s, i) => (
                <span key={s} className={currentStepIndex === i ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium'}>{s}</span>
              ))}
            </div>
          </div>

          <Separator />

          {/* Content — side by side */}
          <div className="min-h-0 flex gap-4 overflow-hidden">
            {/* Left: controls */}
            <div className="flex-[3] min-w-0 overflow-y-auto pr-2 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 p-4">
              {step === 'basic' && (
                <BasicInfoStep
                  name={name} setName={setName}
                  startDate={startDate}
                  setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
                  workWeek={workWeek} toggleWorkDay={toggleWorkDay}
                />
              )}
              {step === 'supply-chain' && (
                <SupplyChainStep
                  parties={parties} addParty={addParty} updateParty={updateParty}
                  removeParty={removeParty} toggleConnection={toggleConnection}
                  onSearchExisting={(id) => { setSearchTargetPartyId(id); setShowCompanySearch(true); }}
                />
              )}
              {step === 'people' && (
                <PeopleStep parties={parties} addPerson={addPersonToParty}
                  removePerson={removePersonFromParty} updatePerson={updatePersonInParty}
                  updateParty={updateParty} />
              )}
              {step === 'review' && (
                <ReviewStep name={name} 
                  startDate={startDate} endDate={endDate} workWeek={workWeek}
                  parties={parties} generatedGraph={generatedGraph}
                  validationErrors={validationErrors} isDraftProject={isDraftProject} />
              )}
            </div>

            {/* Right: always-visible live graph */}
            <div className="flex-[2] min-w-[250px] max-w-[340px] flex-shrink-0 flex flex-col min-h-0">
              <SideGraphPreview parties={parties} step={step} generatedGraph={generatedGraph} />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            {currentStepIndex > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
            <div className="flex-1" />
            {currentStepIndex < steps.length - 1 ? (
              <Button size="sm" className="px-4" onClick={handleNext} disabled={!canProceed[step]}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" className="px-4 shadow-sm" onClick={handleCreate} disabled={loading}>
                {loading ? (
                  <><div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full mr-2" />{editMode ? 'Saving...' : 'Creating...'}</>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {editMode ? 'Save Supply Chain' : (isDraftProject ? 'Create Draft Project' : 'Create Project &amp; Generate Graph')}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompanySearchDialog open={showCompanySearch} onClose={() => setShowCompanySearch(false)}
        onSelect={(company) => {
          if (searchTargetPartyId) {
            updateParty(searchTargetPartyId, { name: company.name, organizationId: company.id, logo: company.logo });
          } else {
            addParty((company.type as PartyType) || 'company', company);
          }
          setShowCompanySearch(false);
          setSearchTargetPartyId(null);
        }}
      />
    </>
  );
}

// ============================================================================
// Step 1: Basic Info
// ============================================================================

function BasicInfoStep({ name, setName,
  startDate, setStartDate, endDate, setEndDate, workWeek, toggleWorkDay }: any) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs">Project Name *</Label>
        <Input id="name" value={name} onChange={(e: any) => setName(e.target.value)}
          placeholder="e.g., Website Redesign Q1 2026" autoFocus className="h-9" />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Start Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start h-9 text-sm">
                <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                {startDate ? format(startDate, 'PPP') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start h-9 text-sm">
                <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                {endDate ? format(endDate, 'PPP') : 'Optional'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Work Week</Label>
        <div className="flex gap-1.5">
          {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => (
            <button type="button" key={day} onClick={() => toggleWorkDay(day)}
              className={`flex-1 py-1.5 px-1 rounded text-[10px] font-semibold border-2 transition-all ${
                workWeek[day] ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-400'}`}>
              {day.slice(0, 2).toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: Supply Chain — Connection-based
// ============================================================================

function SupplyChainStep({ parties, addParty, updateParty, removeParty, toggleConnection, onSearchExisting }: {
  parties: PartyEntry[];
  addParty: (type: PartyType, orgData?: any) => string;
  updateParty: (id: string, updates: Partial<PartyEntry>) => void;
  removeParty: (id: string) => void;
  toggleConnection: (sourceId: string, targetId: string) => void;
  onSearchExisting: (partyId: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/70">
        <div className="flex gap-2 items-start">
          <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-300">
            You're sketching the billing structure of this project. <strong>First party = your organization.</strong> Add the other organizations in the chain — agencies, clients, contractors. Real people join their respective party via invitation after the project is created.
          </p>
        </div>
      </div>

      {/* Party cards */}
      {parties.length > 0 && (
        <div className="space-y-2">
          {parties.map(party => (
            <CompactPartyCard
              key={party.id}
              party={party}
              allParties={parties}
              onUpdate={(u) => updateParty(party.id, u)}
              onRemove={() => removeParty(party.id)}
              onToggleConnection={(targetId) => toggleConnection(party.id, targetId)}
              onSearchExisting={() => onSearchExisting(party.id)}
            />
          ))}
        </div>
      )}

      {/* Add party */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.12em]">Invite other parties</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {PARTY_TYPE_OPTIONS.map(opt => {
            const Icon = getPartyIcon(opt.value);
            return (
              <button type="button" key={opt.value} onClick={() => addParty(opt.value)}
                className="flex flex-col items-start justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all group text-left gap-2 relative overflow-hidden min-h-[104px]">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(135deg, ${opt.color}14, transparent 55%)` }} />
                <div className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                  <Icon className="w-4 h-4" style={{ color: opt.color }} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{opt.label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Compact Party Card
// ============================================================================

function CompactPartyCard({ party, allParties, onUpdate, onRemove, onToggleConnection, onSearchExisting }: {
  party: PartyEntry;
  allParties: PartyEntry[];
  onUpdate: (u: Partial<PartyEntry>) => void;
  onRemove: () => void;
  onToggleConnection: (targetId: string) => void;
  onSearchExisting: () => void;
}) {
  const opt = getPartyOption(party.partyType);
  const otherParties = allParties.filter(p => p.id !== party.id);

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative group">
      <div className="absolute left-0 top-0 bottom-0 w-1 opacity-70 transition-all duration-300 group-hover:w-1.5" style={{ backgroundColor: opt.color }} />
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center flex-shrink-0">
          {(() => {
            const Icon = getPartyIcon(party.partyType);
            return <Icon className="w-3.5 h-3.5" style={{ color: opt.color }} />;
          })()}
        </div>
        <Input value={party.name} onChange={(e: any) => onUpdate({ name: e.target.value })}
          placeholder={`${opt.label} name...`} className="h-8 text-sm font-semibold flex-1 border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none placeholder:font-normal" />
        <Select value={party.partyType} onValueChange={(v: string) => onUpdate({ partyType: v as PartyType })}>
          <SelectTrigger className="h-8 w-[120px] text-xs font-medium border-0 bg-muted/40 hover:bg-muted/60 transition-colors rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARTY_TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                <span className="flex items-center gap-1.5">
                  {(() => {
                    const Icon = getPartyIcon(o.value);
                    return <Icon className="w-3.5 h-3.5" />;
                  })()}
                  <span>{o.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={onSearchExisting} className="h-7 w-7 p-0">
          <Building2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Connection row */}
      {otherParties.length > 0 && (
        <div className="px-3 py-2 bg-muted/20 border-t border-border">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Bills to:</span>
            {otherParties.map(target => {
              const tOpt = getPartyOption(target.partyType);
              const connected = party.billsTo.includes(target.id);
              return (
                <button key={target.id} onClick={() => onToggleConnection(target.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border-2 transition-all duration-200 ${
                    connected
                      ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/60 dark:to-emerald-800/40 border-emerald-300 dark:border-emerald-600 text-emerald-800 dark:text-emerald-100 shadow-sm'
                      : 'bg-muted/30 border-transparent text-muted-foreground hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20'
                  }`}>
                  {connected ? <Link2 className="w-3 h-3 text-emerald-600" /> : <Unlink className="w-3 h-3 opacity-40" />}
                  {(() => {
                    const Icon = getPartyIcon(target.partyType);
                    return <Icon className="w-3 h-3" />;
                  })()}
                  <span className="max-w-[80px] truncate">{target.name || tOpt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] text-muted-foreground border-t border-border/50">
        <Users className="w-3 h-3" />
        <span>{party.people.length} people</span>
        {party.isCreator && <Badge className="text-[9px] h-4 ml-auto bg-blue-100 text-blue-700 border-blue-200">You</Badge>}
      </div>
    </div>
  );
}

// ============================================================================
// Mini Graph SVG Preview — renders the actual DAG structure
// ============================================================================

function MiniGraphPreview({ parties }: { parties: PartyEntry[] }) {
  const depths = computeDepths(parties);

  // Group by depth for layered layout
  const layers = new Map<number, PartyEntry[]>();
  parties.forEach(p => {
    const d = depths.get(p.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(p);
  });
  const layerKeys = [...layers.keys()].sort((a, b) => a - b);

  // Layout constants
  const nodeW = 120;
  const nodeH = 32;
  const layerGap = 80;
  const nodeGap = 16;
  const padX = 20;
  const padY = 20;

  // Position nodes
  const positions = new Map<string, { x: number; y: number }>();
  let maxX = 0;

  layerKeys.forEach((layerIdx, li) => {
    const layerParties = layers.get(layerIdx)!;
    const totalW = layerParties.length * nodeW + (layerParties.length - 1) * nodeGap;
    const startX = padX;
    layerParties.forEach((p, i) => {
      const x = startX + i * (nodeW + nodeGap);
      const y = padY + li * (nodeH + layerGap);
      positions.set(p.id, { x, y });
      maxX = Math.max(maxX, x + nodeW);
    });
  });

  const svgW = Math.max(maxX + padX, 200);
  const svgH = padY * 2 + layerKeys.length * nodeH + (layerKeys.length - 1) * layerGap;

  // Edges
  const edges: { from: { x: number; y: number }; to: { x: number; y: number }; fromId: string; toId: string }[] = [];
  parties.forEach(p => {
    const fromPos = positions.get(p.id);
    if (!fromPos) return;
    p.billsTo.forEach(tid => {
      const toPos = positions.get(tid);
      if (!toPos) return;
      edges.push({
        from: { x: fromPos.x + nodeW / 2, y: fromPos.y + nodeH },
        to: { x: toPos.x + nodeW / 2, y: toPos.y },
        fromId: p.id,
        toId: tid,
      });
    });
  });

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Network className="w-3.5 h-3.5 text-accent-brand" />
        <span className="text-xs font-medium text-foreground">Live Preview</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{parties.length} parties &middot; {edges.length} connections</span>
      </div>
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} className="mx-auto">
          <defs>
            <marker id="arrowhead-mini" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const midY = (e.from.y + e.to.y) / 2;
            return (
              <path
                key={`${e.fromId}-${e.toId}`}
                d={`M${e.from.x},${e.from.y} C${e.from.x},${midY} ${e.to.x},${midY} ${e.to.x},${e.to.y}`}
                fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 4"
                markerEnd="url(#arrowhead-mini)" opacity={0.5} className="animate-[dash_2s_linear_infinite]"
              />
            );
          })}

          {/* Nodes */}
          {parties.map(p => {
            const pos = positions.get(p.id);
            if (!pos) return null;
            const opt = getPartyOption(p.partyType);
            return (
              <g key={p.id}>
                <rect x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={6}
                  fill="white" stroke={opt.color} strokeWidth="1.5" />
                <text x={pos.x + 8} y={pos.y + nodeH / 2 + 1} fontSize="10"
                  dominantBaseline="middle" fill="#374151" fontWeight="500">
                  {(p.name || opt.label).slice(0, 14)}{(p.name || opt.label).length > 14 ? '...' : ''}
                </text>
                {/* People count badge */}
                {p.people.length > 0 && (
                  <>
                    <circle cx={pos.x + nodeW - 10} cy={pos.y + 10} r={7} fill={opt.color} opacity={0.15} />
                    <text x={pos.x + nodeW - 10} y={pos.y + 10} fontSize="8"
                      textAnchor="middle" dominantBaseline="central" fill={opt.color} fontWeight="600">
                      {p.people.length}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ============================================================================
// Step 3: People
// ============================================================================

function PeopleStep({ parties, addPerson, removePerson, updatePerson, updateParty }: {
  parties: PartyEntry[];
  addPerson: (partyId: string, person: PersonEntry) => void;
  removePerson: (partyId: string, personId: string) => void;
  updatePerson: (partyId: string, personId: string, updates: Partial<PersonEntry>) => void;
  updateParty: (id: string, updates: Partial<PartyEntry>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex gap-2 items-start">
          <Users className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            Add people to each organization. Toggle <Shield className="w-3 h-3 inline" /> to make someone an approver,
            and <Eye className="w-3 h-3 inline" /> for rate visibility.
            Use <EyeOff className="w-3 h-3 inline" /> to hide a person from connected parties in the chain.
          </p>
        </div>
      </div>

      {parties.map(party => (
        <PartyPeopleSection key={party.id} party={party}
          addPerson={addPerson} removePerson={removePerson} updatePerson={updatePerson} updateParty={updateParty} />
      ))}

      {parties.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Go back to add parties first</p>
        </div>
      )}
    </div>
  );
}

function PartyPeopleSection({ party, addPerson, removePerson, updatePerson, updateParty }: {
  party: PartyEntry;
  addPerson: (partyId: string, person: PersonEntry) => void;
  removePerson: (partyId: string, personId: string) => void;
  updatePerson: (partyId: string, personId: string, updates: Partial<PersonEntry>) => void;
  updateParty: (id: string, updates: Partial<PartyEntry>) => void;
}) {
  const [pName, setPName] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pRole, setPRole] = useState('');
  const opt = getPartyOption(party.partyType);

  function handleAdd() {
    if (!pName.trim() || !pEmail.includes('@')) return;
    addPerson(party.id, {
      id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: pName.trim(), email: pEmail.trim(), role: pRole.trim() || 'Member',
      canApprove: false, canViewRates: true, canEditTimesheets: true,
      visibleToChain: true,
    });
    setPName(''); setPEmail(''); setPRole('');
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b flex items-center gap-2">
        {(() => {
          const Icon = getPartyIcon(party.partyType);
          return <Icon className="w-3.5 h-3.5" style={{ color: opt.color }} />;
        })()}
        <span className="text-xs font-semibold">{party.name || opt.label}</span>
        <div className="ml-auto flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select value={party.chainVisibility || 'all'} onValueChange={(v: string) => {
                    updateParty(party.id, { chainVisibility: v as 'all' | 'selected' | 'none' });
                  }}>
                    <SelectTrigger className="h-5 w-[90px] text-[9px] border-0 bg-muted/50 gap-1 px-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> Show all</span>
                      </SelectItem>
                      <SelectItem value="selected">
                        <span className="flex items-center gap-1"><EyeOff className="w-2.5 h-2.5" /> Selected</span>
                      </SelectItem>
                      <SelectItem value="none">
                        <span className="flex items-center gap-1"><EyeOff className="w-2.5 h-2.5 text-orange-500" /> Hide all</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Chain visibility: who other parties can see</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge variant="secondary" className="text-[9px] h-4">{party.people.length}</Badge>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {party.people.map(person => (
          <div key={person.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/30 group">
            <div className="w-6 h-6 rounded-full bg-accent-brand/10 flex items-center justify-center flex-shrink-0">
              <User className="w-3 h-3 text-accent-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium">{person.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{person.email} · {person.role}</div>
            </div>
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => updatePerson(party.id, person.id, { canApprove: !person.canApprove })}
                  className={`p-1 rounded transition-colors ${person.canApprove
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'text-muted-foreground/30 hover:text-muted-foreground'}`}>
                  <Shield className="w-3 h-3" />
                </button>
              </TooltipTrigger><TooltipContent><p className="text-xs">{person.canApprove ? 'Approver ✓' : 'Make approver'}</p></TooltipContent></Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => updatePerson(party.id, person.id, { canViewRates: !person.canViewRates })}
                  className={`p-1 rounded transition-colors ${person.canViewRates
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                    : 'text-muted-foreground/30 hover:text-muted-foreground'}`}>
                  <Eye className="w-3 h-3" />
                </button>
              </TooltipTrigger><TooltipContent><p className="text-xs">{person.canViewRates ? 'Sees rates ✓' : 'Show rates'}</p></TooltipContent></Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => updatePerson(party.id, person.id, { visibleToChain: !(person.visibleToChain ?? true) })}
                  className={`p-1 rounded transition-colors ${(person.visibleToChain ?? true)
                    ? 'text-muted-foreground/30 hover:text-muted-foreground'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}`}>
                  <EyeOff className="w-3 h-3" />
                </button>
              </TooltipTrigger><TooltipContent><p className="text-xs">{(person.visibleToChain ?? true) ? 'Visible to chain — click to hide' : 'Hidden from chain ✓'}</p></TooltipContent></Tooltip>
            </TooltipProvider>
            <Button variant="ghost" size="sm" onClick={() => removePerson(party.id, person.id)}
              className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-destructive hover:text-destructive">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}

        {/* Quick add */}
        <div className="flex gap-1.5 items-end pt-1">
          <Input value={pName} onChange={(e: any) => setPName(e.target.value)} placeholder="Name" className="h-7 text-[11px] flex-1" />
          <Input value={pEmail} onChange={(e: any) => setPEmail(e.target.value)} placeholder="email@..." className="h-7 text-[11px] flex-1"
            onKeyDown={(e: any) => e.key === 'Enter' && handleAdd()} />
          <Input value={pRole} onChange={(e: any) => setPRole(e.target.value)} placeholder="Role" className="h-7 text-[11px] w-20"
            onKeyDown={(e: any) => e.key === 'Enter' && handleAdd()} />
          <Button size="sm" className="h-7 px-2" onClick={handleAdd} disabled={!pName.trim() || !pEmail.includes('@')}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step 4: Review with mini-graph
// ============================================================================

function ReviewStep({ name, region, startDate, endDate, workWeek,
  parties, generatedGraph, validationErrors, isDraftProject }: {
  name: string; region: string;
  startDate?: Date; endDate?: Date; workWeek: WorkWeek;
  parties: PartyEntry[]; generatedGraph: { nodes: any[]; edges: any[] };
  validationErrors: string[];
  isDraftProject: boolean;
}) {
  const totalPeople = parties.reduce((s, p) => s + p.people.length, 0);
  const approverCount = parties.reduce((s, p) => s + p.people.filter(pe => pe.canApprove).length, 0);
  const connectionCount = parties.reduce((s, p) => s + p.billsTo.length, 0);
  const workDays = Object.entries(workWeek).filter(([, v]) => v).map(([d]) => d.slice(0, 2).toUpperCase());

  return (
    <div className="space-y-4">
      {validationErrors.length > 0 && (
        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              {validationErrors.map((e, i) => (
                <p key={i} className="text-[11px] text-amber-700 dark:text-amber-300">• {e}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {isDraftProject && (
        <div className="p-2.5 bg-sky-50 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800">
          <div className="flex gap-2 items-start">
            <Info className="w-3.5 h-3.5 text-sky-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-sky-700 dark:text-sky-300">
              This project will be created as a draft so you can invite people and finish the supply chain later.
            </p>
          </div>
        </div>
      )}

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted/30 rounded-lg space-y-1.5">
          <h4 className="text-xs font-semibold">Project</h4>
          <Row label="Name" value={name} />
          <Row label="Region" value={region} />
          <Row label="Start" value={startDate ? format(startDate, 'PP') : '—'} />
          {endDate && <Row label="End" value={format(endDate, 'PP')} />}
          <Row label="Work days" value={workDays.join(' ')} />
        </div>
        <div className="p-3 bg-muted/30 rounded-lg space-y-1.5">
          <h4 className="text-xs font-semibold">Supply Chain</h4>
          <Row label="Parties" value={String(parties.length)} />
          <Row label="Connections" value={String(connectionCount)} />
          <Row label="People" value={String(totalPeople)} />
          <Row label="Approvers" value={String(approverCount)} />
          <Row label="Status" value={isDraftProject ? 'Draft' : 'Active'} />
        </div>
      </div>

      {/* Full graph preview */}
      <MiniGraphPreview parties={parties} />

      {/* Graph stats */}
      <div className="p-3 bg-accent-brand/5 border border-accent-brand/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-accent-brand" />
          <span className="text-xs font-medium">Auto-Generated Graph</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-lg font-bold">{generatedGraph.nodes.length}</div><div className="text-[10px] text-muted-foreground">Nodes</div></div>
          <div><div className="text-lg font-bold">{generatedGraph.edges.length}</div><div className="text-[10px] text-muted-foreground">Edges</div></div>
          <div><div className="text-lg font-bold">{approverCount}</div><div className="text-[10px] text-muted-foreground">Approvers</div></div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Includes party nodes, person nodes, billing edges, and approval chains. Refine on the canvas after creation.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ============================================================================
// Side Graph Preview — renders the actual DAG structure
// ============================================================================

function SideGraphPreview({ parties, step, generatedGraph }: { parties: PartyEntry[]; step: Step; generatedGraph: { nodes: any[]; edges: any[] } }) {
  const depths = computeDepths(parties);

  // Group by depth for layered layout
  const layers = new Map<number, PartyEntry[]>();
  parties.forEach(p => {
    const d = depths.get(p.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(p);
  });
  const layerKeys = [...layers.keys()].sort((a, b) => a - b);

  // Layout constants — fit within 300px width
  const panelW = 300;
  const nodeH = 28;
  const layerGap = 56;
  const nodeGap = 10;
  const padX = 16;
  const padY = 16;

  // Compute node width dynamically based on widest layer
  const maxInLayer = Math.max(1, ...layerKeys.map(k => (layers.get(k) || []).length));
  const nodeW = Math.min(120, Math.floor((panelW - padX * 2 - (maxInLayer - 1) * nodeGap) / maxInLayer));

  // Position nodes centered per layer
  const positions = new Map<string, { x: number; y: number }>();

  layerKeys.forEach((layerIdx, li) => {
    const layerParties = layers.get(layerIdx)!;
    const totalW = layerParties.length * nodeW + (layerParties.length - 1) * nodeGap;
    const startX = (panelW - totalW) / 2;
    layerParties.forEach((p, i) => {
      positions.set(p.id, {
        x: startX + i * (nodeW + nodeGap),
        y: padY + li * (nodeH + layerGap),
      });
    });
  });

  const svgH = padY * 2 + Math.max(1, layerKeys.length) * nodeH + Math.max(0, layerKeys.length - 1) * layerGap;

  // Edges
  const edgeData: { from: { x: number; y: number }; to: { x: number; y: number }; fromId: string; toId: string }[] = [];
  parties.forEach(p => {
    const fromPos = positions.get(p.id);
    if (!fromPos) return;
    p.billsTo.forEach(tid => {
      const toPos = positions.get(tid);
      if (!toPos) return;
      edgeData.push({
        from: { x: fromPos.x + nodeW / 2, y: fromPos.y + nodeH },
        to: { x: toPos.x + nodeW / 2, y: toPos.y },
        fromId: p.id,
        toId: tid,
      });
    });
  });

  const totalPeople = parties.reduce((s, p) => s + p.people.length, 0);

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-full overflow-hidden shadow-sm relative">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border bg-muted/30">
        <Network className="w-3.5 h-3.5 text-accent-brand" />
        <span className="text-xs font-semibold text-foreground">Live Preview</span>
      </div>

      {/* Graph area */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-2">
        {parties.length === 0 ? (
          <div className="text-center py-8">
            <Network className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">Add parties to see the graph</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Your supply chain will appear here</p>
          </div>
        ) : (
          <svg width={panelW} height={svgH} className="block relative z-10 mx-auto">
            <defs>
              <pattern id="dot-matrix" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="#e2e8f0" className="dark:fill-slate-800" />
              </pattern>
              <filter id="node-shadow" x="-10%" y="-10%" width="130%" height="130%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.08" />
              </filter>
              <marker id="arrow-side" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                <polygon points="0 0, 7 2.5, 0 5" fill="#cbd5e1" className="dark:fill-slate-700" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#dot-matrix)" />

            {/* Layer labels */}
            {layerKeys.map((layerIdx, li) => {
              const y = padY + li * (nodeH + layerGap) + nodeH / 2;
              const label = li === 0 ? 'Workers' : li === layerKeys.length - 1 ? 'Client' : `Tier ${li}`;
              return (
                <text key={`label-${layerIdx}`} x={6} y={y} fontSize="7" fill="#a1a1aa"
                  dominantBaseline="middle" fontWeight="500" opacity={0.6}>
                  {label}
                </text>
              );
            })}

            {/* Edges */}
            {edgeData.map(e => {
              const midY = (e.from.y + e.to.y) / 2;
              return (
                <path key={`${e.fromId}-${e.toId}`}
                  d={`M${e.from.x},${e.from.y} C${e.from.x},${midY} ${e.to.x},${midY} ${e.to.x},${e.to.y}`}
                  fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round"
                  className="dark:stroke-slate-700"
                  opacity={0.8} />
              );
            })}

            {/* Nodes */}
            {parties.map(p => {
              const pos = positions.get(p.id);
              if (!pos) return null;
              const opt = getPartyOption(p.partyType);
              const label = (p.name || opt.label);
              const maxChars = Math.floor(nodeW / 7) - 2;
              const hiddenCount = p.people.filter(pe => pe.visibleToChain === false).length;
              const visibleCount = p.people.length - hiddenCount;
              return (
                <g key={p.id} className="transition-transform hover:scale-[1.02] duration-200 origin-center" style={{ transformOrigin: `${pos.x + nodeW/2}px ${pos.y + nodeH/2}px` }}>
                  <rect x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={10}
                    fill="white" stroke={opt.color} strokeWidth="1.5" filter="url(#node-shadow)" className="dark:fill-slate-900" />
                  <text x={pos.x + 8} y={pos.y + nodeH / 2 + 1} fontSize="10"
                    dominantBaseline="middle" fill="#1e293b" className="dark:fill-slate-200" fontWeight="600">
                    {label.slice(0, maxChars)}{label.length > maxChars ? '...' : ''}
                  </text>
                  {p.people.length > 0 && (
                    <g>
                      <circle cx={pos.x + nodeW - 10} cy={pos.y + nodeH / 2} r={7.5} fill={opt.color} opacity={0.15} />
                      <text x={pos.x + nodeW - 10} y={pos.y + nodeH / 2 + 0.5} fontSize="9"
                        textAnchor="middle" dominantBaseline="central" fill={opt.color} fontWeight="700">
                        {p.people.length}
                      </text>
                      {hiddenCount > 0 && (
                        <title>{visibleCount} visible, {hiddenCount} hidden from chain</title>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Stats footer */}
      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <div className="grid grid-cols-3 gap-1 text-center">
          <div>
            <div className="text-sm font-bold text-foreground">{parties.length}</div>
            <div className="text-[9px] text-muted-foreground">Parties</div>
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{edgeData.length}</div>
            <div className="text-[9px] text-muted-foreground">Connections</div>
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{totalPeople}</div>
            <div className="text-[9px] text-muted-foreground">People</div>
          </div>
        </div>
        {step === 'review' && (
          <div className="mt-1.5 pt-1.5 border-t border-border/50 text-center">
            <div className="text-[10px] text-muted-foreground">
              <Sparkles className="w-3 h-3 inline mr-1 text-accent-brand" />
              {generatedGraph.nodes.length} nodes &middot; {generatedGraph.edges.length} edges will be generated
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
