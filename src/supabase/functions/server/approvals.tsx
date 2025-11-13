// Phase 5 Days 9-10: Approval Execution & Email Triggers
import type { Hono } from "npm:hono@4";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendEmail } from "./email.tsx";

const getSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
};

interface ApprovalToken {
  id: string;
  approval_item_id: string;
  approver_id: string;
  action: 'approve' | 'reject' | 'view';
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface ApprovalItem {
  id: string;
  project_id: string;
  period_start: string;
  period_end: string;
  status: string;
  submitter_id: string;
  current_approver_id: string;
  next_approver_id: string | null;
  approval_chain: any[];
  hours_total: number;
  amount: number | null;
}

/**
 * Validate approval token and get token data
 */
async function validateToken(token: string): Promise<{
  valid: boolean;
  error?: string;
  tokenData?: ApprovalToken;
}> {
  const supabase = getSupabaseClient();

  // Query token from database
  const { data, error } = await supabase
    .from('approval_tokens')
    .select('*')
    .eq('id', token)
    .single();

  if (error || !data) {
    console.error('[APPROVAL] Token not found:', error);
    return { valid: false, error: 'INVALID_TOKEN' };
  }

  const tokenData = data as ApprovalToken;

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
 * Mark token as used
 */
async function markTokenUsed(tokenId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('approval_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenId);
}

/**
 * Get approval item details with related data
 */
async function getApprovalItemDetails(itemId: string): Promise<{
  item: ApprovalItem;
  submitter: any;
  currentApprover: any;
  nextApprover: any;
  project: any;
} | null> {
  const supabase = getSupabaseClient();

  // Get approval item
  const { data: item, error: itemError } = await supabase
    .from('approval_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (itemError || !item) {
    console.error('[APPROVAL] Item not found:', itemError);
    return null;
  }

  // Get submitter
  const { data: submitter } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('id', item.submitter_id)
    .single();

  // Get current approver
  const { data: currentApprover } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('id', item.current_approver_id)
    .single();

  // Get next approver (if exists)
  let nextApprover = null;
  if (item.next_approver_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', item.next_approver_id)
      .single();
    nextApprover = data;
  }

  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', item.project_id)
    .single();

  return {
    item: item as ApprovalItem,
    submitter,
    currentApprover,
    nextApprover,
    project,
  };
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
  const supabase = getSupabaseClient();

  // Get current item state
  const { data: item, error: fetchError } = await supabase
    .from('approval_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    return { success: false, error: 'Item not found' };
  }

  const approvalItem = item as ApprovalItem;

  // Verify this person is the current approver
  if (approvalItem.current_approver_id !== approverId) {
    return { success: false, error: 'Not authorized to approve this item' };
  }

  if (action === 'reject') {
    // Handle rejection
    const { error: updateError } = await supabase
      .from('approval_items')
      .update({
        status: 'rejected',
        rejection_reason: reason || 'No reason provided',
        rejected_at: new Date().toISOString(),
        rejected_by: approverId,
      })
      .eq('id', itemId);

    if (updateError) {
      console.error('[APPROVAL] Rejection update failed:', updateError);
      return { success: false, error: 'Database update failed' };
    }

    return { success: true };
  }

  // Handle approval
  if (approvalItem.next_approver_id) {
    // Not final approval - advance to next approver
    const { error: updateError } = await supabase
      .from('approval_items')
      .update({
        status: 'pending',
        current_approver_id: approvalItem.next_approver_id,
        // Update next_approver_id based on approval chain
        // For now, set to null (would need chain logic)
        next_approver_id: null,
      })
      .eq('id', itemId);

    if (updateError) {
      console.error('[APPROVAL] Approval update failed:', updateError);
      return { success: false, error: 'Database update failed' };
    }

    return { success: true };
  } else {
    // Final approval - mark as approved
    const { error: updateError } = await supabase
      .from('approval_items')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (updateError) {
      console.error('[APPROVAL] Final approval update failed:', updateError);
      return { success: false, error: 'Database update failed' };
    }

    return { success: true };
  }
}

/**
 * Send appropriate notification emails after approval action
 */
async function sendApprovalNotifications(
  itemId: string,
  action: 'approve' | 'reject',
  reason?: string
): Promise<void> {
  const details = await getApprovalItemDetails(itemId);
  if (!details) return;

  const { item, submitter, currentApprover, nextApprover, project } = details;

  const periodLabel = `${new Date(item.period_start).toLocaleDateString()} - ${new Date(item.period_end).toLocaleDateString()}`;

  if (action === 'reject') {
    // Send rejection notification to submitter
    if (submitter?.email) {
      await sendEmail({
        to: submitter.email,
        subject: `⚠️ Action Needed: Timesheet Rejected by ${currentApprover.name}`,
        html: generateRejectionEmailHtml({
          contractorName: submitter.name,
          rejectorName: currentApprover.name,
          projectName: project?.name || 'Unknown Project',
          periodLabel,
          reason,
        }),
      });
      console.log('[EMAIL] Rejection notification sent to:', submitter.email);
    }
  } else {
    // Approval
    if (nextApprover) {
      // Not final - send "first approval" to submitter
      if (submitter?.email) {
        await sendEmail({
          to: submitter.email,
          subject: `✅ Approved by ${currentApprover.name} - ${periodLabel}`,
          html: generateFirstApprovalEmailHtml({
            contractorName: submitter.name,
            approverName: currentApprover.name,
            projectName: project?.name || 'Unknown Project',
            periodLabel,
            hours: item.hours_total,
            nextApprover: nextApprover.name,
          }),
        });
        console.log('[EMAIL] First approval notification sent to:', submitter.email);
      }

      // Send approval request to next approver
      if (nextApprover?.email) {
        // Generate new tokens for next approver
        const baseUrl = Deno.env.get('PUBLIC_URL') || 'http://localhost:3000';
        const approveToken = `token-${Date.now()}-approve-${Math.random().toString(36).substring(7)}`;
        const rejectToken = `token-${Date.now()}-reject-${Math.random().toString(36).substring(7)}`;
        const viewToken = `token-${Date.now()}-view-${Math.random().toString(36).substring(7)}`;

        await sendEmail({
          to: nextApprover.email,
          subject: `📋 Approval Request: ${submitter.name} - ${periodLabel}`,
          html: generateApprovalRequestEmailHtml({
            approverName: nextApprover.name,
            submitterName: submitter.name,
            projectName: project?.name || 'Unknown Project',
            periodLabel,
            hours: item.hours_total,
            amount: item.amount,
            approveUrl: `${baseUrl}/approve?token=${approveToken}`,
            rejectUrl: `${baseUrl}/reject?token=${rejectToken}`,
            viewUrl: `${baseUrl}/approval-view?token=${viewToken}`,
          }),
        });
        console.log('[EMAIL] Approval request sent to next approver:', nextApprover.email);
      }
    } else {
      // Final approval - send "ready to invoice" to submitter
      if (submitter?.email) {
        await sendEmail({
          to: submitter.email,
          subject: `🎉 Timesheet Fully Approved - Ready to Invoice`,
          html: generateFinalApprovalEmailHtml({
            contractorName: submitter.name,
            projectName: project?.name || 'Unknown Project',
            periodLabel,
            hours: item.hours_total,
            amount: item.amount,
          }),
        });
        console.log('[EMAIL] Final approval notification sent to:', submitter.email);
      }
    }
  }
}

/**
 * Register approval execution routes
 */
export function registerApprovalRoutes(app: Hono) {
  // Execute approval action (from email link)
  app.post('/make-server-f8b491be/approvals/execute', async (c) => {
    try {
      const body = await c.req.json();
      const { token, action, reason } = body;

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

      // Get approval item details
      const details = await getApprovalItemDetails(tokenData.approval_item_id);
      if (!details) {
        return c.json({
          success: false,
          error: 'ITEM_NOT_FOUND',
          message: 'Approval item not found',
        }, 404);
      }

      const { item, submitter, currentApprover, project } = details;

      // Check if already processed
      if (item.status === 'approved' || item.status === 'rejected') {
        return c.json({
          success: false,
          error: 'ALREADY_PROCESSED',
          message: `This timesheet has already been ${item.status}`,
          itemDetails: {
            submitterName: submitter.name,
            projectName: project?.name || 'Unknown',
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
        return c.json({
          success: false,
          error: 'PROCESSING_FAILED',
          message: result.error || 'Failed to process approval',
        }, 500);
      }

      // Mark token as used
      await markTokenUsed(token);

      // Send notification emails
      await sendApprovalNotifications(
        tokenData.approval_item_id,
        action as 'approve' | 'reject',
        reason
      );

      // Return success with item details
      return c.json({
        success: true,
        message: action === 'approve' 
          ? 'Timesheet approved successfully!'
          : 'Timesheet rejected.',
        itemDetails: {
          submitterName: submitter.name,
          projectName: project?.name || 'Unknown',
          periodLabel: `${new Date(item.period_start).toLocaleDateString()} - ${new Date(item.period_end).toLocaleDateString()}`,
          hours: item.hours_total,
        },
      });

    } catch (error) {
      console.error('[APPROVAL EXECUTE] Error:', error);
      return c.json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
      }, 500);
    }
  });
}

// Email template generators (simplified versions)
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
