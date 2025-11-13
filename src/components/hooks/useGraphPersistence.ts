/**
 * useGraphPersistence Hook
 * 
 * Handles loading and saving WorkGraph versions from/to the database.
 * Integrates with the month context to load month-specific graph versions.
 * 
 * Features:
 * - Load active graph version (current)
 * - Load graph version for specific date/month
 * - Save new graph version (creates temporal version)
 * - Auto-save with debouncing
 * - Version history management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Node, Edge } from 'reactflow@11.10.0';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SUPABASE_URL = `https://${projectId}.supabase.co`;
const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-f8b491be`;

interface GraphVersion {
  id: string;
  project_id: string;
  version_number: number;
  effective_from_date: string; // YYYY-MM-DD
  effective_to_date: string | null; // YYYY-MM-DD or null (active)
  graph_data: {
    nodes: Node[];
    edges: Edge[];
    metadata?: any;
  };
  change_summary: string;
  created_by: string;
  created_at: string;
}

interface UseGraphPersistenceOptions {
  projectId: string;
  autoSave?: boolean;
  autoSaveDelay?: number; // milliseconds
  onLoadSuccess?: (version: GraphVersion) => void;
  onLoadError?: (error: Error) => void;
  onSaveSuccess?: (version: GraphVersion) => void;
  onSaveError?: (error: Error) => void;
}

interface UseGraphPersistenceReturn {
  // State
  currentVersion: GraphVersion | null;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  
  // Actions
  loadActiveVersion: () => Promise<GraphVersion | null>;
  loadVersionForDate: (date: Date) => Promise<GraphVersion | null>;
  saveVersion: (nodes: Node[], edges: Edge[], changeSummary?: string) => Promise<GraphVersion | null>;
  loadVersionById: (versionId: string) => Promise<GraphVersion | null>;
  getVersionHistory: () => Promise<GraphVersion[]>;
  
  // Tracking
  markAsChanged: () => void;
  markAsSaved: () => void;
}

export function useGraphPersistence(options: UseGraphPersistenceOptions): UseGraphPersistenceReturn {
  const {
    projectId: pid,
    autoSave = false,
    autoSaveDelay = 30000, // 30 seconds
    onLoadSuccess,
    onLoadError,
    onSaveSuccess,
    onSaveError,
  } = options;

  const [currentVersion, setCurrentVersion] = useState<GraphVersion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  // Load active version (currently effective)
  const loadActiveVersion = useCallback(async (): Promise<GraphVersion | null> => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/graph-versions/active?projectId=${pid}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        // Graceful fallback if endpoint doesn't exist yet
        if (response.status === 404) {
          console.log(`ℹ️ Graph persistence not yet implemented for project ${pid}`);
          return null;
        }
        
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to load active version');
      }

      const { graphVersion } = await response.json();
      
      if (graphVersion) {
        setCurrentVersion(graphVersion);
        onLoadSuccess?.(graphVersion);
        return graphVersion;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading active graph version:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      onLoadError?.(err);
      // Don't show toast for expected 404s
      if (!error.message?.includes('not yet implemented')) {
        toast.error('Failed to load graph');
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [pid, onLoadSuccess, onLoadError]);

  // Load version for specific date (month-aware)
  const loadVersionForDate = useCallback(async (date: Date): Promise<GraphVersion | null> => {
    setIsLoading(true);
    try {
      // Format date as YYYY-MM-15 (mid-month to avoid edge cases)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dateStr = `${year}-${month}-15`;

      console.log(`📅 Loading graph version for date: ${dateStr}`);

      const response = await fetch(
        `${API_BASE}/graph-versions/for-date?projectId=${pid}&date=${dateStr}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        // Graceful fallback if endpoint doesn't exist yet
        if (response.status === 404) {
          console.log(`ℹ️ Graph persistence not yet implemented for project ${pid}`);
          return null;
        }
        
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to load version for date');
      }

      const { graphVersion, message } = await response.json();
      
      if (graphVersion) {
        setCurrentVersion(graphVersion);
        onLoadSuccess?.(graphVersion);
        console.log(`✅ Loaded graph version ${graphVersion.version_number} for ${dateStr}`);
        return graphVersion;
      } else {
        console.log(`ℹ️ No graph version found for ${dateStr}: ${message}`);
        return null;
      }
    } catch (error) {
      console.error('Error loading graph version for date:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      onLoadError?.(err);
      toast.error('Failed to load graph for selected month');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [pid, onLoadSuccess, onLoadError]);

  // Save new version
  const saveVersion = useCallback(async (
    nodes: Node[],
    edges: Edge[],
    changeSummary?: string
  ): Promise<GraphVersion | null> => {
    setIsSaving(true);
    try {
      const graphData = {
        nodes,
        edges,
        metadata: {
          savedAt: new Date().toISOString(),
          nodeCount: nodes.length,
          edgeCount: edges.length,
        },
      };

      const response = await fetch(`${API_BASE}/graph-versions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: pid,
          graphData,
          changeSummary: changeSummary || 'Graph updated',
          createdBy: 'user', // TODO: Get from auth context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save graph version');
      }

      const { graphVersion, message } = await response.json();
      
      setCurrentVersion(graphVersion);
      setHasUnsavedChanges(false);
      pendingChangesRef.current = null;
      
      onSaveSuccess?.(graphVersion);
      toast.success(`${message} (v${graphVersion.version_number})`);
      
      console.log(`✅ Saved graph version ${graphVersion.version_number}`);
      
      return graphVersion;
    } catch (error) {
      console.error('Error saving graph version:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      onSaveError?.(err);
      toast.error('Failed to save graph');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [pid, onSaveSuccess, onSaveError]);

  // Load version by ID
  const loadVersionById = useCallback(async (versionId: string): Promise<GraphVersion | null> => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/graph-versions/${versionId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load version');
      }

      const { graphVersion } = await response.json();
      
      if (graphVersion) {
        setCurrentVersion(graphVersion);
        onLoadSuccess?.(graphVersion);
        return graphVersion;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading graph version by ID:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      onLoadError?.(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onLoadSuccess, onLoadError]);

  // Get version history
  const getVersionHistory = useCallback(async (): Promise<GraphVersion[]> => {
    try {
      const response = await fetch(
        `${API_BASE}/graph-versions?projectId=${pid}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load version history');
      }

      const { graphVersions } = await response.json();
      return graphVersions || [];
    } catch (error) {
      console.error('Error loading version history:', error);
      return [];
    }
  }, [pid]);

  // Mark graph as changed (for auto-save)
  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true);
    
    // If auto-save is enabled, schedule a save
    if (autoSave && pendingChangesRef.current) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        if (pendingChangesRef.current) {
          const { nodes, edges } = pendingChangesRef.current;
          saveVersion(nodes, edges, 'Auto-saved changes');
        }
      }, autoSaveDelay);
    }
  }, [autoSave, autoSaveDelay, saveVersion]);

  // Mark as saved (clear unsaved changes flag)
  const markAsSaved = useCallback(() => {
    setHasUnsavedChanges(false);
    pendingChangesRef.current = null;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    currentVersion,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    
    // Actions
    loadActiveVersion,
    loadVersionForDate,
    saveVersion,
    loadVersionById,
    getVersionHistory,
    
    // Tracking
    markAsChanged,
    markAsSaved,
  };
}