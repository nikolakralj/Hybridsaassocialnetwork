import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow@11.10.0';
import 'reactflow@11.10.0/dist/style.css';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Save, 
  Play, 
  AlertTriangle, 
  CheckCircle, 
  Eye,
  FileJson,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
  Send,
  Loader2,
  Download,
  Upload,
  History,
  HelpCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { PartyNode } from './nodes/PartyNode';
import { ContractNode } from './nodes/ContractNode';
import { PersonNode } from './nodes/PersonNode';
import { NodePalette } from './NodePalette';
import { PropertyPanel } from './PropertyPanel';
import { ValidationPanel } from './ValidationPanel';
import { PreviewSelector } from './PreviewSelector';
import { CompiledPolicyViewer } from './CompiledPolicyViewer';
import { CompileModal } from './CompileModal';
import { EdgeConfigPopover } from './EdgeConfigPopover';
import { TemplateLoader } from './TemplateLoader';
import { CustomEdge } from './CustomEdge';
import { OverlayController, type OverlayMode } from './OverlayController';
import { applyOverlay } from './overlay-transforms';
import { TEMPLATES } from './templates';
import { useGraphPersistence } from '../hooks/useGraphPersistence';
import { useMonthContextSafe } from '../../contexts/MonthContext';
import { EdgeTypeGuide } from './EdgeTypeGuide';
import type { 
  BaseNode, 
  BaseEdge, 
  CompiledProjectConfig,
  ApprovalPolicy,
  VisibilityRule,
  ValidationError,
  Project,
  ProjectMember,
  ProjectRole
} from '../../types/workgraph';
import { PolicySimulator } from './PolicySimulator';
import { 
  getProjectMock, 
  getProjectMembersMock 
} from '../../utils/api/projects';
import { savePolicyVersionMock } from '../../utils/api/policy-versions';
import { UIPermissions } from '../../utils/collaboration/permissions';

// Custom node types for React Flow
const nodeTypes = {
  party: PartyNode,
  contract: ContractNode,
  person: PersonNode,
  // Placeholder nodes for unsupported types (will use default rendering)
  team: PartyNode,
  sow: ContractNode,
  po: ContractNode,
  budget: ContractNode,
  milestone: ContractNode,
  timesheet: ContractNode,
  expense: ContractNode,
};

// Custom edge types
const edgeTypes = {
  default: CustomEdge,
};

// Edge styling by type
const edgeStyles: Record<string, any> = {
  approves: { stroke: '#3b82f6', strokeWidth: 2, animated: true },
  funds: { stroke: '#10b981', strokeWidth: 2 },
  subcontracts: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5,5' },
  billsTo: { stroke: '#f59e0b', strokeWidth: 2 },
  assigns: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '3,3' },
  worksOn: { stroke: '#64748b', strokeWidth: 1 },
};

interface WorkGraphBuilderProps {
  projectId?: string;
  projectName?: string;
  onSave?: (config: CompiledProjectConfig) => void;
  initialConfig?: CompiledProjectConfig;
  // Deep linking props
  focusNodeId?: string;
  scope?: 'approvals' | 'money' | 'people' | 'access';
  mode?: 'view' | 'edit';
  asOf?: string; // 'now' or ISO timestamp / version id
}

