/**
 * Graph Dynamic Nodes API
 * Loads dynamic nodes (timesheets, expenses) from KV store for graph visualization
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export const graphDynamicNodesRouter = new Hono();

// ============================================================================
// GET /dynamic-nodes - Load all dynamic nodes from KV store
// ============================================================================

graphDynamicNodesRouter.get('/', async (c) => {
  try {
    console.log('📋 Loading dynamic nodes from KV store...');
    
    // 1. Get all graph nodes from KV store
    const { data: kvNodes, error: kvError } = await supabase
      .from('kv_store_f8b491be')
      .select('key, value')
      .like('key', 'graph:node:%');
    
    if (kvError) {
      console.error('Failed to fetch KV nodes:', kvError);
      return c.json({ error: 'Failed to load graph nodes' }, 500);
    }
    
    if (!kvNodes || kvNodes.length === 0) {
      console.log('ℹ️ No graph nodes found in KV store');
      return c.json({
        timesheetNodes: [],
        timesheetEdges: [],
      });
    }
    
    console.log(`📦 Found ${kvNodes.length} graph nodes in KV store`);
    
    // 2. Filter for timesheet nodes and convert to React Flow format
    const timesheetNodes = [];
    const timesheetNodeIds = new Set<string>();
    
    for (const item of kvNodes) {
      try {
        const node = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
        
        // Only include TimesheetPeriod nodes
        if (node.nodeType === 'TimesheetPeriod') {
          const nodeId = node.nodeId || item.key.replace('graph:node:', '');
          timesheetNodeIds.add(nodeId);
          
          // Convert to React Flow node format
          const reactFlowNode = {
            id: nodeId,
            type: 'timesheet', // Use timesheet node type
            position: {
              // Position based on submission date (x) and amount (y)
              x: Math.random() * 400 + 500, // Random for now
              y: Math.random() * 400 + 200,
            },
            data: {
              name: `Timesheet: ${node.properties.weekStart} to ${node.properties.weekEnd}`,
              status: node.properties.status || 'submitted',
              totalHours: node.properties.totalHours || 0,
              totalAmount: node.properties.totalAmount || 0,
              currency: node.properties.currency || 'USD',
              submittedAt: node.properties.submittedAt,
              currentStep: node.properties.currentStep || 1,
              totalSteps: node.properties.totalSteps || 1,
              // For styling
              nodeType: 'timesheet',
              icon: '📋',
              color: node.properties.status === 'approved' ? '#10b981' : 
                     node.properties.status === 'rejected' ? '#ef4444' : 
                     '#3b82f6',
            },
          };
          
          timesheetNodes.push(reactFlowNode);
        }
      } catch (err) {
        console.error('Error parsing node:', item.key, err);
      }
    }
    
    console.log(`✅ Converted ${timesheetNodes.length} timesheet nodes`);
    
    // 3. Get approval edges for these timesheet nodes
    const { data: kvEdges } = await supabase
      .from('kv_store_f8b491be')
      .select('key, value')
      .like('key', 'graph:edge:%');
    
    const timesheetEdges = [];
    
    if (kvEdges) {
      for (const item of kvEdges) {
        try {
          const edge = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          
          // Only include edges connected to timesheet nodes
          if (edge.type === 'REQUIRES_APPROVAL' && timesheetNodeIds.has(edge.from)) {
            const edgeId = item.key.replace('graph:edge:', '');
            
            const reactFlowEdge = {
              id: edgeId,
              source: edge.from,
              target: edge.to,
              type: 'default',
              data: {
                edgeType: 'requires_approval',
                step: edge.metadata?.step || 1,
                status: edge.metadata?.status || 'pending',
              },
              style: {
                stroke: edge.metadata?.status === 'approved' ? '#10b981' : 
                        edge.metadata?.status === 'rejected' ? '#ef4444' : 
                        '#3b82f6',
                strokeWidth: 2,
                strokeDasharray: edge.metadata?.status === 'pending' ? '5,5' : '0',
              },
              animated: edge.metadata?.status === 'pending',
              label: edge.metadata?.status === 'approved' ? '✓ Approved' : 
                     edge.metadata?.status === 'rejected' ? '✗ Rejected' : 
                     `Pending (Step ${edge.metadata?.step})`,
            };
            
            timesheetEdges.push(reactFlowEdge);
          }
        } catch (err) {
          console.error('Error parsing edge:', item.key, err);
        }
      }
    }
    
    console.log(`✅ Converted ${timesheetEdges.length} approval edges`);
    
    return c.json({
      timesheetNodes,
      timesheetEdges,
      stats: {
        totalNodes: timesheetNodes.length,
        totalEdges: timesheetEdges.length,
        byStatus: {
          submitted: timesheetNodes.filter(n => n.data.status === 'submitted').length,
          approved: timesheetNodes.filter(n => n.data.status === 'approved').length,
          rejected: timesheetNodes.filter(n => n.data.status === 'rejected').length,
        },
      },
    });
    
  } catch (error) {
    console.error('❌ Error loading dynamic nodes:', error);
    return c.json({ 
      error: 'Failed to load dynamic nodes', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});
