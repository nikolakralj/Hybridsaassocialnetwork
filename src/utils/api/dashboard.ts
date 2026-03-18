// ============================================================================
// Dashboard API - Hybrid Real Data + Mock Social
// Phase 1: Work stats (projects, contracts, timesheets) come from KV APIs
// Social stats remain mock until Phase 16
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
import { listProjects } from './projects-api';
import { listContracts } from './contracts-api';
import { listTimesheets } from './timesheets-api';

// ============================================================================
// Real Data Fetchers
// ============================================================================

async function fetchRealWorkStats(accessToken?: string | null): Promise<WorkStats> {
  try {
    // Fetch real data in parallel
    const [projects, contracts, timesheetWeeks] = await Promise.all([
      listProjects(accessToken).catch(() => []),
      listContracts(accessToken).catch(() => []),
      listTimesheets(undefined, accessToken).catch(() => []),
    ]);

    // Count active contracts (status != 'terminated')
    const activeContracts = contracts.filter(
      (c: any) => c.status !== 'terminated' && c.status !== 'expired'
    );
    const expiringSoon = contracts.filter((c: any) => {
      if (!c.expirationDate) return false;
      const exp = new Date(c.expirationDate);
      const now = new Date();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      return exp.getTime() - now.getTime() < thirtyDays && exp.getTime() > now.getTime();
    });

    // Compute hours from timesheet weeks
    let totalHours = 0;
    let billableHours = 0;
    let submittedCount = 0;
    let submittedValue = 0;

    timesheetWeeks.forEach((week: any) => {
      const weekHours = (week.days || []).reduce((sum: number, d: any) => sum + (d.hours || 0), 0);
      totalHours += weekHours;
      billableHours += weekHours; // Assume all hours billable for now

      if (week.status === 'submitted') {
        submittedCount++;
        // Estimate value at average rate if contracts exist
        const avgRate = activeContracts.length > 0
          ? activeContracts.reduce((sum: number, c: any) => sum + (c.baseHourlyRate || 0), 0) / activeContracts.length
          : 100;
        submittedValue += weekHours * avgRate;
      }
    });

    // Estimate earnings based on approved weeks
    const approvedWeeks = timesheetWeeks.filter((w: any) => w.status === 'approved');
    const avgRate = activeContracts.length > 0
      ? activeContracts.reduce((sum: number, c: any) => sum + (c.baseHourlyRate || 0), 0) / activeContracts.length
      : 100;
    const currentEarnings = approvedWeeks.reduce((sum: number, w: any) => {
      const weekHours = (w.days || []).reduce((s: number, d: any) => s + (d.hours || 0), 0);
      return sum + weekHours * avgRate;
    }, 0);

    return {
      earnings: {
        current_period: Math.round(currentEarnings) || 0,
        previous_period: 0, // No historical comparison yet
        currency: 'USD',
        period: 'month',
        trend: 0,
      },
      hours: {
        total: totalHours || 0,
        billable: billableHours || 0,
        non_billable: 0,
        period: 'month',
      },
      pending_approvals: {
        count: submittedCount,
        total_value: Math.round(submittedValue),
        currency: 'USD',
      },
      active_contracts: {
        count: activeContracts.length,
        expiring_soon: expiringSoon.length,
      },
    };
  } catch (err) {
    console.error('[Dashboard] Failed to fetch real work stats:', err);
    return FALLBACK_WORK_STATS;
  }
}

async function fetchRealEarningsChart(accessToken?: string | null): Promise<EarningsDataPoint[]> {
  try {
    const weeks = await listTimesheets(undefined, accessToken).catch(() => []);
    if (weeks.length === 0) return FALLBACK_EARNINGS_CHART;

    // Group by weekStart date and aggregate hours to avoid duplicate keys in chart
    const byDate = new Map<string, { hours: number }>();
    weeks
      .filter((w: any) => w.weekStart)
      .forEach((w: any) => {
        const hours = (w.days || []).reduce((s: number, d: any) => s + (d.hours || 0), 0);
        const existing = byDate.get(w.weekStart);
        if (existing) {
          existing.hours += hours;
        } else {
          byDate.set(w.weekStart, { hours });
        }
      });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8) // Last 8 weeks
      .map(([date, { hours }]) => ({
        date,
        amount: Math.round(hours * 100), // Estimate at $100/hr default
        hours,
      }));
  } catch {
    return FALLBACK_EARNINGS_CHART;
  }
}

