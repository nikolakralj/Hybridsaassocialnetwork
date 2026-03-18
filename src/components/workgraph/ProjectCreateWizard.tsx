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
import { format } from 'date-fns';
import { Project, ProjectMember, ProjectRole, WorkWeek } from '../../types/collaboration';
import type { PartyType } from '../../types/workgraph';
import { CompanySearchDialog } from './CompanySearchDialog';
import { createProject, updateProject } from '../../utils/api/projects-api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';
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
  onSuccess?: (projectId: string) => void;
}

type Step = 'basic' | 'supply-chain' | 'people' | 'review';

const PARTY_TYPE_OPTIONS: { value: PartyType; label: string; desc: string; emoji: string; color: string }[] = [
  { value: 'freelancer', emoji: '👤', label: 'Freelancer', desc: 'Independent worker', color: '#8b5cf6' },
  { value: 'contractor', emoji: '🔧', label: 'Contractor', desc: 'Contracting company', color: '#6366f1' },
  { value: 'company', emoji: '🏢', label: 'Company', desc: 'Employer / Staffing co', color: '#3b82f6' },
  { value: 'agency', emoji: '🚀', label: 'Agency', desc: 'Recruiter / MSP', color: '#f59e0b' },
  { value: 'client', emoji: '🌐', label: 'Client', desc: 'End client', color: '#10b981' },
];

