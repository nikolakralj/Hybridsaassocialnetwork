// ============================================================================
// NotificationBell - Header notification icon with badge
// ============================================================================

import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
  className?: string;
}

export function NotificationBell({
  unreadCount,
  onClick,
  className = '',
}: NotificationBellProps) {
  const hasUnread = unreadCount > 0;

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label={`Notifications ${hasUnread ? `(${unreadCount} unread)` : ''}`}
      >
        <Bell 
          className={`w-5 h-5 ${hasUnread ? 'text-blue-600' : 'text-gray-600'}`}
        />
        
        {hasUnread && (
          <>
            {/* Animated pulse dot */}
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            
            {/* Count badge */}
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 text-xs bg-red-500 hover:bg-red-500"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </>
        )}
      </Button>
    </div>
  );
}
