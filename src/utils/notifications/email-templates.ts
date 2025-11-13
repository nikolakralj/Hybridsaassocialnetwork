// Phase 5 Day 7: Email Templates for Approval Notifications
// Beautiful, mobile-friendly HTML emails with action buttons

export interface ApprovalRequestEmailData {
  approverName: string;
  submitterName: string;
  projectName: string;
  periodLabel: string;
  hours: number;
  amount: number | null; // null if rate is masked
  dueDate: Date;
  approveUrl: string;
  rejectUrl: string;
  viewUrl: string;
  urgency?: 'low' | 'medium' | 'high';
}

export interface ApprovalCompletedEmailData {
  submitterName: string;
  approverName: string;
  projectName: string;
  periodLabel: string;
  hours: number;
  amount: number | null;
  status: 'approved' | 'rejected';
  reason?: string;
  viewUrl: string;
  nextSteps?: string;
}

export interface SLAAlertEmailData {
  approverName: string;
  itemCount: number;
  oldestItem: {
    submitterName: string;
    projectName: string;
    hoursOverdue: number;
  };
  approveUrl: string;
}

/**
 * Format date for email display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Get urgency badge color
 */
function getUrgencyColor(urgency: 'low' | 'medium' | 'high' = 'low'): string {
  const colors = {
    low: '#3b82f6',    // blue
    medium: '#f59e0b', // amber
    high: '#ef4444',   // red
  };
  return colors[urgency];
}

/**
 * Approval Request Email Template
 * Sent to approver when someone submits a timesheet
 */
export function approvalRequestTemplate(data: ApprovalRequestEmailData): string {
  const urgencyColor = getUrgencyColor(data.urgency);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approval Request</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f7;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 8px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 32px 24px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .details-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-size: 13px;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-value {
      font-size: 16px;
      font-weight: 600;
      color: #212529;
    }
    .stats {
      display: flex;
      gap: 16px;
      margin: 24px 0;
    }
    .stat {
      flex: 1;
      background: #f1f3f5;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .stat-label {
      font-size: 12px;
      color: #868e96;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #212529;
    }
    .actions {
      margin: 32px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      margin: 8px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      transition: transform 0.2s;
    }
    .btn-approve {
      background: #28a745;
      color: white;
    }
    .btn-reject {
      background: #dc3545;
      color: white;
    }
    .btn-view {
      background: #6c757d;
      color: white;
    }
    .urgency-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      color: white;
      background: ${urgencyColor};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .footer {
      background: #f8f9fa;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #6c757d;
      border-top: 1px solid #dee2e6;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
      .stats {
        flex-direction: column;
      }
      .btn {
        display: block;
        margin: 8px 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>⏰ Approval Request</h1>
      <p>You have a new timesheet to review</p>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="greeting">
        Hi <strong>${data.approverName}</strong>,
      </div>

      <p>
        <strong>${data.submitterName}</strong> has submitted a timesheet for 
        <strong>${data.periodLabel}</strong> on project <strong>${data.projectName}</strong>.
      </p>

      ${data.urgency && data.urgency !== 'low' ? `
      <p>
        <span class="urgency-badge">${data.urgency} Priority</span>
      </p>
      ` : ''}

      <!-- Stats -->
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Hours</div>
          <div class="stat-value">${data.hours}h</div>
        </div>
        ${data.amount !== null ? `
        <div class="stat">
          <div class="stat-label">Amount</div>
          <div class="stat-value">$${data.amount.toLocaleString()}</div>
        </div>
        ` : ''}
        <div class="stat">
          <div class="stat-label">Due By</div>
          <div class="stat-value" style="font-size: 14px; line-height: 1.2;">
            ${formatDate(data.dueDate)}
          </div>
        </div>
      </div>

      <!-- Details -->
      <div class="details-card">
        <div class="detail-row">
          <span class="detail-label">Submitter</span>
          <span class="detail-value">${data.submitterName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Project</span>
          <span class="detail-value">${data.projectName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Period</span>
          <span class="detail-value">${data.periodLabel}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="actions">
        <a href="${data.approveUrl}" class="btn btn-approve">
          ✓ Approve
        </a>
        <a href="${data.rejectUrl}" class="btn btn-reject">
          ✗ Reject
        </a>
        <a href="${data.viewUrl}" class="btn btn-view">
          👁 View Details
        </a>
      </div>

      <p style="font-size: 13px; color: #6c757d; text-align: center;">
        💡 You can approve directly from this email. Links expire in 72 hours.
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0 0 8px 0;">
        <strong>WorkGraph</strong> · Secure Approval System
      </p>
      <p style="margin: 0;">
        <a href="#">Notification Preferences</a> · 
        <a href="#">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Approval Completed Email Template
 * Sent to submitter when their timesheet is approved/rejected
 */
export function approvalCompletedTemplate(data: ApprovalCompletedEmailData): string {
  const isApproved = data.status === 'approved';
  const statusColor = isApproved ? '#28a745' : '#dc3545';
  const statusIcon = isApproved ? '✅' : '❌';
  const statusText = isApproved ? 'Approved' : 'Rejected';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timesheet ${statusText}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f7;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: ${statusColor};
      color: white;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .status-icon {
      font-size: 64px;
      text-align: center;
      margin: 20px 0;
    }
    .details-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      border-radius: 8px;
      background: #667eea;
      color: white;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
    }
    .footer {
      background: #f8f9fa;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #6c757d;
      border-top: 1px solid #dee2e6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${statusIcon} Timesheet ${statusText}</h1>
    </div>

    <div class="content">
      <p>Hi <strong>${data.submitterName}</strong>,</p>

      <p>
        Your timesheet for <strong>${data.periodLabel}</strong> on project 
        <strong>${data.projectName}</strong> has been <strong>${data.status}</strong> 
        by <strong>${data.approverName}</strong>.
      </p>

      ${data.reason ? `
      <div class="details-card">
        <strong>Reason:</strong><br>
        ${data.reason}
      </div>
      ` : ''}

      ${data.nextSteps ? `
      <div class="details-card">
        <strong>Next Steps:</strong><br>
        ${data.nextSteps}
      </div>
      ` : ''}

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.viewUrl}" class="btn">
          View Timesheet
        </a>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0;">
        <strong>WorkGraph</strong> · Timesheet Management
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * SLA Alert Email Template
 * Sent when approvals are approaching or past due
 */
export function slaAlertTemplate(data: SLAAlertEmailData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approval Alert</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f7;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: #f59e0b;
      color: white;
      padding: 32px 24px;
      text-align: center;
    }
    .content {
      padding: 32px 24px;
    }
    .alert-box {
      background: #fff3cd;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      border-radius: 8px;
      background: #f59e0b;
      color: white;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Approval Alert</h1>
    </div>

    <div class="content">
      <p>Hi <strong>${data.approverName}</strong>,</p>

      <p>
        You have <strong>${data.itemCount}</strong> pending approval${data.itemCount !== 1 ? 's' : ''} 
        that require your attention.
      </p>

      <div class="alert-box">
        <strong>Oldest Pending Item:</strong><br>
        ${data.oldestItem.submitterName} · ${data.oldestItem.projectName}<br>
        <strong style="color: #dc3545;">
          ${data.oldestItem.hoursOverdue} hours overdue
        </strong>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.approveUrl}" class="btn">
          Review Approvals
        </a>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