function getPartyOption(type: PartyType) {
  return PARTY_TYPE_OPTIONS.find(o => o.value === type)!;
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectCreateWizard({ open, onClose, onCreate, onSuccess }: ProjectCreateWizardProps) {
  const [step, setStep] = useState<Step>('basic');
  const [loading, setLoading] = useState(false);
  const { user, accessToken } = useAuth();

  // Step 1 state
  const [name, setName] = useState('');
  const [region, setRegion] = useState<'US' | 'EU' | 'UK'>('US');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [workWeek, setWorkWeek] = useState<WorkWeek>({
    monday: true, tuesday: true, wednesday: true, thursday: true,
    friday: true, saturday: false, sunday: false,
  });

  // Step 2 state
  const [parties, setParties] = useState<PartyEntry[]>([]);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [searchTargetPartyId, setSearchTargetPartyId] = useState<string | null>(null);

  const steps: Step[] = ['basic', 'supply-chain', 'people', 'review'];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => { if (currentStepIndex < steps.length - 1) setStep(steps[currentStepIndex + 1]); };
  const handleBack = () => { if (currentStepIndex > 0) setStep(steps[currentStepIndex - 1]); };
  const toggleWorkDay = (day: keyof WorkWeek) => setWorkWeek(prev => ({ ...prev, [day]: !prev[day] }));

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
      isCreator: parties.length === 0,
    };
    setParties(prev => [...prev, newParty]);
    return newParty.id;
  }, [parties.length]);

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

  // ---- Create ----
  async function handleCreate() {
    setLoading(true);
    try {
      const allMembers = parties.flatMap(party =>
        party.people.map(person => ({
          userName: person.name,
          userEmail: person.email,
          role: (person.canApprove ? 'Editor' : 'Contributor') as ProjectRole,
        }))
      );

      if (onCreate) {
        await onCreate({ name, region, currency, startDate: startDate?.toISOString(), endDate: endDate?.toISOString(), workWeek }, allMembers);
      } else {
        const result = await createProject({
          name, description: '', region, currency,
          startDate: startDate?.toISOString(), endDate: endDate?.toISOString(), workWeek,
          ownerName: user?.name || 'Project Owner', ownerEmail: user?.email || '',
          members: allMembers.map(m => ({ userName: m.userName, userEmail: m.userEmail, role: m.role })),
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

        sessionStorage.setItem('currentProjectName', name);
        toast.success('Project created!', { description: `${graph.nodes.length} graph nodes generated.` });
        if (onSuccess) onSuccess(result.project.id);
      }

      onClose();
      setTimeout(() => { setStep('basic'); setName(''); setStartDate(undefined); setEndDate(undefined); setParties([]); }, 500);
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project', { description: error instanceof Error ? error.message : 'Please try again' });
    } finally {
      setLoading(false);
    }
  }

  const canProceed: Record<Step, boolean> = {
    'basic': !!name && !!startDate,
    'supply-chain': parties.length >= 2 && parties.every(p => p.name.trim() !== '') &&
      parties.some(p => p.billsTo.length > 0),
    'people': true,
    'review': true,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="!max-w-[95vw] lg:!max-w-6xl !max-h-[90vh] !grid !grid-rows-[auto_auto_auto_1fr_auto] overflow-hidden !w-[95vw] lg:!w-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Network className="w-5 h-5 text-accent-brand" />
              Create New Project
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define your supply chain, assign people, and auto-generate the WorkGraph
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          <div className="space-y-1.5">
            <Progress value={progress} className="h-1.5" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              {['Basics', 'Supply Chain', 'People', 'Review'].map((s, i) => (
                <span key={s} className={currentStepIndex === i ? 'font-semibold text-foreground' : ''}>{s}</span>
              ))}
            </div>
          </div>

          <Separator />

          {/* Content — side by side */}
          <div className="min-h-0 flex gap-4 overflow-hidden">
            {/* Left: controls */}
            <div className="flex-[3] min-w-0 overflow-y-auto pr-2">
              {step === 'basic' && (
                <BasicInfoStep
                  name={name} setName={setName} region={region} setRegion={setRegion}
                  currency={currency} setCurrency={setCurrency} startDate={startDate}
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
                <ReviewStep name={name} region={region} currency={currency}
                  startDate={startDate} endDate={endDate} workWeek={workWeek}
                  parties={parties} generatedGraph={generatedGraph}
                  validationErrors={validationErrors} />
              )}
            </div>

            {/* Right: always-visible live graph */}
            <div className="flex-[2] min-w-[240px] max-w-[320px] flex-shrink-0 flex flex-col min-h-0">
              <SideGraphPreview parties={parties} step={step} generatedGraph={generatedGraph} />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border">
            {currentStepIndex > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
            <div className="flex-1" />
            {currentStepIndex < steps.length - 1 ? (
              <Button size="sm" onClick={handleNext} disabled={!canProceed[step]}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleCreate} disabled={loading}>
                {loading ? (
                  <><div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full mr-2" />Creating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Create Project &amp; Generate Graph</>
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

function BasicInfoStep({ name, setName, region, setRegion, currency, setCurrency,
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
          <Label className="text-xs">Region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="EU">European Union</SelectItem>
              <SelectItem value="UK">United Kingdom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
            <button key={day} onClick={() => toggleWorkDay(day)}
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
      <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex gap-2 items-start">
          <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-blue-700 dark:text-blue-300">
            Add each organization, then connect them with <strong>"bills to"</strong> relationships.
            Any structure works — linear chains, parallel agencies, direct freelancer→client, diamonds, etc.
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
      <div className="space-y-2">
        <Label className="text-xs font-medium">Add party</Label>
        <div className="flex flex-wrap gap-1.5">
          {PARTY_TYPE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => addParty(opt.value)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-left group">
              <span className="text-sm">{opt.emoji}</span>
              <span className="text-xs font-medium text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-300">{opt.label}</span>
            </button>
          ))}
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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-base flex-shrink-0">{opt.emoji}</span>
        <Input value={party.name} onChange={(e: any) => onUpdate({ name: e.target.value })}
          placeholder={`${opt.label} name...`} className="h-7 text-sm font-medium flex-1 border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none" />
        <Select value={party.partyType} onValueChange={(v: string) => onUpdate({ partyType: v as PartyType })}>
          <SelectTrigger className="h-7 w-[110px] text-[11px] border-0 bg-muted/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARTY_TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                <span className="flex items-center gap-1.5"><span>{o.emoji}</span><span>{o.label}</span></span>
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
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                    connected
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                      : 'bg-muted/50 border-border text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                  }`}>
                  {connected ? <Link2 className="w-2.5 h-2.5" /> : <Unlink className="w-2.5 h-2.5 opacity-40" />}
                  <span>{tOpt.emoji}</span>
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
        {party.isCreator && <Badge variant="secondary" className="text-[9px] h-4 ml-auto">Your org</Badge>}
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
                fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2"
                markerEnd="url(#arrowhead-mini)" opacity={0.6}
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
                  {opt.emoji} {(p.name || opt.label).slice(0, 12)}{(p.name || opt.label).length > 12 ? '…' : ''}
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
        <span>{opt.emoji}</span>
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

function ReviewStep({ name, region, currency, startDate, endDate, workWeek,
  parties, generatedGraph, validationErrors }: {
  name: string; region: string; currency: string;
  startDate?: Date; endDate?: Date; workWeek: WorkWeek;
  parties: PartyEntry[]; generatedGraph: { nodes: any[]; edges: any[] };
  validationErrors: string[];
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

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted/30 rounded-lg space-y-1.5">
          <h4 className="text-xs font-semibold">Project</h4>
          <Row label="Name" value={name} />
          <Row label="Region / Currency" value={`${region} / ${currency}`} />
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
    <div className="rounded-lg border border-border bg-muted/20 flex flex-col h-full overflow-hidden">
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
          <svg width={panelW} height={svgH} className="block">
            <defs>
              <marker id="arrow-side" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                <polygon points="0 0, 7 2.5, 0 5" fill="#94a3b8" />
              </marker>
            </defs>

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
                  fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2"
                  markerEnd="url(#arrow-side)" opacity={0.5} />
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
                <g key={p.id}>
                  <rect x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={5}
                    fill="white" stroke={opt.color} strokeWidth="1.5" />
                  <text x={pos.x + 6} y={pos.y + nodeH / 2 + 1} fontSize="9"
                    dominantBaseline="middle" fill="#374151" fontWeight="500">
                    {opt.emoji} {label.slice(0, maxChars)}{label.length > maxChars ? '…' : ''}
                  </text>
                  {p.people.length > 0 && (
                    <>
                      <circle cx={pos.x + nodeW - 8} cy={pos.y + 8} r={6} fill={opt.color} opacity={0.15} />
                      <text x={pos.x + nodeW - 8} y={pos.y + 8} fontSize="7"
                        textAnchor="middle" dominantBaseline="central" fill={opt.color} fontWeight="600">
                        {p.people.length}
                      </text>
                      {hiddenCount > 0 && (
                        <title>{visibleCount} visible, {hiddenCount} hidden from chain</title>
                      )}
                    </>
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