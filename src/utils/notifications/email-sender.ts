// Phase 5 Day 7: Email Sending Service
// Sends approval notification emails with action tokens

import { generateApprovalToken } from '../tokens/approval-tokens';
import {
  approvalRequestTemplate,
  approvalCompletedTemplate,
  slaAlertTemplate,
  type ApprovalRequestEmailData,
  type ApprovalCompletedEmailData,
  type SLAAlertEmailData,
} from './email-templates';

export interface EmailRecipient {
  id: string;
  name: string;
  email: string;
}

export interface ApprovalItem {
  id: string;
  submitterName: string;
  submitterId: string;
  projectName: string;
  periodLabel: string;
  hours: number;
  amount: number | null; // null if masked for this viewer
  dueDate: Date;
  urgency?: 'low' | 'medium' | 'high';
}

/**
 * Get base URL for generating action links
 */
function getBaseUrl(): string {
  // In browser, use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Fallback for SSR or testing
  return 'http://localhost:3000';
}

/**
 * Send approval request email to approver
 */
export async function sendApprovalRequestEmail(
  approvalItem: ApprovalItem,
  approver: EmailRecipient
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate tokens for email actions
    const approveToken = await generateApprovalToken(
      approvalItem.id,
      approver.id,
      'approve',
      72 // 72 hours expiration
    );
    
    const rejectToken = await generateApprovalToken(
      approvalItem.id,
      approver.id,
      'reject',
      72
    );
    
    const viewToken = await generateApprovalToken(
      approvalItem.id,
      approver.id,
      'view',
      168 // 7 days for view-only
    );
    
    // Build action URLs
    const baseUrl = getBaseUrl();
    const approveUrl = `${baseUrl}/approve?token=${approveToken}`;
    const rejectUrl = `${baseUrl}/reject?token=${rejectToken}`;
    const viewUrl = `${baseUrl}/approval/view?token=${viewToken}`;
    
    // Prepare email data
    const emailData: ApprovalRequestEmailData = {
      approverName: approver.name,
      submitterName: approvalItem.submitterName,
      projectName: approvalItem.projectName,
      periodLabel: approvalItem.periodLabel,
      hours: approvalItem.hours,
      amount: approvalItem.amount,
      dueDate: approvalItem.dueDate,
      approveUrl,
      rejectUrl,
      viewUrl,
      urgency: approvalItem.urgency,
    };
    
    // Render HTML template
    const html = approvalRequestTemplate(emailData);
    
    // TODO: Replace with real email service (SendGrid, AWS SES, etc.)
    // For now, log to console
    console.log('📧 Email would be sent to:', approver.email);
    console.log('Subject:', `⏰ Approval Request: ${approvalItem.submitterName} - ${approvalItem.periodLabel}`);
    console.log('Approve URL:', approveUrl);
    console.log('Reject URL:', rejectUrl);
    
    // In production, use email service:
    /*
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: approver.email, name: approver.name }],
          subject: `⏰ Approval Request: ${approvalItem.submitterName} - ${approvalItem.periodLabel}`,
        }],
        from: {
          email: 'approvals@workgraph.app',
          name: 'WorkGraph Approvals',
        },
        content: [{
          type: 'text/html',
          value: html,
        }],
      }),
    });
    */
    
    return { success: true };
    
  } catch (error) {
    console.error('Error sending approval request email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send approval completed notification to submitter
 */
export async function sendApprovalCompletedEmail(
  approvalItem: ApprovalItem,
  submitter: EmailRecipient,
  approver: EmailRecipient,
  status: 'approved' | 'rejected',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate view token
    const viewToken = await generateApprovalToken(
      approvalItem.id,
      submitter.id,
      'view',
      168 // 7 days
    );
    
    const baseUrl = getBaseUrl();
    const viewUrl = `${baseUrl}/approval/view?token=${viewToken}`;
    
    // Prepare email data
    const emailData: ApprovalCompletedEmailData = {
      submitterName: submitter.name,
      approverName: approver.name,
      projectName: approvalItem.projectName,
      periodLabel: approvalItem.periodLabel,
      hours: approvalItem.hours,
      amount: approvalItem.amount,
      status,
      reason,
      viewUrl,
      nextSteps: status === 'approved' 
        ? 'Your timesheet will be processed for payment.'
        : 'Please review the reason and resubmit if necessary.',
    };
    
    // Render HTML template
    const html = approvalCompletedTemplate(emailData);
    
    // Log for now
    console.log('📧 Email would be sent to:', submitter.email);
    console.log('Subject:', `${status === 'approved' ? '✅' : '❌'} Timesheet ${status}: ${approvalItem.periodLabel}`);
    
    return { success: true };
    
  } catch (error) {
    console.error('Error sending approval completed email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send SLA alert email to approver
 */
export async function sendSLAAlertEmail(
  approver: EmailRecipient,
  pendingItems: ApprovalItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (pendingItems.length === 0) {
      return { success: true };
    }
    
    // Find oldest item
    const oldestItem = pendingItems.reduce((oldest, item) => {
      return item.dueDate < oldest.dueDate ? item : oldest;
    });
    
    // Calculate hours overdue
    const now = new Date();
    const hoursOverdue = Math.floor(
      (now.getTime() - oldestItem.dueDate.getTime()) / (1000 * 60 * 60)
    );
    
    const baseUrl = getBaseUrl();
    const approveUrl = `${baseUrl}/my-approvals`;
    
    // Prepare email data
    const emailData: SLAAlertEmailData = {
      approverName: approver.name,
      itemCount: pendingItems.length,
      oldestItem: {
        submitterName: oldestItem.submitterName,
        projectName: oldestItem.projectName,
        hoursOverdue,
      },
      approveUrl,
    };
    
    // Render HTML template
    const html = slaAlertTemplate(emailData);
    
    // Log for now
    console.log('📧 SLA Alert would be sent to:', approver.email);
    console.log('Subject:', `⚠️ ${pendingItems.length} Approval${pendingItems.length !== 1 ? 's' : ''} Need Attention`);
    
    return { success: true };
    
  } catch (error) {
    console.error('Error sending SLA alert email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test email templates (development only)
 * Generates preview HTML files
 */
export function generateEmailPreviews(): {
  approvalRequest: string;
  approvalCompleted: string;
  slaAlert: string;
} {
  const mockApprovalItem: ApprovalItem = {
    id: 'item-123',
    submitterName: 'Sarah Chen',
    submitterId: 'user-456',
    projectName: 'Mobile App Redesign',
    periodLabel: 'Week 42 (Oct 14-20, 2025)',
    hours: 40,
    amount: 6000,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    urgency: 'medium',
  };
  
  const mockApprover: EmailRecipient = {
    id: 'approver-789',
    name: 'Mike Johnson',
    email: 'mike@acme.com',
  };
  
  const mockSubmitter: EmailRecipient = {
    id: 'user-456',
    name: 'Sarah Chen',
    email: 'sarah@contractor.com',
  };
  
  // Use mock tokens for preview (not real signed tokens)
  const approveToken = 'mock-token-approve-abc123def456';
  const rejectToken = 'mock-token-reject-xyz789uvw012';
  const viewToken = 'mock-token-view-pqr345stu678';
  
  const baseUrl = 'https://workgraph.app';
  
  return {
    approvalRequest: approvalRequestTemplate({
      approverName: mockApprover.name,
      submitterName: mockApprovalItem.submitterName,
      projectName: mockApprovalItem.projectName,
      periodLabel: mockApprovalItem.periodLabel,
      hours: mockApprovalItem.hours,
      amount: mockApprovalItem.amount,
      dueDate: mockApprovalItem.dueDate,
      approveUrl: `${baseUrl}/approve?token=${approveToken}`,
      rejectUrl: `${baseUrl}/reject?token=${rejectToken}`,
      viewUrl: `${baseUrl}/approval/view?token=${viewToken}`,
      urgency: mockApprovalItem.urgency,
    }),
    
    approvalCompleted: approvalCompletedTemplate({
      submitterName: mockSubmitter.name,
      approverName: mockApprover.name,
      projectName: mockApprovalItem.projectName,
      periodLabel: mockApprovalItem.periodLabel,
      hours: mockApprovalItem.hours,
      amount: mockApprovalItem.amount,
      status: 'approved',
      viewUrl: `${baseUrl}/approval/view?token=${viewToken}`,
      nextSteps: 'Your timesheet will be processed for payment.',
    }),
    
    slaAlert: slaAlertTemplate({
      approverName: mockApprover.name,
      itemCount: 3,
      oldestItem: {
        submitterName: mockApprovalItem.submitterName,
        projectName: mockApprovalItem.projectName,
        hoursOverdue: 12,
      },
      approveUrl: `${baseUrl}/my-approvals`,
    }),
  };
}