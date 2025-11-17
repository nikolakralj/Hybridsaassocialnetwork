// Supabase-backed Projects API
// Replaces mock implementations with real database queries

import { createClient } from '@supabase/supabase-js';
import { Project, ProjectMember, ProjectRole } from '../../types/collaboration';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Create a new project with initial members
 */
export async function createProject(
  data: Partial<Project>,
  members: Partial<ProjectMember>[] = []
): Promise<{ project: Project; members: ProjectMember[] }> {
  try {
    const currentUserId = 'current-user-id'; // TODO: Get from auth context
    const now = new Date().toISOString();

    // 1. Insert project
    const projectData = {
      name: data.name || 'Untitled Project',
      description: data.description,
      region: data.region || 'US',
      currency: data.currency || 'USD',
      start_date: data.startDate || now,
      end_date: data.endDate,
      work_week: data.workWeek || {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
      owner_id: currentUserId,
      status: 'active',
    };

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();

    if (projectError) {
      console.error('Error creating project:', projectError);
      throw new Error(`Failed to create project: ${projectError.message}`);
    }

    // 2. Add owner as first member
    const ownerMember = {
      project_id: project.id,
      user_id: currentUserId,
      user_name: 'Current User', // TODO: Get from auth context
      user_email: 'current@example.com', // TODO: Get from auth context
      role: 'Owner',
      invited_by: currentUserId,
      invited_at: now,
      accepted_at: now,
    };

    const membersToInsert = [ownerMember, ...members.map(m => ({
      project_id: project.id,
      user_id: m.userId || `user-${Date.now()}`,
      user_name: m.userName || 'Unknown',
      user_email: m.userEmail || '',
      role: m.role || 'Viewer',
      invited_by: currentUserId,
      invited_at: now,
      accepted_at: m.acceptedAt,
    }))];

    const { data: insertedMembers, error: membersError } = await supabase
      .from('project_members')
      .insert(membersToInsert)
      .select();

    if (membersError) {
      console.error('Error adding members:', membersError);
      // Rollback: delete project
      await supabase.from('projects').delete().eq('id', project.id);
      throw new Error(`Failed to add members: ${membersError.message}`);
    }

    // 3. Transform to expected format
    const resultProject: Project = {
      id: project.id,
      name: project.name,
      description: project.description,
      region: project.region,
      currency: project.currency,
      startDate: project.start_date,
      endDate: project.end_date,
      workWeek: project.work_week,
      ownerId: project.owner_id,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };

    const resultMembers: ProjectMember[] = (insertedMembers || []).map(m => ({
      id: m.id,
      projectId: m.project_id,
      userId: m.user_id,
      userName: m.user_name,
      userEmail: m.user_email,
      role: m.role,
      invitedBy: m.invited_by,
      invitedAt: m.invited_at,
      acceptedAt: m.accepted_at,
    }));

    return {
      project: resultProject,
      members: resultMembers,
    };

  } catch (error) {
    console.error('Error in createProject:', error);
    throw error;
  }
}

/**
 * Get all projects for the current user
 */
export async function getUserProjects(userId?: string): Promise<Project[]> {
  try {
    const currentUserId = userId || 'current-user-id'; // TODO: Get from auth context

    // Get projects where user is a member
    const { data: memberRecords, error: memberError } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', currentUserId);

    if (memberError) {
      console.error('Error fetching project members:', memberError);
      throw new Error(`Failed to fetch projects: ${memberError.message}`);
    }

    if (!memberRecords || memberRecords.length === 0) {
      return [];
    }

    const projectIds = memberRecords.map(m => m.project_id);

    // Get project details
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds)
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    return (projects || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      region: p.region,
      currency: p.currency,
      startDate: p.start_date,
      endDate: p.end_date,
      workWeek: p.work_week,
      ownerId: p.owner_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

  } catch (error) {
    console.error('Error in getUserProjects:', error);
    throw error;
  }
}

/**
 * Get a specific project by ID
 */
export async function getProject(projectId: string): Promise<Project> {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('Error fetching project:', error);
      throw new Error(`Failed to fetch project: ${error.message}`);
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      region: project.region,
      currency: project.currency,
      startDate: project.start_date,
      endDate: project.end_date,
      workWeek: project.work_week,
      ownerId: project.owner_id,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };

  } catch (error) {
    console.error('Error in getProject:', error);
    throw error;
  }
}

