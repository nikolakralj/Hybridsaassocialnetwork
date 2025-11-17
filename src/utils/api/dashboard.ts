// ============================================================================
// Dashboard API - Hybrid SaaS + Social Mock Data
// ============================================================================

import type {
  DashboardData,
  WorkStats,
  SocialStats,
  EarningsDataPoint,
  HoursBreakdown,
  FeedItem,
  JobOpportunity,
  RecentConnection,
  MessagePreview,
  Insight,
  QuickAction,
} from '../../types/dashboard';

// ============================================================================
// Mock Data - Work Stats (SaaS)
// ============================================================================

const MOCK_WORK_STATS: WorkStats = {
  earnings: {
    current_period: 12450,
    previous_period: 10800,
    currency: 'USD',
    period: 'month',
    trend: 15.3, // +15.3%
  },
  hours: {
    total: 92.5,
    billable: 80.5,
    non_billable: 12,
    period: 'month',
  },
  pending_approvals: {
    count: 3,
    total_value: 4500,
    currency: 'USD',
  },
  active_contracts: {
    count: 5,
    expiring_soon: 2,
  },
};

// ============================================================================
// Mock Data - Social Stats
// ============================================================================

const MOCK_SOCIAL_STATS: SocialStats = {
  profile_views: {
    total: 1247,
    this_week: 247,
    trend: 23.5, // +23.5%
  },
  connections: {
    total: 156,
    new_this_week: 3,
    pending_invites: 5,
  },
  endorsements: {
    total: 87,
    new_this_week: 4,
    top_skills: [
      { skill_name: 'React', count: 23, recent_endorsers: ['Sarah Chen', 'John Doe'] },
      { skill_name: 'Node.js', count: 18, recent_endorsers: ['Alex Kim'] },
      { skill_name: 'TypeScript', count: 15, recent_endorsers: ['Emily Watson', 'Mike R.'] },
    ],
  },
  engagement: {
    posts_this_week: 2,
    likes_received: 34,
    comments_received: 12,
  },
  network_strength: {
    score: 72,
    level: 'established',
    next_level_at: 85,
  },
};

// ============================================================================
// Mock Data - Earnings Chart (30 days)
// ============================================================================

const MOCK_EARNINGS_CHART: EarningsDataPoint[] = [
  { date: '2024-10-15', amount: 2400, hours: 32 },
  { date: '2024-10-22', amount: 3200, hours: 40 },
  { date: '2024-10-29', amount: 2800, hours: 35 },
  { date: '2024-11-05', amount: 4050, hours: 45 },
  { date: '2024-11-12', amount: 3600, hours: 40 },
];

// ============================================================================
// Mock Data - Hours Breakdown
// ============================================================================

const MOCK_HOURS_BREAKDOWN: HoursBreakdown[] = [
  {
    project_id: 'proj-1',
    project_name: 'E-Commerce Redesign',
    client_name: 'Acme Inc',
    hours: 35,
    percentage: 37.8,
    color: '#3b82f6',
  },
  {
    project_id: 'proj-2',
    project_name: 'API Integration',
    client_name: 'TechCorp',
    hours: 28,
    percentage: 30.3,
    color: '#8b5cf6',
  },
  {
    project_id: 'proj-3',
    project_name: 'Mobile App',
    client_name: 'DevShop',
    hours: 17.5,
    percentage: 18.9,
    color: '#10b981',
  },
  {
    project_id: 'proj-4',
    project_name: 'Code Review',
    client_name: 'Startup Co',
    hours: 12,
    percentage: 13.0,
    color: '#f59e0b',
  },
];

// ============================================================================
// Mock Data - Network Feed
// ============================================================================

