import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router";
import { userDisplayName } from "../utils/auth/display-name";
import {
  LayoutDashboard, Clock, FileText, CheckSquare, BarChart3, Receipt,
  Plus, Settings, Users, MessageSquare, X, Network, ShieldCheck, ClipboardCheck
} from "lucide-react";
import { ViewerSelector } from "./workgraph/WorkGraphBuilder";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { toast } from "sonner";
import { PILOT_HIDDEN_MODULE_IDS, SHOW_SOCIAL_FEATURES } from "../utils/feature-flags";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./ui/dropdown-menu";
import { MonthProvider } from "../contexts/MonthContext";
import { NotificationCenterBell } from "./notifications/InAppNotificationCenter";
import { ProjectInviteMemberDialog } from "./projects/ProjectInviteMemberDialog";
import { ProjectWorkerSetupDialog } from "./projects/ProjectWorkerSetupDialog";
import { ProjectConfigurationDrawer } from "./projects/ProjectConfigurationDrawer";
import { addProjectMember, getMyProjectMembership, getProject, getProjectMembers, updateProject } from "../utils/api/projects-api";
import { assignProjectMemberAsWorker } from "../utils/api/organizations-api";
import { getInvitableRolesForRole } from "../utils/collaboration/permissions";
import { withWorkspaceSearch, workspaceTab } from "../utils/workspace-link";
import { useAuth } from "../contexts/AuthContext";
import { useTimesheetStore } from "../contexts/TimesheetDataContext";
import type { ProjectMember, ProjectRole } from "../types/collaboration";
import { ALLOW_GRAPH_ADMIN_VIEW, buildViewerOptions, type ViewerIdentity } from "./workgraph/graph-visibility";
import { createClient } from "../utils/supabase/client";

const LazyWorkGraphBuilder = lazy(() =>
  import("./workgraph/WorkGraphBuilder").then((mod) => ({ default: mod.WorkGraphBuilder }))
);
const LazyProjectTimesheetsView = lazy(() =>
  import("./timesheets/ProjectTimesheetsView").then((mod) => ({ default: mod.ProjectTimesheetsView }))
);
const LazyProjectApprovalsTab = lazy(() =>
  import("./approvals/ProjectApprovalsTab").then((mod) => ({ default: mod.ProjectApprovalsTab }))
);
const LazyInvoicesWorkspace = lazy(() =>
  import("./invoices/InvoicesWorkspace").then((mod) => ({ default: mod.InvoicesWorkspace }))
);
const LazyCloseReadinessGate = lazy(() =>
  import("./close/CloseReadinessGate").then((mod) => ({ default: mod.CloseReadinessGate }))
);
const tabLoadingFallback = <div className="p-8 text-muted-foreground">Loading...</div>;

// Module definitions
type ModuleId = "overview" | "project-graph" | "timesheets" | "approvals" | "close" | "invoices" | "contracts" | "documents" | "tasks" | "analytics" | "team" | "messages" | "graph-snapshot";

interface Module {
  id: ModuleId;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  category: "core" | "optional";
  isEnabled: boolean;
  comingSoon?: boolean;
}

interface ProjectWorkspaceProps {
  projectId?: string;
  projectName?: string;
}

interface ProjectConfiguration {
  id: string;
  name: string;
  description?: string;
  approvalChain: any[];
  contracts: any[];
  settings: any;
  createdAt: string;
  status: 'active' | 'archived' | 'draft';
}

const LOCKED_GRAPH_VIEWER: ViewerIdentity = {
  nodeId: "__no_mapped_viewer__",
  type: "company",
  name: "No mapped graph identity",
};

const VIEWER_TYPES = ["admin", "company", "agency", "client", "freelancer", "party"];

function normalizeViewerType(type: string): ViewerIdentity["type"] {
  return type === "party" ? "company" : type as ViewerIdentity["type"];
}

function isAdminViewer(viewer: Partial<ViewerIdentity> | null | undefined): boolean {
  return viewer?.nodeId === "__admin__" || viewer?.type === "admin";
}

function getAllowedViewerIds(
  member: ProjectMember | null,
  role: ProjectRole | null,
  userId?: string
): Set<string> {
  const ids = new Set<string>();
  if (userId) ids.add(userId);
  if (member?.graphNodeId) ids.add(member.graphNodeId);
  // Until org roles exist, org-level viewing is limited to people who can operate
  // the project shell. GSEC will replace this with org_admin/org_pm/org_finance.
  if (role === "Owner" || role === "Editor") {
    if (member?.scope) ids.add(member.scope);
    // Managers can EDIT the whole graph (canEditGraph = canManageProject), so
    // they must be able to SEE it even without a personal graph-node mapping.
    // Grant the full-project (admin) view. M2's server projection will scope
    // rates to their own org; today the client filter still applies.
    ids.add("__admin__");
  }
  return ids;
}

function isViewerAllowed(
  viewer: ViewerIdentity | null | undefined,
  allowedViewerIds: Set<string>
): viewer is ViewerIdentity {
  if (!viewer) return false;
  // Admin/full view is allowed when the debug flag is on OR when this viewer is
  // a project manager (getAllowedViewerIds adds "__admin__" for Owner/Editor).
  if (isAdminViewer(viewer)) {
    return ALLOW_GRAPH_ADMIN_VIEW || allowedViewerIds.has("__admin__");
  }
  return allowedViewerIds.has(viewer.nodeId);
}

