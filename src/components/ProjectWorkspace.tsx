import { useState, useEffect } from "react";
import { 
  LayoutDashboard, Clock, FileText, CheckSquare, BarChart3, Receipt, 
  Plus, Settings, Users, MessageSquare, X, MoreHorizontal, Network
} from "lucide-react";
import { ProjectTimesheetsView } from "./timesheets/ProjectTimesheetsView";
import { ProjectApprovalsTab } from "./approvals/ProjectApprovalsTab";
import { WorkGraphBuilder } from "./workgraph/WorkGraphBuilder";
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./ui/dropdown-menu";
import { MonthProvider } from "../contexts/MonthContext";
import { NotificationCenterBell } from "./notifications/InAppNotificationCenter";
import { ProjectInviteMemberDialog } from "./projects/ProjectInviteMemberDialog";
import { ProjectConfigurationDrawer } from "./projects/ProjectConfigurationDrawer";
import { InvoicesWorkspace } from "./invoices/InvoicesWorkspace";
import { addProjectMember, getProjectMembers } from "../utils/api/projects-api";
import { useAuth } from "../contexts/AuthContext";
import type { ProjectMember, ProjectRole } from "../types/collaboration";
import type { ViewerIdentity } from "./workgraph/graph-visibility";

// Module definitions
type ModuleId = "overview" | "project-graph" | "timesheets" | "approvals" | "invoices" | "contracts" | "documents" | "tasks" | "analytics" | "team" | "messages" | "graph-snapshot";

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

