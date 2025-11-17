// ============================================================================
// NotificationDropdown - Dropdown panel showing recent notifications
// ============================================================================

import React, { useState } from 'react';
import { NotificationBell } from './NotificationBell';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '../../hooks/useNotifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, CheckCheck, Settings, Inbox } from 'lucide-react';
import type { Notification } from '../../types/notifications';

interface NotificationDropdownProps {
  userId: string;
  orgId?: string;
  onNavigate?: (url: string) => void;
  onViewAll?: () => void;
  onSettings?: () => void;
}

export function NotificationDropdown({
  userId,
  orgId,
  onNavigate,
  onViewAll,
  onSettings,
}: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('unread');

  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAsUnread,
    archive,
    markAllRead,
  } = useNotifications({
    userId,
    orgId,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  const handleNotificationClick = (notification: Notification) => {
    if (notification.action_url && onNavigate) {
      onNavigate(notification.action_url);
      setOpen(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    await markAsRead([id]);
  };

  const handleMarkAsUnread = async (id: string) => {
    await markAsUnread([id]);
  };

  const handleArchive = async (id: string) => {
    await archive([id]);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  const displayNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div>
          <NotificationBell unreadCount={unreadCount} onClick={() => setOpen(!open)} />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[420px] p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {unreadCount} unread
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
            {onSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSettings();
                  setOpen(false);
                }}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="px-4 pt-3 border-b">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="unread" className="text-sm">
                Unread {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
              <TabsTrigger value="all" className="text-sm">
                All
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-6 text-center text-sm text-red-600">
              Failed to load notifications
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && displayNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Inbox className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                {activeTab === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </p>
              <p className="text-xs text-gray-500">
                {activeTab === 'unread'
                  ? "You've read all your notifications"
                  : "You'll see notifications here when you have activity"}
              </p>
            </div>
          )}

          {/* Notification List */}
          {!loading && !error && displayNotifications.length > 0 && (
            <TabsContent value={activeTab} className="m-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {displayNotifications.slice(0, 10).map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={handleNotificationClick}
                      onMarkRead={handleMarkAsRead}
                      onMarkUnread={handleMarkAsUnread}
                      onArchive={handleArchive}
                      compact
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>

        {/* Footer */}
        {!loading && !error && displayNotifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-center text-sm"
                onClick={() => {
                  if (onViewAll) {
                    onViewAll();
                  }
                  setOpen(false);
                }}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
