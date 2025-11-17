// ============================================================================
// ActivityFeedPage - Full page view of all notifications
// ============================================================================

import React, { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  CheckCheck,
  Loader2,
  Inbox,
  Filter,
  RefreshCw,
  Archive,
  Settings,
} from 'lucide-react';
import type { Notification, NotificationType, NotificationPriority } from '../../types/notifications';

interface ActivityFeedPageProps {
  userId: string;
  orgId?: string;
  onNavigate?: (url: string) => void;
  onSettings?: () => void;
}

export function ActivityFeedPage({
  userId,
  orgId,
  onNavigate,
  onSettings,
}: ActivityFeedPageProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'archived'>('unread');
  const [filterType, setFilterType] = useState<NotificationType | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<NotificationPriority | 'all'>('all');

  const {
    notifications,
    stats,
    unreadCount,
    loading,
    error,
    hasMore,
    markAsRead,
    markAsUnread,
    archive,
    markAllRead,
    loadMore,
    refresh,
  } = useNotifications({
    userId,
    orgId,
    types: filterType !== 'all' ? [filterType] : undefined,
    priority: filterPriority !== 'all' ? filterPriority : undefined,
    autoRefresh: true,
  });

  const handleNotificationClick = (notification: Notification) => {
    if (notification.action_url && onNavigate) {
      onNavigate(notification.action_url);
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

  const displayNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.read && !n.archived;
    if (activeTab === 'archived') return n.archived;
    return !n.archived; // 'all' tab
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Activity Feed</h1>
            <p className="text-gray-600 mt-1">
              Stay up to date with your notifications
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {onSettings && (
              <Button variant="outline" size="sm" onClick={onSettings}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
                <div className="text-sm text-gray-600">Unread</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-900">{stats.total_today}</div>
                <div className="text-sm text-gray-600">Today</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-900">{stats.total_this_week}</div>
                <div className="text-sm text-gray-600">This Week</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {stats.unread_by_priority?.high || 0}
                </div>
                <div className="text-sm text-gray-600">High Priority</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="unread">
                    Unread
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="archived">Archived</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <Select
                  value={filterType}
                  onValueChange={(v) => setFilterType(v as any)}
                >
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="approval_request">Approval Requests</SelectItem>
                    <SelectItem value="contract_invitation">Contract Invites</SelectItem>
                    <SelectItem value="timesheet_submitted">Timesheets</SelectItem>
                    <SelectItem value="disclosure_request">Disclosures</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filterPriority}
                  onValueChange={(v) => setFilterPriority(v as any)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={markAllRead}
                  >
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Mark all read
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Loading State */}
            {loading && notifications.length === 0 && (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-6 text-center text-red-600">
                Failed to load notifications. Please try again.
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && displayNotifications.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {activeTab === 'unread' ? 'All caught up!' : 'No notifications'}
                </h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  {activeTab === 'unread'
                    ? "You've read all your notifications. Great job staying on top of things!"
                    : activeTab === 'archived'
                    ? "You haven't archived any notifications yet."
                    : "You'll see notifications here when you have activity."}
                </p>
              </div>
            )}

            {/* Notification List */}
            {!loading && !error && displayNotifications.length > 0 && (
              <div>
                <ScrollArea className="h-[600px]">
                  <div className="divide-y">
                    {displayNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={handleNotificationClick}
                        onMarkRead={handleMarkAsRead}
                        onMarkUnread={handleMarkAsUnread}
                        onArchive={handleArchive}
                      />
                    ))}
                  </div>
                </ScrollArea>

                {/* Load More */}
                {hasMore && (
                  <div className="p-4 border-t text-center">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load more'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