export function ProjectWorkspace({ 
  projectId: propProjectId,
  projectName: propProjectName,
}: ProjectWorkspaceProps) {
  const { user, accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const storedProjectId = sessionStorage.getItem('currentProjectId');
  const queryProjectId = searchParams.get('projectId')?.trim() || '';
  const storedIsDemo = !storedProjectId || storedProjectId === 'proj-alpha';

  const projectId = propProjectId || queryProjectId || (storedIsDemo ? '' : storedProjectId);
  const [projectName, setProjectName] = useState(
    propProjectName || sessionStorage.getItem('currentProjectName') || 'Project'
  );

  useEffect(() => {
    if (!projectId) return;
    // The query-selected project replaces whatever the session stored, before
    // timesheets and other listeners reread currentProjectId.
    const previousId = sessionStorage.getItem('currentProjectId');
    sessionStorage.setItem('currentProjectId', projectId);
    if (previousId && previousId !== projectId) {
      sessionStorage.removeItem('currentProjectName');
    }
    window.dispatchEvent(new CustomEvent('workgraph-project-changed', {
      detail: { projectId },
    }));
  }, [projectId]);
  
  // The stored name belongs to the previous project until this one loads.
  useEffect(() => {
    if (propProjectName) {
      setProjectName(propProjectName);
      return;
    }
    setProjectName(projectId ? `Project ${projectId.slice(0, 8)}` : 'Project');
  }, [projectId, propProjectName]);

  // Get hash params for deep linking (works in Figma Make iframe)
  const getHashParams = () => {
    if (typeof window === 'undefined') return new URLSearchParams();
    const hash = window.location.hash.slice(1); // Remove #
    return new URLSearchParams(hash);
  };
  
  const hashParams = getHashParams();
  const focusNodeId = hashParams.get('focus') || undefined;
  const scope = (hashParams.get('scope') as 'approvals' | 'money' | 'people' | 'access') || 'approvals';
  const mode = (hashParams.get('mode') as 'view' | 'edit') || 'view';
  const asOf = hashParams.get('asOf') || 'now';

  // Initial state: Core modules enabled, optional modules disabled
  const [modules, setModules] = useState<Module[]>([
    {
      id: "overview",
      name: "Overview",
      icon: LayoutDashboard,
      description: "Project dashboard and key metrics",
      category: "core",
      isEnabled: true,
    },
    {
      id: "project-graph",
      name: "Project Graph",
      icon: Network,
      description: "Visual project structure and approval flows",
      category: "core",
      isEnabled: true,
    },
    {
      id: "timesheets",
      name: "Timesheets",
      icon: Clock,
      description: "Track and approve contractor hours",
      category: "core",
      isEnabled: true,
    },
    {
      id: "approvals",
      name: "Approvals",
      icon: CheckSquare,
      description: "Manage pending approvals and tasks",
      category: "core",
      isEnabled: true,
    },
    {
      id: "close",
      name: "Close",
      icon: ClipboardCheck,
      description: "Missing hours, pending approver, rate, and PO for each worker-month",
      category: "core",
      isEnabled: true,
    },
    {
      id: "invoices",
      name: "Invoices",
      icon: Receipt,
      description: "Generate and manage invoices from approved timesheets",
      category: "core",
      isEnabled: true,
    },
    {
      id: "contracts",
      name: "Contracts",
      icon: FileText,
      description: "Manage agreements, NDAs, and SOWs",
      category: "core",
      isEnabled: true,
    },
    {
      id: "documents",
      name: "Documents",
      icon: FileText,
      description: "Store project files and deliverables",
      category: "core",
      isEnabled: true,
    },
    // Optional modules (can be toggled on/off)
    {
      id: "graph-snapshot",
      name: "Graph Snapshot",
      icon: Network,
      description: "Quick health check of project structure (adds to Overview)",
      category: "optional",
      isEnabled: false,
    },
    {
      id: "tasks",
      name: "Tasks",
      icon: CheckSquare,
      description: "Lightweight task tracking and milestones",
      category: "optional",
      isEnabled: false,
      comingSoon: true,
    },
    {
      id: "analytics",
      name: "Analytics",
      icon: BarChart3,
      description: "Budget tracking and performance metrics",
      category: "optional",
      isEnabled: false,
      comingSoon: true,
    },
    {
      id: "team",
      name: "Team",
      icon: Users,
      description: "Manage project members and permissions",
      category: "optional",
      isEnabled: false,
      comingSoon: true,
    },
    {
      id: "messages",
      name: "Messages",
      icon: MessageSquare,
      description: "Project-specific chat and discussions",
      category: "optional",
      isEnabled: false,
      comingSoon: true,
    },
  ]);

  const [activeTab, setActiveTab] = useState<ModuleId>(
    workspaceTab(searchParams.get('tab')) as ModuleId,
  );

  useEffect(() => {
    if (!projectId || searchParams.get('projectId') === projectId) return;
    const next = new URLSearchParams(searchParams);
    next.set('projectId', projectId);
    setSearchParams(next, { replace: true });
  }, [projectId, searchParams, setSearchParams]);

  const openTab = (moduleId: ModuleId) => {
    setActiveTab(moduleId);
    setSearchParams((prev) => withWorkspaceSearch(prev, { tab: moduleId }), { replace: true });
  };

  useEffect(() => {
    const requested = searchParams.get('tab');
    const tab = workspaceTab(requested) as ModuleId;
    setActiveTab((current) => (current === tab ? current : tab));
    if (requested && requested !== tab) {
      setSearchParams((prev) => withWorkspaceSearch(prev, { tab }), { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectConfiguration | undefined>();
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  // Set when the server refuses the project (not a member / unknown id). The
  // workspace used to render every tab as an empty shell for such users.
  const [projectAccessDenied, setProjectAccessDenied] = useState(false);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [projectDescription, setProjectDescription] = useState("");
  const [projectParties, setProjectParties] = useState<Array<{ id: string; name: string; partyType?: string }>>([]);
  // Lets the Settings drawer tell "0 parties" apart from "parties haven't loaded yet / failed to load".
  const [projectPartiesStatus, setProjectPartiesStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>([]);
  const [selfMembership, setSelfMembership] = useState<ProjectMember | null>(null);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [workerSetupMember, setWorkerSetupMember] = useState<ProjectMember | null>(null);
  const [ownerOrganizationName, setOwnerOrganizationName] = useState("");
  const [ownerPartyId, setOwnerPartyId] = useState<string | null>(null);
  const [projectGraphViewers, setProjectGraphViewers] = useState<ViewerIdentity[]>([]);
  const [activeGraphViewer, setActiveGraphViewer] = useState<ViewerIdentity | null>(null);
  const [workspaceViewer, setWorkspaceViewer] = useState<ViewerIdentity | null>(null);
  const [workspaceViewerOptions, setWorkspaceViewerOptions] = useState<ViewerIdentity[]>([]);

  const pilotVisible = (moduleId: ModuleId) =>
    SHOW_SOCIAL_FEATURES || !PILOT_HIDDEN_MODULE_IDS.includes(moduleId as typeof PILOT_HIDDEN_MODULE_IDS[number]);
  const enabledModules = modules.filter(m => m.isEnabled && pilotVisible(m.id));
  const availableModules = modules.filter(m => !m.isEnabled && m.category === "optional" && pilotVisible(m.id));
  const currentMembership = useMemo(() => {
    if (!user) return null;
    const email = user.email?.toLowerCase();
    return (
      selfMembership ||
      teamMembers.find((member) => member.userId && member.userId === user.id) ||
      teamMembers.find((member) => email && member.userEmail?.toLowerCase() === email) ||
      null
    );
  }, [selfMembership, teamMembers, user]);
  const currentProjectRole = useMemo<ProjectRole | null>(() => {
    if (user?.id && projectOwnerId && user.id === projectOwnerId) return "Owner";
    return currentMembership?.role || null;
  }, [currentMembership?.role, projectOwnerId, user?.id]);
  const canManageProject = currentProjectRole === "Owner" || currentProjectRole === "Editor";
  // Month close and invoicing are the billing side of the project. Workers
  // (Contributors) submit time; they don't close months or see invoices.
  const BILLING_MODULE_IDS: ModuleId[] = ["close", "invoices"];
  const hideBillingModules = currentProjectRole === "Contributor";
  const visibleModules = hideBillingModules
    ? enabledModules.filter((module) => !BILLING_MODULE_IDS.includes(module.id))
    : enabledModules;
  const canInviteMembers = getInvitableRolesForRole(currentProjectRole).length > 0;
  // A project role opens the workspace; an accepted organization scope limits
  // which party the member may administer inside the shared supply chain.
  const editablePartyIds = currentMembership?.scope
    ? [currentMembership.scope]
    : currentProjectRole === "Owner" && ownerPartyId
      ? [ownerPartyId]
      : [];
  const canEditGraph = canManageProject && editablePartyIds.length > 0;
  // Companies this user invoices FROM: a manager's own company, or the
  // company of a party approver (they set its link rates and issue its
  // invoices, e.g. the Sub's director billing the Agency). The database
  // (wg_invoice_caller_controls_party) makes the same check.
  const billingPartyIds = canManageProject
    ? editablePartyIds
    : (currentMembership?.canApprove && currentMembership?.scope ? [currentMembership.scope] : []);
  // Adding/removing organizations mirrors the server rule: project owner, or
  // an Editor of the creator (owner) organization.
  const canManageStructure = canEditGraph && (
    currentProjectRole === "Owner" ||
    (currentProjectRole === "Editor" && !!ownerPartyId && currentMembership?.scope === ownerPartyId)
  );
  const visibleTeamCount = dedupeTeamMembers(teamMembers).length;
  const teamButtonLabel = visibleTeamCount > 0 ? `Team (${visibleTeamCount})` : "Team";
  const allowedViewerIds = useMemo(
    () => getAllowedViewerIds(currentMembership, currentProjectRole, user?.id),
    [currentMembership, currentProjectRole, user?.id]
  );

  const enableAndOpenModule = (moduleId: ModuleId) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, isEnabled: true } : m));
    openTab(moduleId);
  };

  const handleOpenTeam = () => {
    if (!canManageProject) return;
    enableAndOpenModule("team");
  };

  const handleOpenSettings = () => {
    if (!canManageProject) return;
    setEditingProject({
      id: projectId,
      name: projectName,
      description: projectDescription,
      // Prefill from the project's real parties (graph party nodes).
      approvalChain: projectParties.map((party, index) => ({
        id: party.id,
        type: party.partyType === "client" || party.partyType === "agency" || party.partyType === "contractor"
          ? party.partyType
          : "company",
        organizationName: party.name,
        role: "",
        order: index,
        canApprove: true,
        canViewRates: false,
        canEditTimesheets: false,
      })),
      contracts: [],
      settings: {
        requireSequentialApproval: true,
        allowBulkApproval: true,
        monthlyInvoicing: true,
      },
      createdAt: new Date().toISOString(),
      status: projectStatus === "draft" || projectStatus === "archived" ? projectStatus : "active",
    });
    setIsDrawerOpen(true);
  };

  const handleSaveProject = async (project: ProjectConfiguration) => {
    const nextName = project.name?.trim() || projectName;
    try {
      await updateProject(projectId, { name: nextName, description: project.description || "" }, accessToken);
    } catch (error) {
      toast.error('Project settings were not saved', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
      return;
    }
    setProjectName(nextName);
    setProjectDescription(project.description || "");
    sessionStorage.setItem('currentProjectName', nextName);
    toast.success('Project name and description saved');
  };

  const loadTeamMembers = async () => {
    if (!projectId) return;
    setIsTeamLoading(true);
    try {
      const members = await getProjectMembers(projectId, accessToken);
      setTeamMembers(members);
    } catch {
      setTeamMembers([]);
    } finally {
      setIsTeamLoading(false);
    }
  };

  useEffect(() => {
    loadTeamMembers();
  }, [projectId, accessToken]);

  useEffect(() => {
    let cancelled = false;
    if (!projectId || !user?.id) {
      setSelfMembership(null);
      return;
    }

    void getMyProjectMembership(projectId, user.id)
      .then((membership) => {
        if (!cancelled) setSelfMembership(membership);
      })
      .catch(() => {
        if (!cancelled) setSelfMembership(null);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setProjectOwnerId(null);
      return;
    }

    setProjectPartiesStatus('loading');

    const loadProjectMeta = async () => {
      try {
        const data = await getProject(projectId, accessToken);
        if (!cancelled) {
          setProjectPartiesStatus('loaded');
          setProjectAccessDenied(false);
          const loadedName = data?.project?.name;
          if (loadedName) {
            setProjectName(loadedName);
            sessionStorage.setItem('currentProjectName', loadedName);
          }
          setProjectOwnerId(data?.project?.ownerId || null);
          setProjectStatus(typeof data?.project?.status === 'string' ? data.project.status : null);
          setProjectDescription(typeof data?.project?.description === 'string' ? data.project.description : "");
          if (!propProjectName && typeof data?.project?.name === 'string' && data.project.name.trim()) {
            setProjectName(data.project.name);
          }
          const graphNodes = Array.isArray(data?.project?.graph?.nodes) ? data.project.graph.nodes : [];
          const graphEdges = Array.isArray(data?.project?.graph?.edges) ? data.project.graph.edges : [];
          const creatorParty = graphNodes.find((node: any) => node?.type === 'party' && node?.data?.isCreator);
          setProjectParties(
            graphNodes
              .filter((node: any) => node?.type === 'party')
              .map((node: any) => ({
                id: String(node.id),
                name: String(node?.data?.name || ''),
                partyType: node?.data?.partyType,
              }))
          );
          setOwnerOrganizationName(creatorParty?.data?.name || "");
          setOwnerPartyId(creatorParty?.id || null);
          setProjectGraphViewers(buildViewerOptions(graphNodes, graphEdges));
        }
      } catch (error: any) {
        if (!cancelled) {
          setProjectPartiesStatus('error');
          const message = String(error?.message || '');
          setProjectAccessDenied(/forbidden|not found|not a member/i.test(message));
          setProjectOwnerId(null);
          setProjectStatus(null);
          setProjectParties([]);
          setOwnerPartyId(null);
          setProjectGraphViewers([]);
        }
      }
    };

    void loadProjectMeta();
    return () => {
      cancelled = true;
    };
  }, [projectId, accessToken]);

  useEffect(() => {
    if (!canManageProject && activeTab === "team") {
      openTab("overview");
    }
  }, [activeTab, canManageProject]);

  useEffect(() => {
    if (!pilotVisible(activeTab) || (hideBillingModules && (activeTab === "close" || activeTab === "invoices"))) {
      openTab("overview");
    }
  }, [activeTab, hideBillingModules]);

  useEffect(() => {
    const viewerMetaStorageKey = `workgraph-viewer-meta:${projectId}`;
    const raw = sessionStorage.getItem(viewerMetaStorageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!isViewerAllowed(parsed as ViewerIdentity, allowedViewerIds)) {
          sessionStorage.removeItem(viewerMetaStorageKey);
          sessionStorage.removeItem(`workgraph-viewer:${projectId}`);
          setActiveGraphViewer(null);
          setWorkspaceViewer(null);
        } else if (parsed?.nodeId && parsed?.type) {
          const viewer = parsed as ViewerIdentity;
          setActiveGraphViewer(viewer);
          setWorkspaceViewer(viewer);
        }
      } catch {
        // Ignore malformed viewer payloads
      }
    }

    const nameDirKey = `workgraph-name-dir:${projectId}`;

    const buildViewersFromNameDir = (): ViewerIdentity[] => {
      const result: ViewerIdentity[] = (ALLOW_GRAPH_ADMIN_VIEW || canManageProject)
        ? [{
            nodeId: '__admin__',
            type: 'admin',
            name: ALLOW_GRAPH_ADMIN_VIEW ? 'Admin (Full View)' : 'All parties',
          }]
        : [];
      // Try sessionStorage first, fall back to localStorage
      let nameDirRaw = sessionStorage.getItem(nameDirKey);
      if (!nameDirRaw) {
        try {
          const lsRaw = localStorage.getItem(nameDirKey);
          if (lsRaw) {
            nameDirRaw = lsRaw;
            // Promote to sessionStorage for faster subsequent reads
            sessionStorage.setItem(nameDirKey, lsRaw);
          }
        } catch { /* ignore */ }
      }
      if (nameDirRaw) {
        try {
          const parsed = JSON.parse(nameDirRaw) as Record<string, { name?: string; type?: string; orgId?: string }>;
          Object.entries(parsed).forEach(([nodeId, meta]) => {
            if (!meta?.name || !meta?.type) return;
            if (!VIEWER_TYPES.includes(meta.type)) return;
            const viewer = { nodeId, type: normalizeViewerType(meta.type), name: meta.name, orgId: meta.orgId };
            if (isViewerAllowed(viewer, allowedViewerIds)) {
              result.push(viewer);
            }
          });
        } catch { /* Ignore malformed viewer directory */ }
      }

      projectGraphViewers.forEach((viewer) => {
        if (!isViewerAllowed(viewer, allowedViewerIds)) return;
        if (!result.some((existing) => existing.nodeId === viewer.nodeId)) {
          result.push(viewer);
        }
      });
      return result;
    };
    const initialOptions = buildViewersFromNameDir();
    setWorkspaceViewerOptions(initialOptions);
    setWorkspaceViewer((current) => (
      isViewerAllowed(current, allowedViewerIds)
        ? current
        : initialOptions.find((viewer) => !isAdminViewer(viewer)) || initialOptions[0] || null
    ));

    const onViewerChanged = (event: Event) => {
      const custom = event as CustomEvent<{ projectId?: string; viewer?: ViewerIdentity }>;
      if (!custom.detail?.viewer || custom.detail?.projectId !== projectId) return;
      if (!isViewerAllowed(custom.detail.viewer, allowedViewerIds)) {
        sessionStorage.removeItem(viewerMetaStorageKey);
        sessionStorage.removeItem(`workgraph-viewer:${projectId}`);
        setActiveGraphViewer(null);
        setWorkspaceViewer(null);
        setWorkspaceViewerOptions(buildViewersFromNameDir());
        return;
      }
      setActiveGraphViewer(custom.detail.viewer);
      setWorkspaceViewer(custom.detail.viewer);
      setWorkspaceViewerOptions(buildViewersFromNameDir());
    };

    // Also listen for name directory updates (fired by WorkGraphBuilder when graph loads)
    const onNameDirUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ projectId?: string }>;
      if (custom.detail?.projectId !== projectId) return;
      setWorkspaceViewerOptions(buildViewersFromNameDir());
    };

    window.addEventListener('workgraph-viewer-changed', onViewerChanged);
    window.addEventListener('workgraph-namedir-updated', onNameDirUpdated);
    return () => {
      window.removeEventListener('workgraph-viewer-changed', onViewerChanged);
      window.removeEventListener('workgraph-namedir-updated', onNameDirUpdated);
    };
  }, [projectId, allowedViewerIds, projectGraphViewers, canManageProject]);

  const resolveStoredViewer = (): ViewerIdentity | null => {
    const key = `workgraph-viewer-meta:${projectId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return activeGraphViewer;
    try {
      const parsed = JSON.parse(raw);
      if (!isViewerAllowed(parsed as ViewerIdentity, allowedViewerIds)) {
        sessionStorage.removeItem(key);
        sessionStorage.removeItem(`workgraph-viewer:${projectId}`);
        return activeGraphViewer?.type === 'admin' ? null : activeGraphViewer;
      }
      if (parsed?.nodeId && parsed?.type && parsed?.name) {
        return parsed as ViewerIdentity;
      }
    } catch {
      // Ignore malformed storage payload
    }
    return activeGraphViewer;
  };

  const resolvedStoredViewer = resolveStoredViewer();
  const effectiveViewer =
    (isViewerAllowed(workspaceViewer, allowedViewerIds) ? workspaceViewer : null) ||
    (isViewerAllowed(resolvedStoredViewer, allowedViewerIds) ? resolvedStoredViewer : null) ||
    workspaceViewerOptions.find((viewer) => !isAdminViewer(viewer)) ||
    workspaceViewerOptions[0] ||
    LOCKED_GRAPH_VIEWER;

  const handleInviteMember = async (payload: { userName?: string; userEmail: string; role: ProjectRole }) => {
    await addProjectMember(projectId, payload, accessToken);
    toast.success(`Invitation sent to ${payload.userEmail}`);
    await loadTeamMembers();
  };

  const handleSetUpWorker = async (values: {
    organizationName: string;
    displayName: string;
    placementTitle: string;
  }) => {
    if (!workerSetupMember) return;
    const result = await assignProjectMemberAsWorker({
      projectId,
      memberId: workerSetupMember.id,
      ...values,
    });
    setOwnerOrganizationName(result.organizationName);
    await loadTeamMembers();
    if (user?.id) {
      setSelfMembership(await getMyProjectMembership(projectId, user.id));
    }
    window.dispatchEvent(new CustomEvent('workgraph-project-updated', { detail: { projectId } }));
    toast.success(`${result.displayName} is ready to submit timesheets`, {
      description: `Added to ${result.organizationName} as ${result.placementTitle}.`,
    });
  };

  // Listen for custom tab change events (from deep links)
  useEffect(() => {
    const handleTabChange = (event: CustomEvent<ModuleId>) => {
      openTab(event.detail);
    };
    
    window.addEventListener('changeTab', handleTabChange as EventListener);
    return () => window.removeEventListener('changeTab', handleTabChange as EventListener);
  }, []);

  const handleToggleModule = (moduleId: ModuleId) => {
    setModules(prev => prev.map(m => 
      m.id === moduleId ? { ...m, isEnabled: !m.isEnabled } : m
    ));
    
    const module = modules.find(m => m.id === moduleId);
    if (module && !module.isEnabled) {
      toast.success(`${module.name} module added to project`);
      openTab(moduleId);
    } else if (module && module.isEnabled) {
      toast.success(`${module.name} module removed`);
    }
  };

  const handleAddModule = (moduleId: ModuleId) => {
    const module = modules.find(m => m.id === moduleId);
    if (module?.comingSoon) {
      toast.info(`${module.name} is coming soon! We'll notify you when it's ready.`);
      return;
    }
    handleToggleModule(moduleId);
    setIsAddModuleOpen(false);
  };

  if (projectAccessDenied) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-3" data-testid="project-access-denied">
          <h1 className="m-0 text-xl font-semibold">You don't have access to this project</h1>
          <p className="text-sm text-muted-foreground m-0">
            It doesn't exist or you are not a member. Ask the project owner to invite you, then accept the invite on your Projects page.
          </p>
          <Button variant="outline" size="sm" onClick={() => { window.location.href = '/app/projects'; }}>
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Project Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="m-0">{projectName}</h1>
                {projectStatus ? (
                  <Badge variant={projectStatus === "active" ? "secondary" : "outline"}>
                    {projectStatus === "draft"
                      ? "Draft"
                      : projectStatus === "archived"
                        ? "Archived"
                        : projectStatus === "active"
                          ? "Active"
                          : projectStatus}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground m-0">
                Project workspace
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <NotificationCenterBell />
              {canManageProject ? (
                <>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenTeam}>
                    <Users className="w-4 h-4" />
                    {teamButtonLabel}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenSettings}>
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                </>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            {workspaceViewerOptions.length > 0 ? (
              <ViewerSelector
                viewers={workspaceViewerOptions}
                current={effectiveViewer}
                onChange={(viewer) => {
                  if (!isViewerAllowed(viewer, allowedViewerIds)) return;
                  setWorkspaceViewer(viewer);
                  setActiveGraphViewer(viewer);
                  sessionStorage.setItem(`workgraph-viewer-meta:${projectId}`, JSON.stringify(viewer));
                  sessionStorage.setItem(`workgraph-viewer:${projectId}`, viewer.nodeId);
                  window.dispatchEvent(new CustomEvent('workgraph-viewer-changed', {
                    detail: { projectId, viewer },
                  }));
                }}
              />
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Not yet linked to a party in this project
              </Badge>
            )}
          </div>
          {currentMembership?.acceptedAt && !currentMembership.graphNodeId && currentProjectRole !== 'Owner' ? (
            currentMembership.role === 'Contributor' ? (
              // Contributors CAN become mapped workers — this promise is real.
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="m-0 text-sm font-medium">Your project access is active</p>
                  <p className="mb-0 mt-1 text-sm opacity-80">
                    You joined {projectName} as a Contributor. A project owner still needs to set you up
                    as a worker (Team → Set up as worker) before you can log time.
                  </p>
                </div>
              </div>
            ) : (
              // Editors/Commenters/Viewers are managers/observers — they never
              // get a worker identity, so don't promise one.
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="m-0 text-sm font-medium">You're a {currentMembership.role} on {projectName}</p>
                  <p className="mb-0 mt-1 text-sm opacity-80">
                    {currentMembership.role}s help manage the project — they don't submit timesheets, so
                    there's no worker identity to assign. Workers are invited as Contributors.
                  </p>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Modular Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <MonthProvider key={projectId}>
          <Tabs value={activeTab} onValueChange={(v) => openTab(v as ModuleId)}>
            {/* Tab List with (+) Button */}
            <div className="flex items-center gap-2 mb-6">
              <TabsList className="flex-1">
                {visibleModules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <TabsTrigger 
                      key={module.id} 
                      value={module.id}
                      className="gap-2 relative group"
                    >
                      <Icon className="w-4 h-4" />
                      {module.name}
                      
                      {/* Remove button (only for optional modules) */}
                      {module.category === "optional" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleModule(module.id);
                          }}
                          className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-sm p-0.5 apple-transition"
                          title={`Remove ${module.name}`}
                        >
                          <X className="w-3 h-3 text-destructive" />
                        </button>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Add Module Button */}
              <Dialog open={isAddModuleOpen} onOpenChange={setIsAddModuleOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 flex-shrink-0">
                    <Plus className="w-4 h-4" />
                    Add Module
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Module to Project</DialogTitle>
                    <DialogDescription>
                      Customize this project workspace by adding modules that fit your workflow
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-3 mt-4">
                    {availableModules.length > 0 ? (
                      availableModules.map((module) => {
                        const Icon = module.icon;
                        return (
                          <button
                            key={module.id}
                            onClick={() => handleAddModule(module.id)}
                            className="w-full p-4 rounded-lg border border-border hover:border-accent-brand hover:bg-accent/30 apple-transition text-left flex items-start gap-3 group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-accent-brand/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent-brand/20 apple-transition">
                              <Icon className="w-5 h-5 text-accent-brand" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold m-0">{module.name}</p>
                                {module.comingSoon && (
                                  <Badge variant="secondary" className="text-xs">
                                    Coming Soon
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground m-0">
                                {module.description}
                              </p>
                            </div>
                            <Plus className="w-5 h-5 text-muted-foreground group-hover:text-accent-brand flex-shrink-0 apple-transition" />
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-center py-12">
                        <CheckSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="mb-2">All modules enabled!</h3>
                        <p className="text-sm text-muted-foreground">
                          You're using all available modules for this project.
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Tab Content */}
            <TabsContent value="overview" className="space-y-6">
              <OverviewModule projectName={projectName} teamSize={visibleTeamCount} />
            </TabsContent>

            <TabsContent value="project-graph" className="space-y-6">
              <Suspense fallback={tabLoadingFallback}>
                <LazyWorkGraphBuilder
                  projectId={projectId}
                  focusNodeId={focusNodeId}
                  scope={scope}
                  mode={mode}
                  asOf={asOf}
                  canEditGraph={canEditGraph}
                  editablePartyIds={editablePartyIds}
                  canManageStructure={canManageStructure}
                  allowFullProjectView={canManageProject}
                  currentViewer={effectiveViewer}
                  onViewerChange={(viewer) => {
                    setWorkspaceViewer(viewer);
                    setActiveGraphViewer(viewer);
                  }}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="timesheets" className="space-y-6">
              <Suspense fallback={tabLoadingFallback}>
                <LazyProjectTimesheetsView
                  projectId={projectId}
                  ownerId={user?.id || "current-user"}
                  ownerName={userDisplayName(user, "Current User")}
                  contractors={[]}
                  viewerOverride={effectiveViewer ? {
                    id: effectiveViewer.nodeId,
                    type: effectiveViewer.type,
                    name: effectiveViewer.name,
                    orgId: effectiveViewer.orgId,
                  } : undefined}
                  serverScoped={!canManageProject}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="approvals" className="space-y-6">
              <Suspense fallback={tabLoadingFallback}>
                <LazyProjectApprovalsTab
                  projectId={projectId}
                  projectName={projectName}
                  viewerName={effectiveViewer?.name}
                  viewerNodeId={effectiveViewer?.nodeId}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="close" className="space-y-6">
              <Suspense fallback={tabLoadingFallback}>
                {hideBillingModules ? null : (
                <LazyCloseReadinessGate
                  projectId={projectId}
                  projectName={projectName}
                  canConfirmRates={currentProjectRole === "Owner" || currentProjectRole === "Editor"}
                  members={teamMembers}
                />
                )}
              </Suspense>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-6">
              <Suspense fallback={tabLoadingFallback}>
                {hideBillingModules ? null : (
                <LazyInvoicesWorkspace
                  projectId={projectId}
                  projectName={projectName}
                  canGenerateInvoices={billingPartyIds.length > 0}
                  billingPartyIds={billingPartyIds}
                />
                )}
              </Suspense>
            </TabsContent>

            <TabsContent value="contracts" className="space-y-6">
              <ContractsModule projectId={projectId} />
            </TabsContent>

            <TabsContent value="documents" className="space-y-6">
              <DocumentsModule projectId={projectId} />
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6">
              <TasksModule />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <AnalyticsModule />
            </TabsContent>

            <TabsContent value="team" className="space-y-6">
              <TeamModule
                members={teamMembers}
                projectOwnerId={projectOwnerId}
                loading={isTeamLoading}
                canManageMembers={canInviteMembers}
                canSetUpWorkers={currentProjectRole === "Owner"}
                onInvite={() => setIsInviteOpen(true)}
                onRefresh={loadTeamMembers}
                onSetUpWorker={setWorkerSetupMember}
              />
            </TabsContent>

            <TabsContent value="messages" className="space-y-6">
              <MessagesModule />
            </TabsContent>
          </Tabs>
        </MonthProvider>
      </div>

      {/* Mount only while open so the drawer's state initialises from the
          current project (it used to mount empty: blank name, 0 parties). */}
      {canManageProject && isDrawerOpen && editingProject ? (
        <ProjectConfigurationDrawer
          key={editingProject.id}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setEditingProject(undefined);
          }}
          project={editingProject}
          partiesStatus={projectPartiesStatus}
          onSave={handleSaveProject}
        />
      ) : null}

      {currentProjectRole === "Owner" ? (
        <ProjectWorkerSetupDialog
          open={Boolean(workerSetupMember)}
          member={workerSetupMember}
          suggestedOrganizationName={ownerOrganizationName}
          onOpenChange={(open) => {
            if (!open) setWorkerSetupMember(null);
          }}
          onSubmit={handleSetUpWorker}
        />
      ) : null}

      {canManageProject ? (
        <ProjectInviteMemberDialog
          open={isInviteOpen}
          projectId={projectId}
          projectName={projectName}
          currentUserRole={currentProjectRole}
          onOpenChange={setIsInviteOpen}
          onInvite={handleInviteMember}
        />
      ) : null}
    </div>
  );
}

// Module Components (placeholders for now)

function OverviewModule({ projectName, teamSize }: { projectName: string; teamSize: number }) {
  const store = useTimesheetStore();

  // Derive real stats from timesheet store
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const allWeeks = store.getAllWeeksForMonth(currentMonthKey);
  const totalHours = allWeeks.reduce((s, w) => s + w.days.reduce((a, d) => a + (d.hours || 0), 0), 0);
  const approvedHours = allWeeks.filter(w => w.status === 'approved').reduce((s, w) => s + w.days.reduce((a, d) => a + (d.hours || 0), 0), 0);
  const pendingCount = allWeeks.filter(w => w.status === 'submitted').length;
  const rejectedCount = allWeeks.filter(w => w.status === 'rejected').length;
  const draftCount = allWeeks.filter(w => w.status === 'draft').length;
  const uniquePeople = new Set(allWeeks.map(w => w.personId)).size;

  const handleDeepLink = (tab: string) => {
    const event = new CustomEvent('changeTab', { detail: tab });
    window.dispatchEvent(event);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDeepLink('timesheets')}>
        <p className="text-sm text-muted-foreground mb-2">Hours This Month</p>
        <p className="text-3xl font-semibold mb-1">{totalHours}h</p>
        <p className="text-sm text-muted-foreground">
          {approvedHours}h approved · {uniquePeople} {uniquePeople === 1 ? 'person' : 'people'} logged time
        </p>
      </Card>

      <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDeepLink('approvals')}>
        <p className="text-sm text-muted-foreground mb-2">Pending Approvals</p>
        <p className="text-3xl font-semibold mb-1">{pendingCount}</p>
        <p className="text-sm text-amber-600">
          {pendingCount > 0 ? 'Timesheets need review' : 'All caught up'}
        </p>
      </Card>

      <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDeepLink('project-graph')}>
        <p className="text-sm text-muted-foreground mb-2">Week Status</p>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold">{allWeeks.length}</span>
          <span className="text-sm text-muted-foreground">weeks</span>
        </div>
        <div className="flex gap-2 mt-2 text-xs">
          {draftCount > 0 && <Badge variant="outline">{draftCount} draft</Badge>}
          {pendingCount > 0 && <Badge className="bg-amber-100 text-amber-700 border-amber-200">{pendingCount} pending</Badge>}
          {rejectedCount > 0 && <Badge className="bg-red-100 text-red-700 border-red-200">{rejectedCount} rejected</Badge>}
        </div>
      </Card>

      <Card className="md:col-span-3 p-6">
        <h3 className="mb-3 font-semibold">{projectName}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Hours</p>
            <p className="font-semibold text-lg">{totalHours}h</p>
          </div>
          <div>
            <p className="text-muted-foreground">Approved</p>
            <p className="font-semibold text-lg text-emerald-600">{approvedHours}h</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pending Review</p>
            <p className="font-semibold text-lg text-amber-600">{pendingCount} weeks</p>
          </div>
          <div>
            <p className="text-muted-foreground">Team Size</p>
            <p className="font-semibold text-lg">{teamSize}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}



const CONTRACT_DOCUMENT_TYPES = new Set(["nda", "contract", "sow", "rate_card", "change_order"]);

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  nda: "NDA",
  contract: "Contract",
  sow: "SOW",
  invoice: "Invoice",
  purchase_order: "Purchase order",
  expense_report: "Expense report",
  deliverable_signoff: "Deliverable sign-off",
  change_order: "Change order",
  compliance: "Compliance",
  rate_card: "Rate card",
  other: "Other",
};

interface ProjectDocumentRow {
  id: string;
  type: string;
  title: string;
  status: string;
  file_name?: string | null;
  created_at?: string | null;
}

// Real documents stored for this project (wg_documents). No seed/demo rows:
// a new project shows an empty state, not invented agreements or files.
function useProjectDocuments(projectId: string) {
  const [rows, setRows] = useState<ProjectDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageMissing, setStorageMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStorageMissing(false);
    if (!projectId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void createClient()
      .from("wg_documents")
      .select("id, type, title, status, file_name, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          // PGRST205: the wg_documents table is not in this database yet
          // (migration 006 not applied). That is "nothing stored", not an outage.
          if (queryError.code === "PGRST205" || queryError.code === "42P01") {
            setStorageMissing(true);
            setError(null);
          } else {
            setError("Documents could not be loaded right now.");
          }
          setRows([]);
        } else {
          setRows(Array.isArray(data) ? (data as ProjectDocumentRow[]) : []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { rows, loading, error, storageMissing };
}

function formatDocumentStatus(status: string) {
  return status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function formatDocumentDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function DocumentList({
  rows,
  loading,
  error,
  emptyTitle,
  emptyText,
  storageMissing = false,
}: {
  rows: ProjectDocumentRow[];
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  emptyText: string;
  storageMissing?: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }
  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium mb-1">{emptyTitle}</p>
        <p className="text-sm text-muted-foreground m-0">
          {storageMissing ? "Document storage is not enabled for this workspace yet, so nothing has been uploaded." : emptyText}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-accent-brand" />
            <div>
              <p className="font-medium">{doc.title || doc.file_name || "Untitled document"}</p>
              <p className="text-sm text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                {formatDocumentDate(doc.created_at) ? ` · ${formatDocumentDate(doc.created_at)}` : ""}
              </p>
            </div>
          </div>
          <Badge variant={doc.status === "signed" ? "default" : "secondary"}>
            {formatDocumentStatus(doc.status)}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function ContractsModule({ projectId }: { projectId: string }) {
  const { rows, loading, error, storageMissing } = useProjectDocuments(projectId);
  const contracts = rows.filter((row) => CONTRACT_DOCUMENT_TYPES.has(row.type));
  return (
    <Card className="p-6">
      <h3 className="mb-4">Contracts & Legal Documents</h3>
      <p className="text-muted-foreground mb-4">
        Agreements, NDAs, and statements of work recorded for this project.
      </p>
      <DocumentList
        rows={contracts}
        loading={loading}
        error={error}
        storageMissing={storageMissing}
        emptyTitle="No contracts yet"
        emptyText="Contracts recorded for this project will appear here. Rates between parties are set on the Project Graph."
      />
    </Card>
  );
}

function DocumentsModule({ projectId }: { projectId: string }) {
  const { rows, loading, error, storageMissing } = useProjectDocuments(projectId);
  return (
    <Card className="p-6">
      <h3 className="mb-4">Project Documents</h3>
      <p className="text-muted-foreground mb-4">
        Documents exchanged between the parties on this project.
      </p>
      <DocumentList
        rows={rows}
        loading={loading}
        error={error}
        storageMissing={storageMissing}
        emptyTitle="No documents yet"
        emptyText="Documents added to this project, such as purchase orders, will appear here."
      />
    </Card>
  );
}

function TasksModule() {
  return (
    <Card className="p-6 text-center py-12">
      <CheckSquare className="w-12 h-12 text-accent-brand mx-auto mb-4" />
      <h3 className="mb-2">Task Tracking</h3>
      <p className="text-muted-foreground mb-4">
        Lightweight task management with milestones, assignments, and progress tracking.
      </p>
      <Badge>Coming Soon</Badge>
    </Card>
  );
}

function AnalyticsModule() {
  return (
    <Card className="p-6 text-center py-12">
      <BarChart3 className="w-12 h-12 text-accent-brand mx-auto mb-4" />
      <h3 className="mb-2">Analytics Dashboard</h3>
      <p className="text-muted-foreground mb-4">
        Advanced budget tracking, spending forecasts, and performance metrics.
      </p>
      <Badge>Coming Soon</Badge>
    </Card>
  );
}

// The creation wizard stores each person it lists as a placeholder member row
// (no account, no invitation). Once that person accepts a real invitation they
// get a second, accepted row, so the Team list showed everyone twice.
function dedupeTeamMembers(members: ProjectMember[]): ProjectMember[] {
  const acceptedEmails = new Set(
    members
      .filter((member) => member.acceptedAt && member.userEmail)
      .map((member) => member.userEmail!.toLowerCase())
  );
  return members.filter((member) => {
    if (member.acceptedAt || !member.userEmail) return true;
    return !acceptedEmails.has(member.userEmail.toLowerCase());
  });
}

function TeamModule({
  members: rawMembers,
  projectOwnerId,
  loading,
  canManageMembers,
  canSetUpWorkers,
  onInvite,
  onRefresh,
  onSetUpWorker,
}: {
  members: ProjectMember[];
  projectOwnerId: string | null;
  loading: boolean;
  canManageMembers: boolean;
  canSetUpWorkers: boolean;
  onInvite: () => void;
  onRefresh: () => void;
  onSetUpWorker: (member: ProjectMember) => void;
}) {
  const members = dedupeTeamMembers(rawMembers);
  const isOwnerRow = (member: ProjectMember) => !!projectOwnerId && member.userId === projectOwnerId;
  const statusLabel = (member: ProjectMember) => {
    if (isOwnerRow(member)) return "Active";
    if (!member.acceptedAt) return member.invitationId ? "Invited" : "Not invited yet";
    if (member.graphNodeId) return "Active";
    if (member.role === "Contributor") return "Needs setup";
    return member.role === "Owner" || member.role === "Editor" ? "Manager" : "Active";
  };
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="mb-1">Team Management</h3>
          <p className="text-sm text-muted-foreground m-0">Manage members, roles, and project access.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>Refresh</Button>
          {canManageMembers ? (
            <Button size="sm" className="gap-2" onClick={onInvite}>
              <Plus className="w-4 h-4" />
              Invite Member
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading team members...</p>
      ) : members.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No members found for this project yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium m-0">{member.userName || member.userEmail || member.userId}</p>
                <p className="text-xs text-muted-foreground m-0">{member.userEmail || member.userId}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{isOwnerRow(member) ? "Owner" : member.role}</Badge>
                <Badge variant={statusLabel(member) === "Active" || statusLabel(member) === "Manager" ? "default" : "secondary"}>
                  {statusLabel(member)}
                </Badge>
                {/* Only Contributors can become time-submitting workers. */}
                {canSetUpWorkers && member.acceptedAt && !member.graphNodeId && member.role === 'Contributor' && !isOwnerRow(member) ? (
                  <Button size="sm" variant="outline" onClick={() => onSetUpWorker(member)}>
                    Set up employee
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MessagesModule() {
  return (
    <Card className="p-6 text-center py-12">
      <MessageSquare className="w-12 h-12 text-accent-brand mx-auto mb-4" />
      <h3 className="mb-2">Project Messages</h3>
      <p className="text-muted-foreground mb-4">
        Dedicated chat and discussion threads for this project.
      </p>
      <Badge>Coming Soon</Badge>
    </Card>
  );
}