const MOCK_NETWORK_FEED: FeedItem[] = [
  {
    id: 'feed-1',
    type: 'job_posted',
    actor_id: 'user-999',
    actor_name: 'TechCorp Agency',
    actor_avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=TechCorp',
    actor_headline: 'Leading Digital Agency',
    title: 'Senior React Developer Needed',
    content: 'We\'re looking for a senior React developer for a 3-month contract @ $150/hr. Must have experience with Next.js and TypeScript.',
    related_entity_type: 'job',
    related_entity_id: 'job-123',
    likes_count: 12,
    comments_count: 5,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
  {
    id: 'feed-2',
    type: 'contract_signed',
    actor_id: 'user-456',
    actor_name: 'Sarah Chen',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    actor_headline: 'Full-Stack Developer',
    content: 'Excited to announce I\'ve signed a new contract with Acme Inc to work on their e-commerce platform! 🎉',
    related_entity_type: 'contract',
    related_entity_id: 'contract-456',
    likes_count: 45,
    comments_count: 8,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
  },
  {
    id: 'feed-3',
    type: 'milestone_completed',
    actor_id: 'user-789',
    actor_name: 'Alex Kim',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    actor_headline: 'Product Designer',
    content: 'Just completed the UI redesign for DevShop\'s mobile app! 200+ hours of work delivered on time and under budget. 💪',
    likes_count: 67,
    comments_count: 15,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
  },
  {
    id: 'feed-4',
    type: 'endorsement_received',
    actor_id: 'user-111',
    actor_name: 'Emily Watson',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
    actor_headline: 'Engineering Manager',
    content: 'Endorsed you for React and TypeScript',
    likes_count: 8,
    comments_count: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
  {
    id: 'feed-5',
    type: 'post',
    actor_id: 'user-222',
    actor_name: 'Michael Rodriguez',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    actor_headline: 'Freelance Consultant',
    content: '🔥 Hot take: The best way to increase your freelance rate is to specialize, not generalize. I doubled my rate by focusing exclusively on React + TypeScript projects. What\'s your experience?',
    likes_count: 89,
    comments_count: 23,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), // 1.5 days ago
  },
];

// ============================================================================
// Mock Data - Job Opportunities
// ============================================================================

const MOCK_JOB_OPPORTUNITIES: JobOpportunity[] = [
  {
    id: 'job-1',
    title: 'Senior React Developer',
    company_name: 'TechCorp',
    company_logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=TechCorp',
    remote: true,
    rate_min: 120,
    rate_max: 150,
    currency: 'USD',
    type: 'contract',
    skills: ['React', 'TypeScript', 'Next.js'],
    posted_by: 'Emily Watson',
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    applicants_count: 12,
    in_your_network: true,
  },
  {
    id: 'job-2',
    title: 'Full-Stack Engineer',
    company_name: 'Startup Co',
    remote: true,
    rate_min: 100,
    rate_max: 130,
    currency: 'USD',
    type: 'contract',
    skills: ['Node.js', 'React', 'PostgreSQL'],
    posted_by: 'John Smith',
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    applicants_count: 8,
    in_your_network: false,
  },
  {
    id: 'job-3',
    title: 'UI/UX Designer',
    company_name: 'Acme Inc',
    remote: true,
    rate_min: 80,
    rate_max: 110,
    currency: 'USD',
    type: 'part_time',
    skills: ['Figma', 'UI Design', 'Prototyping'],
    posted_by: 'Sarah Chen',
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    applicants_count: 15,
    in_your_network: true,
  },
];

// ============================================================================
// Mock Data - Recent Connections
// ============================================================================

const MOCK_RECENT_CONNECTIONS: RecentConnection[] = [
  {
    id: 'conn-1',
    name: 'Jennifer Lee',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jennifer',
    headline: 'Product Manager @ Google',
    connection_type: 'direct',
    connected_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    mutual_connections: 8,
  },
  {
    id: 'conn-2',
    name: 'David Park',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    headline: 'Senior Engineer @ Meta',
    connection_type: 'direct',
    connected_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    mutual_connections: 5,
  },
  {
    id: 'conn-3',
    name: 'Lisa Wong',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa',
    headline: 'Freelance Designer',
    connection_type: 'direct',
    connected_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    mutual_connections: 12,
  },
];

// ============================================================================
// Mock Data - Messages
// ============================================================================

const MOCK_MESSAGES: MessagePreview[] = [
  {
    id: 'msg-1',
    sender_id: 'user-999',
    sender_name: 'Sarah Chen',
    sender_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    preview: 'Hey! Are you available for a quick call about the Acme project?',
    unread: true,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
  },
  {
    id: 'msg-2',
    sender_id: 'user-888',
    sender_name: 'TechCorp Recruiter',
    sender_avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=TechCorp',
    preview: 'We have an exciting opportunity that matches your skills...',
    unread: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'msg-3',
    sender_id: 'user-777',
    sender_name: 'Alex Kim',
    sender_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    preview: 'Thanks for the endorsement! Really appreciate it.',
    unread: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

// ============================================================================
// Mock Data - Insights
// ============================================================================

const MOCK_INSIGHTS: Insight[] = [
  {
    id: 'insight-1',
    type: 'earning',
    title: 'Great month!',
    description: "You've earned $12,450 this month, 15% higher than last month. Keep up the momentum!",
    icon: 'TrendingUp',
    color: 'text-green-600',
  },
  {
    id: 'insight-2',
    type: 'opportunity',
    title: '3 jobs match your skills',
    description: 'There are 3 new opportunities in your network that match your React + TypeScript expertise.',
    action_label: 'View Jobs',
    action_url: '#/opportunities',
    icon: 'Briefcase',
    color: 'text-blue-600',
  },
  {
    id: 'insight-3',
    type: 'network',
    title: 'Profile views up 23%',
    description: 'Your profile is gaining traction! Consider posting more content to engage your network.',
    action_label: 'Create Post',
    action_url: '#/feed',
    icon: 'Eye',
    color: 'text-purple-600',
  },
  {
    id: 'insight-4',
    type: 'milestone',
    title: '2 contracts expiring soon',
    description: 'You have 2 contracts expiring in the next 30 days. Time to renew or find new opportunities.',
    action_label: 'View Contracts',
    action_url: '#/contracts',
    icon: 'AlertCircle',
    color: 'text-amber-600',
  },
];

// ============================================================================
// Mock Data - Quick Actions
// ============================================================================

const MOCK_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'action-1',
    label: 'Submit Timesheet',
    icon: 'Clock',
    color: 'bg-blue-500',
    route: '#/approvals',
  },
  {
    id: 'action-2',
    label: 'Browse Jobs',
    icon: 'Briefcase',
    color: 'bg-purple-500',
    route: '#/opportunities',
  },
  {
    id: 'action-3',
    label: 'Review Approvals',
    icon: 'CheckCircle',
    color: 'bg-green-500',
    route: '#/approvals',
    badge_count: 3,
  },
  {
    id: 'action-4',
    label: 'View Contracts',
    icon: 'FileText',
    color: 'bg-amber-500',
    route: '#/contracts',
  },
];

// ============================================================================
// API Functions
// ============================================================================

export async function getDashboardData(userId: string): Promise<DashboardData> {
  console.log('[API] getDashboardData (mock)', userId);
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    user_id: userId,
    work_stats: MOCK_WORK_STATS,
    social_stats: MOCK_SOCIAL_STATS,
    earnings_chart: MOCK_EARNINGS_CHART,
    hours_breakdown: MOCK_HOURS_BREAKDOWN,
    network_feed: MOCK_NETWORK_FEED,
    job_opportunities: MOCK_JOB_OPPORTUNITIES,
    recent_connections: MOCK_RECENT_CONNECTIONS,
    messages: MOCK_MESSAGES,
    insights: MOCK_INSIGHTS,
    quick_actions: MOCK_QUICK_ACTIONS,
  };
}
