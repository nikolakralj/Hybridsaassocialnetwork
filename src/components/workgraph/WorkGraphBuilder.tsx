import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Building2,
  Users,
  User,
  FileText,
  Save,
  Loader2,
  Search,
  Shield,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  List,
  Network,
  ChevronRight,
  ChevronLeft,
  Lock,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileCheck,
  Receipt,
  UserCheck,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { TEMPLATES } from './templates';
import { useGraphPersistence } from '../hooks/useGraphPersistence';
import { ProjectCreateWizard } from './ProjectCreateWizard';
import {
  computeScopedView,
  buildViewerOptions,
  type ViewerIdentity,
  type VisibleNode,
  type VisibleEdge,
} from './graph-visibility';
import {
  MONTHLY_SNAPSHOTS,
  getSnapshotForMonth,
  getActivePeopleIds,
  getPersonMonthlyActivity,
  computeEdgeFlows,
  type MonthlySnapshot,
  type EdgeFlowSummary,
} from './graph-data-flows';
import { NodeDetailDrawer } from './NodeDetailDrawer';
import type {
  BaseNode,
  BaseEdge,
  CompiledProjectConfig,
} from '../../types/workgraph';
import type { PartyEntry } from '../../utils/graph/auto-generate';
import { getProject, updateProject } from '../../utils/api/projects-api';
import { useAuth } from '../../contexts/AuthContext';
import { migrateGraphForVisibility } from '../../utils/graph/migrate-graph';

// ============================================================================
// Layout Engine - Hierarchical Sugiyama-style
// ============================================================================

interface LayoutNode {
  id: string;
  type: string;
  data: any;
  layer: number;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  groupId?: string;
  visibility: 'full' | 'partial' | 'masked';
  hopDistance: number;
  monthlyActivity?: { hoursSubmitted: number; hoursApproved: number; status: string } | null;
}

interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  edgeType: string;
  sourcePort: { x: number; y: number };
  targetPort: { x: number; y: number };
  order?: number;
  visibility: 'full' | 'partial' | 'hidden';
  flowSummary?: EdgeFlowSummary;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT_PERSON = 52;
const NODE_HEIGHT_ORG = 56;
const NODE_HEIGHT_CONTRACT = 80;
const LAYER_GAP = 300;
const NODE_GAP_Y = 16;
const GROUP_GAP_Y = 40;
const PADDING = 80;

function assignLayer(node: BaseNode): number {
  if (node.type === 'person') return 0;
  if (node.type === 'party') {
    // Use chainPosition from auto-generated graph if available
    if (typeof node.data?.chainPosition === 'number') {
      // Shift by 1 so person nodes stay at layer 0
      return node.data.chainPosition + 1;
    }
    // Legacy fallback: infer from partyType
    if (node.data?.partyType === 'client') return 3;
    if (node.data?.partyType === 'agency') return 2;
    return 1;
  }
  if (node.type === 'contract' || node.type === 'sow') return 2;
  return 1;
}

function getNodeHeight(node: BaseNode): number {
  if (node.type === 'person') return NODE_HEIGHT_PERSON;
  if (node.type === 'contract' || node.type === 'sow') return NODE_HEIGHT_CONTRACT;
  return NODE_HEIGHT_ORG;
}

function computeLayout(
  nodes: VisibleNode[],
  edges: VisibleEdge[],
  selectedMonth: string | null,
  edgeFlows: Map<string, EdgeFlowSummary>
): { layoutNodes: LayoutNode[]; layoutEdges: LayoutEdge[]; width: number; height: number } {
  if (nodes.length === 0) {
    return { layoutNodes: [], layoutEdges: [], width: 600, height: 400 };
  }

  const layerMap = new Map<string, number>();
  nodes.forEach((n) => layerMap.set(n.id, assignLayer(n)));

  // Group people by org
  const personToOrg = new Map<string, string>();
  edges.forEach((e) => {
    if (e.data?.edgeType === 'employs' || e.data?.edgeType === 'assigns') {
      personToOrg.set(e.target, e.source);
    }
  });

  const orgNameToId = new Map<string, string>();
  nodes
    .filter((n) => n.type === 'party')
    .forEach((n) => orgNameToId.set(n.data?.name, n.id));

  nodes
    .filter((n) => n.type === 'person' && !personToOrg.has(n.id))
    .forEach((n) => {
      // Try partyId first (auto-generated graphs), then company name lookup
      if (n.data?.partyId) {
        personToOrg.set(n.id, n.data.partyId);
      } else {
        const company = n.data?.company;
        if (company && orgNameToId.has(company)) {
          personToOrg.set(n.id, orgNameToId.get(company)!);
        }
      }
    });

  // Group by layer
  const layerGroups = new Map<number, VisibleNode[]>();
  nodes.forEach((n) => {
    const layer = layerMap.get(n.id)!;
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(n);
  });

  // Sort each layer
  const layer0 = layerGroups.get(0) || [];
  layer0.sort((a, b) => {
    const orgA = personToOrg.get(a.id) || '_zzz';
    const orgB = personToOrg.get(b.id) || '_zzz';
    if (orgA !== orgB) return orgA.localeCompare(orgB);
    return (a.data?.name || '').localeCompare(b.data?.name || '');
  });

  const layer1 = layerGroups.get(1) || [];
  layer1.sort((a, b) => {
    const typeOrder: Record<string, number> = { company: 0, agency: 1 };
    return (typeOrder[a.data?.partyType] ?? 9) - (typeOrder[b.data?.partyType] ?? 9);
  });

  // Sort all non-person, non-company layers by name
  const allLayerIndices = [...layerGroups.keys()].sort((a, b) => a - b);
  allLayerIndices.forEach((idx) => {
    if (idx > 1) {
      const layerNodes = layerGroups.get(idx) || [];
      layerNodes.sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
    }
  });

  // Build allLayers dynamically to support N-tier chains
  const allLayers = allLayerIndices.map((idx) => layerGroups.get(idx) || []);

  // Position nodes
  const layoutNodes: LayoutNode[] = [];
  let maxHeight = 0;

  allLayers.forEach((layerNodes, layerIdx) => {
    let currentY = PADDING;
    let prevGroupId = '';

    layerNodes.forEach((node, idx) => {
      const groupId = layerIdx === 0 ? (personToOrg.get(node.id) || '_freelancer') : node.id;

      if (layerIdx === 0 && groupId !== prevGroupId && idx > 0) {
        currentY += GROUP_GAP_Y;
      }
      prevGroupId = groupId;

      const h = getNodeHeight(node);
      const activity = selectedMonth && node.type === 'person'
        ? getPersonMonthlyActivity(node.id, selectedMonth)
        : null;

      layoutNodes.push({
        id: node.id,
        type: node.type,
        data: node.data,
        layer: layerIdx,
        order: idx,
        x: PADDING + layerIdx * LAYER_GAP,
        y: currentY,
        width: NODE_WIDTH,
        height: h,
        groupId: layerIdx === 0 ? groupId : undefined,
        visibility: node.visibility,
        hopDistance: node.hopDistance,
        monthlyActivity: activity,
      });

      currentY += h + NODE_GAP_Y;
    });

    maxHeight = Math.max(maxHeight, currentY);
  });

  // Center layers vertically
  allLayers.forEach((_, layerIdx) => {
    const lnodes = layoutNodes.filter((n) => n.layer === layerIdx);
    if (lnodes.length === 0) return;
    const minY = Math.min(...lnodes.map((n) => n.y));
    const maxY = Math.max(...lnodes.map((n) => n.y + n.height));
    const offset = (maxHeight - (maxY - minY)) / 2 - minY + PADDING;
    lnodes.forEach((n) => { n.y += offset; });
  });

  // Compute edges
  const nodeMap = new Map<string, LayoutNode>();
  layoutNodes.forEach((n) => nodeMap.set(n.id, n));

  const layoutEdges: LayoutEdge[] = edges
    .map((e) => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return null;

      let sourcePort: { x: number; y: number };
      let targetPort: { x: number; y: number };

      if (src.layer <= tgt.layer) {
        sourcePort = { x: src.x + src.width, y: src.y + src.height / 2 };
        targetPort = { x: tgt.x, y: tgt.y + tgt.height / 2 };
      } else {
        sourcePort = { x: src.x, y: src.y + src.height / 2 };
        targetPort = { x: tgt.x + tgt.width, y: tgt.y + tgt.height / 2 };
      }

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        edgeType: e.data?.edgeType || 'link',
        sourcePort,
        targetPort,
        order: e.data?.order,
        visibility: e.visibility,
        flowSummary: edgeFlows.get(e.id),
      };
    })
    .filter(Boolean) as LayoutEdge[];

  const totalWidth = PADDING * 2 + Math.max(allLayers.length - 1, 1) * LAYER_GAP + NODE_WIDTH;
  return { layoutNodes, layoutEdges, width: totalWidth, height: maxHeight + PADDING * 2 };
}

