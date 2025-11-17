// ============================================================================
// Notifications API - Mock data for demo
// ============================================================================

import type {
  Notification,
  NotificationStats,
  GetNotificationsRequest,
  GetNotificationsResponse,
  NotificationPreferences,
  CreateNotificationRequest,
} from '../../types/notifications';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    type: 'approval_request',
    priority: 'high',
    recipient_id: 'user-123',
    recipient_org_id: 'techcorp-agency',
    actor_id: 'user-456',
    actor_name: 'Sarah Chen',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    title: 'New Approval Request',
    message: 'Sarah Chen submitted a timesheet for Week 45 (40 hours) awaiting your approval',
    action_url: '#/approvals',
    action_label: 'Review Approval',
    related_entity_type: 'approval',
    related_entity_id: 'approval-123',
    metadata: {
      amount: 6000,
      currency: 'USD',
      hours: 40,
      week: 45,
    },
    read: false,
    archived: false,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
  },
  {
    id: 'notif-2',
    type: 'contract_invitation',
    priority: 'high',
    recipient_id: 'user-123',
    recipient_org_id: 'devshop-sub',
    actor_id: 'user-789',
    actor_name: 'Michael Rodriguez',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    title: 'New Contract Invitation',
    message: 'TechCorp Agency invited you to join E-Commerce Platform Redesign at $85/hr',
    action_url: '#/contracts',
    action_label: 'View Contract',
    related_entity_type: 'contract',
    related_entity_id: 'contract-456',
    metadata: {
      rate: 85,
      currency: 'USD',
      contract_type: 'tm',
      project_name: 'E-Commerce Platform Redesign',
    },
    read: false,
    archived: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
  {
    id: 'notif-3',
    type: 'disclosure_request',
    priority: 'normal',
    recipient_id: 'user-123',
    recipient_org_id: 'techcorp-agency',
    actor_id: 'user-111',
    actor_name: 'John Smith',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
    title: 'Disclosure Request',
    message: 'Acme Inc requested to see your contract with DevShop Subcontractor',
    action_url: '#/contracts',
    action_label: 'Review Request',
    related_entity_type: 'contract',
    related_entity_id: 'contract-789',
    metadata: {
      requesting_org: 'Acme Inc',
      contract_with: 'DevShop Subcontractor',
    },
    read: false,
    archived: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
  },
  {
    id: 'notif-4',
    type: 'approval_approved',
    priority: 'normal',
    recipient_id: 'user-123',
    actor_id: 'user-999',
    actor_name: 'Emily Watson',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
    title: 'Timesheet Approved',
    message: 'Emily Watson approved your timesheet for Week 44 ($6,000)',
    action_url: '#/approvals',
    action_label: 'View Details',
    related_entity_type: 'timesheet',
    related_entity_id: 'timesheet-123',
    metadata: {
      amount: 6000,
      currency: 'USD',
      week: 44,
    },
    read: true,
    archived: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
  {
    id: 'notif-5',
    type: 'timesheet_submitted',
    priority: 'normal',
    recipient_id: 'user-123',
    recipient_org_id: 'techcorp-agency',
    actor_id: 'user-555',
    actor_name: 'Alex Kim',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    title: 'Timesheet Submitted',
    message: 'Alex Kim submitted a timesheet for Week 45 (35 hours)',
    action_url: '#/approvals',
    action_label: 'Review Timesheet',
    related_entity_type: 'timesheet',
    related_entity_id: 'timesheet-456',
    metadata: {
      hours: 35,
      week: 45,
    },
    read: true,
    archived: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
  },
  {
    id: 'notif-6',
    type: 'contract_accepted',
    priority: 'normal',
    recipient_id: 'user-123',
    actor_id: 'user-666',
    actor_name: 'DevShop Team',
    title: 'Contract Accepted',
    message: 'DevShop Subcontractor accepted your contract invitation',
    action_url: '#/contracts',
    action_label: 'View Contract',
    related_entity_type: 'contract',
    related_entity_id: 'contract-999',
    read: true,
    archived: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
  },
];

const MOCK_PREFERENCES: NotificationPreferences = {
  user_id: 'user-123',
  in_app_enabled: true,
  email_enabled: true,
  email_digest: 'daily',
  notify_approval_requests: true,
  notify_approval_decisions: true,
  notify_contract_invitations: true,
  notify_contract_decisions: true,
  notify_disclosure_requests: true,
  notify_timesheet_submissions: true,
  notify_timesheet_decisions: true,
  notify_project_invites: true,
  notify_mentions: true,
  quiet_hours_enabled: false,
  updated_at: new Date().toISOString(),
};

// ============================================================================
// API Functions (Mock Implementation)
// ============================================================================

export async function getNotifications(
  request: GetNotificationsRequest
): Promise<GetNotificationsResponse> {
  console.log('[API] getNotifications (mock)', request);
  await new Promise(resolve => setTimeout(resolve, 300));

  let filtered = [...MOCK_NOTIFICATIONS];

  // Apply filters
  if (request.types && request.types.length > 0) {
    filtered = filtered.filter(n => request.types!.includes(n.type));
  }

  if (request.priority) {
    filtered = filtered.filter(n => n.priority === request.priority);
  }

  if (request.read !== undefined) {
    filtered = filtered.filter(n => n.read === request.read);
  }

  if (request.archived !== undefined) {
    filtered = filtered.filter(n => n.archived === request.archived);
  }

  if (request.since) {
    const sinceDate = new Date(request.since);
    filtered = filtered.filter(n => new Date(n.created_at) > sinceDate);
  }

  // Apply pagination
  const limit = request.limit || 20;
  const offset = request.offset || 0;
  const paginated = filtered.slice(offset, offset + limit);

  // Calculate stats
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;
  const stats: NotificationStats = {
    total_unread: unreadCount,
    unread_by_type: MOCK_NOTIFICATIONS.reduce((acc, n) => {
      if (!n.read) {
        acc[n.type] = (acc[n.type] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>) as any,
    unread_by_priority: MOCK_NOTIFICATIONS.reduce((acc, n) => {
      if (!n.read) {
        acc[n.priority] = (acc[n.priority] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>) as any,
    total_today: MOCK_NOTIFICATIONS.filter(n => {
      const created = new Date(n.created_at);
      const today = new Date();
      return created.toDateString() === today.toDateString();
    }).length,
    total_this_week: MOCK_NOTIFICATIONS.filter(n => {
      const created = new Date(n.created_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return created > weekAgo;
    }).length,
  };

  return {
    notifications: paginated,
    stats,
    has_more: offset + limit < filtered.length,
    total_count: filtered.length,
  };
}

export async function markNotificationsRead(notificationIds: string[]): Promise<void> {
  console.log('[API] markNotificationsRead (mock)', notificationIds);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // In real implementation, would update database
  MOCK_NOTIFICATIONS.forEach(n => {
    if (notificationIds.includes(n.id)) {
      n.read = true;
      n.read_at = new Date().toISOString();
    }
  });
}

export async function markNotificationsUnread(notificationIds: string[]): Promise<void> {
  console.log('[API] markNotificationsUnread (mock)', notificationIds);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  MOCK_NOTIFICATIONS.forEach(n => {
    if (notificationIds.includes(n.id)) {
      n.read = false;
      n.read_at = undefined;
    }
  });
}

export async function archiveNotifications(notificationIds: string[]): Promise<void> {
  console.log('[API] archiveNotifications (mock)', notificationIds);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  MOCK_NOTIFICATIONS.forEach(n => {
    if (notificationIds.includes(n.id)) {
      n.archived = true;
    }
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  console.log('[API] markAllAsRead (mock)', userId);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  MOCK_NOTIFICATIONS.forEach(n => {
    if (n.recipient_id === userId) {
      n.read = true;
      n.read_at = new Date().toISOString();
    }
  });
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  console.log('[API] getNotificationPreferences (mock)', userId);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  return MOCK_PREFERENCES;
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  console.log('[API] updateNotificationPreferences (mock)', userId, preferences);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  return {
    ...MOCK_PREFERENCES,
    ...preferences,
    updated_at: new Date().toISOString(),
  };
}

export async function createNotification(
  request: CreateNotificationRequest
): Promise<Notification> {
  console.log('[API] createNotification (mock)', request);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const notification: Notification = {
    id: `notif-${Date.now()}`,
    type: request.type,
    priority: request.priority || 'normal',
    recipient_id: request.recipient_id,
    recipient_org_id: request.recipient_org_id,
    actor_id: request.actor_id,
    actor_name: request.actor_name,
    title: request.title,
    message: request.message,
    action_url: request.action_url,
    action_label: request.action_label,
    related_entity_type: request.related_entity_type as any,
    related_entity_id: request.related_entity_id,
    metadata: request.metadata,
    read: false,
    archived: false,
    created_at: new Date().toISOString(),
  };
  
  MOCK_NOTIFICATIONS.unshift(notification);
  return notification;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  console.log('[API] deleteNotification (mock)', notificationId);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const index = MOCK_NOTIFICATIONS.findIndex(n => n.id === notificationId);
  if (index !== -1) {
    MOCK_NOTIFICATIONS.splice(index, 1);
  }
}

// ============================================================================
// Real-time Subscription (Mock)
// ============================================================================

export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
): () => void {
  console.log('[API] subscribeToNotifications (mock)', userId);
  
  // In real implementation, would use Supabase realtime
  // For now, return empty unsubscribe function
  return () => {
    console.log('[API] unsubscribe from notifications');
  };
}
