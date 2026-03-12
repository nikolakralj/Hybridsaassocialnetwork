import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Create a singleton Supabase client
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          autoRefreshToken: false,   // Prevent background token refresh timer
          persistSession: true,
          detectSessionInUrl: false, // Don't scan URL for auth tokens
        },
        realtime: {
          params: {
            eventsPerSecond: 1,
          },
        },
        // Disable realtime completely — we don't use it
        global: {
          headers: {},
        },
      }
    );
  }
  return supabaseInstance;
}

/**
 * Test the Supabase connection and check if tables exist
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  error?: any;
}> {
  try {
    const client = createClient();
    
    // 1. Test basic connectivity by querying projects table
    const { data, error } = await client
      .from('projects')
      .select('id')
      .limit(1);
    
    if (error) {
      // Check if it's a "relation does not exist" error (tables not created)
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return {
          success: false,
          message: 'Database tables not created yet.\nPlease run the MASTER_SETUP.sql script in the Supabase SQL Editor.',
          error,
        };
      }
      
      // Check for RLS / permission errors
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        return {
          success: false,
          message: 'Row Level Security (RLS) is blocking access.\nRun the FIX_RLS.sql script to disable RLS for development.',
          error,
        };
      }
      
      return {
        success: false,
        message: `Database error: ${error.message}`,
        error,
      };
    }
    
    // 2. Check that key tables exist by querying each
    const tables = ['projects', 'project_members', 'workgraph_nodes', 'workgraph_edges', 'graph_versions', 'approval_records'];
    const missingTables: string[] = [];
    
    for (const table of tables) {
      const { error: tableError } = await client
        .from(table)
        .select('id')
        .limit(0);
      
      if (tableError?.message?.includes('does not exist')) {
        missingTables.push(table);
      }
    }
    
    if (missingTables.length > 0) {
      return {
        success: false,
        message: `Missing tables: ${missingTables.join(', ')}.\nPlease run the MASTER_SETUP.sql script.`,
        error: { missingTables },
      };
    }
    
    // 3. Check if sample data exists
    const { count } = await client
      .from('projects')
      .select('*', { count: 'exact', head: true });
    
    return {
      success: true,
      message: `Connected successfully!\n${count || 0} project(s) found in database.`,
    };
    
  } catch (error: any) {
    return {
      success: false,
      message: `Connection failed: ${error.message || 'Unknown error'}`,
      error,
    };
  }
}