// ============================================================================
// Edge Rendering
// ============================================================================

const EDGE_COLORS: Record<string, { stroke: string; opacity: number }> = {
  employs: { stroke: '#94a3b8', opacity: 0.35 },
  approves: { stroke: '#3b82f6', opacity: 0.65 },
  assigns: { stroke: '#8b5cf6', opacity: 0.5 },
  billsTo: { stroke: '#f59e0b', opacity: 0.6 },
  funds: { stroke: '#10b981', opacity: 0.6 },
  link: { stroke: '#94a3b8', opacity: 0.25 },
};

function EdgePath({
  edge,
  isHighlighted,
  isPartial,
}: {
  edge: LayoutEdge;
  isHighlighted: boolean;
  isPartial: boolean;
}) {
  const { sourcePort: sp, targetPort: tp, edgeType } = edge;
  const colors = EDGE_COLORS[edgeType] || EDGE_COLORS.link;
  const isEmploys = edgeType === 'employs';
  const isApproval = edgeType === 'approves';

  const dx = Math.abs(tp.x - sp.x);
  const cpOffset = Math.max(dx * 0.4, 60);
  const goingRight = tp.x >= sp.x;
  const cp1x = goingRight ? sp.x + cpOffset : sp.x - cpOffset;
  const cp2x = goingRight ? tp.x - cpOffset : tp.x + cpOffset;
  const d = `M ${sp.x} ${sp.y} C ${cp1x} ${sp.y}, ${cp2x} ${tp.y}, ${tp.x} ${tp.y}`;

  const opacity = isPartial ? 0.15 : isHighlighted ? 1 : isEmploys ? 0.2 : colors.opacity;

  return (
    <g>
      {isHighlighted && (
        <path d={d} fill="none" stroke={colors.stroke} strokeWidth={8} strokeOpacity={0.1} strokeLinecap="round" />
      )}
      <path
        d={d}
        fill="none"
        stroke={isPartial ? '#cbd5e1' : colors.stroke}
        strokeWidth={isHighlighted ? 2.5 : 1.5}
        strokeOpacity={opacity}
        strokeDasharray={isEmploys ? '4 4' : isApproval ? '6 3' : isPartial ? '2 4' : undefined}
        strokeLinecap="round"
      />
      {/* Arrowhead at target for approval and billsTo edges */}
      {(isApproval || edgeType === 'billsTo' || edgeType === 'funds') && (
        <circle
          cx={tp.x}
          cy={tp.y}
          r={isHighlighted ? 4.5 : 3}
          fill={isPartial ? '#cbd5e1' : colors.stroke}
          fillOpacity={isPartial ? 0.3 : isHighlighted ? 1 : opacity}
        />
      )}
      {/* Approval step badge — always visible for approves edges */}
      {isApproval && edge.order && !isPartial && (
        <g>
          <circle
            cx={(sp.x + tp.x) / 2}
            cy={(sp.y + tp.y) / 2}
            r={isHighlighted ? 12 : 10}
            fill="white"
            stroke={colors.stroke}
            strokeWidth={isHighlighted ? 1.5 : 1}
          />
          <text
            x={(sp.x + tp.x) / 2}
            y={(sp.y + tp.y) / 2 + (isHighlighted ? 4 : 3.5)}
            textAnchor="middle"
            className="font-semibold fill-blue-600"
            fontSize={isHighlighted ? 10 : 9}
          >
            {edge.order}
          </text>
        </g>
      )}
      {/* Flow indicator badge on edge */}
      {edge.flowSummary && isHighlighted && (
        <g>
          <rect
            x={(sp.x + tp.x) / 2 - 40}
            y={(sp.y + tp.y) / 2 + 12}
            width={80}
            height={22}
            rx={11}
            fill={edge.flowSummary.hasAlerts ? '#fef3c7' : '#f0fdf4'}
            stroke={edge.flowSummary.hasAlerts ? '#f59e0b' : '#86efac'}
            strokeWidth={1}
          />
          <text
            x={(sp.x + tp.x) / 2}
            y={(sp.y + tp.y) / 2 + 27}
            textAnchor="middle"
            className="text-[9px] font-medium"
            fill={edge.flowSummary.hasAlerts ? '#92400e' : '#166534'}
          >
            {edge.flowSummary.flows.map(f => `${f.count} ${f.label}`).join(', ')}
          </text>
        </g>
      )}
    </g>
  );
}

// ============================================================================
// Node Cards
// ============================================================================

function PersonNodeCard({
  node,
  isSelected,
  isHighlighted,
  onClick,
  onHover,
}: {
  node: LayoutNode;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onHover: (h: boolean) => void;
}) {
  const initials = (node.data?.name || '')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2);

  const isMasked = node.visibility === 'masked';
  const isPartial = node.visibility === 'partial';
  const activity = node.monthlyActivity;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`absolute cursor-pointer select-none transition-all duration-150
        rounded-xl border bg-card shadow-sm px-3 py-2
        ${isMasked ? 'opacity-40 border-dashed' : ''}
        ${isSelected
          ? 'border-[var(--accent-brand)] ring-2 ring-[var(--accent-brand)]/20 shadow-md'
          : isHighlighted
            ? 'border-blue-300 shadow-md bg-blue-50/50'
            : isPartial
              ? 'border-border/60'
              : 'border-border hover:border-blue-200 hover:shadow-md'
        }
      `}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
    >
      <div className="flex items-center gap-3 h-full">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 border
          ${activity?.status === 'onboarding'
            ? 'bg-amber-50 border-amber-200 text-amber-600'
            : activity?.status === 'offboarding'
              ? 'bg-red-50 border-red-200 text-red-400'
              : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-200/60 text-slate-500'
          }
        `}>
          {isMasked ? <Lock className="h-3 w-3 text-slate-400" /> : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-foreground truncate leading-tight">
            {isMasked ? 'Hidden User' : node.data?.name}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {isMasked ? '••••' : (node.data?.role || '').replace(/_/g, ' ')}
          </div>
        </div>
        {activity?.status === 'onboarding' && !isMasked && (
          <Badge className="text-[8px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200 border leading-tight shrink-0">
            New
          </Badge>
        )}
        {activity?.status === 'offboarding' && !isMasked && (
          <Badge className="text-[8px] px-1.5 py-0 bg-red-100 text-red-600 border-red-200 border leading-tight shrink-0">
            Leaving
          </Badge>
        )}
        {isPartial && !isMasked && (
          <EyeOff className="h-3 w-3 text-slate-300 shrink-0" />
        )}
      </div>
    </div>
  );
}

const ORG_COLORS: Record<string, { bg: string; border: string; icon: string; accent: string }> = {
  company: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', accent: 'bg-blue-100' },
  agency: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600', accent: 'bg-violet-100' },
  client: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', accent: 'bg-amber-100' },
  contractor: { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'text-slate-600', accent: 'bg-slate-100' },
  freelancer: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', accent: 'bg-emerald-100' },
};

function OrgNodeCard({
  node,
  isSelected,
  isHighlighted,
  onClick,
  onHover,
  peopleCount,
  monthlyStats,
}: {
  node: LayoutNode;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onHover: (h: boolean) => void;
  peopleCount: number;
  monthlyStats?: { hours: number; approved: number; pending: number } | null;
}) {
  const ptype = node.data?.partyType || 'company';
  const colors = ORG_COLORS[ptype] || ORG_COLORS.company;
  const Icon = ptype === 'agency' ? Users : Building2;
  const isPartial = node.visibility === 'partial';
  // hopDistance===0 means this org is the viewer's own. Admin gets hopDistance=99
  // so the YOU badge never fires on all orgs when viewing as Admin.
  const isSelf = node.hopDistance === 0;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`absolute cursor-pointer select-none transition-all duration-150
        rounded-xl border shadow-sm px-3 py-2
        ${colors.bg}
        ${isSelf ? 'ring-2 ring-[var(--accent-brand)]/15' : ''}
        ${isSelected
          ? `${colors.border} ring-2 ring-[var(--accent-brand)]/20 shadow-md`
          : isHighlighted
            ? `${colors.border} shadow-md`
            : `${colors.border} hover:shadow-md`
        }
      `}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
    >
      <div className="flex items-center gap-3 h-full">
        <div className={`w-9 h-9 rounded-lg ${colors.accent} flex items-center justify-center shrink-0`}>
          <Icon className={`h-4 w-4 ${colors.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-foreground truncate leading-tight">
              {node.data?.name}
            </span>
            {isSelf && (
              <Badge className="text-[8px] px-1 py-0 bg-[var(--accent-brand)] text-white border-0 leading-tight">
                YOU
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate capitalize">
            {ptype}{node.data?.role ? ` · ${node.data.role}` : ''}
          </div>
        </div>
        {peopleCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-white/60 border border-border/40 rounded-full px-1.5 py-0.5 shrink-0">
            <Users className="h-2.5 w-2.5" />
            {peopleCount}
          </span>
        )}
        {isPartial && <EyeOff className="h-3 w-3 text-slate-300 shrink-0" />}
      </div>
    </div>
  );
}