export function WorkGraphBuilder({
  projectId: propProjectId,
  projectName: propProjectName,
  onSave,
  initialConfig,
  focusNodeId,
  scope = 'approvals',
  mode = 'view',
  asOf = 'now',
}: WorkGraphBuilderProps) {
  // ✅ MONTH CONTEXT: Get selected month for temporal graph loading
  // Default to October 2025 if context is not available
  const monthContext = useMonthContextSafe();
  const selectedMonth = monthContext.selectedMonth || new Date('2025-10-01');
  const setSelectedMonth = monthContext.setSelectedMonth || (() => {});
  
  // Month navigation handlers
  const handlePreviousMonth = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    setSelectedMonth(new Date(year, month - 1, 1));
  };
  
  const handleNextMonth = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    setSelectedMonth(new Date(year, month + 1, 1));
  };
  
  const monthString = selectedMonth.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });
  
  // ✅ DAY 2: Project loading state
  const [projectId, setProjectId] = useState(propProjectId || sessionStorage.getItem('currentProjectId') || 'proj-alpha'); // Default fallback
  const [project, setProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [userRole, setUserRole] = useState<ProjectRole | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // ✅ PHASE 3: Load real data template by default
  const defaultTemplate = TEMPLATES[0]; // First template = WorkGraph Project (Real Data)
  
  const [nodes, setNodes, onNodesChange] = useNodesState<any>(
    initialConfig?.graph.nodes || defaultTemplate.nodes || []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>(
    initialConfig?.graph.edges || defaultTemplate.edges || []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState(true); // NEW: Track graph loading state
  
  // ✅ GRAPH PERSISTENCE: Connect to database
  const graphPersistence = useGraphPersistence({
    projectId,
    autoSave: false, // Manual save for now
    onLoadSuccess: (version) => {
      console.log('✅ Graph loaded:', version.version_number);
      if (version.graph_data) {
        setNodes(version.graph_data.nodes || []);
        setEdges(version.graph_data.edges || []);
        setIsLoadingGraph(false);
      }
    },
    onLoadError: (error) => {
      console.error('❌ Failed to load graph:', error);
      setIsLoadingGraph(false);
      // Fall back to template
      setNodes(defaultTemplate.nodes as any);
      setEdges(defaultTemplate.edges as any);
    },
    onSaveSuccess: (version) => {
      console.log('✅ Graph saved:', version.version_number);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    },
    onSaveError: (error) => {
      console.error('❌ Failed to save graph:', error);
    },
  });
  
  const [selectedNode, setSelectedNode] = useState<BaseNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<BaseEdge | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [showCompiledPolicy, setShowCompiledPolicy] = useState(false);
  const [showCompileModal, setShowCompileModal] = useState(false);
  const [compiledConfig, setCompiledConfig] = useState<CompiledProjectConfig | null>(null);
  const [previewPartyId, setPreviewPartyId] = useState<string | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('full');
  const [pendingConnection, setPendingConnection] = useState<{ source: Node | null; target: Node | null } | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'simulator'>('builder');
  const [showEdgeTypeGuide, setShowEdgeTypeGuide] = useState(false); // NEW: Edge type guide dialog
  
  // ✅ LOAD GRAPH ON MOUNT: Load active version from database
  useEffect(() => {
    console.log('🔄 Loading graph for project:', projectId);
    setIsLoadingGraph(true);
    
    // Load active version
    graphPersistence.loadActiveVersion().then((version) => {
      if (!version) {
        console.log('ℹ️ No active version found, using template');
        setNodes(defaultTemplate.nodes as any);
        setEdges(defaultTemplate.edges as any);
        setIsLoadingGraph(false);
      }
    });
  }, []); // Only on mount
  
  // ✅ MONTH-AWARE LOADING: Reload graph when month changes
  useEffect(() => {
    console.log('📅 Month changed:', selectedMonth);
    setIsLoadingGraph(true);
    
    // Load graph version for selected month
    graphPersistence.loadVersionForDate(selectedMonth).then((version) => {
      if (!version) {
        console.log(`ℹ️ No graph version for ${selectedMonth}, loading active version`);
        // Fall back to active version
        graphPersistence.loadActiveVersion().then((activeVersion) => {
          if (!activeVersion) {
            console.log('ℹ️ No active version found, using template');
            setNodes(defaultTemplate.nodes as any);
            setEdges(defaultTemplate.edges as any);
          }
          setIsLoadingGraph(false);
        });
      } else {
        setIsLoadingGraph(false);
      }
    });
  }, [selectedMonth]); // Reload when month changes
  
  // Apply overlay transformations to nodes and edges
  const { nodes: displayNodes, edges: displayEdges, stats: overlayStats } = useMemo(() => {
    return applyOverlay(nodes, edges, overlayMode);
  }, [nodes, edges, overlayMode]);
  
  // Keyboard shortcuts for overlay modes (1-5)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only if no input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const keyMap: Record<string, OverlayMode> = {
        '1': 'full',
        '2': 'approvals',
        '3': 'money',
        '4': 'people',
        '5': 'access',
      };
      
      const newMode = keyMap[e.key];
      if (newMode) {
        setOverlayMode(newMode);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Handle Delete/Backspace for nodes and edges (but not when typing in inputs)
  useEffect(() => {
    const handleDelete = (e: KeyboardEvent) => {
      // Don't delete nodes if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Only handle Delete and Backspace keys
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); // Prevent browser back navigation on Backspace
        
        // Delete selected node
        if (selectedNode) {
          setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
          setEdges((eds) => eds.filter(
            (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
          ));
          setSelectedNode(null);
        }
        
        // Delete selected edge
        if (selectedEdge) {
          setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
          setSelectedEdge(null);
        }
      }
    };

    window.addEventListener('keydown', handleDelete);
    return () => window.removeEventListener('keydown', handleDelete);
  }, [selectedNode, selectedEdge, setNodes, setEdges]);

  // Handle new connections - show popover
  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      
      if (sourceNode && targetNode) {
        setPendingConnection({
          source: sourceNode,
          target: targetNode,
        });
      }
    },
    [nodes]
  );

  // Handle edge config save from popover
  const handleEdgeConfigSave = useCallback(
    (edgeData: any) => {
      if (!pendingConnection) return;

      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: pendingConnection.source!.id,
        target: pendingConnection.target!.id,
        type: 'default',
        data: edgeData,
        style: edgeStyles[edgeData.edgeType] || edgeStyles.approves,
        animated: edgeData.edgeType === 'approves',
      };
      
      setEdges((eds) => addEdge(newEdge as any, eds));
      setPendingConnection(null);
      setHasUnsavedChanges(true);
    },
    [pendingConnection, setEdges]
  );

  // Handle node click (for selection)
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as BaseNode);
    setSelectedEdge(null);
  }, []);

  // Handle edge click (for selection)
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge as BaseEdge);
    setSelectedNode(null);
  }, []);

  // Add node from palette
  const handleAddNode = useCallback((nodeType: string) => {
    const newNode: BaseNode = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType as any,
      position: { 
        x: Math.random() * 400 + 100, 
        y: Math.random() * 400 + 100 
      },
      data: {
        name: `New ${nodeType}`,
        ...(nodeType === 'party' && { partyType: 'company' }),
        ...(nodeType === 'contract' && { 
          contractType: 'hourly',
          currency: 'USD',
          visibility: { hideRateFrom: [], hideTermsFrom: [] }
        }),
      },
    };
    setNodes((nds) => [...nds, newNode as any]);
  }, [setNodes]);

  // Update node data
  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<BaseNode['data']>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
    setHasUnsavedChanges(true);
  }, [setNodes]);

  // Update edge data
  const handleUpdateEdge = useCallback((edgeId: string, updates: Partial<BaseEdge['data']>) => {
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === edgeId
          ? { 
              ...edge, 
              data: { ...edge.data, ...updates },
              style: edgeStyles[updates.edgeType || edge.data?.edgeType] || edge.style
            }
          : edge
      )
    );
  }, [setEdges]);

  // Delete selected node/edge
  const handleDelete = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => 
        eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
      );
      setSelectedNode(null);
    } else if (selectedEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
      setSelectedEdge(null);
    }
  }, [selectedNode, selectedEdge, setNodes, setEdges]);

  // Validate graph
  const handleValidate = useCallback(() => {
    setIsValidating(true);
    const errors: ValidationError[] = [];

    // Check for cycles in approval edges
    const approvalEdges = edges.filter((e) => e.data?.edgeType === 'approves');
    const visited = new Set<string>();
    const detectCycle = (nodeId: string, path: Set<string>): boolean => {
      if (path.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      
      visited.add(nodeId);
      path.add(nodeId);
      
      const outgoing = approvalEdges.filter((e) => e.source === nodeId);
      for (const edge of outgoing) {
        if (detectCycle(edge.target, path)) return true;
      }
      
      path.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (detectCycle(node.id, new Set())) {
        errors.push({
          nodeId: node.id,
          severity: 'error',
          code: 'CYCLE_DETECTED',
          message: 'Cycle detected in approval chain',
          suggestion: 'Remove one of the approval edges to break the cycle',
        });
        break;
      }
    }

    // Check for disconnected contractor nodes
    const contractorNodes = nodes.filter((n) => 
      n.type === 'person' || (n.type === 'party' && n.data?.partyType === 'contractor')
    );
    for (const node of contractorNodes) {
      const hasConnection = edges.some(
        (e) => e.source === node.id || e.target === node.id
      );
      if (!hasConnection) {
        errors.push({
          nodeId: node.id,
          severity: 'warning',
          code: 'ORPHAN_NODE',
          message: `${node.data?.name || 'Node'} is not connected to the project`,
          suggestion: 'Connect this contractor to a company or agency',
        });
      }
    }

    // Check for missing approvers in approval chain
    const hasApprovalChain = approvalEdges.length > 0;
    if (!hasApprovalChain && nodes.length > 2) {
      errors.push({
        severity: 'warning',
        code: 'MISSING_APPROVER',
        message: 'No approval chain defined',
        suggestion: 'Add "Approves" edges to define who approves timesheets',
      });
    }

    setValidationErrors(errors);
    setIsValidating(false);
  }, [nodes, edges]);

  // Load template
  const handleLoadTemplate = useCallback((templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setNodes(template.nodes as any);
    setEdges(template.edges as any);
    setHasUnsavedChanges(true);
  }, [setNodes, setEdges]);

  // Compile to policy
  const handleCompile = useCallback(() => {
    setIsCompiling(true);

    // Build approval policies
    const approvalPolicies: ApprovalPolicy[] = [];
    const approvalEdges = edges
      .filter((e) => e.data?.edgeType === 'approves')
      .sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0));

    if (approvalEdges.length > 0) {
      const policy: ApprovalPolicy = {
        projectId,
        workType: 'timesheet',
        sequential: true,
        steps: approvalEdges.map((edge, index) => {
          const targetNode = nodes.find((n) => n.id === edge.target);
          return {
            order: index + 1,
            partyId: edge.target,
            partyType: targetNode?.data?.partyType || 'company',
            role: targetNode?.data?.role || 'Approver',
          };
        }),
      };
      approvalPolicies.push(policy);
    }

    // Build visibility rules
    const visibilityRules: VisibilityRule[] = [];
    const contractNodes = nodes.filter((n) => n.type === 'contract');
    
    contractNodes.forEach((node, index) => {
      const hideRateFrom = node.data?.visibility?.hideRateFrom || [];
      if (hideRateFrom.length > 0) {
        visibilityRules.push({
          id: `rule-${index}`,
          projectId,
          scope: {
            objectType: 'contract',
            field: 'rate',
          },
          policy: {
            action: 'MASK',
            hiddenFrom: hideRateFrom,
            maskWith: '•••',
          },
          priority: 100,
        });
      }
    });

    const config: CompiledProjectConfig = {
      projectId,
      version: (initialConfig?.version || 0) + 1,
      compiledAt: new Date().toISOString(),
      compiledBy: 'current-user', // TODO: Get from auth
      graph: {
        nodes: nodes as BaseNode[],
        edges: edges as BaseEdge[],
      },
      approvalPolicies,
      visibilityRules,
      routingRules: [],
      notificationRules: [],
    };

    setCompiledConfig(config);
    setIsCompiling(false);
    setShowCompileModal(true);
  }, [nodes, edges, projectId, initialConfig]);

  // Save project
  const handleSave = useCallback(() => {
    if (compiledConfig) {
      if (onSave) {
        onSave(compiledConfig);
      }
      // TODO: Save to API when onSave not provided
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setShowCompileModal(false);
    }
  }, [compiledConfig, onSave]);

  // ✅ DAY 2: Publish policy version
  const handlePublish = useCallback(async () => {
    if (!projectId) {
      toast.error('No project selected');
      return;
    }

    // First compile if not already compiled
    if (!compiledConfig) {
      handleCompile();
      toast.info('Compiling graph first...');
      return;
    }

    setIsPublishing(true);

    try {
      // Save as new policy version
      const result = await savePolicyVersionMock({
        projectId,
        versionName: `Policy v${(initialConfig?.version || 0) + 1}`,
        description: `Published from WorkGraph Builder`,
        changeNotes: 'Initial publish from visual builder',
        compiledJson: compiledConfig,
        graphSnapshot: {
          nodes: nodes as BaseNode[],
          edges: edges as BaseEdge[],
        },
        publishImmediately: true,
        activateImmediately: true,
        createdBy: 'current-user', // TODO: Get from auth
      });

      if (result.success) {
        toast.success(`Policy v${result.policy.version} published and activated!`, {
          description: `${nodes.length} nodes, ${edges.length} edges`,
          duration: 4000,
        });
        
        setHasUnsavedChanges(false);
        setLastSaved(new Date());
        
        // Clear draft from localStorage
        localStorage.removeItem(`workgraph-draft-${projectId}`);
        
        console.log('✅ Policy published:', result.policy);
      } else {
        toast.error('Failed to publish policy');
      }
    } catch (error) {
      console.error('Error publishing policy:', error);
      toast.error('Failed to publish policy');
    } finally {
      setIsPublishing(false);
    }
  }, [projectId, compiledConfig, nodes, edges, initialConfig, handleCompile]);

  // Autosave every 10 seconds
  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const interval = setInterval(() => {
      // Auto-save to localStorage for draft recovery
      localStorage.setItem(`workgraph-draft-${projectId}`, JSON.stringify({
        nodes,
        edges,
        savedAt: new Date().toISOString(),
      }));
      setLastSaved(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, nodes, edges, projectId]);

  // Preview mode
  const handlePreviewChange = useCallback((partyId: string | null) => {
    setPreviewPartyId(partyId);
    
    if (partyId) {
      // Gray out nodes the party can't see
      setNodes((nds) =>
        nds.map((node) => {
          const canSee = true; // TODO: Implement visibility check
          return {
            ...node,
            style: {
              ...node.style,
              opacity: canSee ? 1 : 0.3,
            },
          };
        })
      );
    } else {
      // Reset all nodes
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          style: {
            ...node.style,
            opacity: 1,
          },
        }))
      );
    }
  }, [setNodes]);

  const hasErrors = validationErrors.filter((e) => e.severity === 'error').length > 0;
  const hasWarnings = validationErrors.filter((e) => e.severity === 'warning').length > 0;

  // Sync selectedNode with updated nodes array
  React.useEffect(() => {
    if (selectedNode) {
      const updatedNode = nodes.find((n) => n.id === selectedNode.id);
      if (updatedNode && JSON.stringify(updatedNode) !== JSON.stringify(selectedNode)) {
        setSelectedNode(updatedNode as BaseNode);
      }
    }
  }, [nodes, selectedNode]);

  // Sync selectedEdge with updated edges array
  React.useEffect(() => {
    if (selectedEdge) {
      const updatedEdge = edges.find((e) => e.id === selectedEdge.id);
      if (updatedEdge && JSON.stringify(updatedEdge) !== JSON.stringify(selectedEdge)) {
        setSelectedEdge(updatedEdge as BaseEdge);
      }
    }
  }, [edges, selectedEdge]);

  // Track changes for unsaved indicator
  React.useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [nodes, edges]);

  // Get last saved text
  const getLastSavedText = () => {
    if (!lastSaved) return '';
    const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (seconds < 60) return `Saved • ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Saved • ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `Saved • ${hours}h ago`;
  };

  // ✅ PHASE 3: Handle deep link focus - Filter nodes and center view
  // This component needs to be inside ReactFlow context, so we'll create a child component
  const FocusHandler = () => {
    const reactFlowInstance = useReactFlow();
    
    useEffect(() => {
      if (!focusNodeId || nodes.length === 0) return;

      console.log('🎯 Deep link focus requested:', focusNodeId);

      // Find the focused node
      const focusedNode = nodes.find((n) => n.id === focusNodeId);
      
      if (!focusedNode) {
        console.warn('⚠️ Focus node not found:', focusNodeId);
        toast.error(`Person not found in graph: ${focusNodeId}`);
        return;
      }

      // Build approval chain for this person
      const getApprovalChain = (personId: string): Set<string> => {
        const visited = new Set<string>();
        const queue = [personId];
        
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;
          
          visited.add(current);
          
          // Find all edges where this person/company is source or target
          edges.forEach((edge) => {
            if (edge.source === current && !visited.has(edge.target)) {
              queue.push(edge.target);
            }
            if (edge.target === current && !visited.has(edge.source)) {
              queue.push(edge.source);
            }
          });
        }
        
        return visited;
      };

      const visibleNodeIds = getApprovalChain(focusNodeId);
      
      console.log('✅ Visible nodes in approval chain:', Array.from(visibleNodeIds));

      // Update node visibility - hide nodes not in the chain
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          hidden: !visibleNodeIds.has(node.id),
          style: {
            ...node.style,
            // Highlight the focused person
            ...(node.id === focusNodeId ? {
              boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5)',
              border: '2px solid #3b82f6',
            } : {}),
          },
        }))
      );

      // Update edge visibility - only show edges between visible nodes
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          hidden: !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target),
        }))
      );

      // Center view on the focused node after a short delay
      setTimeout(() => {
        reactFlowInstance.fitView({
          padding: 0.3,
          duration: 800,
          nodes: [{ id: focusNodeId }],
        });
      }, 100);

      toast.success('Focused on approval chain', {
        description: `Showing ${visibleNodeIds.size} connected nodes`,
      });
    }, [focusNodeId, reactFlowInstance]);

    return null;
  };

  // ✅ DAY 2: Loading state
  if (isLoadingProject) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-16rem)] flex flex-col bg-background rounded-lg border border-border overflow-hidden">
      {/* Simplified Header (for embedded mode) */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'builder' | 'simulator')} className="border-none">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="builder" className="gap-2">
                <FileJson className="w-4 h-4" />
                Builder
              </TabsTrigger>
              <TabsTrigger value="simulator" disabled={!compiledConfig} className="gap-2">
                <Play className="w-4 h-4" />
                Simulator
                {!compiledConfig && (
                  <span className="ml-1 text-xs text-muted-foreground">(Compile first)</span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Stats */}
          {activeTab === 'builder' && (
            <div className="flex items-center gap-2">
              {/* Month Navigator */}
              <div className="flex items-center gap-1 border-r pr-3 mr-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePreviousMonth}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1.5 min-w-[120px] justify-center">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-xs font-medium">{monthString}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextMonth}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Node/Edge counts */}
              <Badge variant="outline" className="text-xs gap-1">
                {nodes.length} Nodes
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                {edges.length} Edges
              </Badge>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab === 'builder' && (
            <>
              {/* Template loader */}
              <TemplateLoader onLoad={handleLoadTemplate} />

              {/* Preview selector */}
              <PreviewSelector
                parties={nodes.filter((n) => n.type === 'party')}
                selectedPartyId={previewPartyId}
                onChange={handlePreviewChange}
              />

              {/* Save Graph button - NEW */}
              <Button
                variant={hasUnsavedChanges ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  graphPersistence.saveVersion(nodes, edges, 'Manual save')
                }}
                disabled={graphPersistence.isSaving || nodes.length === 0}
                className="gap-2"
              >
                {graphPersistence.isSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3" />
                    {hasUnsavedChanges ? 'Save Graph' : 'Saved'}
                  </>
                )}
              </Button>

              {/* Last saved indicator */}
              {lastSaved && (
                <div className="text-xs text-muted-foreground px-2">
                  {getLastSavedText()}
                </div>
              )}
              
              {/* Validate button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={isValidating}
                className="gap-2"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Validating...
                  </>
                ) : hasErrors ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    {validationErrors.length} Issues
                  </>
                ) : hasWarnings ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-warning" />
                    {validationErrors.length} Warnings
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 text-success" />
                    Validate
                  </>
                )}
              </Button>

              {/* Compile & Test button */}
              <Button
                onClick={() => {
                  handleCompile();
                  // Auto-switch to simulator after compile
                  setTimeout(() => setActiveTab('simulator'), 100);
                }}
                disabled={isCompiling || hasErrors}
                size="sm"
                className="gap-2"
              >
                <Play className="h-3 w-3" />
                Compile & Test
              </Button>

              {/* ✅ DAY 2: Publish button (Owner only) */}
              {userRole && UIPermissions.canPublish(userRole) && (
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing || hasErrors || nodes.length === 0}
                  size="sm"
                  variant="default"
                  className="bg-accent-brand hover:bg-accent-brand/90 gap-2"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3" />
                      Publish
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {activeTab === 'builder' ? (
          /* Canvas */
          <>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          fitView
          className="bg-gray-50"
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background />
          <Controls />
          <MiniMap 
            nodeStrokeWidth={3}
            zoomable
            pannable
          />
          
          {/* ✅ PHASE 3: Focus handler for deep linking */}
          <FocusHandler />
          
          {/* Stats Panel */}
          <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-4">
            <div className="space-y-3">
              {/* Graph Stats */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{nodes.length} Nodes</Badge>
                <Badge variant="outline" className="text-xs">{edges.length} Edges</Badge>
              </div>
              
              {previewPartyId && (
                <Badge variant="default" className="bg-blue-600">
                  <Eye className="h-3 w-3 mr-1" />
                  Preview Mode
                </Badge>
              )}
              
              {/* Loading indicator */}
              {isLoadingGraph && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading graph...
                </div>
              )}
            </div>
          </Panel>
        </ReactFlow>

        {/* Left Sidebar - Node Palette and Overlay Controller */}
        <div className="absolute left-4 top-4 bottom-4 flex flex-col gap-3 z-10 w-60">
          {/* Node Palette */}
          <NodePalette onAddNode={handleAddNode} />
          
          {/* Overlay Controller */}
          <OverlayController
            mode={overlayMode}
            onChange={setOverlayMode}
            stats={overlayStats}
          />
        </div>

        {/* Property Panel (Right) */}
        {(selectedNode || selectedEdge) && (
          <PropertyPanel
            node={selectedNode}
            edge={selectedEdge}
            onUpdateNode={handleUpdateNode}
            onUpdateEdge={handleUpdateEdge}
            onDelete={handleDelete}
            allParties={nodes.filter((n) => n.type === 'party')}
            allNodes={nodes}
            allEdges={edges}
          />
        )}

        {/* Validation Panel (Bottom) */}
        {validationErrors.length > 0 && (
          <ValidationPanel
            errors={validationErrors}
            onClose={() => setValidationErrors([])}
            onSelectNode={(nodeId) => {
              const node = nodes.find((n) => n.id === nodeId);
              if (node) setSelectedNode(node as BaseNode);
            }}
          />
        )}

        {/* Compiled Policy Viewer */}
        {showCompiledPolicy && compiledConfig && (
          <CompiledPolicyViewer
            config={compiledConfig}
            onClose={() => setShowCompiledPolicy(false)}
          />
        )}

        {/* Edge Config Popover */}
        {pendingConnection && (
          <EdgeConfigPopover
            open={!!pendingConnection}
            sourceNode={pendingConnection.source}
            targetNode={pendingConnection.target}
            onSave={handleEdgeConfigSave}
            onCancel={() => setPendingConnection(null)}
          />
        )}

        {/* Edge Type Guide Dialog */}
        <EdgeTypeGuide 
          open={showEdgeTypeGuide} 
          onClose={() => setShowEdgeTypeGuide(false)} 
        />

        {/* Compile Modal */}
        {showCompileModal && compiledConfig && (
          <CompileModal
            open={showCompileModal}
            config={compiledConfig}
            onSave={handleSave}
            onClose={() => setShowCompileModal(false)}
          />
        )}
      </>
        ) : (
          /* Simulator View */
          compiledConfig && (
            <PolicySimulator
              config={compiledConfig}
              projectName={project?.name || propProjectName || 'Project'}
            />
          )
        )}
      </div>
    </div>
  );
}