/**
 * Update project details
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Project>
): Promise<Project> {
  try {
    const updateData: any = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.region !== undefined) updateData.region = updates.region;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.workWeek !== undefined) updateData.work_week = updates.workWeek;

    const { data: project, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Error updating project:', error);
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      region: project.region,
      currency: project.currency,
      startDate: project.start_date,
      endDate: project.end_date,
      workWeek: project.work_week,
      ownerId: project.owner_id,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };

  } catch (error) {
    console.error('Error in updateProject:', error);
    throw error;
  }
}

/**
 * Delete a project (owner only)
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('Error deleting project:', error);
      throw new Error(`Failed to delete project: ${error.message}`);
    }

  } catch (error) {
    console.error('Error in deleteProject:', error);
    throw error;
  }
}

/**
 * Get project members
 */
export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  try {
    const { data: members, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching members:', error);
      throw new Error(`Failed to fetch members: ${error.message}`);
    }

    return (members || []).map(m => ({
      id: m.id,
      projectId: m.project_id,
      userId: m.user_id,
      userName: m.user_name,
      userEmail: m.user_email,
      role: m.role,
      invitedBy: m.invited_by,
      invitedAt: m.invited_at,
      acceptedAt: m.accepted_at,
    }));

  } catch (error) {
    console.error('Error in getProjectMembers:', error);
    throw error;
  }
}

/**
 * Add a member to a project
 */
export async function addProjectMember(
  projectId: string,
  member: Partial<ProjectMember>
): Promise<ProjectMember> {
  try {
    const currentUserId = 'current-user-id'; // TODO: Get from auth context
    const now = new Date().toISOString();

    const memberData = {
      project_id: projectId,
      user_id: member.userId || `user-${Date.now()}`,
      user_name: member.userName || 'Unknown',
      user_email: member.userEmail || '',
      role: member.role || 'Viewer',
      invited_by: currentUserId,
      invited_at: now,
      accepted_at: member.acceptedAt,
    };

    const { data: insertedMember, error } = await supabase
      .from('project_members')
      .insert([memberData])
      .select()
      .single();

    if (error) {
      console.error('Error adding member:', error);
      throw new Error(`Failed to add member: ${error.message}`);
    }

    return {
      id: insertedMember.id,
      projectId: insertedMember.project_id,
      userId: insertedMember.user_id,
      userName: insertedMember.user_name,
      userEmail: insertedMember.user_email,
      role: insertedMember.role,
      invitedBy: insertedMember.invited_by,
      invitedAt: insertedMember.invited_at,
      acceptedAt: insertedMember.accepted_at,
    };

  } catch (error) {
    console.error('Error in addProjectMember:', error);
    throw error;
  }
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  projectId: string,
  memberId: string,
  role: ProjectRole
): Promise<ProjectMember> {
  try {
    const { data: updatedMember, error } = await supabase
      .from('project_members')
      .update({ role })
      .eq('id', memberId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Error updating member role:', error);
      throw new Error(`Failed to update member role: ${error.message}`);
    }

    return {
      id: updatedMember.id,
      projectId: updatedMember.project_id,
      userId: updatedMember.user_id,
      userName: updatedMember.user_name,
      userEmail: updatedMember.user_email,
      role: updatedMember.role,
      invitedBy: updatedMember.invited_by,
      invitedAt: updatedMember.invited_at,
      acceptedAt: updatedMember.accepted_at,
    };

  } catch (error) {
    console.error('Error in updateMemberRole:', error);
    throw error;
  }
}

/**
 * Remove a member from a project
 */
export async function removeProjectMember(
  projectId: string,
  memberId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId)
      .eq('project_id', projectId);

    if (error) {
      console.error('Error removing member:', error);
      throw new Error(`Failed to remove member: ${error.message}`);
    }

  } catch (error) {
    console.error('Error in removeProjectMember:', error);
    throw error;
  }
}

/**
 * Get user's role in a project
 */
export async function getUserProjectRole(
  projectId: string,
  userId: string
): Promise<ProjectRole | null> {
  try {
    const { data: member, error } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - user not a member
        return null;
      }
      console.error('Error fetching user role:', error);
      throw new Error(`Failed to fetch user role: ${error.message}`);
    }

    return member.role as ProjectRole;

  } catch (error) {
    console.error('Error in getUserProjectRole:', error);
    throw error;
  }
}
