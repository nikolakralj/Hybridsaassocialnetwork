// ============================================================================
// NotificationItem - Individual notification display
// ============================================================================

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Handshake,
  Eye,
  Clock,
  FolderPlus,
  AtSign,
  Bell,
  MoreVertical,
  Trash2,
  Archive,
  MailOpen,
  Mail,
} from 'lucide-react';
import type { Notification } from '../../types/notifications';
import { NOTIFICATION_ICONS } from '../../types/notifications';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface NotificationItemProps {
  notification: Notification;
  onClick?: (notification: Notification) => void;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

const ICON_MAP: Record<string, any> = {
  CheckCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Handshake,
  Eye,
  Clock,
  FolderPlus,
  AtSign,
  Bell,
};

export function NotificationItem({
  notification,
  onClick,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onDelete,
  compact = false,
}: NotificationItemProps) {
  const iconConfig = NOTIFICATION_ICONS[notification.type];
  const IconComponent = ICON_MAP[iconConfig.icon] || Bell;

  const handleClick = () => {
    if (!notification.read && onMarkRead) {
      onMarkRead(notification.id);
    }
    if (onClick) {
      onClick(notification);
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkRead) {
      onMarkRead(notification.id);
    }
  };

  const handleMarkAsUnread = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkUnread) {
      onMarkUnread(notification.id);
    }
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onArchive) {
      onArchive(notification.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(notification.id);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <div
      onClick={handleClick}
      className={`
        group relative flex gap-3 p-4 rounded-lg transition-colors cursor-pointer
        ${!notification.read ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}
        ${compact ? 'p-3' : ''}
      `}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-l-lg" />
      )}

      {/* Icon or Avatar */}
      {notification.actor_avatar ? (
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={notification.actor_avatar} alt={notification.actor_name} />
          <AvatarFallback>
            {notification.actor_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div
          className={`
            w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center
            ${iconConfig.bgColor}
          `}
        >
          <IconComponent className={`w-5 h-5 ${iconConfig.color}`} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm ${
                notification.read ? 'text-gray-900' : 'font-semibold text-gray-900'
              }`}
            >
              {notification.title}
            </p>
            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
              {notification.message}
            </p>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
              >
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!notification.read ? (
                <DropdownMenuItem onClick={handleMarkAsRead}>
                  <MailOpen className="w-4 h-4 mr-2" />
                  Mark as read
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleMarkAsUnread}>
                  <Mail className="w-4 h-4 mr-2" />
                  Mark as unread
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-gray-500">{timeAgo}</span>
          
          {notification.priority === 'high' && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
              High Priority
            </span>
          )}
          
          {notification.priority === 'urgent' && (
            <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded animate-pulse">
              Urgent
            </span>
          )}

          {notification.action_label && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-blue-600 hover:text-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              {notification.action_label} →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