async function fetchRealHoursBreakdown(accessToken?: string | null): Promise<HoursBreakdown[]> {
  try {
    const [projects, weeks] = await Promise.all([
      listProjects(accessToken).catch(() => []),
      listTimesheets(undefined, accessToken).catch(() => []),
    ]);

    if (projects.length === 0) return FALLBACK_HOURS_BREAKDOWN;

    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
    const totalHours = weeks.reduce((sum: number, w: any) =>
      sum + (w.days || []).reduce((s: number, d: any) => s + (d.hours || 0), 0), 0);

    // Distribute hours across projects (evenly for now since weeks don't have projectId linkage yet)
    return projects.slice(0, 6).map((p: any, i: number) => {
      const projHours = totalHours > 0 ? Math.round(totalHours / projects.length) : 0;
      return {
        project_id: p.id,
        project_name: p.name,
        client_name: p.ownerName || 'Direct',
        hours: projHours,
        percentage: totalHours > 0 ? Math.round((projHours / totalHours) * 100) : 0,
        color: colors[i % colors.length],
      };
    });
  } catch {
    return FALLBACK_HOURS_BREAKDOWN;
  }
}

// ============================================================================
// Fallback Data (shown when API returns empty)
// ============================================================================

const FALLBACK_WORK_STATS: WorkStats = {
  earnings: {
    current_period: 0,
    previous_period: 0,
    currency: 'USD',
    period: 'month',
    trend: 0,
  },
  hours: {
    total: 0,
    billable: 0,
    non_billable: 0,
    period: 'month',
  },
  pending_approvals: {
    count: 0,
    total_value: 0,
    currency: 'USD',
  },
  active_contracts: {
    count: 0,
    expiring_soon: 0,
  },
};

const FALLBACK_EARNINGS_CHART: EarningsDataPoint[] = [];

const FALLBACK_HOURS_BREAKDOWN: HoursBreakdown[] = [];

// ============================================================================
// Mock Data - Social Stats (Phase 16)
// ============================================================================

