// ============================================================================
// useNotifications - Hook for managing notifications (performance-optimized)
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Use refs for mutable values to avoid dependency cycles
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const optionsRef = useRef({ userId, orgId, types, priority });
  optionsRef.current = { userId, orgId, types, priority };

  const fetchNotifications = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    try {
      setLoading(true);
      setError(null);

      const opts = optionsRef.current;
      const request: GetNotificationsRequest = {
        user_id: opts.userId,
        org_id: opts.orgId,
        types: opts.types,
        priority: opts.priority,
        archived: false,
        limit: 20,
        offset: reset ? 0 : offsetRef.current,
      };

      const response = await getNotifications(request);

      if (reset) {
        setNotifications(response.notifications);
        offsetRef.current = response.notifications.length;
      } else {
        setNotifications(prev => [...prev, ...response.notifications]);
        offsetRef.current += response.notifications.length;
      }

      setStats(response.stats);
      setHasMore(response.has_more);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []); // Stable - no deps, uses refs

  const refresh = useCallback(async () => {
    await fetchNotifications(true);
  }, [fetchNotifications]);

  const loadMore = useCallback(async () => {
    if (!loadingRef.current && hasMore) {
      await fetchNotifications(false);
    }
  }, [fetchNotifications, hasMore]);

  const markAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      await markNotificationsRead(notificationIds);
      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id)
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          total_unread: Math.max(0, prev.total_unread - notificationIds.length),
        };
      });
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
      throw err;
    }
  }, []);

  const markAsUnread = useCallback(async (notificationIds: string[]) => {
    try {
      await markNotificationsUnread(notificationIds);
      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id)
            ? { ...n, read: false, read_at: undefined }
            : n
        )
      );
      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          total_unread: prev.total_unread + notificationIds.length,
        };
      });
    } catch (err) {
      console.error('Failed to mark notifications as unread:', err);
      throw err;
    }
  }, []);

  const archive = useCallback(async (notificationIds: string[]) => {
    try {
      await archiveNotifications(notificationIds);
      setNotifications(prev =>
        prev.filter(n => !notificationIds.includes(n.id))
      );
    } catch (err) {
      console.error('Failed to archive notifications:', err);
      throw err;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllAsRead(optionsRef.current.userId);
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      setStats(prev => {
        if (!prev) return prev;
        return { ...prev, total_unread: 0 };
      });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      throw err;
    }
  }, []);

  // Initial fetch — only re-runs when filter params actually change
  useEffect(() => {
    fetchNotifications(true);
  }, [userId, orgId, priority, fetchNotifications]);
  // Note: `types` intentionally excluded as array ref changes each render

  // Auto-refresh (stable interval since fetchNotifications is stable)
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
      setNotifications(prev => [notification, ...prev]);
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
