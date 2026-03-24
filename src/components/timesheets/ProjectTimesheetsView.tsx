/**
 * ProjectTimesheetsView — Store-Powered, Clean
 *
 * Design philosophy: HOURS are the hero. Tasks are descriptive labels.
 * Time details (start/end/break) are optional, collapsed by default.
 * Drag-and-drop to copy days within a week.
 *
 * Features:
 * - Persona-aware filtering
 * - Org-grouped collapsible sections (for admin/org/client)
 * - Calendar + List view modes
 * - Click day cell → simplified Day Edit Popup (hours-first)
 * - Drag day cell → drop on another day to copy
 * - Click row arrow → detail drawer
 * - Quick inline approve/recall on hover
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, LayoutList,
  CheckCircle2, Clock, CircleDot, AlertCircle, ThumbsUp,
  ThumbsDown, Pencil, Send, Save, Undo2, MessageSquare,
  X, Network, ChevronDown, ChevronRight as ChevronRt, Eye,
  ArrowRight, StickyNote, Timer, Coffee, Plus, Trash2,
  Zap, Copy, GripVertical, ChevronUp,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { useTimesheetStore } from '../../contexts/TimesheetDataContext';
import { sumWeekHours } from '../../types/timesheets';
import type { StoredWeek, StoredDay, WeekStatus, DayTask, TimeEntry, TimeCategory } from '../../contexts/TimesheetDataContext';
import { usePersona, TEST_PERSONAS } from '../../contexts/PersonaContext';
import { useMonthContextSafe } from '../../contexts/MonthContext';
import { useNotificationStore } from '../../contexts/NotificationContext';
import { ApprovalChainTracker, ApprovalChainEmpty } from '../notifications/ApprovalChainTracker';

// ============================================================================
// Person / Org helpers — graph-aware resolution
// ============================================================================

type NameDirEntry = { name: string; type: string; orgId?: string };
type NameDir = Record<string, NameDirEntry>;

let activeProjectId = '';
let cachedNameDir: NameDir | null = null;
let cachedOrgMap: Record<string, OrgInfo> | null = null;

function getNameDir(): NameDir {
  if (!activeProjectId) return {};
  if (cachedNameDir) return cachedNameDir;
  try {
    const raw = sessionStorage.getItem(`workgraph-name-dir:${activeProjectId}`);
    cachedNameDir = raw ? JSON.parse(raw) : {};
    return cachedNameDir!;
  } catch {
    return {};
  }
}

function personName(id: string): string {
  const entry = getNameDir()[id];
  if (entry?.name) return entry.name;
  const persona = TEST_PERSONAS.find(t => t.id === id);
  if (persona?.name) return persona.name;
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 24);
}
function personInitials(id: string): string {
  return personName(id).split(' ').map(n => n[0]).join('');
}
function personOrgId(id: string): string | undefined {
  return getNameDir()[id]?.orgId ?? TEST_PERSONAS.find(t => t.id === id)?.graphOrgId;
}
function personViewerType(id: string): string | undefined {
  return TEST_PERSONAS.find(t => t.id === id)?.graphViewerType;
}

interface OrgInfo { id: string; name: string; color: string; bgColor: string; }

function getOrgMap(): Record<string, OrgInfo> {
  if (cachedOrgMap) return cachedOrgMap;
  const PALETTE: Array<[string, string]> = [
    ['text-blue-700', 'bg-blue-100'],
    ['text-purple-700', 'bg-purple-100'],
    ['text-amber-700', 'bg-amber-100'],
    ['text-rose-700', 'bg-rose-100'],
    ['text-cyan-700', 'bg-cyan-100'],
    ['text-pink-700', 'bg-pink-100'],
  ];
  const map: Record<string, OrgInfo> = {};
  let colorIdx = 0;

  Object.entries(getNameDir()).forEach(([id, entry]) => {
    if (entry.type === 'party' && !map[id]) {
      const [color, bgColor] = PALETTE[colorIdx % PALETTE.length];
      map[id] = { id, name: entry.name, color, bgColor };
      colorIdx++;
    }
  });

  if (Object.keys(map).length === 0) {
    map['org-acme'] = { id: 'org-acme', name: 'Acme Dev Studio', color: 'text-blue-700', bgColor: 'bg-blue-100' };
    map['org-brightworks'] = { id: 'org-brightworks', name: 'BrightWorks Design', color: 'text-purple-700', bgColor: 'bg-purple-100' };
  }
  map['__freelancers__'] = { id: '__freelancers__', name: 'Independent Freelancers', color: 'text-emerald-700', bgColor: 'bg-emerald-100' };
  map['__other__'] = { id: '__other__', name: 'Other', color: 'text-slate-700', bgColor: 'bg-slate-100' };
  
  cachedOrgMap = map;
  return map;
}

function getOrgForPerson(pid: string): OrgInfo {
  const map = getOrgMap();
  const oid = personOrgId(pid);
  if (oid && map[oid]) return map[oid];
  if (personViewerType(pid) === 'freelancer') return map['__freelancers__'];
  return map['__other__'] ?? { id: '__other__', name: 'Other', color: 'text-slate-700', bgColor: 'bg-slate-100' };
}

// ============================================================================
// Status helpers
// ============================================================================

const STATUS_ICON: Record<WeekStatus, React.ReactNode> = {
  draft: <CircleDot className="h-3.5 w-3.5 text-slate-400" />,
  submitted: <Clock className="h-3.5 w-3.5 text-blue-500" />,
  approved: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  rejected: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
};
const STATUS_LABEL: Record<WeekStatus, string> = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected' };
const STATUS_COLOR: Record<WeekStatus, string> = {
  draft: 'text-slate-500 bg-slate-50 border-slate-200',
  submitted: 'text-blue-600 bg-blue-50 border-blue-200',
  approved: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  rejected: 'text-red-600 bg-red-50 border-red-200',
};

// ============================================================================
// Quick hour presets (simple, no time confusion)
// ============================================================================

const HOUR_PRESETS = [8, 6, 4, 2, 0] as const;

function calcHoursFromTime(start: string, end: string, breakMins: number): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm) - breakMins;
  return Math.max(0, Math.round((totalMinutes / 60) * 10) / 10);
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

// ============================================================================
// Props
// ============================================================================

interface ProjectTimesheetsViewProps {
  projectId: string;
  ownerId: string;
  ownerName: string;
  contractors: any[];
  hourlyRate?: number;
  viewerOverride?: {
    id: string;
    type: 'admin' | 'company' | 'agency' | 'client' | 'freelancer';
    name: string;
    orgId?: string;
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectTimesheetsView({ projectId, viewerOverride }: ProjectTimesheetsViewProps) {
  if (activeProjectId !== projectId) {
    activeProjectId = projectId;
    cachedNameDir = null;
    cachedOrgMap = null;
  }

  const store = useTimesheetStore();
  const { currentPersona } = usePersona();
  const { selectedMonth, setSelectedMonth } = useMonthContextSafe();

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set(['org-acme', 'org-brightworks', '__freelancers__', '__other__']));
  const [drawerWeek, setDrawerWeek] = useState<{ personId: string; weekStart: string } | null>(null);

  // Day popup
  const [dayPopup, setDayPopup] = useState<{
    personId: string; weekStart: string; dayIndex: number; anchorRect: DOMRect;
  } | null>(null);

  // Drag state for copy-between-days
  const [dragSource, setDragSource] = useState<{
    personId: string; weekStart: string; dayIndex: number; day: StoredDay;
  } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  // Month helpers
  const monthKey = useMemo(() => {
    const d = selectedMonth instanceof Date ? selectedMonth : new Date(selectedMonth);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);
  const monthLabel = useMemo(() => {
    const d = selectedMonth instanceof Date ? selectedMonth : new Date(selectedMonth);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);
  const goMonth = useCallback((delta: number) => {
    const d = selectedMonth instanceof Date ? new Date(selectedMonth) : new Date(selectedMonth);
    d.setMonth(d.getMonth() + delta);
    setSelectedMonth(d);
  }, [selectedMonth, setSelectedMonth]);

  const storedViewerMeta = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(`workgraph-viewer-meta:${projectId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.nodeId && parsed?.type) return parsed;
      return null;
    } catch {
      return null;
    }
  }, [projectId]);

  const viewerId = viewerOverride?.id || storedViewerMeta?.nodeId || currentPersona?.id;
  const viewerType = viewerOverride?.type || storedViewerMeta?.type || currentPersona?.graphViewerType;
  const viewerOrgId = viewerOverride?.orgId || storedViewerMeta?.orgId;
  const isPersonViewer = Boolean(viewerOrgId);
  const isAdmin = viewerType === 'admin' || currentPersona?.role === 'admin';
  const isMultiPersonViewer =
    !isPersonViewer && (
      isAdmin ||
      viewerType === 'company' ||
      viewerType === 'agency' ||
      viewerType === 'client' ||
      viewerId?.startsWith('org-') ||
      viewerId?.startsWith('client-')
    );

  // Persona-filtered weeks
  const { orgGroups, flatPersonWeeks } = useMemo(() => {
    const allWeeks = store.getAllWeeksForMonth(monthKey);
    let filtered: StoredWeek[];
    if (isAdmin) filtered = allWeeks;
    else if (viewerId?.startsWith('org-')) filtered = allWeeks.filter(w => personOrgId(w.personId) === viewerId);
    else if (viewerId?.startsWith('client-')) filtered = allWeeks;
    else if (viewerId) filtered = allWeeks.filter(w => w.personId === viewerId);
    else filtered = allWeeks;

    const byPerson = new Map<string, StoredWeek[]>();
    filtered.forEach(w => { const arr = byPerson.get(w.personId) || []; arr.push(w); byPerson.set(w.personId, arr); });
    const flatPW = [...byPerson.entries()].sort((a, b) => personName(a[0]).localeCompare(personName(b[0])));

    const byOrg = new Map<string, { org: OrgInfo; people: [string, StoredWeek[]][] }>();
    flatPW.forEach(([pid, weeks]) => {
      const org = getOrgForPerson(pid);
      const existing = byOrg.get(org.id) || { org, people: [] };
      existing.people.push([pid, weeks]);
      byOrg.set(org.id, existing);
    });

    return { orgGroups: [...byOrg.values()], flatPersonWeeks: flatPW };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.version, monthKey, viewerId, isAdmin]);

  // Stats
  const totalHours = flatPersonWeeks.reduce((s, [, ws]) => s + ws.reduce((a, w) => a + sumWeekHours(w), 0), 0);
  const approvedHours = flatPersonWeeks.reduce((s, [, ws]) => s + ws.filter(w => w.status === 'approved').reduce((a, w) => a + sumWeekHours(w), 0), 0);
  const submittedCount = flatPersonWeeks.reduce((s, [, ws]) => s + ws.filter(w => w.status === 'submitted').length, 0);

  const viewInGraph = () => {
    window.dispatchEvent(new CustomEvent('changeTab', { detail: 'project-graph' }));
    toast.success('Opening Project Graph');
  };

  const canSeedMonth = Boolean(viewerId && (isPersonViewer || !isMultiPersonViewer));
  const handleSeedMonth = useCallback(() => {
    if (!viewerId) return;
    const created = store.seedMonthForPerson(viewerId, monthKey);
    if (created > 0) {
      toast.success(`Created ${created} draft week${created === 1 ? '' : 's'} for ${monthLabel}`);
      return;
    }
    toast.info(`Draft weeks already exist for ${monthLabel}`);
  }, [viewerId, store, monthKey, monthLabel]);

  const viewingAs = viewerOverride?.name
    ? `${viewerOverride.name}${isAdmin ? ' (Admin)' : ''}`
    : isAdmin ? 'All people (Admin)'
      : viewerId?.startsWith('org-') ? `${personName(viewerId)} employees`
      : viewerId?.startsWith('client-') ? 'All people (Client)'
      : currentPersona?.name ?? 'Unknown';

  const drawerWeekData = useMemo(() => {
    if (!drawerWeek) return null;
    const weeks = store.getWeeksForPerson(drawerWeek.personId, monthKey);
    return weeks.find(w => w.weekStart === drawerWeek.weekStart) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerWeek, store.version, monthKey]);

  const dayPopupData = useMemo(() => {
    if (!dayPopup) return null;
    const weeks = store.getWeeksForPerson(dayPopup.personId, monthKey);
    const week = weeks.find(w => w.weekStart === dayPopup.weekStart);
    if (!week) return null;
    return { week, day: week.days[dayPopup.dayIndex], dayIndex: dayPopup.dayIndex };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayPopup, store.version, monthKey]);

  const canEditDay = useCallback((personId: string, weekStatus: WeekStatus) => {
    const isOwn = viewerId === personId;
    return isOwn && (weekStatus === 'draft' || weekStatus === 'rejected');
  }, [viewerId]);

  const handleDayClick = useCallback((e: React.MouseEvent, personId: string, weekStart: string, dayIndex: number, weekStatus: WeekStatus) => {
    e.stopPropagation();
    if (!canEditDay(personId, weekStatus)) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDayPopup({ personId, weekStart, dayIndex, anchorRect: rect });
  }, [canEditDay]);

  // Drag-and-drop handlers
  const handleDragStart = useCallback((personId: string, weekStart: string, dayIndex: number, day: StoredDay) => {
    setDragSource({ personId, weekStart, dayIndex, day });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverDay(dayIndex);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDay(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, personId: string, weekStart: string, targetDayIndex: number) => {
    e.preventDefault();
    setDragOverDay(null);
    if (!dragSource) return;
    if (dragSource.personId !== personId || dragSource.weekStart !== weekStart) return;
    if (dragSource.dayIndex === targetDayIndex) return;

    const copiedDay: StoredDay = {
      ...dragSource.day,
      day: DAY_LABELS[targetDayIndex],
      tasks: dragSource.day.tasks?.map(t => ({ ...t, id: `task-${Date.now()}-${Math.random()}` })),
    };
    store.updateSingleDay(personId, weekStart, targetDayIndex, copiedDay);
    toast.success(`Copied ${dragSource.day.day} → ${DAY_LABELS[targetDayIndex]}`);
    setDragSource(null);
  }, [dragSource, store]);

  const handleDragEnd = useCallback(() => {
    setDragSource(null);
    setDragOverDay(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Project Timesheets</h2>
          <p className="text-sm text-muted-foreground">Synced with Project Graph</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] gap-1"><Eye className="h-3 w-3" /> {viewingAs}</Badge>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={viewInGraph}>
            <Network className="h-3.5 w-3.5" /> Graph
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 py-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold px-2 min-w-[130px] text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
          {([['calendar', CalendarDays, 'Calendar'], ['list', LayoutList, 'List']] as const).map(([m, Icon, label]) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === m ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}><Icon className="h-3.5 w-3.5" /> {label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs"><span className="font-semibold">{totalHours}h</span> total</span>
          <div className="h-3 w-px bg-border" />
          <span className="text-xs text-emerald-600 font-medium">{approvedHours}h approved</span>
          {submittedCount > 0 && (
            <><div className="h-3 w-px bg-border" /><Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">{submittedCount} pending</Badge></>
          )}
        </div>
      </div>

      {/* Empty */}
      {flatPersonWeeks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No timesheet data for {monthLabel}</p>
          {canSeedMonth && (
            <>
              <p className="text-xs mt-2 mb-3">Create draft weeks first, then click day cells to add hours.</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSeedMonth}>
                <Plus className="h-3.5 w-3.5" />
                Create Draft Weeks
              </Button>
            </>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && flatPersonWeeks.length > 0 && (
        <div className="space-y-3">
          {isMultiPersonViewer ? (
            orgGroups.map(({ org, people }) => {
              const orgExpanded = expandedOrgs.has(org.id);
              const orgTotal = people.reduce((s, [, ws]) => s + ws.reduce((a, w) => a + sumWeekHours(w), 0), 0);
              const orgSubmitted = people.reduce((s, [, ws]) => s + ws.filter(w => w.status === 'submitted').length, 0);
              return (
                <div key={org.id} className="border rounded-xl overflow-hidden">
                  <div className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none transition-colors hover:bg-muted/30 ${orgExpanded ? 'border-b' : ''}`}
                    onClick={() => setExpandedOrgs(prev => { const n = new Set(prev); n.has(org.id) ? n.delete(org.id) : n.add(org.id); return n; })}>
                    {orgExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRt className="h-4 w-4 text-muted-foreground" />}
                    <div className={`w-6 h-6 rounded-md ${org.bgColor} ${org.color} flex items-center justify-center text-[10px] font-bold`}>{org.name[0]}</div>
                    <span className="text-sm font-semibold flex-1">{org.name}</span>
                    <span className="text-xs text-muted-foreground">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
                    <div className="h-3 w-px bg-border" />
                    <span className="text-xs font-medium">{orgTotal}h</span>
                    {orgSubmitted > 0 && <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200 ml-1">{orgSubmitted} pending</Badge>}
                  </div>
                  {orgExpanded && (
                    <div className="divide-y">
                      {people.map(([pid, weeks]) => (
                        <PersonSection key={pid} personId={pid} weeks={weeks} viewerId={viewerId} isAdmin={isAdmin} store={store}
                          onClickWeek={(ws) => setDrawerWeek({ personId: pid, weekStart: ws })}
                          onClickDay={(e, ws, di, status) => handleDayClick(e, pid, ws, di, status)}
                          canEditDay={(ws) => canEditDay(pid, ws)}
                          onViewInGraph={viewInGraph}
                          onDragStart={(ws, di, d) => handleDragStart(pid, ws, di, d)}
                          onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                          onDrop={(e, ws, di) => handleDrop(e, pid, ws, di)} onDragEnd={handleDragEnd}
                          dragSource={dragSource} dragOverDay={dragOverDay} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            flatPersonWeeks.map(([pid, weeks]) => (
              <div key={pid} className="border rounded-xl overflow-hidden">
                <PersonSection personId={pid} weeks={weeks} viewerId={viewerId} isAdmin={isAdmin} store={store}
                  onClickWeek={(ws) => setDrawerWeek({ personId: pid, weekStart: ws })}
                  onClickDay={(e, ws, di, status) => handleDayClick(e, pid, ws, di, status)}
                  canEditDay={(ws) => canEditDay(pid, ws)}
                  onViewInGraph={viewInGraph}
                  onDragStart={(ws, di, d) => handleDragStart(pid, ws, di, d)}
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                  onDrop={(e, ws, di) => handleDrop(e, pid, ws, di)} onDragEnd={handleDragEnd}
                  dragSource={dragSource} dragOverDay={dragOverDay} />
              </div>
            ))
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && flatPersonWeeks.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b text-left">
                <th className="px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Person</th>
                <th className="px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Week</th>
                {DAY_LABELS.map(d => <th key={d} className="px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{d}</th>)}
                <th className="px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-right">Total</th>
                <th className="px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {flatPersonWeeks.map(([pid, weeks]) =>
                weeks.map((w, wi) => (
                  <tr key={`${pid}-${w.weekStart}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDrawerWeek({ personId: pid, weekStart: w.weekStart })}>
                    {wi === 0 && (
                      <td rowSpan={weeks.length} className="px-4 py-2 border-r align-top">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full ${getOrgForPerson(pid).bgColor} ${getOrgForPerson(pid).color} flex items-center justify-center text-[10px] font-bold`}>{personInitials(pid)}</div>
                          <div><div className="font-medium text-xs">{personName(pid)}</div><div className="text-[10px] text-muted-foreground">{getOrgForPerson(pid).name}</div></div>
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs font-medium whitespace-nowrap">{w.weekLabel}</td>
                    {w.days.map((d, di) => (
                      <td key={di} className={`px-3 py-2 text-xs text-center font-medium ${d.hours === 0 ? 'text-slate-300' : 'text-foreground'} ${canEditDay(pid, w.status) ? 'cursor-pointer hover:bg-blue-50 rounded' : ''}`}
                        onClick={canEditDay(pid, w.status) ? (e) => { e.stopPropagation(); handleDayClick(e, pid, w.weekStart, di, w.status); } : undefined}>
                        {d.hours}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-xs font-semibold text-right">{sumWeekHours(w)}h</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[w.status]}`}>{STATUS_LABEL[w.status]}</Badge></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Day Edit Popup */}
      {dayPopup && dayPopupData && (
        <DayEditPopup
          day={dayPopupData.day}
          dayIndex={dayPopupData.dayIndex}
          week={dayPopupData.week}
          anchorRect={dayPopup.anchorRect}
          drawerOpen={!!drawerWeek}
          onSave={(updatedDay) => {
            store.updateSingleDay(dayPopup.personId, dayPopup.weekStart, dayPopup.dayIndex, updatedDay);
            toast.success(`${dayPopupData.day.day} → ${updatedDay.hours}h`);
            setDayPopup(null);
          }}
          onCopyToAll={(updatedDay) => {
            const newDays = dayPopupData.week.days.map((d, i) => ({
              ...updatedDay,
              day: DAY_LABELS[i],
              tasks: updatedDay.tasks?.map(t => ({ ...t, id: `task-${Date.now()}-${i}-${Math.random()}` })),
            }));
            store.updateWeekDays(dayPopup.personId, dayPopup.weekStart, newDays);
            toast.success(`Applied to all days — ${updatedDay.hours}h × 5`);
            setDayPopup(null);
          }}
          onCopyToRest={(updatedDay) => {
            for (let i = dayPopup.dayIndex + 1; i < 5; i++) {
              const copiedDay: StoredDay = {
                ...updatedDay,
                day: DAY_LABELS[i],
                tasks: updatedDay.tasks?.map(t => ({ ...t, id: `task-${Date.now()}-${i}-${Math.random()}` })),
              };
              store.updateSingleDay(dayPopup.personId, dayPopup.weekStart, i, copiedDay);
            }
            toast.success(`Copied to ${DAY_LABELS[dayPopup.dayIndex]}–Fri`);
            setDayPopup(null);
          }}
          onClose={() => setDayPopup(null)}
        />
      )}

      {/* Detail Drawer */}
      {drawerWeek && drawerWeekData && (
        <WeekDetailDrawer
          week={drawerWeekData} personId={drawerWeek.personId}
          allWeeks={store.getWeeksForPerson(drawerWeek.personId, monthKey)}
          viewerId={viewerId} isAdmin={isAdmin} store={store}
          onClose={() => setDrawerWeek(null)}
          onNavigateWeek={(ws) => setDrawerWeek(prev => prev ? { ...prev, weekStart: ws } : null)}
          onViewInGraph={viewInGraph}
          onOpenDayPopup={(dayIndex, rect) => {
            setDayPopup({ personId: drawerWeek.personId, weekStart: drawerWeek.weekStart, dayIndex, anchorRect: rect });
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Person Section (with draggable day cells)
// ============================================================================

function PersonSection({
  personId, weeks, viewerId, isAdmin, store, onClickWeek, onClickDay, canEditDay, onViewInGraph,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, dragSource, dragOverDay,
}: {
  personId: string;
  weeks: StoredWeek[];
  viewerId?: string;
  isAdmin: boolean;
  store: ReturnType<typeof useTimesheetStore>;
  onClickWeek: (weekStart: string) => void;
  onClickDay: (e: React.MouseEvent, weekStart: string, dayIndex: number, weekStatus: WeekStatus) => void;
  canEditDay: (weekStatus: WeekStatus) => boolean;
  onViewInGraph: () => void;
  onDragStart: (weekStart: string, dayIndex: number, day: StoredDay) => void;
  onDragOver: (e: React.DragEvent, dayIndex: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, weekStart: string, targetDayIndex: number) => void;
  onDragEnd: () => void;
  dragSource: { personId: string; weekStart: string; dayIndex: number; day: StoredDay } | null;
  dragOverDay: number | null;
}) {
  const isOwn = viewerId === personId;
  const isApprover = isAdmin || (!isOwn && (viewerId?.startsWith('org-') || viewerId?.startsWith('client-')));
  const total = weeks.reduce((s, w) => s + sumWeekHours(w), 0);
  const approved = weeks.filter(w => w.status === 'approved').reduce((s, w) => s + sumWeekHours(w), 0);
  const notifStore = useNotificationStore();

  const fireStatusChange = useCallback((w: StoredWeek, newStatus: WeekStatus, meta?: { by?: string; note?: string }) => {
    store.setWeekStatus(personId, w.weekStart, newStatus, meta);
    notifStore.onTimesheetStatusChange(personId, w.weekStart, w.weekLabel, newStatus, sumWeekHours(w), meta);
  }, [store, notifStore, personId]);

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-2 bg-muted/10">
        <div className={`w-7 h-7 rounded-full ${getOrgForPerson(personId).bgColor} ${getOrgForPerson(personId).color} flex items-center justify-center text-[10px] font-bold`}>{personInitials(personId)}</div>
        <div className="flex-1 min-w-0"><div className="text-xs font-semibold">{personName(personId)}</div></div>
        <div className="text-right mr-2">
          <span className="text-xs font-semibold">{total}h</span>
          <span className="text-[10px] text-emerald-600 ml-1.5">({approved}h ✓)</span>
        </div>
        {isOwn && <Badge variant="outline" className="text-[8px] h-4">You</Badge>}
        <button onClick={onViewInGraph} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-blue-600 transition-colors" title="View in Graph"><Network className="h-3.5 w-3.5" /></button>
        {isApprover && weeks.some(w => w.status === 'submitted') && (
          <button onClick={() => { const ct = store.batchApproveMonth(personId, weeks[0].weekStart.slice(0, 7), personName(viewerId || '')); toast.success(`Approved ${ct} weeks`); }}
            className="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition-colors" title="Approve all"><CheckCircle2 className="h-3.5 w-3.5" /></button>
        )}
      </div>

      {weeks.map(w => {
        const weekTotal = sumWeekHours(w);
        const editable = canEditDay(w.status);
        const isDragWeek = dragSource?.personId === personId && dragSource?.weekStart === w.weekStart;

        return (
          <div key={w.weekStart} className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted/20 transition-colors cursor-pointer group border-t border-dashed border-muted/40"
            onClick={() => onClickWeek(w.weekStart)}>
            <div className="w-5 flex justify-center">{STATUS_ICON[w.status]}</div>
            <div className="w-16 text-[11px] font-medium">{w.weekLabel}</div>

            <div className="flex-1 grid grid-cols-5 gap-1">
              {w.days.map((d, di) => {
                const isDragSrc = isDragWeek && dragSource?.dayIndex === di;
                const isDragTarget = isDragWeek && dragOverDay === di && dragSource?.dayIndex !== di;

                return (
                  <div key={di}
                    draggable={editable && d.hours > 0}
                    onDragStart={editable ? (e) => {
                      e.stopPropagation();
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('text/plain', ''); // Required for Firefox
                      onDragStart(w.weekStart, di, d);
                    } : undefined}
                    onDragOver={editable ? (e) => { e.stopPropagation(); onDragOver(e, di); } : undefined}
                    onDragLeave={editable ? onDragLeave : undefined}
                    onDrop={editable ? (e) => { e.stopPropagation(); onDrop(e, w.weekStart, di); } : undefined}
                    onDragEnd={onDragEnd}
                    className={`text-center rounded-md px-1 py-0.5 transition-all relative ${
                      editable ? 'cursor-pointer hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 active:scale-95' : ''
                    } ${isDragSrc ? 'opacity-40 ring-1 ring-blue-300 bg-blue-50' : ''}
                    ${isDragTarget ? 'ring-2 ring-blue-400 bg-blue-100 scale-105' : ''}`}
                    onClick={editable ? (e) => onClickDay(e, w.weekStart, di, w.status) : undefined}
                    title={editable ? ((d.totalHours ?? d.hours) > 0 ? `Click to edit • Drag to copy` : `Click to add hours`) : `${d.day}: ${d.totalHours ?? d.hours}h`}
                  >
                    {editable && (d.totalHours ?? d.hours) > 0 && (
                      <div className="absolute -top-0.5 -left-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity">
                        <GripVertical className="h-2.5 w-2.5 text-slate-400" />
                      </div>
                    )}
                    <div className="text-[8px] text-muted-foreground font-medium">{d.day}</div>
                    <div className={`text-[11px] font-semibold ${d.totalHours === 0 && d.hours === 0 ? 'text-slate-300' : 'text-foreground'}`}>{d.totalHours ?? d.hours}h</div>
                    <div className="h-0.5 mt-0.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${(d.totalHours ?? d.hours) >= 8 ? 'bg-blue-400' : (d.totalHours ?? d.hours) > 0 ? 'bg-blue-300' : ''}`}
                        style={{ width: `${Math.min(((d.totalHours ?? d.hours) / 10) * 100, 100)}%` }} />
                    </div>
                    {isDragTarget && (
                      <div className="absolute inset-0 flex items-center justify-center bg-blue-200/60 rounded-md">
                        <Copy className="h-3 w-3 text-blue-700" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="w-10 text-right text-xs font-semibold">{weekTotal}h</div>
            <Badge variant="outline" className={`text-[9px] w-16 justify-center ${STATUS_COLOR[w.status]}`}>{STATUS_LABEL[w.status]}</Badge>

            <div className="flex items-center gap-0.5 w-14 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              {isApprover && w.status === 'submitted' && (
                <button onClick={() => { fireStatusChange(w, 'approved', { by: personName(viewerId || '') }); toast.success(`Approved ${w.weekLabel}`); }}
                  className="p-1 rounded hover:bg-emerald-100 text-emerald-600"><ThumbsUp className="h-3 w-3" /></button>
              )}
              {isOwn && w.status === 'submitted' && (
                <button onClick={() => { fireStatusChange(w, 'draft'); toast.info(`Recalled ${w.weekLabel}`); }}
                  className="p-1 rounded hover:bg-amber-100 text-amber-500"><Undo2 className="h-3 w-3" /></button>
              )}
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Day Edit Popup — Hours-first design
// ============================================================================

function DayEditPopup({
  day, dayIndex, week, anchorRect, drawerOpen, onSave, onCopyToAll, onCopyToRest, onClose,
}: {
  day: StoredDay;
  dayIndex: number;
  week: StoredWeek;
  anchorRect: DOMRect;
  drawerOpen: boolean;
  onSave: (updatedDay: StoredDay) => void;
  onCopyToAll: (updatedDay: StoredDay) => void;
  onCopyToRest: (updatedDay: StoredDay) => void;
  onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  
  // Phase 3.5 Multi-Category State
  const initialEntries = day.entries?.length ? day.entries : [
    { id: `ent-${Date.now()}`, category: 'regular' as TimeCategory, hours: day.hours, billable: true }
  ];
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);

  const [description, setDescription] = useState(day.notes || '');
  const [showTimeDetails, setShowTimeDetails] = useState(!!(day.startTime && day.endTime));
  const [startTime, setStartTime] = useState(day.startTime || '09:00');
  const [endTime, setEndTime] = useState(day.endTime || '17:30');
  const [breakMinutes, setBreakMinutes] = useState(day.breakMinutes ?? 30);

  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);

  // No auto-focus needed for multi-entry
  useEffect(() => {}, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close/Save on keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, description, startTime, endTime, breakMinutes, showTimeDetails]);

  const popupStyle = useMemo(() => {
    const POPUP_W = 300;
    const POPUP_H = 400;
    const DRAWER_W = drawerOpen ? 448 : 0; // max-w-md = 28rem = 448px
    const availableRight = window.innerWidth - DRAWER_W;

    // Vertical: prefer below anchor, but clamp so popup stays visible
    const top = Math.max(8, Math.min(anchorRect.bottom + 8, window.innerHeight - POPUP_H));

    // Horizontal: center on anchor, but clamp to available space (left of drawer)
    const idealLeft = anchorRect.left + anchorRect.width / 2 - POPUP_W / 2;
    const left = Math.max(8, Math.min(idealLeft, availableRight - POPUP_W - 16));

    return { top: `${top}px`, left: `${left}px` };
  }, [anchorRect, drawerOpen]);

  const applyTimeCalc = () => {
    const calc = calcHoursFromTime(startTime, endTime, breakMinutes);
    if (!entries.find(e => e.category === 'regular')) {
      setEntries([...entries, { id: `ent-${Date.now()}`, category: 'regular' as TimeCategory, hours: calc, billable: true }]);
    } else {
      setEntries(entries.map(e => e.category === 'regular' ? { ...e, hours: calc } : e));
    }
  };

  const buildDay = (): StoredDay => ({
    ...day,
    hours: totalHours, // legacy fallback
    totalHours,
    entries,
    startTime: showTimeDetails ? startTime : undefined,
    endTime: showTimeDetails ? endTime : undefined,
    breakMinutes: showTimeDetails ? breakMinutes : undefined,
    notes: description || undefined,
  });

  const handleSave = () => onSave(buildDay());

  return (
    <>
      <div className="fixed inset-0 z-40" />
      <div ref={popupRef} style={popupStyle}
        className="fixed z-[60] w-[300px] bg-white rounded-xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        
        {/* Header with big hours */}
        <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold">{day.day}</div>
              <div className="text-[10px] text-muted-foreground">{week.weekLabel}</div>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* PHASE 3.5: Multi-Category Entries */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Time Entries</label>
              <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{totalHours}h Total</div>
            </div>
            <div className="space-y-2">
              {['regular', 'overtime', 'travel'].map(cat => {
                const entry = entries.find(e => e.category === cat) || { hours: 0 };
                const isSelected = entry.hours > 0;
                return (
                  <div key={cat} className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${isSelected ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                    <div className="w-20 text-[11px] font-medium capitalize text-slate-600 pl-1">{cat}</div>
                    <input type="number" min={0} max={24} step={0.5} value={entry.hours || ''} placeholder="0"
                      onChange={e => {
                        const val = Math.max(0, Math.min(24, Number(e.target.value)));
                        if (entries.find(ex => ex.category === cat)) {
                          setEntries(entries.map(ex => ex.category === cat ? { ...ex, hours: val } : ex));
                        } else {
                          setEntries([...entries, { id: `ent-${Date.now()}-${cat}`, category: cat as TimeCategory, hours: val, billable: true }]);
                        }
                      }}
                      className="w-16 h-8 text-center text-sm font-bold rounded-md border focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none" />
                    <span className="text-[10px] text-muted-foreground mr-1">h</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What I worked on (descriptive, not time-splitting) */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">What I worked on</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Frontend dev, API integration, Code review..."
              className="w-full h-9 px-3 text-xs rounded-lg border focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none" />
          </div>

          {/* Time details — collapsible */}
          <div className="border rounded-lg overflow-hidden">
            <button onClick={() => setShowTimeDetails(!showTimeDetails)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:bg-muted/30 transition-colors">
              <Timer className="h-3 w-3" />
              <span className="flex-1 text-left">Time Details</span>
              <span className="text-[9px] font-normal normal-case tracking-normal">{showTimeDetails ? 'optional' : 'expand if needed'}</span>
              {showTimeDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showTimeDetails && (
              <div className="px-3 pb-3 pt-1 border-t space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground block mb-0.5">Start</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                      className="w-full h-7 px-1.5 text-[11px] rounded border focus:border-blue-400 outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground block mb-0.5">End</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                      className="w-full h-7 px-1.5 text-[11px] rounded border focus:border-blue-400 outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground block mb-0.5">Break</label>
                    <div className="relative">
                      <input type="number" min={0} max={120} value={breakMinutes} onChange={e => setBreakMinutes(Number(e.target.value))}
                        className="w-full h-7 px-1.5 pr-7 text-[11px] rounded border focus:border-blue-400 outline-none" />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">m</span>
                    </div>
                  </div>
                </div>
                <button onClick={applyTimeCalc}
                  className="w-full flex items-center justify-center gap-1.5 h-7 text-[10px] font-medium text-blue-600 bg-blue-50 rounded border border-blue-200 hover:bg-blue-100 transition-colors">
                  <Zap className="h-3 w-3" /> Calculate: {calcHoursFromTime(startTime, endTime, breakMinutes)}h → Apply
                </button>
              </div>
            )}
          </div>

          {/* Copy actions */}
          {totalHours > 0 && dayIndex < 4 && (
            <div className="flex gap-1.5">
              <button onClick={() => onCopyToRest(buildDay())}
                className="flex-1 flex items-center justify-center gap-1 h-7 text-[10px] font-medium text-slate-600 bg-slate-50 rounded-md border hover:bg-slate-100 transition-colors">
                <Copy className="h-3 w-3" /> Copy → {DAY_LABELS[dayIndex]}–Fri
              </button>
              <button onClick={() => onCopyToAll(buildDay())}
                className="flex items-center justify-center gap-1 h-7 px-2.5 text-[10px] font-medium text-slate-600 bg-slate-50 rounded-md border hover:bg-slate-100 transition-colors">
                <Copy className="h-3 w-3" /> All
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center gap-2">
          <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Save {day.day}
          </Button>
          <span className="text-[9px] text-muted-foreground">↵ Enter</span>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Week Detail Drawer
// ============================================================================

function WeekDetailDrawer({
  week, personId, allWeeks, viewerId, isAdmin, store, onClose, onNavigateWeek, onViewInGraph, onOpenDayPopup,
}: {
  week: StoredWeek;
  personId: string;
  allWeeks: StoredWeek[];
  viewerId?: string;
  isAdmin: boolean;
  store: ReturnType<typeof useTimesheetStore>;
  onClose: () => void;
  onNavigateWeek: (weekStart: string) => void;
  onViewInGraph: () => void;
  onOpenDayPopup: (dayIndex: number, rect: DOMRect) => void;
}) {
  const notifStore = useNotificationStore();
  const isOwn = viewerId === personId;
  const canApprove = isAdmin || (!isOwn && (viewerId?.startsWith('org-') || viewerId?.startsWith('client-')));
  const canEdit = isOwn && (week.status === 'draft' || week.status === 'rejected');

  const [rejectMode, setRejectMode] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => { setRejectMode(false); }, [week.weekStart]);

  const weekTotal = sumWeekHours(week);
  const maxDay = Math.max(...week.days.map(d => d.hours), 1);

  const weekIdx = allWeeks.findIndex(w => w.weekStart === week.weekStart);
  const prevWeek = weekIdx > 0 ? allWeeks[weekIdx - 1] : null;
  const nextWeek = weekIdx < allWeeks.length - 1 ? allWeeks[weekIdx + 1] : null;

  // Wrapper: set status + fire notification
  const changeStatus = useCallback((newStatus: WeekStatus, meta?: { by?: string; note?: string }) => {
    store.setWeekStatus(personId, week.weekStart, newStatus, meta);
    notifStore.onTimesheetStatusChange(personId, week.weekStart, week.weekLabel, newStatus, weekTotal, meta);
  }, [store, notifStore, personId, week.weekStart, week.weekLabel, weekTotal]);

  // Get approval chain for this week
  const chain = notifStore.getChainForWeek(personId, week.weekStart);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b space-y-2">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full ${getOrgForPerson(personId).bgColor} ${getOrgForPerson(personId).color} flex items-center justify-center text-xs font-bold`}>{personInitials(personId)}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{personName(personId)}</div>
              <div className="text-[11px] text-muted-foreground">{getOrgForPerson(personId).name}</div>
            </div>
            <button onClick={onViewInGraph} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-500"><Network className="h-4 w-4" /></button>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!prevWeek} onClick={() => prevWeek && onNavigateWeek(prevWeek.weekStart)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <div className="flex-1 text-center">
              <span className="text-sm font-semibold">{week.weekLabel}</span>
              <span className="text-xs text-muted-foreground ml-2">• {weekTotal}h</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!nextWeek} onClick={() => nextWeek && onNavigateWeek(nextWeek.weekStart)}><ChevronRight className="h-3.5 w-3.5" /></Button>
            <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[week.status]}`}>{STATUS_ICON[week.status]}<span className="ml-1">{STATUS_LABEL[week.status]}</span></Badge>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Breakdown</h4>
              {canEdit && <span className="text-[9px] text-blue-500 font-medium">Click a day to edit</span>}
            </div>
            <div className="grid grid-cols-5 gap-3">
              {week.days.map((d, di) => (
                <div key={di}
                  className={`text-center rounded-lg p-1.5 transition-all ${
                    canEdit ? 'cursor-pointer hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 active:scale-95' : ''
                  }`}
                  onClick={canEdit ? (e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    onOpenDayPopup(di, rect);
                  } : undefined}>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">{d.day}</div>
                  <div className="h-16 flex items-end justify-center mb-1.5">
                    <div className={`w-8 rounded-t-md transition-all ${d.hours === 0 ? 'bg-slate-100' : d.hours >= 8 ? 'bg-blue-400' : 'bg-blue-300'}`}
                      style={{ height: `${Math.max((d.hours / maxDay) * 100, 4)}%` }} />
                  </div>
                  <div className={`text-sm font-bold ${d.hours === 0 ? 'text-slate-300' : ''}`}>{d.hours}h</div>
                  {d.startTime && d.endTime && <div className="text-[8px] text-muted-foreground mt-0.5">{d.startTime}–{d.endTime}</div>}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <span className="text-xs text-muted-foreground">Weekly total</span>
              <span className="text-lg font-bold text-blue-600">{weekTotal}h</span>
            </div>
          </div>

          <Separator />

          {/* Day detail cards */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Day Details</h4>
            <div className="space-y-2">
              {week.days.map((d, di) => (
                <div key={di}
                  className={`rounded-lg border p-3 transition-all ${d.hours > 0 ? 'bg-white' : 'bg-muted/20 border-dashed'} ${canEdit ? 'cursor-pointer hover:border-blue-200 hover:shadow-sm' : ''}`}
                  onClick={canEdit ? (e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    onOpenDayPopup(di, rect);
                  } : undefined}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${d.hours > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>{d.day}</div>
                      <div>
                        <div className={`text-sm font-semibold ${d.hours === 0 ? 'text-slate-400' : ''}`}>{d.hours}h</div>
                        {d.startTime && d.endTime && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Timer className="h-2.5 w-2.5" /> {d.startTime} – {d.endTime}
                            {d.breakMinutes ? <><Coffee className="h-2.5 w-2.5 ml-1" />{d.breakMinutes}m</> : null}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.hours > 0 && (
                        <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${d.hours >= 8 ? 'bg-blue-400' : 'bg-blue-300'}`}
                            style={{ width: `${Math.min((d.hours / 10) * 100, 100)}%` }} />
                        </div>
                      )}
                      {canEdit && <Pencil className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                  </div>
                  {d.notes && (
                    <div className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1 mt-2 flex items-start gap-1.5">
                      <StickyNote className="h-3 w-3 mt-0.5 flex-shrink-0" /> {d.notes}
                    </div>
                  )}
                  {d.hours === 0 && canEdit && <div className="text-[11px] text-blue-400 italic mt-1">Click to add hours</div>}
                  {d.hours === 0 && !canEdit && <div className="text-[11px] text-slate-400 italic mt-1">No hours logged</div>}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Tasks */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Week Tasks</h4>
            {week.tasks.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">{week.tasks.map((t, i) => <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>)}</div>
            ) : <span className="text-xs text-muted-foreground">No tasks recorded</span>}
          </div>

          <Separator />

          {/* Approval Chain Tracker */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Approval Chain</h4>
            {chain ? (
              <ApprovalChainTracker chain={chain} />
            ) : (
              <ApprovalChainEmpty personName={personName(personId)} />
            )}
          </div>

          {/* Approval history */}
          {(week.approvedBy || week.rejectedBy) && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Approval History</h4>
                {week.approvedBy && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approved by <strong>{week.approvedBy}</strong>
                  </div>
                )}
                {week.rejectedBy && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2"><AlertCircle className="h-3.5 w-3.5" /> Rejected by <strong>{week.rejectedBy}</strong></div>
                    {week.rejectionNote && <div className="text-xs text-red-500 bg-red-50/50 rounded-lg px-3 py-2 italic">"{week.rejectionNote}"</div>}
                  </div>
                )}
              </div>
            </>
          )}

          {rejectMode && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 uppercase tracking-wider"><MessageSquare className="h-3.5 w-3.5" /> Rejection Reason</div>
              <input type="text" value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Reason (optional)..." autoFocus
                className="w-full h-9 px-3 text-sm rounded-lg border border-red-200 focus:border-red-400 outline-none bg-white" />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" className="flex-1 h-9 text-xs gap-1.5" onClick={() => {
                  changeStatus('rejected', { by: personName(viewerId || ''), note: rejectNote });
                  setRejectMode(false);
                  toast.error(`Rejected ${week.weekLabel}`);
                }}><ThumbsDown className="h-3.5 w-3.5" /> Confirm</Button>
                <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setRejectMode(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-muted/20 flex items-center gap-2">
          {isOwn && week.status === 'draft' && weekTotal > 0 && (
            <Button size="sm" className="h-9 text-xs gap-1.5" onClick={() => { changeStatus('submitted'); toast.success(`Submitted ${week.weekLabel}`); }}>
              <Send className="h-3.5 w-3.5" /> Submit
            </Button>
          )}
          {isOwn && week.status === 'submitted' && (
            <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5 text-amber-600" onClick={() => { changeStatus('draft'); toast.info(`Recalled`); }}>
              <Undo2 className="h-3.5 w-3.5" /> Recall
            </Button>
          )}
          {canApprove && week.status === 'submitted' && !rejectMode && (
            <>
              <Button size="sm" className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => { changeStatus('approved', { by: personName(viewerId || '') }); toast.success(`Approved`); }}>
                <ThumbsUp className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectMode(true)}>
                <ThumbsDown className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={onClose}>Close</Button>
        </div>
      </div>
    </>
  );
}
