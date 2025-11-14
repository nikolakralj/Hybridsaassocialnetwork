import type { Hono } from "npm:hono@4";
import * as kv from "./kv_store.tsx";
import { sendEmail } from "./email.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// EMAIL HELPERS - Handle Resend testing mode
// ============================================================================

const VERIFIED_EMAIL = 'nikola.kralj86@gmail.com';

/**
 * In Resend testing mode, all emails must go to the verified address.
 * This function ensures we always use a valid recipient.
 */
function getTestingEmailRecipient(intendedEmail?: string): string {
  // Always use verified email in testing mode
  // In production, you would check an environment variable to determine if in testing mode
  return VERIFIED_EMAIL;
}

/**
 * Send email with automatic testing mode handling
 */
async function sendEmailSafe(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    const actualRecipient = getTestingEmailRecipient(params.to);
    
    // Add note to subject if redirecting email
    const subjectWithNote = params.to !== actualRecipient 
      ? `[TEST - intended for ${params.to}] ${params.subject}`
      : params.subject;
    
    await sendEmail({
      to: actualRecipient,
      subject: subjectWithNote,
      html: params.html,
    });
    
    console.log(`[EMAIL] Sent to ${actualRecipient} (intended: ${params.to})`);
  } catch (error) {
    console.error('[EMAIL] Failed to send:', error);
    // Don't throw - we don't want email failures to break the workflow
  }
}

interface ApprovalToken {
  id: string;
  approval_item_id: string;
  approver_id: string;
  approver_name: string;
  approver_email: string;
  action: 'approve' | 'reject' | 'view';
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface ApprovalItem {
  id: string;
  project_id: string;
  project_name: string;
  period_start: string;
  period_end: string;
  status: string;
  submitter_id: string;
  submitter_name: string;
  submitter_email: string;
  current_approver_id: string;
  current_approver_name: string;
  next_approver_id: string | null;
  next_approver_name: string | null;
  next_approver_email: string | null;
  approval_chain: any[];
  hours_total: number;
  amount: number | null;
}

/**
 * Validate approval token from KV store
 */
async function validateToken(token: string): Promise<{
  valid: boolean;
  error?: string;
  tokenData?: ApprovalToken;
}> {
  // Get token from KV store
  const tokenData = await kv.get<ApprovalToken>(`approval_token:${token}`);

  if (!tokenData) {
    console.error('[APPROVAL KV] Token not found:', token);
    return { valid: false, error: 'INVALID_TOKEN' };
  }

  // Check if already used
  if (tokenData.used_at) {
    return { valid: false, error: 'ALREADY_USED', tokenData };
  }

  // Check if expired
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt < new Date()) {
    return { valid: false, error: 'TOKEN_EXPIRED', tokenData };
  }

  return { valid: true, tokenData };
}

/**
 * Mark token as used in KV store
 */
async function markTokenUsed(tokenId: string): Promise<void> {
  const tokenData = await kv.get<ApprovalToken>(`approval_token:${tokenId}`);
  if (tokenData) {
    tokenData.used_at = new Date().toISOString();
    await kv.set(`approval_token:${tokenId}`, tokenData);
  }
}

/**
 * Get approval item from KV store
 */
async function getApprovalItem(itemId: string): Promise<ApprovalItem | null> {
  const item = await kv.get<ApprovalItem>(`approval_item:${itemId}`);
  return item;
}

/**
 * Update approval item in KV store
 */
async function updateApprovalItem(itemId: string, updates: Partial<ApprovalItem>): Promise<void> {
  const item = await kv.get<ApprovalItem>(`approval_item:${itemId}`);
  if (item) {
    Object.assign(item, updates);
    await kv.set(`approval_item:${itemId}`, item);
  }
}

/**
 * Process approval action
 */
