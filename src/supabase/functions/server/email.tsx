// Phase 5 Day 8: Real Email Sending with Resend API
import type { Hono } from "npm:hono@4";
import * as kv from "./kv_store.tsx"; // ✅ Store tokens in KV

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send email using Resend API
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!RESEND_API_KEY) {
    console.error('[EMAIL] Missing RESEND_API_KEY environment variable');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // ✅ FIX: Use Resend's default domain for testing (no verification needed)
        from: payload.from || 'WorkGraph <onboarding@resend.dev>',
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[EMAIL] Resend API error:', data);
      return { success: false, error: data.message || 'Failed to send email' };
    }

    console.log('[EMAIL] ✅ Email sent successfully:', {
      id: data.id,
      to: payload.to,
      subject: payload.subject,
    });

    return { success: true, id: data.id };
  } catch (error) {
    console.error('[EMAIL] Network error:', error);
    return { success: false, error: 'Network error sending email' };
  }
}

/**
 * Register email routes on Hono app
 */
export function registerEmailRoutes(app: Hono) {
  // Test route to verify email sending works
  app.post('/make-server-f8b491be/email/test', async (c) => {
    try {
      const body = await c.req.json();
      const { to } = body;

      if (!to) {
        return c.json({ error: 'Missing "to" field' }, 400);
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px;">✅ Email Test Successful!</h1>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                Congratulations! Your WorkGraph email system is working correctly.
              </p>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  <strong>Test Details:</strong>
                </p>
                <p style="margin: 8px 0 0; color: #374151; font-size: 14px;">
                  • Email sent via Resend API<br>
                  • Recipient: ${to}<br>
                  • Timestamp: ${new Date().toISOString()}
                </p>
              </div>
              
              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px;">
                You can now proceed with implementing approval notification emails.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
              Powered by <strong>WorkGraph</strong> · Approval System
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await sendEmail({
        to,
        subject: '✅ WorkGraph Email Test Successful',
        html,
      });

      if (result.success) {
        return c.json({ 
          success: true, 
          message: 'Test email sent successfully',
          emailId: result.id,
        });
      } else {
        return c.json({ 
          success: false, 
          error: result.error,
        }, 500);
      }
    } catch (error) {
      console.error('[EMAIL TEST] Error:', error);
      return c.json({ error: 'Failed to send test email' }, 500);
    }
  });

  // Send approval request email
  app.post('/make-server-f8b491be/email/approval-request', async (c) => {
    try {
      const body = await c.req.json();
      const { 
        to,
        approverName, 
        submitterName, 
        projectName, 
        periodLabel,
        hours,
        amount,
        baseUrl, // ✅ Accept baseUrl from client
      } = body;

      if (!to || !approverName || !submitterName) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Use provided baseUrl or fallback to env variable or default
      const appUrl = baseUrl || Deno.env.get('PUBLIC_URL') || 'http://localhost:3000';
      console.log('[EMAIL] Using base URL:', appUrl);
      
      const approveToken = `token-${Date.now()}-approve-${Math.random().toString(36).substring(7)}`;
      const rejectToken = `token-${Date.now()}-reject-${Math.random().toString(36).substring(7)}`;
      const viewToken = `token-${Date.now()}-view-${Math.random().toString(36).substring(7)}`;

      // ✅ Use hash-based routing (works in ALL hosting environments including Figma preview)
      const approveUrl = `${appUrl}/#/approve?token=${approveToken}`;
      const rejectUrl = `${appUrl}/#/reject?token=${rejectToken}`;
      const viewUrl = `${appUrl}/#/approval-view?token=${viewToken}`;
      
      console.log('[EMAIL] Generated URLs:', { approveUrl, rejectUrl, viewUrl });

      const html = generateApprovalRequestEmail({
        approverName,
        submitterName,
        projectName,
        periodLabel,
        hours,
        amount,
        approveUrl,
        rejectUrl,
        viewUrl,
      });

      const result = await sendEmail({
        to,
        subject: `📋 Approval Request: ${submitterName} - ${periodLabel}`,
        html,
      });

      if (result.success) {
        await kv.set(approveToken, { type: 'approve', emailId: result.id });
        await kv.set(rejectToken, { type: 'reject', emailId: result.id });
        await kv.set(viewToken, { type: 'view', emailId: result.id });
        return c.json({ success: true, emailId: result.id });
      } else {
        return c.json({ success: false, error: result.error }, 500);
      }
    } catch (error) {
      console.error('[EMAIL APPROVAL REQUEST] Error:', error);
      return c.json({ error: 'Failed to send approval request email' }, 500);
    }
  });

  // Send approval notification (first node approved)
  app.post('/make-server-f8b491be/email/first-approval', async (c) => {
    try {
      const body = await c.req.json();
      const { 
        to,
        contractorName, 
        approverName, 
        projectName, 
        periodLabel,
        hours,
        nextApprover,
      } = body;

      if (!to || !contractorName || !approverName) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const html = generateFirstApprovalEmail({
        contractorName,
        approverName,
        projectName,
        periodLabel,
        hours,
        nextApprover,
      });

      const result = await sendEmail({
        to,
        subject: `✅ Approved by ${approverName} - ${periodLabel}`,
        html,
      });

      if (result.success) {
        return c.json({ success: true, emailId: result.id });
      } else {
        return c.json({ success: false, error: result.error }, 500);
      }
    } catch (error) {
      console.error('[EMAIL FIRST APPROVAL] Error:', error);
      return c.json({ error: 'Failed to send first approval email' }, 500);
    }
  });

  // Send final approval notification (ready to invoice)
  app.post('/make-server-f8b491be/email/final-approval', async (c) => {
    try {
      const body = await c.req.json();
      const { 
        to,
        contractorName, 
        projectName, 
        periodLabel,
        hours,
        amount,
      } = body;

      if (!to || !contractorName) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const html = generateFinalApprovalEmail({
        contractorName,
        projectName,
        periodLabel,
        hours,
        amount,
      });

      const result = await sendEmail({
        to,
        subject: `🎉 Timesheet Fully Approved - Ready to Invoice`,
        html,
      });

      if (result.success) {
        return c.json({ success: true, emailId: result.id });
      } else {
        return c.json({ success: false, error: result.error }, 500);
      }
    } catch (error) {
      console.error('[EMAIL FINAL APPROVAL] Error:', error);
      return c.json({ error: 'Failed to send final approval email' }, 500);
    }
  });

  // Send rejection notification
  app.post('/make-server-f8b491be/email/rejection', async (c) => {
    try {
      const body = await c.req.json();
      const { 
        to,
        contractorName, 
        rejectorName, 
        projectName, 
        periodLabel,
        reason,
      } = body;

      if (!to || !contractorName || !rejectorName) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const html = generateRejectionEmail({
        contractorName,
        rejectorName,
        projectName,
        periodLabel,
        reason,
      });

      const result = await sendEmail({
        to,
        subject: `⚠️ Action Needed: Timesheet Rejected by ${rejectorName}`,
        html,
      });

      if (result.success) {
        return c.json({ success: true, emailId: result.id });
      } else {
        return c.json({ success: false, error: result.error }, 500);
      }
    } catch (error) {
      console.error('[EMAIL REJECTION] Error:', error);
      return c.json({ error: 'Failed to send rejection email' }, 500);
    }
  });
}

// Email template generators
function generateApprovalRequestEmail(data: {
  approverName: string;
  submitterName: string;
  projectName: string;
  periodLabel: string;
  hours: number;
  amount?: number | null;
  approveUrl: string;
  rejectUrl: string;
  viewUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">📋 Approval Request</h1>
        </div>
        
        <!-- Body -->
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
            Hi <strong>${data.approverName}</strong>,
          </p>
          
          <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
            <strong>${data.submitterName}</strong> has submitted a timesheet for your approval.
          </p>
          
          <!-- Timesheet Details -->
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Project:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.projectName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.periodLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Hours:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.hours}h</td>
              </tr>
              ${data.amount ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">$${data.amount.toLocaleString()}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <!-- Action Buttons -->
          <div style="margin: 30px 0;">
            <a href="${data.approveUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-right: 10px;">
              ✅ Approve
            </a>
            <a href="${data.rejectUrl}" style="display: inline-block; background: #ef4444; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              ❌ Reject
            </a>
          </div>
          
          <div style="margin-top: 20px;">
            <a href="${data.viewUrl}" style="color: #6366f1; text-decoration: none; font-size: 14px;">
              View Details →
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #ffffff; padding: 20px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            These action links expire in 72 hours for security.
          </p>
          <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">
            Powered by <strong>WorkGraph</strong> · Approval System
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateFirstApprovalEmail(data: {
  contractorName: string;
  approverName: string;
  projectName: string;
  periodLabel: string;
  hours: number;
  nextApprover?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">✅ Your Timesheet Approved</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
            Hi <strong>${data.contractorName}</strong>,
          </p>
          
          <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
            Good news! <strong>${data.approverName}</strong> has approved your timesheet for <strong>${data.periodLabel}</strong>.
          </p>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin: 0; color: #166534; font-size: 14px;">
              <strong>Status:</strong> Approved by ${data.approverName}
              ${data.nextApprover ? ` → Pending with ${data.nextApprover}` : ''}
            </p>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Project:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.projectName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.periodLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Hours:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.hours}h</td>
              </tr>
            </table>
          </div>
          
          <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px;">
            ${data.nextApprover 
              ? "You'll be notified when the full approval chain completes." 
              : "This was the final approval. You can now generate your invoice!"
            }
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateFinalApprovalEmail(data: {
  contractorName: string;
  projectName: string;
  periodLabel: string;
  hours: number;
  amount?: number | null;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 28px;">🎉 Fully Approved!</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
            Hi <strong>${data.contractorName}</strong>,
          </p>
          
          <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
            Your timesheet for <strong>${data.periodLabel}</strong> is fully approved by all parties.
          </p>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
              ✅ Ready to Invoice
            </p>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Project:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.projectName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.periodLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total Hours:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.hours}h</td>
              </tr>
              ${data.amount ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 18px; font-weight: 700; text-align: right; color: #10b981;">$${data.amount.toLocaleString()}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <div style="margin: 30px 0;">
            <a href="#" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Generate Invoice
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateRejectionEmail(data: {
  contractorName: string;
  rejectorName: string;
  projectName: string;
  periodLabel: string;
  reason?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px;">⚠️ Action Needed</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
            Hi <strong>${data.contractorName}</strong>,
          </p>
          
          <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
            Your timesheet for <strong>${data.periodLabel}</strong> was rejected by <strong>${data.rejectorName}</strong>.
          </p>
          
          ${data.reason ? `
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <p style="margin: 0 0 8px; color: #991b1b; font-size: 14px; font-weight: 600;">
              Reason:
            </p>
            <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
              "${data.reason}"
            </p>
          </div>
          ` : ''}
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Project:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.projectName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.periodLabel}</td>
              </tr>
            </table>
          </div>
          
          <div style="margin: 30px 0;">
            <a href="#" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Revise & Resubmit
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}