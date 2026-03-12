// ============================================================================
// DashboardPage - Clean, polished dashboard
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  DollarSign,
  Clock,
  AlertCircle,
  FileText,
  Eye,
  Users,
  Award,
  TrendingUp,
  Briefcase,
  CheckCircle,
  MessageSquare,
  Loader2,
  ArrowRight,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { StatCard } from './StatCard';
import { EarningsChart } from './EarningsChart';
import { NetworkFeed } from './NetworkFeed';
import { JobOpportunitiesCard } from './JobOpportunitiesCard';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { getDashboardData } from '../../utils/api/dashboard';
import type { DashboardData, RecentConnection, MessagePreview, Insight } from '../../types/dashboard';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || "user-123";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [userId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const dashboardData = await getDashboardData(userId);
      setData(dashboardData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err instanceof Error ? err : new Error('Failed to load'));
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (route: string) => {
    navigate(route);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Failed to load dashboard</p>
          <p className="text-xs text-muted-foreground mb-4">Please try again or check your connection.</p>
          <Button onClick={loadDashboard} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { work_stats, social_stats } = data;
  const firstName = user?.name ? user.name.split(' ')[0] : '';

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground m-0">
            {firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Here's your overview for this month.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-sm"
            onClick={() => handleNavigate('/app/feed')}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Browse Jobs
          </Button>
          <Button
            size="sm"
            className="h-9 gap-2 text-sm"
            onClick={() => handleNavigate('/app/approvals')}
          >
            <Clock className="w-3.5 h-3.5" />
            Submit Timesheet
          </Button>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Earnings"
          value={`$${work_stats.earnings.current_period.toLocaleString()}`}
          subtitle={`vs $${work_stats.earnings.previous_period.toLocaleString()} last month`}
          trend={work_stats.earnings.trend}
          icon={<DollarSign className="w-4 h-4" />}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          onClick={() => handleNavigate('/app/approvals')}
        />
        <StatCard
          title="Hours Logged"
          value={work_stats.hours.total}
          subtitle={`${((work_stats.hours.billable / work_stats.hours.total) * 100).toFixed(0)}% billable`}
          icon={<Clock className="w-4 h-4" />}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Pending Approvals"
          value={work_stats.pending_approvals.count}
          subtitle={`Worth $${work_stats.pending_approvals.total_value.toLocaleString()}`}
          icon={<AlertCircle className="w-4 h-4" />}
          color="text-amber-600"
          bgColor="bg-amber-50"
          onClick={() => handleNavigate('/app/approvals')}
        />
        <StatCard
          title="Active Contracts"
          value={work_stats.active_contracts.count}
          subtitle={
            work_stats.active_contracts.expiring_soon > 0
              ? `${work_stats.active_contracts.expiring_soon} expiring soon`
              : 'All current'
          }
          icon={<FileText className="w-4 h-4" />}
          color="text-violet-600"
          bgColor="bg-violet-50"
          onClick={() => handleNavigate('/app/contracts')}
        />
      </div>

      {/* Main Content - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chart + Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <EarningsChart data={data.earnings_chart} />

          {/* Quick Actions row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.quick_actions.map((action) => (
              <button
                key={action.id}
                className="relative flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border/60 bg-card hover:bg-accent/40 hover:border-border transition-all duration-150 cursor-pointer group"
                onClick={() => handleNavigate(action.route)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getActionBg(action.icon)} transition-transform group-hover:scale-105`}>
                  {getIconComponent(action.icon, getActionColor(action.icon))}
                </div>
                <span className="text-xs font-medium text-foreground">{action.label}</span>
                {action.badge_count && action.badge_count > 0 && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-destructive text-white text-[10px] font-semibold flex items-center justify-center">
                    {action.badge_count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Network Feed */}
          <NetworkFeed items={data.network_feed} />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3">
              <h3 className="text-sm font-semibold text-foreground">Your Profile</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <ProfileStat
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Profile views"
                value={social_stats.profile_views.this_week}
                sub={`+${social_stats.profile_views.trend.toFixed(0)}%`}
                subColor="text-emerald-600"
              />
              <ProfileStat
                icon={<Users className="w-3.5 h-3.5" />}
                label="Connections"
                value={social_stats.connections.total}
                sub={`+${social_stats.connections.new_this_week} this week`}
              />
              <ProfileStat
                icon={<Award className="w-3.5 h-3.5" />}
                label="Endorsements"
                value={social_stats.endorsements.total}
                sub={`+${social_stats.endorsements.new_this_week} new`}
              />

              {/* Network Strength */}
              <div className="pt-3 border-t border-border/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground">Network Strength</span>
                  <Badge variant="secondary" className="text-[10px] capitalize">{social_stats.network_strength.level}</Badge>
                </div>
                <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-accent-brand to-violet-500 transition-all duration-700"
                    style={{ width: `${social_stats.network_strength.score}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {social_stats.network_strength.score}% — {social_stats.network_strength.next_level_at - social_stats.network_strength.score}pts to next level
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">Insights</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {data.insights.slice(0, 3).map((insight) => (
                <InsightItem
                  key={insight.id}
                  insight={insight}
                  onAction={() => insight.action_url && handleNavigate(insight.action_url)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Recent Connections */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <h3 className="text-sm font-semibold text-foreground">Recent Connections</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {data.recent_connections.map((connection) => (
                <ConnectionItem key={connection.id} connection={connection} />
              ))}
            </CardContent>
          </Card>

          {/* Job Opportunities */}
          <JobOpportunitiesCard
            opportunities={data.job_opportunities}
            onViewAll={() => handleNavigate('/app/feed')}
          />

          {/* Messages */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Messages</h3>
                {data.messages.filter((m) => m.unread).length > 0 && (
                  <Badge className="text-[10px] bg-accent-brand text-white px-1.5 py-0">
                    {data.messages.filter((m) => m.unread).length} new
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {data.messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ProfileStat({
  icon,
  label,
  value,
  sub,
  subColor = 'text-muted-foreground',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  subColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-right flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{value}</span>
        <span className={`text-[11px] ${subColor}`}>{sub}</span>
      </div>
    </div>
  );
}

function InsightItem({
  insight,
  onAction,
}: {
  insight: Insight;
  onAction?: () => void;
}) {
  return (
    <button
      className="flex gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors w-full text-left cursor-pointer border-0 bg-transparent"
      onClick={onAction}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getInsightBg(insight.type)}`}>
        {getIconComponent(insight.icon, getInsightColor(insight.type))}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-xs text-foreground">{insight.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{insight.description}</p>
      </div>
      {insight.action_url && (
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
      )}
    </button>
  );
}

function ConnectionItem({ connection }: { connection: RecentConnection }) {
  const navigate = useNavigate();
  return (
    <div
      className="flex gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/app/profile/${connection.id}`)}
    >
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarImage src={connection.avatar} alt={connection.name} />
        <AvatarFallback className="text-[10px]">{connection.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-xs text-foreground">{connection.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{connection.headline}</p>
        {connection.mutual_connections && connection.mutual_connections > 0 && (
          <p className="text-[10px] text-muted-foreground/60">
            {connection.mutual_connections} mutual connections
          </p>
        )}
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: MessagePreview }) {
  const timeAgo = formatDistanceToNow(new Date(message.created_at), { addSuffix: true });

  return (
    <div
      className={`flex gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer ${
        message.unread ? 'bg-accent-brand/5' : ''
      }`}
    >
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarImage src={message.sender_avatar} alt={message.sender_name} />
        <AvatarFallback className="text-[10px]">{message.sender_name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs ${message.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
            {message.sender_name}
          </p>
          {message.unread && (
            <div className="w-1.5 h-1.5 rounded-full bg-accent-brand flex-shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{message.preview}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Icon / Color Helpers
// ============================================================================

function getActionBg(iconName: string): string {
  const map: Record<string, string> = {
    Clock: 'bg-blue-50',
    Briefcase: 'bg-violet-50',
    CheckCircle: 'bg-emerald-50',
    FileText: 'bg-amber-50',
  };
  return map[iconName] || 'bg-muted/50';
}

function getActionColor(iconName: string): string {
  const map: Record<string, string> = {
    Clock: 'text-blue-600',
    Briefcase: 'text-violet-600',
    CheckCircle: 'text-emerald-600',
    FileText: 'text-amber-600',
  };
  return map[iconName] || 'text-foreground';
}

function getInsightBg(type: string): string {
  const map: Record<string, string> = {
    earning: 'bg-emerald-50',
    opportunity: 'bg-blue-50',
    network: 'bg-violet-50',
    milestone: 'bg-amber-50',
    tip: 'bg-sky-50',
  };
  return map[type] || 'bg-muted/50';
}

function getInsightColor(type: string): string {
  const map: Record<string, string> = {
    earning: 'text-emerald-600',
    opportunity: 'text-blue-600',
    network: 'text-violet-600',
    milestone: 'text-amber-600',
    tip: 'text-sky-600',
  };
  return map[type] || 'text-foreground';
}

function getIconComponent(iconName: string, colorClass: string = '') {
  const icons: Record<string, React.ReactNode> = {
    Clock: <Clock className={`w-4 h-4 ${colorClass}`} />,
    Briefcase: <Briefcase className={`w-4 h-4 ${colorClass}`} />,
    CheckCircle: <CheckCircle className={`w-4 h-4 ${colorClass}`} />,
    FileText: <FileText className={`w-4 h-4 ${colorClass}`} />,
    TrendingUp: <TrendingUp className={`w-4 h-4 ${colorClass}`} />,
    Eye: <Eye className={`w-4 h-4 ${colorClass}`} />,
    AlertCircle: <AlertCircle className={`w-4 h-4 ${colorClass}`} />,
    MessageSquare: <MessageSquare className={`w-4 h-4 ${colorClass}`} />,
  };
  return icons[iconName] || <TrendingUp className={`w-4 h-4 ${colorClass}`} />;
}