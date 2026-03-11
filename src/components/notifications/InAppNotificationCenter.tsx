/**
 * InAppNotificationCenter — Live notification bell + dropdown
 *
 * Phase 5 Day 8: In-app real-time notification center
 * Shows approval chain progress, status changes, and actions.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Bell, CheckCheck, Settings, Inbox, X,
  CheckCircle2, Clock, XCircle, Send, Undo2,
  PartyPopper, AlertTriangle, ChevronRight,
  Trash2,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import {
  useNotificationStore,
  type AppNotification,
  type NotifType,
} from '../../contexts/NotificationContext';

// ============================================================================
// Config
// ============================================================================

const TYPE_CONFIG: Record<NotifType, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  first_approval: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-200',
  },
  middle_approval: {
    icon: CheckCircle2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  final_approval: {
    icon: PartyPopper,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-200',
  },
  rejection: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
  },
  submission: {
    icon: Send,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  recall: {
    icon: Undo2,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-200',
  },
};

// ============================================================================
// Bell Button
// ============================================================================

export function NotificationCenterBell() {
  const store = useNotificationStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors"
        aria-label={`Notifications${store.unreadCount > 0 ? ` (${store.unreadCount} unread)` : ''}`}
      >
        <Bell className={`h-5 w-5 ${store.unreadCount > 0 ? 'text-blue-600' : 'text-muted-foreground'}`} />
        {store.unreadCount > 0 && (
          <>
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 text-[10px] bg-red-500 hover:bg-red-500"
            >
              {store.unreadCount > 99 ? '99+' : store.unreadCount}
            </Badge>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <NotificationDropdown
          onClose={() => setOpen(false)}
          onSettings={() => {
            setOpen(false);
            // Dispatch event to open settings
            window.dispatchEvent(new CustomEvent('openNotificationSettings'));
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Dropdown Panel
// ============================================================================

function NotificationDropdown({ onClose, onSettings }: {
  onClose: () => void;
  onSettings: () => void;
}) {
  const store = useNotificationStore();
  const [tab, setTab] = useState<'all' | 'unread'>('unread');

  const displayed = tab === 'unread'
    ? store.notifications.filter(n => !n.read)
    : store.notifications;

  return (
    <div className="absolute right-0 top-full mt-2 w-[400px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Notifications</h3>
          {store.unreadCount > 0 && (
            <p className="text-[10px] text-muted-foreground">{store.unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {store.unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={store.markAllRead}>
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          )}
          <button onClick={onSettings} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(['unread', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors relative ${
              tab === t ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'unread' ? `Unread${store.unreadCount > 0 ? ` (${store.unreadCount})` : ''}` : 'All'}
            {tab === t && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {tab === 'unread' ? 'All caught up!' : 'No notifications yet'}
          </p>
          <p className="text-xs text-muted-foreground">
            {tab === 'unread'
              ? 'Submit a timesheet to see approval progress'
              : 'Notifications will appear here as events happen'}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="divide-y">
            {displayed.slice(0, 20).map(n => (
              <NotifItem key={n.id} notification={n} />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Footer */}
      {store.notifications.length > 0 && (
        <div className="px-4 py-2 border-t flex items-center justify-between">
          <button
            onClick={store.clearAll}
            className="text-[10px] text-muted-foreground hover:text-red-500 flex items-center gap-1 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Clear all
          </button>
          <span className="text-[10px] text-muted-foreground">
            {store.notifications.length} total
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Notification Item
// ============================================================================

function NotifItem({ notification }: { notification: AppNotification }) {
  const store = useNotificationStore();
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  return (
    <div
      onClick={() => !notification.read && store.markRead(notification.id)}
      className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer relative ${
        !notification.read ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-muted/30'
      }`}
    >
      {/* Unread dot */}
      {!notification.read && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
      )}

      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${!notification.read ? 'font-semibold' : ''}`}>
          {notification.title}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          {notification.priority === 'urgent' && (
            <Badge className="text-[8px] bg-red-100 text-red-700 border-red-200 animate-pulse">
              <AlertTriangle className="h-2 w-2 mr-0.5" /> Urgent
            </Badge>
          )}
          {notification.priority === 'high' && (
            <Badge className="text-[8px] bg-amber-100 text-amber-700 border-amber-200">
              High
            </Badge>
          )}
          {notification.chainId && (
            <button className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
              View chain <ChevronRight className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
