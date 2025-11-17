// ============================================================================
// useNotifications - Hook for managing notifications
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type {
  Notification,
  NotificationStats,
  NotificationType,
  NotificationPriority,
  GetNotificationsRequest,
} from '../types/notifications';
import {
  getNotifications,
  markNotificationsRead,
  markNotificationsUnread,
  archiveNotifications,
  markAllAsRead,
  subscribeToNotifications,
} from '../utils/api/notifications';

interface UseNotificationsOptions {
  userId: string;
  orgId?: string;
  types?: NotificationType[];
  priority?: NotificationPriority;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface UseNotificationsReturn {
  notifications: Notification[];
  stats: NotificationStats | null;
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  
  // Actions
  refresh: () => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  markAsUnread: (notificationIds: string[]) => Promise<void>;
  archive: (notificationIds: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useNotifications(options: UseNotificationsOptions): UseNotificationsReturn {
  const {
    userId,
    orgId,
    types,
    priority,
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchNotifications = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);

      const request: GetNotificationsRequest = {
        user_id: userId,
        org_id: orgId,
        types,
        priority,
        archived: false,
        limit: 20,
        offset: reset ? 0 : offset,
      };

      const response = await getNotifications(request);

      if (reset) {
        setNotifications(response.notifications);
        setOffset(response.notifications.length);
      } else {
        setNotifications(prev => [...prev, ...response.notifications]);
        setOffset(prev => prev + response.notifications.length);
      }

      setStats(response.stats);
      setHasMore(response.has_more);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
    } finally {
      setLoading(false);
    }
  }, [userId, orgId, types, priority, offset]);

  const refresh = useCallback(async () => {
    await fetchNotifications(true);
  }, [fetchNotifications]);

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await fetchNotifications(false);
    }
  }, [fetchNotifications, loading, hasMore]);

  const markAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      await markNotificationsRead(notificationIds);
      
      // Optimistic update
      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id)
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      
      // Update stats
      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          total_unread: Math.max(0, prev.total_unread - notificationIds.length),
        };
      });
      
      // Refresh to get accurate stats
      await refresh();
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
      throw err;
    }
  }, [refresh]);

  const markAsUnread = useCallback(async (notificationIds: string[]) => {
    try {
      await markNotificationsUnread(notificationIds);
      
      // Optimistic update
      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id)
            ? { ...n, read: false, read_at: undefined }
            : n
        )
      );
      
      // Update stats
      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          total_unread: prev.total_unread + notificationIds.length,
        };
      });
      
      await refresh();
    } catch (err) {
      console.error('Failed to mark notifications as unread:', err);
      throw err;
    }
  }, [refresh]);

  const archive = useCallback(async (notificationIds: string[]) => {
    try {
      await archiveNotifications(notificationIds);
      
      // Optimistic update - remove from list
      setNotifications(prev =>
        prev.filter(n => !notificationIds.includes(n.id))
      );
      
      await refresh();
    } catch (err) {
      console.error('Failed to archive notifications:', err);
      throw err;
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    try {
      await markAllAsRead(userId);
      
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      
      setStats(prev => {
        if (!prev) return prev;
        return { ...prev, total_unread: 0 };
      });
      
      await refresh();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      throw err;
    }
  }, [userId, refresh]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications(true);
  }, [userId, orgId, types, priority]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchNotifications(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = subscribeToNotifications(userId, (notification) => {
      // Add new notification to the top of the list
      setNotifications(prev => [notification, ...prev]);
      
      // Update stats
      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          total_unread: prev.total_unread + 1,
        };
      });
    });

    return () => unsubscribe();
  }, [userId]);

  return {
    notifications,
    stats,
    unreadCount: stats?.total_unread || 0,
    loading,
    error,
    hasMore,
    refresh,
    markAsRead,
    markAsUnread,
    archive,
    markAllRead,
    loadMore,
  };
}

// ============================================================================
// Additional hooks for specific use cases
// ============================================================================

export function useUnreadCount(userId: string): number {
  const { unreadCount } = useNotifications({
    userId,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  return unreadCount;
}

export function useRecentNotifications(userId: string, limit = 5) {
  const { notifications, loading, error, refresh } = useNotifications({
    userId,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  return {
    notifications: notifications.slice(0, limit),
    loading,
    error,
    refresh,
  };
}
