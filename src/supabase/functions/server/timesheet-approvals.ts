/**
 * Timesheet Approval API Routes
 * Handles submission, approval, rejection with graph node integration
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Resend } from 'npm:resend';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const TESTING_EMAIL = 'delivered@resend.dev'; // Resend testing email

export const timesheetApprovalsRouter = new Hono();

// ============================================================================
// SUBMIT TIMESHEET FOR APPROVAL
// ============================================================================

timesheetApprovalsRouter.post('/submit', async (c) => {
  try {
    const { periodId, userId } = await c.req.json();
    
    console.log('📝 Submitting timesheet for approval:', { periodId, userId });
    
    // 1. Get timesheet period data
    const { data: period, error: periodError } = await supabase
      .from('timesheet_periods')
      .select(`
        *,
        project_contracts!inner(
          id,
          project_id,
          company_id,
          user_id,
          hourly_rate,
          requires_client_approval,
          client_timesheet_visibility,
          projects!inner(
            id,
            name,
            company_id
          )
        )
      `)
      .eq('id', periodId)
      .single();
    
    if (periodError || !period) {
      console.error('Period not found:', periodError);
      return c.json({ error: 'Timesheet period not found' }, 404);
    }
    
    // 2. Get entries to calculate totals
    const { data: entries, error: entriesError } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('period_id', periodId);
    
    if (entriesError) {
      console.error('Failed to get entries:', entriesError);
      return c.json({ error: 'Failed to get entries' }, 500);
    }
    
    const totalHours = entries?.reduce((sum, e) => sum + (e.hours || 0), 0) || 0;
    const billableHours = entries?.filter(e => e.billable).reduce((sum, e) => sum + (e.hours || 0), 0) || 0;
    const overtimeHours = Math.max(0, totalHours - 40);
    const daysWorked = new Set(entries?.map(e => e.entry_date)).size;
    
    // 3. Build approval chain
    const approvalChain = await buildApprovalChain(period.project_contracts);
    
    // 4. Update Postgres status
    const { error: updateError } = await supabase
      .from('timesheet_periods')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        current_approval_step: 1,
        total_approval_steps: approvalChain.length,
      })
      .eq('id', periodId);
    
    if (updateError) {
      console.error('Failed to update period:', updateError);
      return c.json({ error: 'Failed to submit timesheet' }, 500);
    }
    
    // 5. Create graph node
    const nodeId = `ts-${period.week_start_date}-${userId.replace('user-', '')}`;
    
    const timesheetNode = {
      nodeType: 'TimesheetPeriod',
      nodeId,
      properties: {
        weekStart: period.week_start_date,
        weekEnd: period.week_end_date,
        submittedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        status: 'submitted',
        currentStep: 1,
        totalSteps: approvalChain.length,
        version: period.version || 1,
        totalHours,
        billableHours,
        overtimeHours,
        daysWorked,
        totalAmount: totalHours * (period.project_contracts.hourly_rate || 0),
        currency: 'USD',
        hourlyRate: period.project_contracts.hourly_rate,
        postgresEntriesRef: `period_id = '${periodId}'`,
        postgresPeriodId: periodId,
        trackingMode: 'hours',
        hasBreaks: false,
        hasOvertimeFlag: overtimeHours > 0,
        hasWeekendWorkFlag: false,
        requiresClientApproval: period.project_contracts.requires_client_approval || false,
      }
    };
    
    // Store node in KV
    await supabase
      .from('kv_store_f8b491be')
      .upsert({
        key: `graph:node:${nodeId}`,
        value: timesheetNode,
        metadata: {
          nodeType: 'TimesheetPeriod',
          status: 'submitted',
          createdAt: new Date().toISOString(),
        }
      });
    
    // 6. Create approval edges
    for (const approver of approvalChain) {
      const edgeId = `${nodeId}:requires_approval:${approver.approverId}:step${approver.step}`;
      
      await supabase
        .from('kv_store_f8b491be')
        .upsert({
          key: `graph:edge:${edgeId}`,
          value: {
            type: 'REQUIRES_APPROVAL',
            from: nodeId,
            to: approver.approverId,
            metadata: {
              step: approver.step,
              status: approver.step === 1 ? 'pending' : 'pending',
              notifiedAt: approver.step === 1 ? new Date().toISOString() : '',
              remindersSent: 0,
            }
          },
          metadata: {
            edgeType: 'REQUIRES_APPROVAL',
            createdAt: new Date().toISOString(),
          }
        });
    }
    
    // 7. Update period with graph node reference
    await supabase
      .from('timesheet_periods')
      .update({ graph_node_id: nodeId })
      .eq('id', periodId);
    
    // 8. Send email notification to first approver
    if (approvalChain.length > 0) {
      const firstApprover = approvalChain[0];
      
      await sendApprovalRequestEmail({
        approverEmail: TESTING_EMAIL,
        approverName: firstApprover.approverName,
        contractorName: userId, // TODO: Get actual name
        weekStart: period.week_start_date,
        weekEnd: period.week_end_date,
        totalHours,
        totalAmount: totalHours * (period.project_contracts.hourly_rate || 0),
        timesheetId: periodId,
      });
    }
    
    console.log('✅ Timesheet submitted successfully:', nodeId);
    
    return c.json({
      success: true,
      nodeId,
      approvalChain,
      message: 'Timesheet submitted for approval',
    });
    
  } catch (error) {
    console.error('❌ Error submitting timesheet:', error);
    return c.json({ 
      error: 'Failed to submit timesheet', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================================================
// APPROVE TIMESHEET
// ============================================================================

timesheetApprovalsRouter.post('/approve', async (c) => {
  try {
    const { periodId, approverId, approverName, comment } = await c.req.json();
    
    console.log('✅ Approving timesheet:', { periodId, approverId });
    
    // 1. Get timesheet period
    const { data: period, error: periodError } = await supabase
      .from('timesheet_periods')
      .select('*, project_contracts!inner(user_id)')
      .eq('id', periodId)
      .single();
    
    if (periodError || !period) {
      return c.json({ error: 'Timesheet not found' }, 404);
    }
    
    // 2. Get graph node
    const { data: nodeData } = await supabase
      .from('kv_store_f8b491be')
      .select('value')
      .eq('key', `graph:node:${period.graph_node_id}`)
      .single();
    
    if (!nodeData) {
      return c.json({ error: 'Graph node not found' }, 404);
    }
    
    const node = nodeData.value;
    const currentStep = node.properties.currentStep;
    
    // 3. Update approval edge
    const edgeKey = `graph:edge:${period.graph_node_id}:requires_approval:${approverId}:step${currentStep}`;
    
    const { data: edgeData } = await supabase
      .from('kv_store_f8b491be')
      .select('value')
      .eq('key', edgeKey)
      .single();
    
    if (!edgeData) {
      return c.json({ error: 'Approval edge not found - you may not be the current approver' }, 403);
    }
    
    const edge = edgeData.value;
    edge.metadata.status = 'approved';
    edge.metadata.approvedAt = new Date().toISOString();
    edge.metadata.approvalComment = comment;
    
    await supabase
      .from('kv_store_f8b491be')
      .update({ value: edge })
      .eq('key', edgeKey);
    
    // 4. Check if fully approved
    const nextStep = currentStep + 1;
    const fullyApproved = nextStep > node.properties.totalSteps;
    
    if (fullyApproved) {
      // Update node to approved
      node.properties.status = 'approved';
      node.properties.approvedAt = new Date().toISOString();
      
      await supabase
        .from('kv_store_f8b491be')
        .update({ value: node })
        .eq('key', `graph:node:${period.graph_node_id}`);
      
      // Update Postgres
      await supabase
        .from('timesheet_periods')
        .update({
          status: 'manager_approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: approverId,
          review_notes: comment,
        })
        .eq('id', periodId);
      
      // Send approval email to contractor
      await sendApprovalConfirmationEmail({
        contractorEmail: TESTING_EMAIL,
        contractorName: period.project_contracts.user_id,
        approverName,
        weekStart: period.week_start_date,
        weekEnd: period.week_end_date,
        totalHours: node.properties.totalHours,
        totalAmount: node.properties.totalAmount,
      });
      
    } else {
      // Move to next step
      node.properties.currentStep = nextStep;
      node.properties.status = 'in_review';
      
      await supabase
        .from('kv_store_f8b491be')
        .update({ value: node })
        .eq('key', `graph:node:${period.graph_node_id}`);
      
      await supabase
        .from('timesheet_periods')
        .update({ current_approval_step: nextStep })
        .eq('id', periodId);
      
      // TODO: Notify next approver
    }
    
    console.log(`✅ Timesheet approved by ${approverName} (${fullyApproved ? 'FULLY APPROVED' : `moved to step ${nextStep}`})`);
    
    return c.json({
      success: true,
      fullyApproved,
      nextStep: fullyApproved ? null : nextStep,
      message: fullyApproved ? 'Timesheet fully approved' : 'Moved to next approval step',
    });
    
  } catch (error) {
    console.error('❌ Error approving timesheet:', error);
    return c.json({ 
      error: 'Failed to approve timesheet', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================================================
// REJECT TIMESHEET
// ============================================================================

timesheetApprovalsRouter.post('/reject', async (c) => {
  try {
    const { periodId, approverId, approverName, reason } = await c.req.json();
    
    console.log('❌ Rejecting timesheet:', { periodId, approverId, reason });
    
    if (!reason || reason.trim().length === 0) {
      return c.json({ error: 'Rejection reason is required' }, 400);
    }
    
    // 1. Get timesheet period
    const { data: period, error: periodError } = await supabase
      .from('timesheet_periods')
      .select('*, project_contracts!inner(user_id)')
      .eq('id', periodId)
      .single();
    
    if (periodError || !period) {
      return c.json({ error: 'Timesheet not found' }, 404);
    }
    
    // 2. Get graph node
    const { data: nodeData } = await supabase
      .from('kv_store_f8b491be')
      .select('value')
      .eq('key', `graph:node:${period.graph_node_id}`)
      .single();
    
    if (!nodeData) {
      return c.json({ error: 'Graph node not found' }, 404);
    }
    
    const node = nodeData.value;
    const currentStep = node.properties.currentStep;
    
    // 3. Update approval edge
    const edgeKey = `graph:edge:${period.graph_node_id}:requires_approval:${approverId}:step${currentStep}`;
    
    const { data: edgeData } = await supabase
      .from('kv_store_f8b491be')
      .select('value')
      .eq('key', edgeKey)
      .single();
    
    if (!edgeData) {
      return c.json({ error: 'Approval edge not found - you may not be the current approver' }, 403);
    }
    
    const edge = edgeData.value;
    edge.metadata.status = 'rejected';
    edge.metadata.rejectedAt = new Date().toISOString();
    edge.metadata.rejectionReason = reason;
    
    await supabase
      .from('kv_store_f8b491be')
      .update({ value: edge })
      .eq('key', edgeKey);
    
    // 4. Update node to rejected
    node.properties.status = 'rejected';
    node.properties.currentStep = 1; // Reset for resubmission
    
    await supabase
      .from('kv_store_f8b491be')
      .update({ value: node })
      .eq('key', `graph:node:${period.graph_node_id}`);
    
    // 5. Update Postgres
    await supabase
      .from('timesheet_periods')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: approverId,
        review_notes: reason,
        current_approval_step: 1,
      })
      .eq('id', periodId);
    
    // 6. Send rejection email to contractor
    await sendRejectionEmail({
      contractorEmail: TESTING_EMAIL,
      contractorName: period.project_contracts.user_id,
      approverName,
      weekStart: period.week_start_date,
      weekEnd: period.week_end_date,
      rejectionReason: reason,
      timesheetId: periodId,
    });
    
    console.log(`❌ Timesheet rejected by ${approverName}`);
    
    return c.json({
      success: true,
      message: 'Timesheet rejected - contractor can now edit and resubmit',
    });
    
  } catch (error) {
    console.error('❌ Error rejecting timesheet:', error);
    return c.json({ 
      error: 'Failed to reject timesheet', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================================================
// RESET TO DRAFT (for testing)
// ============================================================================

timesheetApprovalsRouter.post('/reset-to-draft', async (c) => {
  try {
    const { periodId } = await c.req.json();
    
    console.log('🔄 Resetting timesheet to draft:', periodId);
    
    // 1. Get period to find graph node
    const { data: period } = await supabase
      .from('timesheet_periods')
      .select('graph_node_id')
      .eq('id', periodId)
      .single();
    
    // 2. Delete graph nodes and edges (if they exist)
    if (period?.graph_node_id) {
      console.log('🗑️ Cleaning up graph nodes for:', period.graph_node_id);
      
      // Delete node
      await supabase
        .from('kv_store_f8b491be')
        .delete()
        .eq('key', `graph:node:${period.graph_node_id}`);
      
      // Delete all related edges
      await supabase
        .from('kv_store_f8b491be')
        .delete()
        .like('key', `graph:edge:${period.graph_node_id}:%`);
      
      await supabase
        .from('kv_store_f8b491be')
        .delete()
        .like('key', `graph:edge:%:${period.graph_node_id}`);
    }
    
    // 3. Reset Postgres period to draft
    await supabase
      .from('timesheet_periods')
      .update({
        status: 'draft',
        current_approval_step: 1,
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null,
        graph_node_id: null,
      })
      .eq('id', periodId);
    
    console.log('✅ Timesheet reset to draft');
    
    return c.json({
      success: true,
      message: 'Timesheet reset to draft - ready to submit again',
    });
    
  } catch (error) {
    console.error('❌ Error resetting timesheet:', error);
    return c.json({ 
      error: 'Failed to reset timesheet', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================================================
// RESET ALL APPROVED PERIODS (for testing) - NEW!
// ============================================================================

timesheetApprovalsRouter.post('/reset-all-approved', async (c) => {
  try {
    console.log('🔄 Resetting ALL non-draft timesheets to draft...');
    
    // 1. Get all periods that are NOT in draft status
    // This includes: submitted, manager_approved, approved, finance_approved, rejected
    // NOTE: Only select columns that exist in the table
    const { data: periods, error: fetchError } = await supabase
      .from('timesheet_periods')
      .select('id, status')
      .not('status', 'eq', 'draft'); // Get everything except draft
    
    if (fetchError) {
      console.error('Failed to fetch periods:', fetchError);
      return c.json({ error: 'Failed to fetch periods', details: fetchError }, 500);
    }
    
    if (!periods || periods.length === 0) {
      console.log('⚠️ No periods found to reset');
      return c.json({
        success: true,
        message: 'No periods found to reset - all are already in draft status',
        count: 0,
      });
    }
    
    console.log(`📋 Found ${periods.length} period(s) to reset:`);
    
    // 2. Clean up graph nodes for all periods (search KV store by period IDs)
    for (const period of periods) {
      console.log(`🗑️ Cleaning up graph nodes for period ${period.id}`);
      
      // Search for any graph nodes that reference this period
      const { data: kvData } = await supabase
        .from('kv_store_f8b491be')
        .select('key, value')
        .like('key', '%graph:%');
      
      if (kvData) {
        for (const item of kvData) {
          try {
            const value = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            // If this graph node references our period, delete it
            if (value?.period_id === period.id || value?.timesheet_period_id === period.id) {
              console.log(`  🗑️ Deleting graph node: ${item.key}`);
              await supabase
                .from('kv_store_f8b491be')
                .delete()
                .eq('key', item.key);
            }
          } catch (err) {
            // Skip items that can't be parsed
          }
        }
      }
    }
    
    // 3. Reset ALL periods to draft (only update columns that exist)
    const updateData: any = {
      status: 'draft',
      submitted_at: null,
      approved_at: null,
    };
    
    // Update ALL non-draft periods
    const { error: updateError } = await supabase
      .from('timesheet_periods')
      .update(updateData)
      .not('status', 'eq', 'draft'); // Update everything except draft
    
    if (updateError) {
      console.error('Failed to update periods:', updateError);
      return c.json({ error: 'Failed to reset periods', details: updateError }, 500);
    }
    
    console.log(`✅ Successfully reset ${periods.length} timesheets to draft`);
    
    return c.json({
      success: true,
      message: `Reset ${periods.length} timesheet(s) back to draft status`,
      count: periods.length,
      resetPeriods: periods.map(p => ({ id: p.id, previousStatus: p.status })),
    });
    
  } catch (error) {
    console.error('❌ Error resetting timesheets:', error);
    return c.json({ 
      error: 'Failed to reset timesheets', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function buildApprovalChain(contract: any) {
  const chain = [];
  
  // Step 1: Internal manager
  const { data: manager } = await supabase
    .from('users')
    .select('id, name')
    .eq('company_id', contract.company_id)
    .eq('user_type', 'manager')
    .limit(1)
    .single();
  
  if (manager) {
    chain.push({
      step: 1,
      approverId: manager.id,
      approverName: manager.name,
      role: 'manager',
    });
  }
  
  // Step 2: Client (if required)
  if (contract.requires_client_approval) {
    const { data: client } = await supabase
      .from('users')
      .select('id, name')
      .eq('company_id', contract.projects.company_id)
      .eq('user_type', 'client')
      .limit(1)
      .single();
    
    if (client) {
      chain.push({
        step: 2,
        approverId: client.id,
        approverName: client.name,
        role: 'client',
      });
    }
  }
  
  return chain;
}

// ============================================================================
// EMAIL FUNCTIONS
// ============================================================================

async function sendApprovalRequestEmail(params: {
  approverEmail: string;
  approverName: string;
  contractorName: string;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  totalAmount: number;
  timesheetId: string;
}) {
  try {
    await resend.emails.send({
      from: 'WorkGraph <onboarding@resend.dev>',
      to: params.approverEmail,
      subject: `New Timesheet Submitted - ${params.contractorName} - Week of ${params.weekStart}`,
      html: `
        <h2>New Timesheet Awaiting Your Approval</h2>
        <p>Hi ${params.approverName},</p>
        <p><strong>${params.contractorName}</strong> has submitted a timesheet for your approval.</p>
        
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>Period:</strong> ${params.weekStart} - ${params.weekEnd}</p>
          <p><strong>Total Hours:</strong> ${params.totalHours.toFixed(2)} hours</p>
          <p><strong>Estimated Amount:</strong> $${params.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        
        <p><a href="http://localhost:5173/?page=approvals" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Review and Approve</a></p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">WorkGraph Approval System</p>
      `,
    });
    console.log('✉️ Approval request email sent to:', params.approverEmail);
  } catch (error) {
    console.error('Failed to send approval email:', error);
  }
}

async function sendApprovalConfirmationEmail(params: {
  contractorEmail: string;
  contractorName: string;
  approverName: string;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  totalAmount: number;
}) {
  try {
    await resend.emails.send({
      from: 'WorkGraph <onboarding@resend.dev>',
      to: params.contractorEmail,
      subject: `Timesheet Approved - Week of ${params.weekStart}`,
      html: `
        <h2>Your Timesheet Has Been Approved! ✅</h2>
        <p>Hi ${params.contractorName},</p>
        <p>Your timesheet for <strong>${params.weekStart} - ${params.weekEnd}</strong> has been approved by ${params.approverName}.</p>
        
        <div style="background: #f0f9ff; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #0ea5e9;">
          <p><strong>Total Hours:</strong> ${params.totalHours.toFixed(2)} hours</p>
          <p><strong>Amount:</strong> $${params.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p><strong>Payment ETA:</strong> Within 5 business days</p>
        </div>
        
        <p><a href="http://localhost:5173/?page=timesheets" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Details</a></p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">WorkGraph</p>
      `,
    });
    console.log('✉️ Approval confirmation email sent to:', params.contractorEmail);
  } catch (error) {
    console.error('Failed to send approval email:', error);
  }
}

async function sendRejectionEmail(params: {
  contractorEmail: string;
  contractorName: string;
  approverName: string;
  weekStart: string;
  weekEnd: string;
  rejectionReason: string;
  timesheetId: string;
}) {
  try {
    await resend.emails.send({
      from: 'WorkGraph <onboarding@resend.dev>',
      to: params.contractorEmail,
      subject: `Timesheet Requires Changes - Week of ${params.weekStart}`,
      html: `
        <h2>Timesheet Returned for Revision</h2>
        <p>Hi ${params.contractorName},</p>
        <p>Your timesheet for <strong>${params.weekStart} - ${params.weekEnd}</strong> has been returned for revision by ${params.approverName}.</p>
        
        <div style="background: #fef2f2; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ef4444;">
          <p><strong>Manager's Notes:</strong></p>
          <p style="white-space: pre-wrap;">${params.rejectionReason}</p>
        </div>
        
        <p>Please review the feedback and resubmit your timesheet.</p>
        
        <p><a href="http://localhost:5173/?page=timesheets&id=${params.timesheetId}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Edit Timesheet</a></p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">WorkGraph</p>
      `,
    });
    console.log('✉️ Rejection email sent to:', params.contractorEmail);
  } catch (error) {
    console.error('Failed to send rejection email:', error);
  }
}