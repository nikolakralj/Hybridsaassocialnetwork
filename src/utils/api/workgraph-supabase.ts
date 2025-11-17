// Supabase-backed WorkGraph API
// Handles visual graph structure, nodes, edges, and versioning

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface WorkGraphNode {
  id: string;
  projectId: string;
  nodeType: 'company' | 'agency' | 'freelancer' | 'approver' | 'router' | 'ai_agent' | 'n8n' | 'data_check' | 'delay';
  label: string;
  data: Record<string, any>;
  positionX: number;
  positionY: number;
  graphVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkGraphEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: 'contract' | 'approval' | 'data_flow' | 'conditional';
  data: Record<string, any>;
  graphVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GraphVersion {
  id: string;
  projectId: string;
  projectName?: string;
  versionNumber: number;
  effectiveFromDate: string;
  effectiveToDate?: string | null;
  graphData: Record<string, any>;
  changeSummary?: string;
  createdBy: string;
  createdAt: string;
}

export interface WorkGraphStructure {
  nodes: WorkGraphNode[];
  edges: WorkGraphEdge[];
  version?: GraphVersion;
}

// ============================================================================
// NODE OPERATIONS
// ============================================================================

/**
 * Create a new node in the graph
 */
export async function createNode(node: Omit<WorkGraphNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkGraphNode> {
  try {
    const { data, error } = await supabase
      .from('workgraph_nodes')
      .insert([{
        project_id: node.projectId,
        node_type: node.nodeType,
        label: node.label,
        data: node.data,
        position_x: node.positionX,
        position_y: node.positionY,
        graph_version_id: node.graphVersionId || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating node:', error);
      throw new Error(`Failed to create node: ${error.message}`);
    }

    return transformNode(data);
  } catch (error) {
    console.error('Error in createNode:', error);
    throw error;
  }
}

/**
 * Get all nodes for a project (draft version)
 */
export async function getProjectNodes(projectId: string): Promise<WorkGraphNode[]> {
  try {
    const { data, error } = await supabase
      .from('workgraph_nodes')
      .select('*')
      .eq('project_id', projectId)
      .is('graph_version_id', null) // Only draft nodes
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching nodes:', error);
      throw new Error(`Failed to fetch nodes: ${error.message}`);
    }

    return (data || []).map(transformNode);
  } catch (error) {
    console.error('Error in getProjectNodes:', error);
    throw error;
  }
}

/**
 * Update a node
 */
export async function updateNode(
  nodeId: string,
  updates: Partial<Omit<WorkGraphNode, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
): Promise<WorkGraphNode> {
  try {
    const updateData: any = {};
    if (updates.label !== undefined) updateData.label = updates.label;
    if (updates.data !== undefined) updateData.data = updates.data;
    if (updates.positionX !== undefined) updateData.position_x = updates.positionX;
    if (updates.positionY !== undefined) updateData.position_y = updates.positionY;

    const { data, error } = await supabase
      .from('workgraph_nodes')
      .update(updateData)
      .eq('id', nodeId)
      .select()
      .single();

    if (error) {
      console.error('Error updating node:', error);
      throw new Error(`Failed to update node: ${error.message}`);
    }

    return transformNode(data);
  } catch (error) {
    console.error('Error in updateNode:', error);
    throw error;
  }
}

/**
 * Delete a node
 */
export async function deleteNode(nodeId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('workgraph_nodes')
      .delete()
      .eq('id', nodeId);

    if (error) {
      console.error('Error deleting node:', error);
      throw new Error(`Failed to delete node: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deleteNode:', error);
    throw error;
  }
}

// ============================================================================
// EDGE OPERATIONS
// ============================================================================

/**
 * Create a new edge in the graph
 */
export async function createEdge(edge: Omit<WorkGraphEdge, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkGraphEdge> {
  try {
    const { data, error } = await supabase
      .from('workgraph_edges')
      .insert([{
        project_id: edge.projectId,
        source_node_id: edge.sourceNodeId,
        target_node_id: edge.targetNodeId,
        edge_type: edge.edgeType,
        data: edge.data,
        graph_version_id: edge.graphVersionId || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating edge:', error);
      throw new Error(`Failed to create edge: ${error.message}`);
    }

    return transformEdge(data);
  } catch (error) {
    console.error('Error in createEdge:', error);
    throw error;
  }
}

/**
 * Get all edges for a project (draft version)
 */
export async function getProjectEdges(projectId: string): Promise<WorkGraphEdge[]> {
  try {
    const { data, error } = await supabase
      .from('workgraph_edges')
      .select('*')
      .eq('project_id', projectId)
      .is('graph_version_id', null) // Only draft edges
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching edges:', error);
      throw new Error(`Failed to fetch edges: ${error.message}`);
    }

    return (data || []).map(transformEdge);
  } catch (error) {
    console.error('Error in getProjectEdges:', error);
    throw error;
  }
}

/**
 * Update an edge
 */
export async function updateEdge(
  edgeId: string,
  updates: Partial<Omit<WorkGraphEdge, 'id' | 'projectId' | 'sourceNodeId' | 'targetNodeId' | 'createdAt' | 'updatedAt'>>
): Promise<WorkGraphEdge> {
  try {
    const updateData: any = {};
    if (updates.edgeType !== undefined) updateData.edge_type = updates.edgeType;
    if (updates.data !== undefined) updateData.data = updates.data;

    const { data, error } = await supabase
      .from('workgraph_edges')
      .update(updateData)
      .eq('id', edgeId)
      .select()
      .single();

    if (error) {
      console.error('Error updating edge:', error);
      throw new Error(`Failed to update edge: ${error.message}`);
    }

    return transformEdge(data);
  } catch (error) {
    console.error('Error in updateEdge:', error);
    throw error;
  }
}

/**
 * Delete an edge
 */
export async function deleteEdge(edgeId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('workgraph_edges')
      .delete()
      .eq('id', edgeId);

    if (error) {
      console.error('Error deleting edge:', error);
      throw new Error(`Failed to delete edge: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deleteEdge:', error);
    throw error;
  }
}

// ============================================================================
// GRAPH OPERATIONS (Combined nodes + edges)
// ============================================================================

/**
 * Get complete graph structure for a project (draft version)
 */
export async function getProjectGraph(projectId: string): Promise<WorkGraphStructure> {
  try {
    const [nodes, edges] = await Promise.all([
      getProjectNodes(projectId),
      getProjectEdges(projectId),
    ]);

    return { nodes, edges };
  } catch (error) {
    console.error('Error in getProjectGraph:', error);
    throw error;
  }
}

/**
 * Save entire graph structure (bulk update)
 */
export async function saveProjectGraph(
  projectId: string,
  structure: { nodes: Omit<WorkGraphNode, 'id' | 'createdAt' | 'updatedAt'>[]; edges: Omit<WorkGraphEdge, 'id' | 'createdAt' | 'updatedAt'>[] }
): Promise<WorkGraphStructure> {
  try {
    // 1. Delete existing draft nodes and edges
    await supabase.from('workgraph_nodes').delete().eq('project_id', projectId).is('graph_version_id', null);
    await supabase.from('workgraph_edges').delete().eq('project_id', projectId).is('graph_version_id', null);

    // 2. Insert new nodes
    const { data: newNodes, error: nodesError } = await supabase
      .from('workgraph_nodes')
      .insert(structure.nodes.map(n => ({
        project_id: n.projectId,
        node_type: n.nodeType,
        label: n.label,
        data: n.data,
        position_x: n.positionX,
        position_y: n.positionY,
        graph_version_id: null,
      })))
      .select();

    if (nodesError) {
      console.error('Error saving nodes:', nodesError);
      throw new Error(`Failed to save nodes: ${nodesError.message}`);
    }

    // 3. Insert new edges
    const { data: newEdges, error: edgesError } = await supabase
      .from('workgraph_edges')
      .insert(structure.edges.map(e => ({
        project_id: e.projectId,
        source_node_id: e.sourceNodeId,
        target_node_id: e.targetNodeId,
        edge_type: e.edgeType,
        data: e.data,
        graph_version_id: null,
      })))
      .select();

    if (edgesError) {
      console.error('Error saving edges:', edgesError);
      throw new Error(`Failed to save edges: ${edgesError.message}`);
    }

    return {
      nodes: (newNodes || []).map(transformNode),
      edges: (newEdges || []).map(transformEdge),
    };
  } catch (error) {
    console.error('Error in saveProjectGraph:', error);
    throw error;
  }
}

// ============================================================================
// VERSION OPERATIONS (Compile & Publish)
// ============================================================================

/**
 * Publish current draft as a new version
 */
export async function publishGraphVersion(
  projectId: string,
  changeSummary?: string
): Promise<GraphVersion> {
  try {
    const currentUserId = 'current-user-id'; // TODO: Get from auth context

    // 1. Get current draft
    const draft = await getProjectGraph(projectId);

    // 2. Get project name
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    // 3. Get next version number
    const { data: versions } = await supabase
      .from('graph_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

    // 4. Create new version
    const { data: newVersion, error: versionError } = await supabase
      .from('graph_versions')
      .insert([{
        project_id: projectId,
        project_name: project?.name,
        version_number: nextVersion,
        effective_from_date: new Date().toISOString(),
        effective_to_date: null, // Active version
        graph_data: { nodes: draft.nodes, edges: draft.edges },
        change_summary: changeSummary,
        created_by: currentUserId,
      }])
      .select()
      .single();

    if (versionError) {
      console.error('Error creating version:', versionError);
      throw new Error(`Failed to publish version: ${versionError.message}`);
    }

    // 5. Copy draft nodes/edges and link to version
    const versionId = newVersion.id;

    // Clone nodes with version ID
    const { data: versionedNodes } = await supabase
      .from('workgraph_nodes')
      .insert(draft.nodes.map(n => ({
        project_id: n.projectId,
        node_type: n.nodeType,
        label: n.label,
        data: n.data,
        position_x: n.positionX,
        position_y: n.positionY,
        graph_version_id: versionId,
      })))
      .select();

    // Clone edges with version ID
    const { data: versionedEdges } = await supabase
      .from('workgraph_edges')
      .insert(draft.edges.map(e => ({
        project_id: e.projectId,
        source_node_id: e.sourceNodeId,
        target_node_id: e.targetNodeId,
        edge_type: e.edgeType,
        data: e.data,
        graph_version_id: versionId,
      })))
      .select();

    return transformVersion(newVersion);
  } catch (error) {
    console.error('Error in publishGraphVersion:', error);
    throw error;
  }
}

/**
 * Get all versions for a project
 */
export async function getProjectVersions(projectId: string): Promise<GraphVersion[]> {
  try {
    const { data, error } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('Error fetching versions:', error);
      throw new Error(`Failed to fetch versions: ${error.message}`);
    }

    return (data || []).map(transformVersion);
  } catch (error) {
    console.error('Error in getProjectVersions:', error);
    throw error;
  }
}

/**
 * Get active version for a project (latest published)
 */
export async function getActiveVersion(projectId: string): Promise<GraphVersion | null> {
  try {
    const { data, error } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('project_id', projectId)
      .is('effective_to_date', null)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No active version
        return null;
      }
      console.error('Error fetching active version:', error);
      throw new Error(`Failed to fetch active version: ${error.message}`);
    }

    return transformVersion(data);
  } catch (error) {
    console.error('Error in getActiveVersion:', error);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS (Transform database format to API format)
// ============================================================================

function transformNode(dbNode: any): WorkGraphNode {
  return {
    id: dbNode.id,
    projectId: dbNode.project_id,
    nodeType: dbNode.node_type,
    label: dbNode.label,
    data: dbNode.data || {},
    positionX: parseFloat(dbNode.position_x),
    positionY: parseFloat(dbNode.position_y),
    graphVersionId: dbNode.graph_version_id,
    createdAt: dbNode.created_at,
    updatedAt: dbNode.updated_at,
  };
}

function transformEdge(dbEdge: any): WorkGraphEdge {
  return {
    id: dbEdge.id,
    projectId: dbEdge.project_id,
    sourceNodeId: dbEdge.source_node_id,
    targetNodeId: dbEdge.target_node_id,
    edgeType: dbEdge.edge_type,
    data: dbEdge.data || {},
    graphVersionId: dbEdge.graph_version_id,
    createdAt: dbEdge.created_at,
    updatedAt: dbEdge.updated_at,
  };
}

function transformVersion(dbVersion: any): GraphVersion {
  return {
    id: dbVersion.id,
    projectId: dbVersion.project_id,
    projectName: dbVersion.project_name,
    versionNumber: dbVersion.version_number,
    effectiveFromDate: dbVersion.effective_from_date,
    effectiveToDate: dbVersion.effective_to_date,
    graphData: dbVersion.graph_data || {},
    changeSummary: dbVersion.change_summary,
    createdBy: dbVersion.created_by,
    createdAt: dbVersion.created_at,
  };
}
