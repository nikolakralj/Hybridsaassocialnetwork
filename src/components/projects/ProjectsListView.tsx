import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Search, Filter, MoreVertical, Trash2, Eye, Users, Calendar, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ProjectConfigurationDrawer } from './ProjectConfigurationDrawer';
import { ProjectCreateWizard } from '../workgraph/ProjectCreateWizard';
import { useAuth } from '../../contexts/AuthContext';
import {
  listProjects,
  deleteProject as deleteProjectApi,
  getProjectMembers,
} from '../../utils/api/projects-api';
import { toast } from 'sonner@2.0.3';

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

export function ProjectsListView() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectConfiguration | undefined>();
  
  const [projects, setProjects] = useState<any[]>([]);
  const [projectMembers, setProjectMembers] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const userProjects = await listProjects(accessToken);
      setProjects(userProjects);
      
      // Load member counts in parallel
      const memberCounts: Record<string, number> = {};
      await Promise.all(
        userProjects.map(async (project: any) => {
          try {
            const members = await getProjectMembers(project.id, accessToken);
            memberCounts[project.id] = members.length;
          } catch {
            memberCounts[project.id] = 0;
          }
        })
      );
      setProjectMembers(memberCounts);
    } catch (error) {
      console.error('Error loading projects:', error);
      // Don't toast on initial load if there's just no data
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [accessToken]);

  const handleCreateProject = () => {
    setIsWizardOpen(true);
  };
  
  const handleProjectCreated = (projectId: string) => {
    sessionStorage.setItem('currentProjectId', projectId);
    // Store project name too (will be fetched from API in workspace)
    navigate('/app/project-workspace');
    loadProjects(); // Refresh list
  };
  
  const handleOpenProject = (projectId: string) => {
    sessionStorage.setItem('currentProjectId', projectId);
    // Store name for workspace header
    const proj = projects.find(p => p.id === projectId);
    if (proj?.name) sessionStorage.setItem('currentProjectName', proj.name);
    navigate('/app/project-workspace');
  };

  const handleEditProject = (project: ProjectConfiguration) => {
    setEditingProject(project);
    setIsDrawerOpen(true);
  };

  const handleSaveProject = (project: ProjectConfiguration) => {
    if (editingProject) {
      setProjects(projects.map(p => (p.id === project.id ? project : p)));
    } else {
      setProjects([...projects, { ...project, createdAt: new Date().toISOString(), status: 'active' }]);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await deleteProjectApi(projectId, accessToken);
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Project deleted');
    } catch (error: any) {
      console.error('Delete project error:', error);
      toast.error(error.message || 'Failed to delete project');
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Active</Badge>;
      case 'archived':
        return <Badge variant="outline" className="text-muted-foreground">Archived</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Active</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground m-0">Projects</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your projects, approval chains, and contractor contracts
          </p>
        </div>
        <Button
          onClick={handleCreateProject}
          size="sm"
          className="h-9 px-4 text-sm gap-2"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="pl-10 bg-background border-border/60 h-9 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2 text-sm" onClick={() => toast.info('Filter options coming soon')}>
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border-2 border-dashed border-border/60 bg-muted/20">
          <div className="max-w-sm mx-auto">
            <div className="h-14 w-14 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-foreground font-medium mb-1">No projects yet</h3>
            <p className="text-muted-foreground text-sm mb-5">
              Get started by creating your first project with approval chains and contracts
            </p>
            <Button
              onClick={handleCreateProject}
              className="bg-foreground text-background hover:bg-foreground/90 rounded-full h-9 px-4 text-sm gap-2"
            >
              <Plus className="h-4 w-4" />
              Create First Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              className="bg-card border border-border/60 rounded-xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]"
              onClick={() => handleOpenProject(project.id)}
            >
              {/* Project Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground mb-0.5 truncate">{project.name}</h3>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenProject(project.id); }}>
                      <Eye className="mr-2 h-4 w-4" />
                      Open in Builder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status & Region */}
              <div className="mb-4 flex items-center gap-1.5 flex-wrap">
                {getStatusBadge(project.status)}
                <Badge variant="secondary" className="text-[11px]">
                  {project.region}
                </Badge>
                <Badge variant="secondary" className="text-[11px]">
                  {project.currency}
                </Badge>
              </div>

              {/* Stats */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{projectMembers[project.id] || 0} member{(projectMembers[project.id] || 0) !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Started {new Date(project.startDate || project.createdAt).toLocaleDateString()}</span>
                </div>
                {project.endDate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Ends {new Date(project.endDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Work Week */}
              {project.workWeek && (
                <div className="border-t border-border/60 pt-3 mb-4">
                  <div className="text-[11px] text-muted-foreground mb-1.5">Work Week</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(project.workWeek).map(([day, enabled]) => (
                      enabled && (
                        <Badge key={day} variant="outline" className="text-[10px] capitalize border-border/60 px-1.5 py-0">
                          {day.substring(0, 3)}
                        </Badge>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Action */}
              <div className="mt-4 pt-3 border-t border-border/60">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-lg h-8 text-xs gap-1.5"
                  onClick={(e) => { e.stopPropagation(); handleOpenProject(project.id); }}
                >
                  Open in Builder
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Configuration Drawer */}
      <ProjectConfigurationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        project={editingProject}
        onSave={handleSaveProject}
      />
      
      {/* Project Creation Wizard */}
      <ProjectCreateWizard
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}