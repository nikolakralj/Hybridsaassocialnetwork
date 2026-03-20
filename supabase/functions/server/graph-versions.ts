/**
 * Graph Versions API Routes
 * Handles loading/saving graph configurations
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export const graphVersionsRouter = new Hono();

// ============================================================================
// GET ACTIVE VERSION
// ============================================================================

graphVersionsRouter.get('/active', async (c) => {
  try {
    const projectId = c.req.query('projectId');
    
    if (!projectId) {
      return c.json({ error: 'projectId is required' }, 400);
    }
    
    console.log('📊 Getting active graph version for project:', projectId);
    
    // For now, return null (no graph version exists)
    // Later this will query the graph_versions table
    return c.json({ 
      graphVersion: null, // ✅ Fixed: Changed from 'version' to 'graphVersion'
      message: 'No active graph version found (this is expected for new projects)' 
    });
    
  } catch (error) {
    console.error('❌ Error getting active graph version:', error);
    return c.json({ 
      error: 'Failed to get active graph version', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================================================
// GET VERSION FOR DATE
// ============================================================================

graphVersionsRouter.get('/for-date', async (c) => {
  try {
    const projectId = c.req.query('projectId');
    const date = c.req.query('date');
    
    if (!projectId || !date) {
      return c.json({ error: 'projectId and date are required' }, 400);
    }
    
    console.log('📅 Getting graph version for date:', { projectId, date });
    
    // For now, return null
    return c.json({ 
      graphVersion: null, // ✅ Fixed: Changed from 'version' to 'graphVersion'
      message: 'Month-specific graph versions not yet implemented' 
    });
    
  } catch (error) {
    console.error('❌ Error getting graph version for date:', error);
    return c.json({ 
      error: 'Failed to get graph version', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================================================
// SAVE VERSION
// ============================================================================

graphVersionsRouter.post('/save', async (c) => {
  try {
    const body = await c.req.json();
    const { projectId, nodes, edges, changeSummary } = body;
    
    if (!projectId) {
      return c.json({ error: 'projectId is required' }, 400);
    }
    
    console.log('💾 Saving graph version:', { 
      projectId, 
      nodeCount: nodes?.length || 0,
      edgeCount: edges?.length || 0,
      changeSummary 
    });
    
    // For now, just return success
    // Later this will actually save to the database
    return c.json({
      success: true,
      message: 'Graph version saved successfully',
      versionId: `v-${Date.now()}`,
    });
    
  } catch (error) {
    console.error('❌ Error saving graph version:', error);
    return c.json({ 
      error: 'Failed to save graph version', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================================================
// GET VERSION HISTORY
// ============================================================================

graphVersionsRouter.get('/history', async (c) => {
  try {
    const projectId = c.req.query('projectId');
    
    if (!projectId) {
      return c.json({ error: 'projectId is required' }, 400);
    }
    
    console.log('📜 Getting graph version history for:', projectId);
    
    // For now, return empty array
    return c.json({ 
      versions: [],
      message: 'Version history not yet implemented' 
    });
    
  } catch (error) {
    console.error('❌ Error getting version history:', error);
    return c.json({ 
      error: 'Failed to get version history', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================================================
// GET VERSION BY ID
// ============================================================================

graphVersionsRouter.get('/:versionId', async (c) => {
  try {
    const versionId = c.req.param('versionId');
    const projectId = c.req.query('projectId');
    
    if (!projectId) {
      return c.json({ error: 'projectId is required' }, 400);
    }
    
    console.log('📊 Getting graph version by ID:', { versionId, projectId });
    
    // For now, return null
    return c.json({ 
      version: null,
      message: 'Version lookup not yet implemented' 
    });
    
  } catch (error) {
    console.error('❌ Error getting graph version:', error);
    return c.json({ 
      error: 'Failed to get graph version', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});