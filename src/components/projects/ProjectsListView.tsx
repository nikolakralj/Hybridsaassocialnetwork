import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye, Users, Calendar, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
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
import { Project } from '../../types/collaboration';
import { getUserProjectsMock, getProjectMembersMock } from '../../utils/api/projects';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectConfiguration | undefined>();
  
  // ✅ DAY 2: Load real projects from API
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectMembers, setProjectMembers] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // ✅ DAY 2: Load projects on mount
  useEffect(() => {
    async function loadProjects() {
      setIsLoading(true);
      try {
        const userProjects = await getUserProjectsMock();
        setProjects(userProjects);
        
        // Load member counts for each project
        const memberCounts: Record<string, number> = {};
        for (const project of userProjects) {
          const members = await getProjectMembersMock(project.id);
          memberCounts[project.id] = members.length;
        }
        setProjectMembers(memberCounts);
        
        console.log('✅ Loaded projects:', userProjects.length);
      } catch (error) {
        console.error('Error loading projects:', error);
        toast.error('Failed to load projects');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadProjects();
  }, []);

  const handleCreateProject = () => {
    // Open new wizard instead of old drawer
    setIsWizardOpen(true);
  };
  
  const handleProjectCreated = (projectId: string) => {
    // Dispatch custom navigation event to switch to visual builder
    const event = new CustomEvent('navigate', { detail: 'visual-builder' });
    window.dispatchEvent(event);
    
    // Store the project ID for the builder to load
    sessionStorage.setItem('currentProjectId', projectId);
    
    // Reload projects list
    getUserProjectsMock().then(setProjects);
  };
  
  const handleOpenProject = (projectId: string) => {
    // Navigate to visual builder with this project
    sessionStorage.setItem('currentProjectId', projectId);
    const event = new CustomEvent('navigate', { detail: 'visual-builder' });
    window.dispatchEvent(event);
  };

  const handleEditProject = (project: ProjectConfiguration) => {
    setEditingProject(project);
    setIsDrawerOpen(true);
  };

  const handleSaveProject = (project: ProjectConfiguration) => {
    if (editingProject) {
      // Update existing project
      setProjects(projects.map(p => (p.id === project.id ? project : p)));
    } else {
      // Create new project
      setProjects([...projects, { ...project, createdAt: new Date().toISOString(), status: 'active' }]);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      setProjects(projects.filter(p => p.id !== projectId));
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case 'archived':
        return <Badge variant="outline">Archived</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl text-gray-900">Projects</h1>
            <p className="text-gray-500 mt-1">
              Manage your projects, approval chains, and contractor contracts
            </p>
          </div>
          <Button onClick={handleCreateProject}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* ✅ DAY 2: Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="max-w-sm mx-auto">
            <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Get started by creating your first project with approval chains and contracts
            </p>
            <Button onClick={handleCreateProject}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleOpenProject(project.id)}
            >
              {/* Project Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-1">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{project.description}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status & Region */}
              <div className="mb-4 flex items-center gap-2">
                {getStatusBadge('active')}
                <Badge variant="secondary" className="text-xs">
                  {project.region}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {project.currency}
                </Badge>
              </div>

              {/* Stats */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>{projectMembers[project.id] || 0} member{(projectMembers[project.id] || 0) !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>Started {new Date(project.startDate).toLocaleDateString()}</span>
                </div>
                {project.endDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Ends {new Date(project.endDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Work Week */}
              {project.workWeek && (
                <div className="border-t pt-3 mb-4">
                  <div className="text-xs text-gray-500 mb-2">Work Week:</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(project.workWeek).map(([day, enabled]) => (
                      enabled && (
                        <Badge key={day} variant="outline" className="text-xs capitalize">
                          {day.substring(0, 3)}
                        </Badge>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={(e) => { e.stopPropagation(); handleOpenProject(project.id); }}
                >
                  Open in Builder
                  <ArrowRight className="h-3 w-3 ml-2" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Configuration Drawer (old system) */}
      <ProjectConfigurationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        project={editingProject}
        onSave={handleSaveProject}
      />
      
      {/* Project Creation Wizard (new system - M5.1) */}
      <ProjectCreateWizard
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}