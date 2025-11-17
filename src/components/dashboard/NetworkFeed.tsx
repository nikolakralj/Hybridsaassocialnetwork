// ============================================================================
// NetworkFeed - Social feed component
// ============================================================================

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Heart,
  MessageCircle,
  Briefcase,
  FileText,
  CheckCircle,
  Award,
  Share2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { FeedItem } from '../../types/dashboard';

interface NetworkFeedProps {
  items: FeedItem[];
  onItemClick?: (item: FeedItem) => void;
}

const FEED_TYPE_ICONS: Record<string, React.ReactNode> = {
  job_posted: <Briefcase className="w-4 h-4" />,
  contract_signed: <FileText className="w-4 h-4" />,
  milestone_completed: <CheckCircle className="w-4 h-4" />,
  endorsement_received: <Award className="w-4 h-4" />,
  post: <Share2 className="w-4 h-4" />,
};

const FEED_TYPE_LABELS: Record<string, string> = {
  job_posted: 'Posted a job',
  contract_signed: 'Signed a contract',
  milestone_completed: 'Completed a milestone',
  endorsement_received: 'Endorsed you',
  post: 'Posted',
};

export function NetworkFeed({ items, onItemClick }: NetworkFeedProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <h3 className="font-semibold">Network Activity</h3>
        <p className="text-sm text-gray-500 mt-1">What's happening in your network</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {items.map((item) => (
            <FeedItemCard
              key={item.id}
              item={item}
              onClick={() => onItemClick?.(item)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedItemCard({ item, onClick }: { item: FeedItem; onClick?: () => void }) {
  const timeAgo = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
  });

  return (
    <div
      className={`p-4 hover:bg-gray-50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="w-12 h-12 flex-shrink-0">
          <AvatarImage src={item.actor_avatar} alt={item.actor_name} />
          <AvatarFallback>{item.actor_name.charAt(0)}</AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="font-semibold text-gray-900">{item.actor_name}</p>
              {item.actor_headline && (
                <p className="text-sm text-gray-500">{item.actor_headline}</p>
              )}
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo}</span>
          </div>

          {/* Type Badge */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              {FEED_TYPE_ICONS[item.type]}
              <span className="text-xs">{FEED_TYPE_LABELS[item.type] || item.type}</span>
            </Badge>
          </div>

          {/* Title */}
          {item.title && (
            <p className="font-medium text-gray-900 mb-1">{item.title}</p>
          )}

          {/* Content */}
          {item.content && (
            <p className="text-sm text-gray-700 mb-3 line-clamp-3">{item.content}</p>
          )}

          {/* Engagement */}
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors">
              <Heart className={`w-4 h-4 ${item.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
              <span>{item.likes_count}</span>
            </button>
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 transition-colors">
              <MessageCircle className="w-4 h-4" />
              <span>{item.comments_count}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