async function processApproval(
  itemId: string,
  approverId: string,
  action: 'approve' | 'reject',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // Get current item state
  const item = await getApprovalItem(itemId);
  
  if (!item) {
    return { success: false, error: 'Item not found' };
  }

  // Verify this person is the current approver
  if (item.current_approver_id !== approverId) {
    return { success: false, error: 'Not authorized to approve this item' };
  }

  if (action === 'reject') {
    // Handle rejection
    await updateApprovalItem(itemId, {
      status: 'rejected',
      rejection_reason: reason || 'No reason provided',
      rejected_at: new Date().toISOString(),
      rejected_by: approverId,
    } as any);

    return { success: true };
  }

  // Handle approval
  if (item.next_approver_id) {
    // Not final approval - advance to next approver
    await updateApprovalItem(itemId, {
      status: 'pending',
      current_approver_id: item.next_approver_id,
      current_approver_name: item.next_approver_name || 'Unknown',
      next_approver_id: null,
      next_approver_name: null,
      next_approver_email: null,
    });

    return { success: true };
  } else {
    // Final approval - mark as approved
    await updateApprovalItem(itemId, {
      status: 'approved',
      approved_at: new Date().toISOString(),
    } as any);

    return { success: true };
  }
}

/**
 * Send appropriate notification emails after approval action
 */
async function sendApprovalNotifications(
  item: ApprovalItem,
  action: 'approve' | 'reject',
  reason?: string
): Promise<void> {
  const periodLabel = `${new Date(item.period_start).toLocaleDateString()} - ${new Date(item.period_end).toLocaleDateString()}`;

  if (action === 'reject') {
    // Send rejection notification to submitter
    if (item.submitter_email) {
      await sendEmailSafe({
        to: item.submitter_email,
        subject: `⚠️ Action Needed: Timesheet Rejected by ${item.current_approver_name}`,
        html: generateRejectionEmailHtml({
          contractorName: item.submitter_name,
          rejectorName: item.current_approver_name,
          projectName: item.project_name,
          periodLabel,
          reason,
        }),
      });
      console.log('[EMAIL KV] Rejection notification sent to:', item.submitter_email);
    }
  } else {
    // Approval
    if (item.next_approver_id) {
      // Not final - send "first approval" to submitter
      if (item.submitter_email) {
        await sendEmailSafe({
          to: item.submitter_email,
          subject: `✅ Approved by ${item.current_approver_name} - ${periodLabel}`,
          html: generateFirstApprovalEmailHtml({
            contractorName: item.submitter_name,
            approverName: item.current_approver_name,
            projectName: item.project_name,
            periodLabel,
            hours: item.hours_total,
            nextApprover: item.next_approver_name || 'Next Approver',
          }),
        });
        console.log('[EMAIL KV] First approval notification sent to:', item.submitter_email);
      }

      // Send approval request to next approver
      if (item.next_approver_email) {
        // Generate new tokens for next approver
        const baseUrl = Deno.env.get('PUBLIC_URL') || 'http://localhost:3000';
        const approveToken = `token-${Date.now()}-approve-${Math.random().toString(36).substring(7)}`;
        const rejectToken = `token-${Date.now()}-reject-${Math.random().toString(36).substring(7)}`;
        const viewToken = `token-${Date.now()}-view-${Math.random().toString(36).substring(7)}`;

        // Store tokens in KV
        await kv.set(`approval_token:${approveToken}`, {
          id: approveToken,
          approval_item_id: item.id,
          approver_id: item.next_approver_id,
          approver_name: item.next_approver_name || 'Unknown',
          approver_email: item.next_approver_email,
          action: 'approve',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: null,
          created_at: new Date().toISOString(),
        });

        await kv.set(`approval_token:${rejectToken}`, {
          id: rejectToken,
          approval_item_id: item.id,
          approver_id: item.next_approver_id,
          approver_name: item.next_approver_name || 'Unknown',
          approver_email: item.next_approver_email,
          action: 'reject',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: null,
          created_at: new Date().toISOString(),
        });

        await sendEmailSafe({
          to: item.next_approver_email,
          subject: `📋 Approval Request: ${item.submitter_name} - ${periodLabel}`,
          html: generateApprovalRequestEmailHtml({
            approverName: item.next_approver_name || 'Unknown',
            submitterName: item.submitter_name,
            projectName: item.project_name,
            periodLabel,
            hours: item.hours_total,
            amount: item.amount,
            approveUrl: `${baseUrl}/approve?token=${approveToken}`,
            rejectUrl: `${baseUrl}/reject?token=${rejectToken}`,
            viewUrl: `${baseUrl}/approval-view?token=${viewToken}`,
          }),
        });
        console.log('[EMAIL KV] Approval request sent to next approver:', item.next_approver_email);
      }
    } else {
      // Final approval - send "ready to invoice" to submitter
      if (item.submitter_email) {
        await sendEmailSafe({
          to: item.submitter_email,
          subject: `🎉 Timesheet Fully Approved - Ready to Invoice`,
          html: generateFinalApprovalEmailHtml({
            contractorName: item.submitter_name,
            projectName: item.project_name,
            periodLabel,
            hours: item.hours_total,
            amount: item.amount,
          }),
        });
        console.log('[EMAIL KV] Final approval notification sent to:', item.submitter_email);
      }
    }
  }
}

