// ============================================================================
// NetworkFeed - Clean social feed for dashboard
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
import { Badge } from '../ui/badge';
import type { FeedItem } from '../../types/dashboard';

interface NetworkFeedProps {
  items: FeedItem[];
  onItemClick?: (item: FeedItem) => void;
}

const FEED_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  job_posted: {
    icon: <Briefcase className="w-3 h-3" />,
    label: 'Posted a job',
    color: 'bg-blue-50 text-blue-600',
  },
  contract_signed: {
    icon: <FileText className="w-3 h-3" />,
    label: 'Signed a contract',
    color: 'bg-emerald-50 text-emerald-600',
  },
  milestone_completed: {
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Completed a milestone',
    color: 'bg-violet-50 text-violet-600',
  },
  endorsement_received: {
    icon: <Award className="w-3 h-3" />,
    label: 'Endorsed you',
    color: 'bg-amber-50 text-amber-600',
  },
  post: {
    icon: <Share2 className="w-3 h-3" />,
    label: 'Posted',
    color: 'bg-sky-50 text-sky-600',
  },
};

export function NetworkFeed({ items, onItemClick }: NetworkFeedProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Network Activity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">What's happening in your network</p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
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

  const config = FEED_TYPE_CONFIG[item.type] || FEED_TYPE_CONFIG['post'];

  return (
    <div
      className={`p-3 rounded-lg hover:bg-accent/40 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        <Avatar className="w-9 h-9 flex-shrink-0">
          <AvatarImage src={item.actor_avatar} alt={item.actor_name} />
          <AvatarFallback className="text-[10px]">{item.actor_name.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div>
              <p className="font-medium text-sm text-foreground leading-tight">{item.actor_name}</p>
              {item.actor_headline && (
                <p className="text-[11px] text-muted-foreground">{item.actor_headline}</p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap mt-0.5">{timeAgo}</span>
          </div>

          <div className="mt-1.5 mb-2">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${config.color}`}>
              {config.icon}
              {config.label}
            </span>
          </div>

          {item.title && (
            <p className="font-medium text-sm text-foreground mb-1">{item.title}</p>
          )}

          {item.content && (
            <p className="text-xs text-muted-foreground mb-2.5 line-clamp-2 leading-relaxed">{item.content}</p>
          )}

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 transition-colors bg-transparent border-0 cursor-pointer p-0">
              <Heart className={`w-3.5 h-3.5 ${item.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
              <span>{item.likes_count}</span>
            </button>
            <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-accent-brand transition-colors bg-transparent border-0 cursor-pointer p-0">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{item.comments_count}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