export function ProjectWorkspace({ 
  projectId: propProjectId,
  projectName: propProjectName,
}: ProjectWorkspaceProps) {
  const { accessToken } = useAuth();
  // Read from sessionStorage if not passed as prop (set by ProjectsListView on navigate)
  const projectId = propProjectId || sessionStorage.getItem('currentProjectId') || 'proj-alpha';
  const [projectName, setProjectName] = useState(propProjectName || sessionStorage.getItem('currentProjectName') || 'Project');
  
  // Load project name from API if not provided
  useEffect(() => {
    if (propProjectName) return;
    const stored = sessionStorage.getItem('currentProjectName');
    if (stored) { setProjectName(stored); return; }
    setProjectName(projectId === 'proj-alpha' ? 'Mobile App Redesign' : `Project ${projectId.slice(0, 8)}`);
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

  const [activeTab, setActiveTab] = useState<ModuleId>("overview");
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectConfiguration | undefined>();
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activeGraphViewer, setActiveGraphViewer] = useState<ViewerIdentity | null>(null);

  const enabledModules = modules.filter(m => m.isEnabled);
  const availableModules = modules.filter(m => !m.isEnabled && m.category === "optional");

  const enableAndOpenModule = (moduleId: ModuleId) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, isEnabled: true } : m));
    setActiveTab(moduleId);
  };

  const handleOpenTeam = () => {
    enableAndOpenModule("team");
  };

  const handleOpenSettings = () => {
    setEditingProject({
      id: projectId,
      name: projectName,
      description: "",
      approvalChain: [],
      contracts: [],
      settings: {
        requireSequentialApproval: true,
        allowBulkApproval: true,
        monthlyInvoicing: true,
      },
      createdAt: new Date().toISOString(),
      status: "active",
    });
    setIsDrawerOpen(true);
  };

  const handleSaveProject = (project: ProjectConfiguration) => {
    setProjectName(project.name || projectName);
    sessionStorage.setItem('currentProjectName', project.name || projectName);
    toast.success('Project settings updated');
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
    const viewerMetaStorageKey = `workgraph-viewer-meta:${projectId}`;
    const raw = sessionStorage.getItem(viewerMetaStorageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.nodeId && parsed?.type) {
          setActiveGraphViewer(parsed as ViewerIdentity);
        }
      } catch {
        // Ignore malformed viewer payloads
      }
    }

    const onViewerChanged = (event: Event) => {
      const custom = event as CustomEvent<{ projectId?: string; viewer?: ViewerIdentity }>;
      if (!custom.detail?.viewer || custom.detail?.projectId !== projectId) return;
      setActiveGraphViewer(custom.detail.viewer);
    };

    window.addEventListener('workgraph-viewer-changed', onViewerChanged);
    return () => window.removeEventListener('workgraph-viewer-changed', onViewerChanged);
  }, [projectId]);

  const resolveStoredViewer = (): ViewerIdentity | null => {
    const key = `workgraph-viewer-meta:${projectId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return activeGraphViewer;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.nodeId && parsed?.type && parsed?.name) {
        return parsed as ViewerIdentity;
      }
    } catch {
      // Ignore malformed storage payload
    }
    return activeGraphViewer;
  };

  const effectiveViewer = resolveStoredViewer();

  const handleInviteMember = async (payload: { userName?: string; userEmail: string; role: ProjectRole }) => {
    await addProjectMember(projectId, payload, accessToken);
    toast.success(`Invitation sent to ${payload.userEmail}`);
    await loadTeamMembers();
  };

  // Listen for custom tab change events (from deep links)
  useEffect(() => {
    const handleTabChange = (event: CustomEvent<ModuleId>) => {
      setActiveTab(event.detail);
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
      setActiveTab(moduleId);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Project Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="m-0">{projectName}</h1>
                <Badge variant="secondary">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground m-0">
                Project workspace
              </p>
            </div>
            <div className="flex gap-2">
              <NotificationCenterBell />
              <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenTeam}>
                <Users className="w-4 h-4" />
                Team ({teamMembers.length || 0})
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenSettings}>
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modular Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <MonthProvider>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ModuleId)}>
            {/* Tab List with (+) Button */}
            <div className="flex items-center gap-2 mb-6">
              <TabsList className="flex-1">
                {enabledModules.map((module) => {
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
              <OverviewModule projectName={projectName} />
            </TabsContent>

            <TabsContent value="project-graph" className="space-y-6">
              <WorkGraphBuilder
                projectId={projectId}
                focusNodeId={focusNodeId}
                scope={scope}
                mode={mode}
                asOf={asOf}
              />
            </TabsContent>

            <TabsContent value="timesheets" className="space-y-6">
              <ProjectTimesheetsView
                projectId={projectId}
                ownerId="demo-owner-id"
                ownerName="Demo Project Owner"
                contractors={[
                  { id: "sarah-chen-id", name: "Sarah Chen", initials: "SC" },
                  { id: "mike-johnson-id", name: "Mike Johnson", initials: "MJ" },
                  { id: "emma-davis-id", name: "Emma Davis", initials: "ED" },
                  { id: "tom-martinez-id", name: "Tom Martinez", initials: "TM", company: "Acme Corp" },
                  { id: "lisa-park-id", name: "Lisa Park", initials: "LP", company: "Acme Corp" },
                  { id: "james-wilson-id", name: "James Wilson", initials: "JW", company: "Acme Corp" },
                  { id: "alex-kim-id", name: "Alex Kim", initials: "AK", company: "TechStaff Inc" },
                  { id: "jordan-lee-id", name: "Jordan Lee", initials: "JL", company: "TechStaff Inc" },
                ]}
                hourlyRate={95}
                viewerOverride={effectiveViewer ? {
                  id: effectiveViewer.nodeId,
                  type: effectiveViewer.type,
                  name: effectiveViewer.name,
                  orgId: effectiveViewer.orgId,
                } : undefined}
              />
            </TabsContent>

            <TabsContent value="approvals" className="space-y-6">
              <ProjectApprovalsTab
                projectId={projectId}
                projectName={projectName}
                viewerName={effectiveViewer?.name}
              />
            </TabsContent>

            <TabsContent value="invoices" className="space-y-6">
              <InvoicesWorkspace
                projectId={projectId}
                projectName={projectName}
              />
            </TabsContent>

            <TabsContent value="contracts" className="space-y-6">
              <ContractsModule />
            </TabsContent>

            <TabsContent value="documents" className="space-y-6">
              <DocumentsModule />
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
                loading={isTeamLoading}
                onInvite={() => setIsInviteOpen(true)}
                onRefresh={loadTeamMembers}
              />
            </TabsContent>

            <TabsContent value="messages" className="space-y-6">
              <MessagesModule />
            </TabsContent>
          </Tabs>
        </MonthProvider>
      </div>

      <ProjectConfigurationDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingProject(undefined);
        }}
        project={editingProject}
        onSave={handleSaveProject}
      />

      <ProjectInviteMemberDialog
        open={isInviteOpen}
        projectName={projectName}
        onOpenChange={setIsInviteOpen}
        onInvite={handleInviteMember}
      />
    </div>
  );
}

// Module Components (placeholders for now)

function OverviewModule({ projectName }: { projectName: string }) {
  const handleDeepLink = (scope: string, focus?: string) => {
    const params = new URLSearchParams();
    params.set('scope', scope);
    if (focus) params.set('focus', focus);
    
    // Use hash-based routing (works in Figma Make iframe)
    window.location.hash = params.toString();
    
    // Add visual toast for confirmation
    toast.success(`Opening Project Graph: ${scope} view`, {
      duration: 2000,
    });
    
    // Trigger tab change to project-graph
    const event = new CustomEvent('changeTab', { detail: 'project-graph' });
    window.dispatchEvent(event);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="p-6 relative group">
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm text-muted-foreground">Budget Progress</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDeepLink('money')}>
                <Network className="w-4 h-4 mr-2" />
                Show money flow in graph
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-3xl font-semibold mb-1">$12,500</p>
        <p className="text-sm text-muted-foreground">of $20,000 (62%)</p>
      </Card>
      
      <Card className="p-6">
        <p className="text-sm text-muted-foreground mb-2">Hours This Week</p>
        <p className="text-3xl font-semibold mb-1">45</p>
        <p className="text-sm text-success">+12% from last week</p>
      </Card>
      
      <Card className="p-6 relative group">
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm text-muted-foreground">Pending Approvals</p>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleDeepLink('approvals')}
          >
            View on graph →
          </Button>
        </div>
        <p className="text-3xl font-semibold mb-1">3</p>
        <p className="text-sm text-warning">Timesheets need review</p>
      </Card>

      <Card className="md:col-span-3 p-6">
        <h3 className="mb-4">Project Status</h3>
        <p className="text-muted-foreground">
          {projectName} is progressing well. 3 contractors actively working, 
          on track for Jan 31 deadline. Next milestone: Design Review (Jan 15).
        </p>
      </Card>
    </div>
  );
}



function ContractsModule() {
  return (
    <Card className="p-6">
      <h3 className="mb-4">Contracts & Legal Documents</h3>
      <p className="text-muted-foreground mb-4">
        Centralized storage for all project agreements, NDAs, and statements of work.
      </p>
      <div className="space-y-3">
        {[
          { name: "Master Service Agreement", type: "MSA", status: "Signed", date: "Dec 15, 2023" },
          { name: "Non-Disclosure Agreement", type: "NDA", status: "Signed", date: "Dec 15, 2023" },
          { name: "Statement of Work", type: "SOW", status: "Pending Signature", date: "Jan 5, 2024" },
        ].map((doc, i) => (
          <div key={i} className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-accent-brand" />
              <div>
                <p className="font-medium">{doc.name}</p>
                <p className="text-sm text-muted-foreground">{doc.type} · {doc.date}</p>
              </div>
            </div>
            <Badge variant={doc.status === "Signed" ? "default" : "secondary"}>
              {doc.status}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DocumentsModule() {
  return (
    <Card className="p-6">
      <h3 className="mb-4">Project Documents</h3>
      <p className="text-muted-foreground mb-4">
        All project files, deliverables, and assets organized in one place.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { name: "Design Mockups v3.fig", folder: "Deliverables", size: "12.4 MB" },
          { name: "Project Brief.pdf", folder: "Planning", size: "2.1 MB" },
          { name: "User Research Report.docx", folder: "Research", size: "5.8 MB" },
          { name: "Brand Guidelines.pdf", folder: "Assets", size: "8.3 MB" },
        ].map((doc, i) => (
          <div key={i} className="p-4 border border-border rounded-lg hover:border-accent-brand apple-transition cursor-pointer">
            <div className="flex items-start justify-between mb-2">
              <FileText className="w-5 h-5 text-accent-brand" />
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="font-medium mb-1">{doc.name}</p>
            <p className="text-sm text-muted-foreground">{doc.folder} · {doc.size}</p>
          </div>
        ))}
      </div>
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

function TeamModule({
  members,
  loading,
  onInvite,
  onRefresh,
}: {
  members: ProjectMember[];
  loading: boolean;
  onInvite: () => void;
  onRefresh: () => void;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="mb-1">Team Management</h3>
          <p className="text-sm text-muted-foreground m-0">Manage members, roles, and project access.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>Refresh</Button>
          <Button size="sm" className="gap-2" onClick={onInvite}>
            <Plus className="w-4 h-4" />
            Invite Member
          </Button>
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
                <Badge variant="outline">{member.role}</Badge>
                <Badge variant={member.acceptedAt ? "default" : "secondary"}>
                  {member.acceptedAt ? "Active" : "Invited"}
                </Badge>
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