const MOCK_SOCIAL_STATS: SocialStats = {
  profile_views: {
    total: 1247,
    this_week: 247,
    trend: 23.5,
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
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'feed-2',
    type: 'contract_signed',
    actor_id: 'user-456',
    actor_name: 'Sarah Chen',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    actor_headline: 'Full-Stack Developer',
    content: 'Excited to announce I\'ve signed a new contract with Acme Inc to work on their e-commerce platform!',
    related_entity_type: 'contract',
    related_entity_id: 'contract-456',
    likes_count: 45,
    comments_count: 8,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'feed-3',
    type: 'milestone_completed',
    actor_id: 'user-789',
    actor_name: 'Alex Kim',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    actor_headline: 'Product Designer',
    content: 'Just completed the UI redesign for DevShop\'s mobile app! 200+ hours of work delivered on time and under budget.',
    likes_count: 67,
    comments_count: 15,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
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
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'feed-5',
    type: 'post',
    actor_id: 'user-222',
    actor_name: 'Michael Rodriguez',
    actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    actor_headline: 'Freelance Consultant',
    content: 'Hot take: The best way to increase your freelance rate is to specialize, not generalize. I doubled my rate by focusing exclusively on React + TypeScript projects. What\'s your experience?',
    likes_count: 89,
    comments_count: 23,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
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
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
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
// Mock Data - Insights (dynamically generated from real data)
// ============================================================================

function generateInsights(workStats: WorkStats): Insight[] {
  const insights: Insight[] = [];

  if (workStats.earnings.current_period > 0) {
    insights.push({
      id: 'insight-earnings',
      type: 'earning',
      title: workStats.earnings.current_period > 5000 ? 'Great month!' : 'Getting started',
      description: `You've earned $${workStats.earnings.current_period.toLocaleString()} this month from approved timesheets.`,
      icon: 'TrendingUp',
      color: 'text-green-600',
    });
  }

  if (workStats.pending_approvals.count > 0) {
    insights.push({
      id: 'insight-pending',
      type: 'opportunity',
      title: `${workStats.pending_approvals.count} pending approval${workStats.pending_approvals.count !== 1 ? 's' : ''}`,
      description: `You have ${workStats.pending_approvals.count} timesheet${workStats.pending_approvals.count !== 1 ? 's' : ''} waiting for approval worth $${workStats.pending_approvals.total_value.toLocaleString()}.`,
      action_label: 'View Approvals',
      action_url: '/app/approvals',
      icon: 'Clock',
      color: 'text-amber-600',
    });
  }

  if (workStats.active_contracts.expiring_soon > 0) {
    insights.push({
      id: 'insight-expiring',
      type: 'milestone',
      title: `${workStats.active_contracts.expiring_soon} contract${workStats.active_contracts.expiring_soon !== 1 ? 's' : ''} expiring soon`,
      description: 'Review your expiring contracts and plan renewals or new opportunities.',
      action_label: 'View Contracts',
      action_url: '/app/contracts',
      icon: 'AlertCircle',
      color: 'text-amber-600',
    });
  }

  if (workStats.active_contracts.count === 0 && workStats.hours.total === 0) {
    insights.push({
      id: 'insight-getstarted',
      type: 'opportunity',
      title: 'Get started with WorkGraph',
      description: 'Create your first project and contract to start tracking time and earnings.',
      action_label: 'Create Project',
      action_url: '/app/projects',
      icon: 'Sparkles',
      color: 'text-blue-600',
    });
  }

  // Always show social insight
  insights.push({
    id: 'insight-network',
    type: 'network',
    title: 'Grow your network',
    description: 'Connect with other freelancers and companies to discover new opportunities.',
    action_label: 'Browse Feed',
    action_url: '/app/feed',
    icon: 'Eye',
    color: 'text-purple-600',
  });

  return insights.slice(0, 4);
}

// ============================================================================
// Quick Actions
// ============================================================================

function generateQuickActions(workStats: WorkStats): QuickAction[] {
  const actions: QuickAction[] = [
    {
      id: 'action-1',
      label: 'Submit Timesheet',
      icon: 'Clock',
      color: 'bg-blue-500',
      route: '/app/approvals',
    },
    {
      id: 'action-2',
      label: 'Browse Jobs',
      icon: 'Briefcase',
      color: 'bg-purple-500',
      route: '/app/feed',
    },
  ];

  if (workStats.pending_approvals.count > 0) {
    actions.push({
      id: 'action-3',
      label: 'Review Approvals',
      icon: 'CheckCircle',
      color: 'bg-green-500',
      route: '/app/approvals',
      badge_count: workStats.pending_approvals.count,
    });
  }

  actions.push({
    id: 'action-4',
    label: 'View Contracts',
    icon: 'FileText',
    color: 'bg-amber-500',
    route: '/app/contracts',
  });

  return actions;
}

// ============================================================================
// Main API Function
// ============================================================================

export async function getDashboardData(
  userId: string,
  accessToken?: string | null
): Promise<DashboardData> {
  console.log('[Dashboard] Loading data for user:', userId, accessToken ? '(authenticated)' : '(no token)');

  // Fetch real work data from KV APIs in parallel
  const [workStats, earningsChart, hoursBreakdown] = await Promise.all([
    fetchRealWorkStats(accessToken),
    fetchRealEarningsChart(accessToken),
    fetchRealHoursBreakdown(accessToken),
  ]);

  return {
    user_id: userId,
    work_stats: workStats,
    social_stats: MOCK_SOCIAL_STATS,
    earnings_chart: earningsChart.length > 0 ? earningsChart : FALLBACK_EARNINGS_CHART,
    hours_breakdown: hoursBreakdown.length > 0 ? hoursBreakdown : FALLBACK_HOURS_BREAKDOWN,
    network_feed: MOCK_NETWORK_FEED,
    job_opportunities: MOCK_JOB_OPPORTUNITIES,
    recent_connections: MOCK_RECENT_CONNECTIONS,
    messages: MOCK_MESSAGES,
    insights: generateInsights(workStats),
    quick_actions: generateQuickActions(workStats),
  };
}