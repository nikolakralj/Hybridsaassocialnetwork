// ============================================================================
// Notification Types - Real-time activity feed
// ============================================================================

export type NotificationType =
  | 'approval_request'      // Someone needs you to approve something
  | 'approval_approved'     // Your submission was approved
  | 'approval_rejected'     // Your submission was rejected
  | 'contract_invitation'   // You've been invited to a contract
  | 'contract_accepted'     // Someone accepted your contract invitation
  | 'contract_declined'     // Someone declined your contract invitation
  | 'disclosure_request'    // Someone wants to see your contract details
  | 'disclosure_approved'   // Your disclosure request was approved
  | 'disclosure_declined'   // Your disclosure request was declined
  | 'timesheet_submitted'   // Someone submitted a timesheet for your approval
  | 'timesheet_approved'    // Your timesheet was approved
  | 'timesheet_rejected'    // Your timesheet was rejected
  | 'project_invite'        // You've been invited to a project
  | 'mention'               // Someone mentioned you in a comment
  | 'system';               // System notifications

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  
  // Who this notification is for
  recipient_id: string;
  recipient_org_id?: string;
  
  // Who/what triggered it
  actor_id?: string;          // User who triggered the action
  actor_name?: string;
  actor_avatar?: string;
  
  // What it's about
  title: string;
  message: string;
  
  // Action data
  action_url?: string;        // Where to go when clicked
  action_label?: string;      // "View Approval", "Accept Invitation"
  
  // Related entities
  related_entity_type?: 'approval' | 'contract' | 'timesheet' | 'project' | 'comment';
  related_entity_id?: string;
  
  // Metadata
  metadata?: Record<string, any>;  // Flexible data storage
  
  // State
  read: boolean;
  archived: boolean;
  
  // Timestamps
  created_at: string;
  read_at?: string;
  expires_at?: string;        // Optional: auto-archive after date
}

export interface NotificationGroup {
  type: NotificationType;
  count: number;
  latest: Notification;
  notifications: Notification[];
}

export interface NotificationPreferences {
  user_id: string;
  
  // Channel preferences
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_digest: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'never';
  
  // Type preferences
  notify_approval_requests: boolean;
  notify_approval_decisions: boolean;
  notify_contract_invitations: boolean;
  notify_contract_decisions: boolean;
  notify_disclosure_requests: boolean;
  notify_timesheet_submissions: boolean;
  notify_timesheet_decisions: boolean;
  notify_project_invites: boolean;
  notify_mentions: boolean;
  
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;  // "22:00"
  quiet_hours_end?: string;    // "08:00"
  quiet_hours_timezone?: string;
  
  updated_at: string;
}

export interface NotificationStats {
  total_unread: number;
  unread_by_type: Record<NotificationType, number>;
  unread_by_priority: Record<NotificationPriority, number>;
  total_today: number;
  total_this_week: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetNotificationsRequest {
  user_id: string;
  org_id?: string;
  
  // Filters
  types?: NotificationType[];
  priority?: NotificationPriority;
  read?: boolean;
  archived?: boolean;
  
  // Pagination
  limit?: number;
  offset?: number;
  since?: string;  // ISO timestamp
}

export interface GetNotificationsResponse {
  notifications: Notification[];
  stats: NotificationStats;
  has_more: boolean;
  total_count: number;
}

export interface MarkNotificationsRequest {
  notification_ids: string[];
  read?: boolean;
  archived?: boolean;
}

export interface CreateNotificationRequest {
  type: NotificationType;
  priority?: NotificationPriority;
  recipient_id: string;
  recipient_org_id?: string;
  actor_id?: string;
  actor_name?: string;
  title: string;
  message: string;
  action_url?: string;
  action_label?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface NotificationIcon {
  icon: string;        // Lucide icon name
  color: string;       // Tailwind color class
  bgColor: string;     // Tailwind bg color class
}

export const NOTIFICATION_ICONS: Record<NotificationType, NotificationIcon> = {
  approval_request: {
    icon: 'CheckCircle',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  approval_approved: {
    icon: 'CheckCircle2',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  approval_rejected: {
    icon: 'XCircle',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  contract_invitation: {
    icon: 'FileText',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  contract_accepted: {
    icon: 'Handshake',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  contract_declined: {
    icon: 'XCircle',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  disclosure_request: {
    icon: 'Eye',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  disclosure_approved: {
    icon: 'EyeCheck',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  disclosure_declined: {
    icon: 'EyeOff',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  timesheet_submitted: {
    icon: 'Clock',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  timesheet_approved: {
    icon: 'CheckCircle2',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  timesheet_rejected: {
    icon: 'XCircle',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  project_invite: {
    icon: 'FolderPlus',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
  mention: {
    icon: 'AtSign',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  system: {
    icon: 'Bell',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
};