/**
 * Register KV-based approval execution routes
 */
export function registerApprovalKVRoutes(app: Hono) {
  // Execute approval action (from email link)
  app.post('/make-server-f8b491be/approvals/execute', async (c) => {
    try {
      const body = await c.req.json();
      const { token, action, reason } = body;

      console.log('[APPROVAL KV] Executing approval:', { token, action });

      if (!token || !action) {
        return c.json({ 
          success: false, 
          error: 'MISSING_PARAMS',
          message: 'Missing token or action' 
        }, 400);
      }

      // Validate token
      const validation = await validateToken(token);
      if (!validation.valid) {
        console.log('[APPROVAL KV] Token validation failed:', validation.error);
        return c.json({
          success: false,
          error: validation.error,
          message: validation.error === 'ALREADY_USED' 
            ? 'This approval has already been processed'
            : validation.error === 'TOKEN_EXPIRED'
            ? 'This approval link has expired'
            : 'Invalid approval link',
        }, 400);
      }

      const tokenData = validation.tokenData!;

      // Verify action matches token
      if (tokenData.action !== action && tokenData.action !== 'view') {
        return c.json({
          success: false,
          error: 'ACTION_MISMATCH',
          message: 'This link cannot be used for this action',
        }, 400);
      }

      // Get approval item
      const item = await getApprovalItem(tokenData.approval_item_id);
      if (!item) {
        console.log('[APPROVAL KV] Item not found:', tokenData.approval_item_id);
        return c.json({
          success: false,
          error: 'ITEM_NOT_FOUND',
          message: 'Approval item not found',
        }, 404);
      }

      // Check if already processed
      if (item.status === 'approved' || item.status === 'rejected') {
        return c.json({
          success: false,
          error: 'ALREADY_PROCESSED',
          message: `This timesheet has already been ${item.status}`,
          itemDetails: {
            submitterName: item.submitter_name,
            projectName: item.project_name,
            periodLabel: `${new Date(item.period_start).toLocaleDateString()} - ${new Date(item.period_end).toLocaleDateString()}`,
            hours: item.hours_total,
            status: item.status,
          },
        }, 400);
      }

      // Process the approval/rejection
      const result = await processApproval(
        tokenData.approval_item_id,
        tokenData.approver_id,
        action as 'approve' | 'reject',
        reason
      );

      if (!result.success) {
        console.error('[APPROVAL KV] Processing failed:', result.error);
        return c.json({
          success: false,
          error: 'PROCESSING_FAILED',
          message: result.error || 'Failed to process approval',
        }, 500);
      }

      // Mark token as used
      await markTokenUsed(token);

      // Get updated item for notifications
      const updatedItem = await getApprovalItem(tokenData.approval_item_id);
      if (updatedItem) {
        // Send notification emails
        await sendApprovalNotifications(
          updatedItem,
          action as 'approve' | 'reject',
          reason
        );
      }

      // Return success
      console.log('[APPROVAL KV] Success!', { action, item: item.id });
      return c.json({
        success: true,
        message: action === 'approve' 
          ? 'Timesheet approved successfully!'
          : 'Timesheet rejected.',
        itemDetails: {
          submitterName: item.submitter_name,
          projectName: item.project_name,
          periodLabel: `${new Date(item.period_start).toLocaleDateString()} - ${new Date(item.period_end).toLocaleDateString()}`,
          hours: item.hours_total,
        },
      });

    } catch (error) {
      console.error('[APPROVAL KV EXECUTE] Error:', error);
      return c.json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal server error: ' + String(error),
      }, 500);
    }
  });

  // NEW: Submit timesheet for approval
  app.post('/make-server-f8b491be/approvals/submit', async (c) => {
    try {
      const body = await c.req.json();
      const { periodId, contractId, submitterId, submitterName, submitterEmail, approverName, approverEmail, projectName, periodLabel, hours, amount } = body;

      console.log('[SUBMIT] Timesheet submission:', { periodId, contractId, submitterId });

      if (!periodId || !contractId) {
        return c.json({ 
          success: false, 
          error: 'MISSING_PARAMS',
          message: 'Missing required parameters' 
        }, 400);
      }

      // ✅ UPDATE POSTGRES: Update the timesheet_periods table status to 'submitted'
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: updateData, error: updateError } = await supabase
        .from('timesheet_periods')
        .update({ 
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .eq('id', periodId);

      if (updateError) {
        console.error('[SUBMIT] Failed to update Postgres:', updateError);
        return c.json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Failed to update timesheet status: ' + updateError.message,
        }, 500);
      }

      console.log('[SUBMIT] Updated Postgres period status to submitted:', periodId);

      // ✅ ALSO UPDATE KV (for backward compatibility with approval workflow)
      const periodKey = `timesheet_period:${periodId}`;
      const periodData = await kv.get<any>(periodKey);
      
      if (periodData) {
        periodData.status = 'submitted';
        periodData.submittedAt = new Date().toISOString();
        await kv.set(periodKey, periodData);
        console.log('[SUBMIT] Updated KV period status to submitted:', periodId);
      }

      // ✅ Create timesheet graph node for visualization
      try {
        const { data: period, error: periodError } = await supabase
          .from('timesheet_periods')
          .select('*')
          .eq('id', periodId)
          .single();
        
        // ✅ ARCHITECTURE DECISION: Do NOT create graph nodes for timesheets
        // The WorkGraph is for POLICY (structure, rules, approval chains)
        // Timesheets are TRANSACTIONS that follow the policies
        // This prevents graph pollution (50 people × 52 weeks = 2600+ nodes/year)
        if (!periodError && period) {
          console.log('[SUBMIT] Timesheet submitted - following approval policy from WorkGraph');
          console.log('[SUBMIT] Period:', period.week_start_date, 'to', period.week_end_date);
          // The approval logic is handled via the approvals table, not graph nodes
        }
      } catch (error) {
        console.error('[SUBMIT] Error fetching period data:', error);
      }

      // Send email notification to approver (nikola.kralj86@gmail.com)
      if (approverEmail && approverName) {
        try {
          await sendEmailSafe({
            to: approverEmail,
            subject: `📋 Timesheet Approval Request - ${projectName}`,
            html: generateSubmissionNotificationEmailHtml({
              approverName,
              submitterName: submitterName || 'Contractor',
              projectName: projectName || 'Project',
              periodLabel: periodLabel || 'Period',
              hours: hours || 0,
              amount,
            }),
          });
          console.log('[SUBMIT] Notification email sent to:', approverEmail);
        } catch (emailError) {
          console.error('[SUBMIT] Failed to send email:', emailError);
          // Don't fail the submission if email fails
        }
      }

      return c.json({
        success: true,
        message: 'Timesheet submitted for approval successfully!',
        periodId,
        status: 'submitted',
      });

    } catch (error) {
      console.error('[SUBMIT] Error:', error);
      return c.json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal server error: ' + String(error),
      }, 500);
    }
  });

  // NEW: Approve timesheet
  app.post('/make-server-f8b491be/approvals/approve', async (c) => {
    try {
      const body = await c.req.json();
      const { periodId, contractId, approverId, approverName, approverEmail, submitterName, submitterEmail, projectName, periodLabel, hours, amount } = body;

      console.log('[APPROVE] Timesheet approval:', { periodId, contractId, approverId });

      if (!periodId) {
        return c.json({ 
          success: false, 
          error: 'MISSING_PARAMS',
          message: 'Missing required parameters' 
        }, 400);
      }

      // ✅ UPDATE POSTGRES: Update the timesheet_periods table status
      // Note: The database may have a check constraint that only allows certain status values
      // Common valid values: 'pending', 'draft', 'submitted', 'manager_approved', 'rejected'
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Try to update with 'manager_approved' status (common in timesheet systems)
      const { data: updateData, error: updateError } = await supabase
        .from('timesheet_periods')
        .update({ 
          status: 'manager_approved', // Use valid status value per database constraint
        })
        .eq('id', periodId);

      if (updateError) {
        console.error('[APPROVE] Failed to update Postgres:', updateError);
        return c.json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Failed to update timesheet status: ' + updateError.message,
        }, 500);
      }

      console.log('[APPROVE] Updated Postgres period status to manager_approved:', periodId);

      // ✅ ALSO UPDATE KV (for backward compatibility)
      const periodKey = `timesheet_period:${periodId}`;
      const periodData = await kv.get<any>(periodKey);
      
      if (periodData) {
        periodData.status = 'manager_approved';
        periodData.approvedAt = new Date().toISOString();
        periodData.approvedBy = approverId;
        await kv.set(periodKey, periodData);
        console.log('[APPROVE] Updated KV period status to manager_approved:', periodId);
      }

      // Send email notification to submitter (contractor)
      if (submitterEmail && submitterName) {
        try {
          await sendEmailSafe({
            to: submitterEmail,
            subject: `✅ Timesheet Approved - ${projectName}`,
            html: generateApprovalNotificationEmailHtml({
              submitterName,
              approverName: approverName || 'Manager',
              projectName: projectName || 'Project',
              periodLabel: periodLabel || 'Period',
              hours: hours || 0,
              amount,
            }),
          });
          console.log('[APPROVE] Notification email sent to:', submitterEmail);
        } catch (emailError) {
          console.error('[APPROVE] Failed to send email:', emailError);
          // Don't fail the approval if email fails
        }
      }

      return c.json({
        success: true,
        message: 'Timesheet approved successfully!',
        periodId,
        status: 'manager_approved',
      });

    } catch (error) {
      console.error('[APPROVE] Error:', error);
      return c.json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal server error: ' + String(error),
      }, 500);
    }
  });

  // NEW: Reject timesheet
  app.post('/make-server-f8b491be/approvals/reject', async (c) => {
    try {
      const body = await c.req.json();
      const { periodId, contractId, approverId, approverName, approverEmail, submitterName, submitterEmail, reason, projectName, periodLabel, hours, amount } = body;

      console.log('[REJECT] Timesheet rejection:', { periodId, contractId, approverId, reason });

      if (!periodId || !reason) {
        return c.json({ 
          success: false, 
          error: 'MISSING_PARAMS',
          message: 'Missing required parameters' 
        }, 400);
      }

      // ✅ UPDATE POSTGRES: Update the timesheet_periods table status to 'rejected'
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Only update status field (other rejection fields don't exist in the table yet)
      const { data: updateData, error: updateError } = await supabase
        .from('timesheet_periods')
        .update({ 
          status: 'rejected',
        })
        .eq('id', periodId);

      if (updateError) {
        console.error('[REJECT] Failed to update Postgres:', updateError);
        return c.json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Failed to update timesheet status: ' + updateError.message,
        }, 500);
      }

      console.log('[REJECT] Updated Postgres period status to rejected:', periodId);

      // ✅ ALSO UPDATE KV (for backward compatibility) - KV can store additional metadata
      const periodKey = `timesheet_period:${periodId}`;
      const periodData = await kv.get<any>(periodKey);
      
      if (periodData) {
        periodData.status = 'rejected';
        periodData.rejectedAt = new Date().toISOString();
        periodData.rejectedBy = approverId;
        periodData.rejectionReason = reason;
        await kv.set(periodKey, periodData);
        console.log('[REJECT] Updated KV period status to rejected:', periodId);
      } else {
        // If period doesn't exist in KV, create it with the rejection metadata
        await kv.set(periodKey, {
          id: periodId,
          contractId,
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectedBy: approverId,
          rejectionReason: reason,
        });
        console.log('[REJECT] Created KV period with rejection metadata:', periodId);
      }

      // Send email notification to submitter (contractor)
      if (submitterEmail && submitterName) {
        try {
          await sendEmailSafe({
            to: submitterEmail,
            subject: `❌ Timesheet Rejected - ${projectName}`,
            html: generateRejectionNotificationEmailHtml({
              submitterName,
              approverName: approverName || 'Manager',
              projectName: projectName || 'Project',
              periodLabel: periodLabel || 'Period',
              hours: hours || 0,
              amount,
              reason,
            }),
          });
          console.log('[REJECT] Notification email sent to:', submitterEmail);
        } catch (emailError) {
          console.error('[REJECT] Failed to send email:', emailError);
          // Don't fail the rejection if email fails
        }
      }

      return c.json({
        success: true,
        message: 'Timesheet rejected successfully!',
        periodId,
        status: 'rejected',
      });

    } catch (error) {
      console.error('[REJECT] Error:', error);
      return c.json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal server error: ' + String(error),
      }, 500);
    }
  });
}

