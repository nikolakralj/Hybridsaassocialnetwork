// ============================================================================
// NetworkFeed - Apple-minimalistic social feed
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

const FEED_TYPE_ICONS: Record<string, React.ReactNode> = {
  job_posted: <Briefcase className="w-3.5 h-3.5" />,
  contract_signed: <FileText className="w-3.5 h-3.5" />,
  milestone_completed: <CheckCircle className="w-3.5 h-3.5" />,
  endorsement_received: <Award className="w-3.5 h-3.5" />,
  post: <Share2 className="w-3.5 h-3.5" />,
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
    <Card className="border-border/60">
      <CardHeader className="border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">Network Activity</h3>
        <p className="text-xs text-muted-foreground mt-1">What's happening in your network</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/60 max-h-[600px] overflow-y-auto">
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
      className={`p-4 hover:bg-muted/30 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={item.actor_avatar} alt={item.actor_name} />
          <AvatarFallback className="text-xs">{item.actor_name.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="font-medium text-sm text-foreground">{item.actor_name}</p>
              {item.actor_headline && (
                <p className="text-xs text-muted-foreground">{item.actor_headline}</p>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">{timeAgo}</span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="flex items-center gap-1 text-[11px] font-medium">
              {FEED_TYPE_ICONS[item.type]}
              <span>{FEED_TYPE_LABELS[item.type] || item.type}</span>
            </Badge>
          </div>

          {item.title && (
            <p className="font-medium text-sm text-foreground mb-1">{item.title}</p>
          )}

          {item.content && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{item.content}</p>
          )}

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors">
              <Heart className={`w-3.5 h-3.5 ${item.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
              <span>{item.likes_count}</span>
            </button>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent-brand transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{item.comments_count}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