function ContractNodeCard({
  node,
  isSelected,
  isHighlighted,
  onClick,
  onHover,
}: {
  node: LayoutNode;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onHover: (h: boolean) => void;
}) {
  const isMasked = node.data?.hourlyRate === '••••' || node.data?.dailyRate === '••••';
  const rate =
    node.data?.contractType === 'hourly' && node.data?.hourlyRate && node.data.hourlyRate !== '••••'
      ? `$${node.data.hourlyRate}/hr`
      : node.data?.contractType === 'daily' && node.data?.dailyRate && node.data.dailyRate !== '••••'
        ? `$${node.data.dailyRate}/day`
        : isMasked ? '••••' : '';

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`absolute cursor-pointer select-none transition-all duration-150
        rounded-xl border bg-card shadow-sm px-3 py-2
        ${isSelected
          ? 'border-amber-400 ring-2 ring-amber-200/40 shadow-md'
          : isHighlighted
            ? 'border-amber-300 shadow-md bg-amber-50/40'
            : 'border-border hover:border-amber-200 hover:shadow-md'
        }
      `}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
    >
      <div className="flex items-center gap-3 h-full">
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground truncate leading-tight">
            {node.data?.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground capitalize">
              {node.data?.contractType || 'custom'}
            </span>
            {rate && (
              <>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className={`text-[11px] font-semibold ${isMasked ? 'text-slate-300' : 'text-foreground'}`}>
                  {isMasked && <Lock className="inline h-2.5 w-2.5 mr-0.5 relative -top-px" />}
                  {rate}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Group Labels
// ============================================================================

function computeGroupLabels(
  layoutNodes: LayoutNode[],
  allNodes: BaseNode[]
) {
  const people = layoutNodes.filter((n) => n.type === 'person' && n.groupId);
  if (people.length === 0) return [];

  const groups = new Map<string, LayoutNode[]>();
  people.forEach((n) => {
    if (!groups.has(n.groupId!)) groups.set(n.groupId!, []);
    groups.get(n.groupId!)!.push(n);
  });

  return Array.from(groups.entries()).map(([orgId, gNodes]) => {
    const orgNode = allNodes.find((n) => n.id === orgId);
    const ptype = orgNode?.data?.partyType || 'company';
    const colorMap: Record<string, string> = {
      company: '#3b82f6', agency: '#8b5cf6', client: '#f59e0b', contractor: '#64748b', freelancer: '#10b981',
    };
    const minY = Math.min(...gNodes.map((n) => n.y));
    const maxY = Math.max(...gNodes.map((n) => n.y + n.height));
    return {
      orgId,
      orgName: orgNode?.data?.name || orgId,
      x: gNodes[0].x - 6,
      y: minY - 4,
      height: maxY - minY + 8,
      color: colorMap[ptype] || '#94a3b8',
    };
  });
}

// ============================================================================
// Viewer Selector
// ============================================================================

export function ViewerSelector({
  viewers,
  current,
  onChange,
}: {
  viewers: ViewerIdentity[];
  current: ViewerIdentity;
  onChange: (v: ViewerIdentity) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const iconMap: Record<string, React.ReactNode> = {
    admin: <Shield className="h-3.5 w-3.5 text-red-500" />,
    company: <Building2 className="h-3.5 w-3.5 text-blue-500" />,
    agency: <Users className="h-3.5 w-3.5 text-violet-500" />,
    client: <Building2 className="h-3.5 w-3.5 text-amber-500" />,
    freelancer: <User className="h-3.5 w-3.5 text-emerald-500" />,
  };

  const getIcon = (v: ViewerIdentity) => {
    if (v.orgId) return <User className="h-3.5 w-3.5 text-blue-500" />;
    return iconMap[v.type];
  };

  const getLabel = (v: ViewerIdentity) => {
    if (v.type === 'admin') return 'Admin';
    if (v.type === 'freelancer') return 'Freelancer';
    if (v.orgId) return 'Employee';
    return v.type;
  };

  // Group: admin, orgs, people
  const adminViewers = viewers.filter(v => v.type === 'admin');
  const orgViewers = viewers.filter(v => v.type !== 'admin' && v.type !== 'freelancer' && !v.orgId);
  const peopleViewers = viewers.filter(v => !!v.orgId || v.type === 'freelancer');

  const renderRow = (v: ViewerIdentity) => (
    <button
      key={v.nodeId}
      onClick={() => { onChange(v); setOpen(false); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors
        ${current.nodeId === v.nodeId ? 'bg-blue-50' : ''}
      `}
    >
      {getIcon(v)}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate">{v.name}</div>
        <div className="text-[10px] text-muted-foreground capitalize">{getLabel(v)}</div>
      </div>
      {current.nodeId === v.nodeId && (
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-brand)] shrink-0" />
      )}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-sm"
      >
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">
          Viewing as:
        </span>
        <span className="flex items-center gap-1.5">
          {getIcon(current)}
          <span className="text-xs font-semibold text-foreground max-w-[140px] truncate">
            {current.name}
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-lg z-50 py-1.5 max-h-80 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            View graph as...
          </div>
          {adminViewers.map(renderRow)}

          {orgViewers.length > 0 && (
            <div className="px-3 pt-2.5 pb-1 text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider border-t border-border/50 mt-1">
              Organizations
            </div>
          )}
          {orgViewers.map(renderRow)}

          {peopleViewers.length > 0 && (
            <div className="px-3 pt-2.5 pb-1 text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider border-t border-border/50 mt-1">
              People
            </div>
          )}
          {peopleViewers.map(renderRow)}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Month Navigator
// ============================================================================

function MonthNavigator({
  snapshots,
  selectedMonth,
  onChange,
}: {
  snapshots: MonthlySnapshot[];
  selectedMonth: string;
  onChange: (month: string) => void;
}) {
  const currentIdx = snapshots.findIndex((s) => s.month === selectedMonth);

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => currentIdx > 0 && onChange(snapshots[currentIdx - 1].month)}
        disabled={currentIdx <= 0}
        className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted/50 disabled:opacity-30 transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 py-0.5">
        {snapshots.map((s, i) => (
          <button
            key={s.month}
            onClick={() => onChange(s.month)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all
              ${s.month === selectedMonth
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => currentIdx < snapshots.length - 1 && onChange(snapshots[currentIdx + 1].month)}
        disabled={currentIdx >= snapshots.length - 1}
        className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted/50 disabled:opacity-30 transition-colors"
      >
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

// ============================================================================
// Month Summary Bar
// ============================================================================

function MonthSummaryBar({ snapshot }: { snapshot: MonthlySnapshot }) {
  const stats = snapshot.stats;
  const activeCount = snapshot.activePeople.filter(p => p.status === 'active').length;
  const onboardingCount = snapshot.activePeople.filter(p => p.status === 'onboarding').length;

  return (
    <div className="flex items-center gap-5 px-5 py-2 bg-muted/30 border-b border-border text-[11px]">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <UserCheck className="h-3 w-3" />
        <span><span className="font-semibold text-foreground">{activeCount}</span> active</span>
        {onboardingCount > 0 && (
          <span className="text-amber-500">+{onboardingCount} onboarding</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span><span className="font-semibold text-foreground">{stats.totalHoursSubmitted.toLocaleString()}</span>h submitted</span>
        <span>/ <span className="font-semibold text-foreground">{stats.totalHoursApproved.toLocaleString()}</span>h approved</span>
      </div>
      {stats.pendingApprovals > 0 && (
        <div className="flex items-center gap-1.5 text-amber-600">
          <AlertCircle className="h-3 w-3" />
          <span className="font-medium">{stats.pendingApprovals} pending</span>
        </div>
      )}
      {stats.totalAmountInvoiced > 0 && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Receipt className="h-3 w-3" />
          <span><span className="font-semibold text-foreground">${stats.totalAmountInvoiced.toLocaleString()}</span> invoiced</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <FileCheck className="h-3 w-3" />
        <span>{stats.activeNDAs} NDAs</span>
      </div>
    </div>
  );
}

// DetailPanel replaced by NodeDetailDrawer (imported above)

// Error boundary for NodeDetailDrawer
class DrawerErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-[360px] border-l border-border bg-card flex flex-col shrink-0 z-10 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-red-600">Drawer Error</span>
            <button onClick={this.props.onClose} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <p className="text-xs text-red-500">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

type GraphVersionHistoryEntry = {
  id: string;
  version_number: number;
  created_at: string;
  change_summary: string;
  graph_data?: {
    nodes: BaseNode[];
    edges: BaseEdge[];
  };
};

function formatHistoryTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function VersionHistoryPanel({
  versions,
  loading,
  restoringVersionId,
  onClose,
  onRestore,
}: {
  versions: GraphVersionHistoryEntry[];
  loading: boolean;
  restoringVersionId: string | null;
  onClose: () => void;
  onRestore: (version: GraphVersionHistoryEntry) => void;
}) {
  return (
    <div className="w-[360px] border-l border-border bg-card flex flex-col shrink-0 z-30 shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-semibold text-foreground">Version History</div>
            <div className="text-[11px] text-muted-foreground">Saved checkpoints</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground"
          aria-label="Close version history"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">No history yet — save the graph to create a checkpoint</p>
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((version) => (
              <div key={version.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">v{version.version_number}</span>
                      <span className="text-[11px] text-muted-foreground">{formatHistoryTimestamp(version.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {version.change_summary || 'Graph updated'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] shrink-0"
                    onClick={() => onRestore(version)}
                    disabled={restoringVersionId === version.id}
                  >
                    {restoringVersionId === version.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Restore'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Graph Canvas
// ============================================================================

function GraphCanvas({
  nodes,
  edges,
  allBaseNodes,
  selectedId,
  onSelect,
  hoveredId,
  onHover,
  selectedMonth,
  edgeFlows,
}: {
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  allBaseNodes: BaseNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  selectedMonth: string;
  edgeFlows: Map<string, EdgeFlowSummary>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  const { layoutNodes, layoutEdges, width, height } = useMemo(
    () => computeLayout(nodes, edges, selectedMonth, edgeFlows),
    [nodes, edges, selectedMonth, edgeFlows]
  );

  const groupLabels = useMemo(
    () => computeGroupLabels(layoutNodes, allBaseNodes),
    [layoutNodes, allBaseNodes]
  );

  // Org people count
  const orgPeopleCount = useMemo(() => {
    const counts = new Map<string, number>();
    edges.forEach((e) => {
      if (e.data?.edgeType === 'employs' || e.data?.edgeType === 'assigns') {
        counts.set(e.source, (counts.get(e.source) || 0) + 1);
      }
    });
    return counts;
  }, [edges]);

  // Monthly org stats
  const orgMonthlyStats = useMemo(() => {
    const snapshot = getSnapshotForMonth(selectedMonth);
    if (!snapshot) return new Map<string, { hours: number; approved: number; pending: number }>();

    const stats = new Map<string, { hours: number; approved: number; pending: number }>();
    snapshot.activePeople.forEach((p) => {
      const existing = stats.get(p.orgId) || { hours: 0, approved: 0, pending: 0 };
      existing.hours += p.hoursSubmitted;
      existing.approved += p.hoursApproved;
      existing.pending += Math.max(0, p.hoursSubmitted - p.hoursApproved);
      stats.set(p.orgId, existing);
    });
    return stats;
  }, [selectedMonth]);

  const activeNodeId = hoveredId || selectedId;
  const highlightedEdgeIds = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    return new Set(layoutEdges.filter((e) => e.source === activeNodeId || e.target === activeNodeId).map((e) => e.id));
  }, [activeNodeId, layoutEdges]);

  const highlightedNodeIds = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    const ids = new Set<string>([activeNodeId]);
    layoutEdges.forEach((e) => {
      if (e.source === activeNodeId) ids.add(e.target);
      if (e.target === activeNodeId) ids.add(e.source);
    });
    return ids;
  }, [activeNodeId, layoutEdges]);

  const fitView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newZoom = Math.min(Math.max((rect.width - 40) / width, 0.3), 1);
    setZoom(newZoom);
    setPan({
      x: (rect.width - width * newZoom) / 2,
      y: (rect.height - height * newZoom) / 2,
    });
  }, [width, height]);

  useEffect(() => { fitView(); }, [fitView]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(Math.max(z * (e.deltaY > 0 ? 0.92 : 1.08), 0.2), 2.5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffset.current = { ...pan };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleBgClick = useCallback((e: React.MouseEvent) => {
    // Only deselect when clicking directly on the canvas background
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.tagName === 'svg' || target.hasAttribute('data-canvas-bg')) {
      onSelect(null);
    }
  }, [onSelect]);

  // Layer labels
  const layerLabels = useMemo(() => {
    const seen = new Map<number, number>();
    const labels: Record<number, string> = { 0: 'PEOPLE', 1: 'ORGANIZATIONS', 2: 'CONTRACTS', 3: 'CLIENTS' };
    layoutNodes.forEach(n => {
      if (!seen.has(n.layer)) seen.set(n.layer, n.x);
    });
    return Array.from(seen.entries()).map(([layer, x]) => ({ label: labels[layer] || '', x }));
  }, [layoutNodes]);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative">
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1">
        <button onClick={() => setZoom(z => Math.min(z * 1.2, 2.5))} className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/50 transition-colors">
          <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.2))} className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/50 transition-colors">
          <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={fitView} className="w-8 h-8 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/50 transition-colors">
          <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="absolute bottom-4 right-4 z-20 text-[11px] text-muted-foreground bg-card/80 backdrop-blur-sm border border-border rounded-md px-2 py-1">
        {Math.round(zoom * 100)}%
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-4 bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t-[1.5px] border-dashed border-slate-400" />
          <span className="text-[10px] text-muted-foreground">Employs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="20" height="10" className="shrink-0">
            <line x1="0" y1="5" x2="14" y2="5" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 2" />
            <circle cx="17" cy="5" r="2.5" fill="#3b82f6" />
          </svg>
          <span className="text-[10px] text-muted-foreground">Approval chain</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full border border-blue-400 bg-white flex items-center justify-center">
            <span className="text-[7px] font-bold text-blue-600">1</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Step #</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t-[1.5px] border-amber-500" />
          <span className="text-[10px] text-muted-foreground">Bills to</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="h-2.5 w-2.5 text-slate-400" />
          <span className="text-[10px] text-muted-foreground">Hidden</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleBgClick}
        style={{
          background: `radial-gradient(circle at 1px 1px, var(--border) 0.5px, transparent 0.5px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x % (24 * zoom)}px ${pan.y % (24 * zoom)}px`,
        }}
      >
        <div
          data-canvas-bg="true"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width, height,
            position: 'relative',
          }}
        >
          {/* Layer labels */}
          {layerLabels.map((ll) => (
            <div key={ll.label} className="absolute text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.15em]" style={{ left: ll.x, top: PADDING - 32 }}>
              {ll.label}
            </div>
          ))}

          {/* Group bars */}
          {groupLabels.map((gl) => (
            <div key={gl.orgId} className="absolute" style={{ left: gl.x - 3, top: gl.y, height: gl.height }}>
              <div className="w-[3px] h-full rounded-full" style={{ backgroundColor: gl.color, opacity: 0.25 }} />
            </div>
          ))}

          {/* SVG Edges */}
          <svg className="absolute inset-0 pointer-events-none" width={width} height={height} style={{ overflow: 'visible' }}>
            {layoutEdges.filter(e => !highlightedEdgeIds.has(e.id)).map(edge => (
              <EdgePath key={edge.id} edge={edge} isHighlighted={false} isPartial={edge.visibility === 'partial'} />
            ))}
            {layoutEdges.filter(e => highlightedEdgeIds.has(e.id)).map(edge => (
              <EdgePath key={edge.id} edge={edge} isHighlighted={true} isPartial={edge.visibility === 'partial'} />
            ))}
          </svg>

          {/* Nodes */}
          {layoutNodes.map((lNode) => {
            const isSelected = selectedId === lNode.id;
            const isHigh = highlightedNodeIds.has(lNode.id) && !isSelected;

            if (lNode.type === 'person') {
              return <PersonNodeCard key={lNode.id} node={lNode} isSelected={isSelected} isHighlighted={isHigh} onClick={() => onSelect(lNode.id)} onHover={(h) => onHover(h ? lNode.id : null)} />;
            }
            if (lNode.type === 'contract' || lNode.type === 'sow') {
              return <ContractNodeCard key={lNode.id} node={lNode} isSelected={isSelected} isHighlighted={isHigh} onClick={() => onSelect(lNode.id)} onHover={(h) => onHover(h ? lNode.id : null)} />;
            }
            return (
              <OrgNodeCard
                key={lNode.id}
                node={lNode}
                isSelected={isSelected}
                isHighlighted={isHigh}
                onClick={() => onSelect(lNode.id)}
                onHover={(h) => onHover(h ? lNode.id : null)}
                peopleCount={orgPeopleCount.get(lNode.id) || 0}
                monthlyStats={orgMonthlyStats.get(lNode.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// List View
// ============================================================================

function ListView({
  nodes,
  edges,
  selectedId,
  onSelect,
  selectedMonth,
}: {
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedMonth: string;
}) {
  return (
    <div className="overflow-auto flex-1 p-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
            <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
            <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Visibility</th>
            <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
            <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Connections</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const connCount = edges.filter(e => e.source === node.id || e.target === node.id).length;
            return (
              <tr
                key={node.id}
                onClick={() => onSelect(node.id)}
                className={`border-b border-border/50 cursor-pointer transition-colors ${selectedId === node.id ? 'bg-blue-50' : 'hover:bg-muted/30'}`}
              >
                <td className="py-2.5 px-3 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    {node.visibility === 'masked' && <Lock className="h-3 w-3 text-slate-300" />}
                    {node.data?.name || node.id}
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <Badge variant="outline" className="text-[11px] capitalize">{node.type}</Badge>
                </td>
                <td className="py-2.5 px-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      node.visibility === 'full' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                      node.visibility === 'partial' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                      'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {node.visibility === 'full' ? <Eye className="h-2.5 w-2.5 mr-1" /> :
                     node.visibility === 'partial' ? <EyeOff className="h-2.5 w-2.5 mr-1" /> :
                     <Lock className="h-2.5 w-2.5 mr-1" />}
                    {node.visibility}
                  </Badge>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground text-xs">
                  {node.data?.role?.replace(/_/g, ' ') || node.data?.partyType || node.data?.contractType || '\u2014'}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">{connCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Hidden Nodes Banner
// ============================================================================

function HiddenBanner({ hiddenNodes, hiddenEdges }: { hiddenNodes: number; hiddenEdges: number }) {
  if (hiddenNodes === 0 && hiddenEdges === 0) return null;
  return (
    <div className="flex items-center gap-2 px-5 py-1.5 bg-slate-50 border-b border-border text-[11px] text-muted-foreground">
      <Lock className="h-3 w-3" />
      <span>
        {hiddenNodes > 0 && <><span className="font-semibold">{hiddenNodes}</span> nodes</>}
        {hiddenNodes > 0 && hiddenEdges > 0 && ' and '}
        {hiddenEdges > 0 && <><span className="font-semibold">{hiddenEdges}</span> connections</>}
        {' '}hidden from this view
      </span>
    </div>
  );
}

function buildEditableParties(nodes: BaseNode[], edges: BaseEdge[]): PartyEntry[] {
  // Build person→org map using the same resilient logic as graph-visibility
  const personToOrg = new Map<string, string>();
  const partyIds = new Set(nodes.filter((n) => n.type === 'party').map((n) => n.id));

  // From edges (employs/assigns)
  edges.forEach((e) => {
    if ((e.data?.edgeType === 'employs' || e.data?.edgeType === 'assigns') && partyIds.has(e.source)) {
      personToOrg.set(e.target, e.source);
    }
  });
  // From node data (partyId/orgId)
  nodes.forEach((n) => {
    if (n.type !== 'person' || personToOrg.has(n.id)) return;
    const candidate = n.data?.partyId || n.data?.orgId;
    if (typeof candidate === 'string' && partyIds.has(candidate)) {
      personToOrg.set(n.id, candidate);
    }
  });
  // From company name match
  const partyNameToId = new Map<string, string>();
  nodes.forEach((n) => {
    if (n.type === 'party' && n.data?.name) {
      partyNameToId.set(n.data.name.trim().toLowerCase(), n.id);
    }
  });
  nodes.forEach((n) => {
    if (n.type !== 'person' || personToOrg.has(n.id)) return;
    const company = (n.data?.company || n.data?.orgName || '').trim().toLowerCase();
    if (company && partyNameToId.has(company)) {
      personToOrg.set(n.id, partyNameToId.get(company)!);
    }
  });

  return nodes
    .filter((node) => node.type === 'party')
    .map((partyNode, index) => {
      const partyId = partyNode.id;
      const people = nodes
        .filter((node) => node.type === 'person' && (
          node.data?.partyId === partyId ||
          node.data?.orgId === partyId ||
          personToOrg.get(node.id) === partyId
        ))
        .map((personNode) => ({
          id: personNode.id,
          name: personNode.data?.name || '',
          email: personNode.data?.email || '',
          role: personNode.data?.role || '',
          canApprove: personNode.data?.canApprove === true,
          canViewRates: personNode.data?.canViewRates === true,
          canEditTimesheets: personNode.data?.canEditTimesheets === true,
          visibleToChain: personNode.data?.visibleToChain === true,
        }));

      const billsTo = edges
        .filter((edge) =>
          edge.source === partyId &&
          (edge.data?.edgeType === 'billsTo' || edge.data?.edgeType === 'subcontracts' || edge.data?.edgeType === 'bills_to')
        )
        .map((edge) => edge.target);

      return {
        id: partyId,
        name: partyNode.data?.name || '',
        partyType: partyNode.data?.partyType || 'company',
        billsTo,
        organizationId: partyNode.data?.organizationId,
        logo: partyNode.data?.logo,
        people,
        isCreator: partyNode.data?.isCreator === true || index === 0,
        chainVisibility: partyNode.data?.chainVisibility,
      };
    });
}

// ============================================================================
// Main Component
// ============================================================================

interface WorkGraphBuilderProps {
  projectId?: string;
  projectName?: string;
  onSave?: (config: CompiledProjectConfig) => void;
  initialConfig?: CompiledProjectConfig;
  focusNodeId?: string;
  scope?: 'approvals' | 'money' | 'people' | 'access';
  mode?: 'view' | 'edit';
  asOf?: string;
  currentViewer?: ViewerIdentity | null;
  onViewerChange?: (viewer: ViewerIdentity) => void;
}

export function WorkGraphBuilder({
  projectId: propProjectId,
  projectName: propProjectName,
  onSave,
  initialConfig,
  currentViewer: controlledViewer,
  onViewerChange: externalViewerChange,
}: WorkGraphBuilderProps) {
  const projectId = propProjectId || sessionStorage.getItem('currentProjectId') || '';
  const { accessToken, user } = useAuth();
  const isDemoProject = projectId === 'proj-alpha';

  const defaultTemplate = TEMPLATES[0];
  const [allNodes, setAllNodes] = useState<BaseNode[]>(() => {
    if (initialConfig?.graph.nodes) return initialConfig.graph.nodes as BaseNode[];
    if (isDemoProject) return (defaultTemplate.nodes || []) as BaseNode[];
    return [];
  });
  const [allEdges, setAllEdges] = useState<BaseEdge[]>(() => {
    if (initialConfig?.graph.edges) return initialConfig.graph.edges as BaseEdge[];
    if (isDemoProject) return (defaultTemplate.edges || []) as BaseEdge[];
    return [];
  });
  const [graphLoaded, setGraphLoaded] = useState(!!initialConfig || isDemoProject);

  // Try to load project graph from KV on mount
  useEffect(() => {
    if (graphLoaded || initialConfig) return;
    if (!projectId) {
      setGraphLoaded(true);
      return;
    }
    let cancelled = false;

    async function loadProjectGraph() {
      try {
        const data = await getProject(projectId, accessToken);
        if (cancelled) return;
        if (data?.project?.graph?.nodes?.length > 0) {
          setAllNodes(data.project.graph.nodes);
          setAllEdges(data.project.graph.edges || []);
          setGraphLoaded(true);
          console.log(`[WorkGraph] Loaded ${data.project.graph.nodes.length} nodes from project ${projectId}`);
        } else {
          if (!cancelled) {
            if (isDemoProject) {
              setAllNodes((defaultTemplate.nodes || []) as BaseNode[]);
              setAllEdges((defaultTemplate.edges || []) as BaseEdge[]);
            } else {
              setAllNodes([]);
              setAllEdges([]);
            }
            setGraphLoaded(true);
          }
        }
      } catch (err) {
        console.log(`[WorkGraph] No saved graph for ${projectId}, using ${isDemoProject ? 'template' : 'empty state'}`);
        if (!cancelled) {
          if (isDemoProject) {
            setAllNodes((defaultTemplate.nodes || []) as BaseNode[]);
            setAllEdges((defaultTemplate.edges || []) as BaseEdge[]);
          } else {
            setAllNodes([]);
            setAllEdges([]);
          }
          setGraphLoaded(true);
        }
      }
    }

    loadProjectGraph();
    return () => { cancelled = true; };
  }, [projectId, accessToken, graphLoaded, initialConfig, isDemoProject, defaultTemplate.edges, defaultTemplate.nodes]);

  // Viewer options
  const viewerOptions = useMemo(() => buildViewerOptions(allNodes, allEdges), [allNodes, allEdges]);
  const authViewerFallback = useMemo<ViewerIdentity | null>(() => {
    if (!user?.id) return null;
    const authType =
      user?.persona_type === 'company'
        ? 'company'
        : user?.persona_type === 'agency'
          ? 'agency'
          : user?.persona_type === 'freelancer'
            ? 'freelancer'
            : null;
    if (!authType) return null;
    return {
      nodeId: user.id,
      type: authType,
      name: (user.user_metadata?.name as string) || (user.email as string) || 'Me',
      orgId: user.user_metadata?.orgId as string | undefined,
    };
  }, [user]);

  const [internalViewer, setInternalViewer] = useState<ViewerIdentity | null>(null);
  const fallbackViewer: ViewerIdentity = viewerOptions[0] ?? authViewerFallback ?? {
    nodeId: '__admin__',
    type: 'admin',
    name: 'Admin (Full View)',
  };
  const currentViewer = controlledViewer ?? internalViewer ?? fallbackViewer;
  const viewerStorageKey = `workgraph-viewer:${projectId}`;
  const viewerMetaStorageKey = `workgraph-viewer-meta:${projectId}`;
  const restoredViewerKeyRef = useRef<string | null>(null);
  const skipNextViewerPersistRef = useRef(false);
  const hasRestoredViewerRef = useRef(false);

  // Persist a lightweight name directory so other tabs (Timesheets, Approvals)
  // can resolve person/party names from graph node IDs.
  useEffect(() => {
    const dir: Record<string, { name: string; type: string; orgId?: string }> = {};
    viewerOptions.forEach(v => {
      if (v.nodeId === '__admin__') return;
      dir[v.nodeId] = { name: v.name, type: v.type, orgId: v.orgId };
    });
    // Also include party names from allNodes
    allNodes.forEach(n => {
      if (n.type === 'party' && n.data?.name && !dir[n.id]) {
        dir[n.id] = { name: n.data.name, type: 'party' };
      }
    });
    sessionStorage.setItem(`workgraph-name-dir:${projectId}`, JSON.stringify(dir));
    // Notify ProjectWorkspace that the name directory is available/updated
    window.dispatchEvent(new CustomEvent('workgraph-namedir-updated', { detail: { projectId } }));

    // Build a resilient person → org map from viewerOptions, which already uses
    // buildPersonToOrgMap (checks edges, partyId/orgId, and company name match).
    // This ensures floating person nodes (e.g., "Me" with no membership edge) are
    // still assigned to the correct party in the approval directory.
    const personOrgFromViewers = new Map<string, string>();
    viewerOptions.forEach(v => {
      if (v.orgId) personOrgFromViewers.set(v.nodeId, v.orgId);
    });

    const parties = allNodes
      .filter((n) => n.type === 'party')
      .map((partyNode) => {
        const partyId = partyNode.id;
        const people = allNodes
          .filter((n) => n.type === 'person' && (
            n.data?.partyId === partyId ||
            n.data?.orgId === partyId ||
            personOrgFromViewers.get(n.id) === partyId
          ))
          .map((personNode) => ({
            id: personNode.id,
            name: personNode.data?.name || personNode.id,
            canApprove: personNode.data?.canApprove === true,
          }));

        const billsTo = allEdges
          .filter((e) =>
            e.source === partyId &&
            (e.data?.edgeType === 'billsTo' || e.data?.edgeType === 'subcontracts' || e.data?.edgeType === 'bills_to')
          )
          .map((e) => e.target);

        return {
          id: partyId,
          name: partyNode.data?.name || partyId,
          partyType: partyNode.data?.partyType || 'company',
          billsTo,
          people,
        };
      });

    const approvalDirPayload = JSON.stringify({ parties });
    sessionStorage.setItem(`workgraph-approval-dir:${projectId}`, approvalDirPayload);
    try { localStorage.setItem(`workgraph-approval-dir:${projectId}`, approvalDirPayload); } catch { /* quota */ }
  }, [viewerOptions, allNodes, allEdges, projectId]);

  // When viewer changes in the graph, persist the identity for other tabs.
  const handleViewerChange = useCallback((viewer: ViewerIdentity) => {
    if (externalViewerChange) {
      externalViewerChange(viewer);
    } else {
      setInternalViewer(viewer);
    }
    sessionStorage.setItem(viewerStorageKey, viewer.nodeId);
    sessionStorage.setItem(viewerMetaStorageKey, JSON.stringify(viewer));
    window.dispatchEvent(new CustomEvent('workgraph-viewer-changed', {
      detail: { projectId, viewer }
    }));
  }, [externalViewerChange, viewerStorageKey, viewerMetaStorageKey, projectId]);

  // Keep selected viewer valid after graph/viewer changes.
  useEffect(() => {
    if (viewerOptions.length === 0) return;
    const exists = currentViewer ? viewerOptions.some(v => v.nodeId === currentViewer.nodeId) : false;
    if (exists) return;
    const authViewerMatch = user?.id
      ? viewerOptions.find(v => v.nodeId === user.id)
      : undefined;
    const nextViewer = authViewerMatch || viewerOptions[0];
    if (!nextViewer) return;
    if (externalViewerChange) {
      externalViewerChange(nextViewer);
    } else {
      setInternalViewer(nextViewer);
    }
  }, [viewerOptions, currentViewer?.nodeId, user?.id, externalViewerChange]);

  // Restore previously selected viewer once per project key.
  useEffect(() => {
    if (viewerOptions.length === 0) return;
    if (restoredViewerKeyRef.current === viewerStorageKey) return;
    restoredViewerKeyRef.current = viewerStorageKey;

    const savedViewerId = sessionStorage.getItem(viewerStorageKey);
    if (!savedViewerId) return;
    const savedViewer = viewerOptions.find(v => v.nodeId === savedViewerId);
    if (savedViewer && savedViewer.nodeId !== currentViewer?.nodeId) {
      skipNextViewerPersistRef.current = true;
      if (externalViewerChange) {
        externalViewerChange(savedViewer);
      } else {
        setInternalViewer(savedViewer);
      }
      sessionStorage.setItem(viewerMetaStorageKey, JSON.stringify(savedViewer));
      window.dispatchEvent(new CustomEvent('workgraph-viewer-changed', {
        detail: { projectId, viewer: savedViewer }
      }));
    }
    hasRestoredViewerRef.current = true;
  }, [viewerOptions, viewerStorageKey, viewerMetaStorageKey, currentViewer?.nodeId, projectId, externalViewerChange]);

  // Persist selected viewer per project.
  useEffect(() => {
    if (!hasRestoredViewerRef.current) return;
    if (!currentViewer?.nodeId) return;
    if (skipNextViewerPersistRef.current) {
      skipNextViewerPersistRef.current = false;
      return;
    }
    sessionStorage.setItem(viewerStorageKey, currentViewer.nodeId);
    sessionStorage.setItem(viewerMetaStorageKey, JSON.stringify(currentViewer));
    window.dispatchEvent(new CustomEvent('workgraph-viewer-changed', {
      detail: { projectId, viewer: currentViewer }
    }));
  }, [currentViewer, viewerStorageKey, viewerMetaStorageKey, projectId]);

  // Month
  const [selectedMonth, setSelectedMonth] = useState(MONTHLY_SNAPSHOTS[MONTHLY_SNAPSHOTS.length - 1].month);
  const currentSnapshot = useMemo(() => getSnapshotForMonth(selectedMonth), [selectedMonth]);

  // Layout mode
  const [layoutMode, setLayoutMode] = useState<'graph' | 'list'>('graph');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<GraphVersionHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditSupplyChainOpen, setIsEditSupplyChainOpen] = useState(false);

  // Persistence
  const graphPersistence = useGraphPersistence({
    projectId,
    autoSave: false,
    onSaveSuccess: () => toast.success('Graph saved'),
    onSaveError: () => toast.error('Failed to save'),
  });

  const openHistoryPanel = useCallback(() => {
    setSelectedId(null);
    setHistoryOpen((prev) => !prev);
  }, []);

  const handleRestoreVersion = useCallback(async (version: GraphVersionHistoryEntry) => {
    setRestoringVersionId(version.id);
    try {
      const restored = await graphPersistence.loadVersionById(version.id);
      const graphData = restored?.graph_data;
      if (!graphData || !Array.isArray(graphData.nodes) || !Array.isArray(graphData.edges)) {
        toast.error('Failed to restore version');
        return;
      }

      setAllNodes(graphData.nodes as BaseNode[]);
      setAllEdges(graphData.edges as BaseEdge[]);
      setSelectedId(null);
      toast.success(`Restored v${restored.version_number}`);
    } finally {
      setRestoringVersionId(null);
    }
  }, [graphPersistence.loadVersionById]);

  useEffect(() => {
    if (!historyOpen) return;
    let cancelled = false;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const versions = await graphPersistence.getVersionHistory();
        if (!cancelled) {
          setHistoryVersions([...versions].sort((a, b) => b.version_number - a.version_number));
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [historyOpen, graphPersistence.getVersionHistory]);

  useEffect(() => {
    if (!historyOpen) {
      setHistoryLoading(false);
    }
  }, [historyOpen]);

  const runGraphMigration = useCallback(async () => {
    const migrated = migrateGraphForVisibility(allNodes, allEdges);
    if (!migrated.changed) {
      toast.info('Graph already up to date');
      return;
    }

    setAllNodes(migrated.nodes);
    setAllEdges(migrated.edges);

    try {
      await updateProject(projectId, {
        graph: {
          nodes: migrated.nodes,
          edges: migrated.edges,
        },
      }, accessToken);
      toast.success('Graph migrated', {
        description: `Added ${migrated.summary.personPartyLinksAdded} person-org links and ${migrated.summary.employsEdgesAdded} membership edges.`,
      });
    } catch (error) {
      console.error('Graph migration save failed:', error);
      toast.warning('Graph migrated locally', {
        description: 'Could not persist migration to server yet. Use Save after reconnecting.',
      });
    }
  }, [allNodes, allEdges, projectId, accessToken]);

  // Compute scoped view
  const scopedView = useMemo(
    () => computeScopedView(currentViewer, allNodes, allEdges),
    [currentViewer, allNodes, allEdges]
  );

  // Filter inactive people for selected month
  const monthFilteredNodes = useMemo(() => {
    const activePeople = getActivePeopleIds(selectedMonth);
    if (activePeople.size === 0) return scopedView.nodes;

    const scopedPeople = scopedView.nodes.filter(n => n.type === 'person');
    // If this graph uses non-demo person IDs, do not hide everyone.
    const hasSnapshotCoverageForGraph = scopedPeople.some(p => activePeople.has(p.id));
    if (!hasSnapshotCoverageForGraph) return scopedView.nodes;

    // Only filter people nodes, keep everything else.
    return scopedView.nodes.filter(n => {
      if (n.type !== 'person') return true;
      return activePeople.has(n.id);
    });
  }, [scopedView.nodes, selectedMonth]);

  // Filter edges for visible nodes
  const monthFilteredEdges = useMemo(() => {
    const visibleIds = new Set(monthFilteredNodes.map(n => n.id));
    return scopedView.edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [scopedView.edges, monthFilteredNodes]);

  // Apply search
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return monthFilteredNodes;
    const q = searchQuery.toLowerCase();
    return monthFilteredNodes.filter(n =>
      (n.data?.name || '').toLowerCase().includes(q) ||
      (n.data?.role || '').toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q)
    );
  }, [monthFilteredNodes, searchQuery]);

  const filteredEdges = useMemo(() => {
    if (!searchQuery) return monthFilteredEdges;
    const ids = new Set(filteredNodes.map(n => n.id));
    return monthFilteredEdges.filter(e => ids.has(e.source) || ids.has(e.target));
  }, [monthFilteredEdges, filteredNodes, searchQuery]);

  // Edge flows
  const edgeFlows = useMemo(() => {
    if (!currentSnapshot) return new Map<string, EdgeFlowSummary>();
    return computeEdgeFlows(filteredEdges, currentSnapshot);
  }, [filteredEdges, currentSnapshot]);

  // Navigation handler - dispatches custom event to ProjectWorkspace
  const handleNavigate = useCallback((target: string) => {
    const event = new CustomEvent('changeTab', { detail: target });
    window.dispatchEvent(event);
  }, []);

  // Stats
  const stats = useMemo(() => ({
    people: filteredNodes.filter(n => n.type === 'person').length,
    orgs: filteredNodes.filter(n => n.type === 'party').length,
    contracts: filteredNodes.filter(n => n.type === 'contract' || n.type === 'sow').length,
    approvals: filteredEdges.filter(e => e.data?.edgeType === 'approves').length,
  }), [filteredNodes, filteredEdges]);

  const editableParties = useMemo(() => buildEditableParties(allNodes, allEdges), [allNodes, allEdges]);

  const handleEditSupplyChainSave = useCallback(async ({
    parties,
    nodes,
    edges,
  }: {
    parties: PartyEntry[];
    nodes: BaseNode[];
    edges: BaseEdge[];
  }) => {
    // Build maps for incoming nodes/edges by ID so we can update OR add
    const incomingNodeMap = new Map(nodes.map((n) => [n.id, n]));
    const incomingEdgeMap = new Map(edges.map((e) => [e.id, e]));

    // Update existing nodes with new data (e.g., partyId, canApprove, name changes),
    // then append genuinely new nodes
    const mergedNodes = allNodes.map((existing) => {
      const incoming = incomingNodeMap.get(existing.id);
      if (!incoming) return existing;
      // Merge: incoming data overwrites, but keep existing position
      return {
        ...existing,
        ...incoming,
        position: existing.position, // preserve layout
        data: { ...existing.data, ...incoming.data },
      };
    });
    // Add nodes that don't exist yet
    const existingNodeIds = new Set(allNodes.map((n) => n.id));
    nodes.forEach((n) => { if (!existingNodeIds.has(n.id)) mergedNodes.push(n); });

    // Same for edges: update existing, add new
    const mergedEdges = allEdges.map((existing) => {
      const incoming = incomingEdgeMap.get(existing.id);
      if (!incoming) return existing;
      return { ...existing, ...incoming, data: { ...existing.data, ...incoming.data } };
    });
    const existingEdgeIds = new Set(allEdges.map((e) => e.id));
    edges.forEach((e) => { if (!existingEdgeIds.has(e.id)) mergedEdges.push(e); });

    await updateProject(projectId, {
      graph: {
        nodes: mergedNodes,
        edges: mergedEdges,
      },
      parties: parties.map((party) => ({
        id: party.id,
        name: party.name,
        partyType: party.partyType,
        billsTo: [...party.billsTo],
        peopleCount: party.people.length,
      })),
    }, accessToken);

    setAllNodes(mergedNodes);
    setAllEdges(mergedEdges);
    await graphPersistence.saveVersion(mergedNodes as any, mergedEdges as any, 'Supply chain updated');
    toast.success('Supply chain updated', {
      description: `Saved ${mergedNodes.length} nodes and ${mergedEdges.length} connections.`,
    });
    setIsEditSupplyChainOpen(false);
  }, [allNodes, allEdges, projectId, accessToken, graphPersistence]);

  return (
    <>
      <div className="h-[calc(100vh-16rem)] flex flex-col bg-background rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Work Graph</span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          <MonthNavigator snapshots={MONTHLY_SNAPSHOTS} selectedMonth={selectedMonth} onChange={setSelectedMonth} />
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          <div className="hidden xl:flex items-center gap-3 mr-2">
            <span className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{stats.people}</span> people
            </span>
            <span className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{stats.orgs}</span> orgs
            </span>
            <span className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{stats.contracts}</span> contracts
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="h-8 w-40 pl-8 text-xs" />
          </div>

          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setLayoutMode('graph')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${layoutMode === 'graph' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Network className="h-3.5 w-3.5" /> Graph
            </button>
            <button
              onClick={() => setLayoutMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${layoutMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={runGraphMigration}
            className="h-8 gap-1.5 text-xs"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Repair Graph
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditSupplyChainOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Users className="h-3.5 w-3.5" />
            Edit Supply Chain
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => graphPersistence.saveVersion(allNodes as any, allEdges as any, 'Manual save')}
            disabled={graphPersistence.isSaving}
            className="h-8 gap-1.5 text-xs"
          >
            {graphPersistence.isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={openHistoryPanel}
            className="h-8 gap-1.5 text-xs"
          >
            <Clock className="h-3.5 w-3.5" />
            History
          </Button>
        </div>
      </div>

      {/* Month summary */}
      {currentSnapshot && <MonthSummaryBar snapshot={currentSnapshot} />}

      {/* Hidden nodes banner */}
      <HiddenBanner hiddenNodes={scopedView.hiddenNodeCount} hiddenEdges={scopedView.hiddenEdgeCount} />

      {/* Content */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {layoutMode === 'list' ? (
          <ListView nodes={filteredNodes} edges={filteredEdges} selectedId={selectedId} onSelect={setSelectedId} selectedMonth={selectedMonth} />
        ) : (
          <GraphCanvas
            nodes={filteredNodes}
            edges={filteredEdges}
            allBaseNodes={allNodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            selectedMonth={selectedMonth}
            edgeFlows={edgeFlows}
          />
        )}

        {historyOpen && (
          <div className="absolute top-0 right-0 bottom-0 z-30 shadow-xl">
            <DrawerErrorBoundary onClose={() => setHistoryOpen(false)}>
              <VersionHistoryPanel
                versions={historyVersions}
                loading={historyLoading}
                restoringVersionId={restoringVersionId}
                onClose={() => setHistoryOpen(false)}
                onRestore={handleRestoreVersion}
              />
            </DrawerErrorBoundary>
          </div>
        )}

        {selectedId && !historyOpen && (
          <div className="absolute top-0 right-0 bottom-0 z-30 shadow-xl">
            <DrawerErrorBoundary onClose={() => setSelectedId(null)}>
              <NodeDetailDrawer
                selectedId={selectedId}
                nodes={scopedView.nodes}
                edges={scopedView.edges}
                viewer={currentViewer}
                selectedMonth={selectedMonth}
                onClose={() => setSelectedId(null)}
                onSelectNode={(id) => setSelectedId(id)}
                onNavigate={handleNavigate}
              />
            </DrawerErrorBoundary>
          </div>
        )}
      </div>
      </div>

      <ProjectCreateWizard
        open={isEditSupplyChainOpen}
        onClose={() => setIsEditSupplyChainOpen(false)}
        onEditSave={handleEditSupplyChainSave}
        editMode={true}
        initialParties={editableParties}
        initialProjectName={propProjectName || sessionStorage.getItem('currentProjectName') || ''}
      />
    </>
  );
}