// Email template generators
function generateApprovalRequestEmailHtml(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">📋 Approval Request</h1>
        </div>
        <div style="padding: 30px;">
          <p style="margin: 0 0 20px; color: #374151;">Hi <strong>${data.approverName}</strong>,</p>
          <p style="margin: 0 0 20px; color: #374151;"><strong>${data.submitterName}</strong> has submitted a timesheet for your approval.</p>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="margin: 8px 0;"><span style="color: #6b7280;">Project:</span> <strong>${data.projectName}</strong></div>
            <div style="margin: 8px 0;"><span style="color: #6b7280;">Period:</span> <strong>${data.periodLabel}</strong></div>
            <div style="margin: 8px 0;"><span style="color: #6b7280;">Hours:</span> <strong>${data.hours}h</strong></div>
            ${data.amount ? `<div style="margin: 8px 0;"><span style="color: #6b7280;">Amount:</span> <strong>$${data.amount.toLocaleString()}</strong></div>` : ''}
          </div>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${data.approveUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: 10px;">✅ Approve</a>
            <a href="${data.rejectUrl}" style="display: inline-block; background: #ef4444; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">❌ Reject</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateFirstApprovalEmailHtml(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">✅ Your Timesheet Approved</h1>
        </div>
        <div style="padding: 30px;">
          <p style="margin: 0 0 20px; color: #374151;">Hi <strong>${data.contractorName}</strong>,</p>
          <p style="margin: 0 0 20px; color: #374151;">Good news! <strong>${data.approverName}</strong> has approved your timesheet for <strong>${data.periodLabel}</strong>.</p>
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin: 0; color: #166534;"><strong>Status:</strong> Approved by ${data.approverName}${data.nextApprover ? ` → Pending with ${data.nextApprover}` : ''}</p>
          </div>
          <p style="margin: 20px 0 0; color: #6b7280;">${data.nextApprover ? "You'll be notified when the full approval chain completes." : "This was the final approval. You can now generate your invoice!"}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateFinalApprovalEmailHtml(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 28px;">🎉 Fully Approved!</h1>
        </div>
        <div style="padding: 30px;">
          <p style="margin: 0 0 20px; color: #374151;">Hi <strong>${data.contractorName}</strong>,</p>
          <p style="margin: 0 0 20px; color: #374151;">Your timesheet for <strong>${data.periodLabel}</strong> is fully approved by all parties.</p>
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-weight: 600;">✅ Ready to Invoice</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="margin: 8px 0;"><span style="color: #6b7280;">Project:</span> <strong>${data.projectName}</strong></div>
            <div style="margin: 8px 0;"><span style="color: #6b7280;">Hours:</span> <strong>${data.hours}h</strong></div>
            ${data.amount ? `<div style="margin: 8px 0;"><span style="color: #6b7280;">Amount:</span> <strong style="color: #10b981; font-size: 18px;">$${data.amount.toLocaleString()}</strong></div>` : ''}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateRejectionEmailHtml(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">⚠️ Action Needed</h1>
        </div>
        <div style="padding: 30px;">
          <p style="margin: 0 0 20px; color: #374151;">Hi <strong>${data.contractorName}</strong>,</p>
          <p style="margin: 0 0 20px; color: #374151;">Your timesheet for <strong>${data.periodLabel}</strong> was rejected by <strong>${data.rejectorName}</strong>.</p>
          ${data.reason ? `
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <p style="margin: 0 0 8px; color: #991b1b; font-weight: 600;">Reason:</p>
            <p style="margin: 0; color: #7f1d1d;">"${data.reason}"</p>
          </div>
          ` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateSubmissionNotificationEmailHtml(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">📋 Timesheet Approval Request</h1>
        </div>
        <div style="padding: 30px;">
          <p style="margin: 0 0 20px; color: #374151;">Hi <strong>${data.approverName}</strong>,</p>
          <p style="margin: 0 0 20px; color: #374151;"><strong>${data.submitterName}</strong> has submitted a timesheet for your approval.</p>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="margin: 8px 0;"><span style="color: #6b7280;">Project:</span> <strong>${data.projectName}</strong></div>
            <div style="margin: 8px 0;"><span style="color: #6b7280;">Period:</span> <strong>${data.periodLabel}</strong></div>
            <div style="margin: 8px 0;"><span style="color: #6b7280;">Hours:</span> <strong>${data.hours}h</strong></div>
            ${data.amount ? `<div style="margin: 8px 0;"><span style="color: #6b7280;">Amount:</span> <strong>$${data.amount.toLocaleString()}</strong></div>` : ''}
          </div>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${data.approveUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: 10px;">✅ Approve</a>
            <a href="${data.rejectUrl}" style="display: inline-block; background: #ef4444; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">❌ Reject</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateApprovalNotificationEmailHtml(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">✅ Timesheet Approved</h1>
        </div>
        <div style="padding: 30px;">
          <p style="margin: 0 0 20px; color: #374151;">Hi <strong>${data.submitterName}</strong>,</p>
          <p style="margin: 0 0 20px; color: #374151;">Good news! <strong>${data.approverName}</strong> has approved your timesheet for <strong>${data.periodLabel}</strong>.</p>
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin: 0; color: #166534;"><strong>Status:</strong> Approved by ${data.approverName}${data.nextApprover ? ` → Pending with ${data.nextApprover}` : ''}</p>
          </div>
          <p style="margin: 20px 0 0; color: #6b7280;">${data.nextApprover ? "You'll be notified when the full approval chain completes." : "This was the final approval. You can now generate your invoice!"}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateRejectionNotificationEmailHtml(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">⚠️ Action Needed</h1>
        </div>
        <div style="padding: 30px;">
          <p style="margin: 0 0 20px; color: #374151;">Hi <strong>${data.submitterName}</strong>,</p>
          <p style="margin: 0 0 20px; color: #374151;">Your timesheet for <strong>${data.periodLabel}</strong> was rejected by <strong>${data.approverName}</strong>.</p>
          ${data.reason ? `
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <p style="margin: 0 0 8px; color: #991b1b; font-weight: 600;">Reason:</p>
            <p style="margin: 0; color: #7f1d1d;">"${data.reason}"</p>
          </div>
          ` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}