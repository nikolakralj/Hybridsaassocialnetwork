// ============================================================================
// Dashboard Types - Hybrid SaaS + Social Platform
// ============================================================================

// ============================================================================
// SaaS Work Management Stats
// ============================================================================

export interface WorkStats {
  earnings: {
    current_period: number;
    previous_period: number;
    currency: string;
    period: 'week' | 'month' | 'year';
    trend: number; // percentage change
  };
  hours: {
    total: number;
    billable: number;
    non_billable: number;
    period: 'week' | 'month';
  };
  pending_approvals: {
    count: number;
    total_value: number;
    currency: string;
  };
  active_contracts: {
    count: number;
    expiring_soon: number; // within 30 days
  };
}

export interface EarningsDataPoint {
  date: string;
  amount: number;
  hours?: number;
}

export interface HoursBreakdown {
  project_id: string;
  project_name: string;
  client_name: string;
  hours: number;
  percentage: number;
  color: string;
}

// ============================================================================
// Social Network Stats
// ============================================================================

export interface SocialStats {
  profile_views: {
    total: number;
    this_week: number;
    trend: number; // percentage change
  };
  connections: {
    total: number;
    new_this_week: number;
    pending_invites: number;
  };
  endorsements: {
    total: number;
    new_this_week: number;
    top_skills: SkillEndorsement[];
  };
  engagement: {
    posts_this_week: number;
    likes_received: number;
    comments_received: number;
  };
  network_strength: {
    score: number; // 0-100
    level: 'emerging' | 'growing' | 'established' | 'influential';
    next_level_at: number;
  };
}

export interface SkillEndorsement {
  skill_name: string;
  count: number;
  recent_endorsers: string[]; // user names
}

// ============================================================================
// Network Feed Items
// ============================================================================

export type FeedItemType =
  | 'post'
  | 'job_posted'
  | 'contract_signed'
  | 'milestone_completed'
  | 'endorsement_received'
  | 'connection_made'
  | 'profile_updated'
  | 'comment'
  | 'like';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  actor_id: string;
  actor_name: string;
  actor_avatar?: string;
  actor_headline?: string;
  
  // Content
  content?: string;
  title?: string;
  
  // Related entities
  related_entity_type?: 'job' | 'project' | 'contract' | 'profile' | 'post';
  related_entity_id?: string;
  
  // Engagement
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
  
  // Metadata
  metadata?: Record<string, any>;
  
  created_at: string;
}

export interface JobOpportunity {
  id: string;
  title: string;
  company_name: string;
  company_logo?: string;
  location?: string;
  remote: boolean;
  rate_min?: number;
  rate_max?: number;
  currency: string;
  type: 'full_time' | 'contract' | 'part_time';
  skills: string[];
  posted_by: string;
  posted_at: string;
  applicants_count: number;
  in_your_network: boolean;
}

// ============================================================================
// Recent Connections
// ============================================================================

export interface RecentConnection {
  id: string;
  name: string;
  avatar?: string;
  headline: string;
  connection_type: 'direct' | '2nd_degree';
  connected_at: string;
  mutual_connections?: number;
}

// ============================================================================
// Messages
// ============================================================================

export interface MessagePreview {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  preview: string;
  unread: boolean;
  created_at: string;
}

// ============================================================================
// Quick Actions
// ============================================================================

export interface QuickAction {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  color: string;
  route: string;
  badge_count?: number;
}

// ============================================================================
// Insights & Recommendations
// ============================================================================

export interface Insight {
  id: string;
  type: 'earning' | 'network' | 'opportunity' | 'milestone' | 'tip';
  title: string;
  description: string;
  action_label?: string;
  action_url?: string;
  icon: string;
  color: string;
}

// ============================================================================
// Dashboard API Response
// ============================================================================

export interface DashboardData {
  user_id: string;
  work_stats: WorkStats;
  social_stats: SocialStats;
  earnings_chart: EarningsDataPoint[];
  hours_breakdown: HoursBreakdown[];
  network_feed: FeedItem[];
  job_opportunities: JobOpportunity[];
  recent_connections: RecentConnection[];
  messages: MessagePreview[];
  insights: Insight[];
  quick_actions: QuickAction[];
}
