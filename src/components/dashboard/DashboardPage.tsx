// ============================================================================
// DashboardPage - Apple-Minimalistic Dashboard
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
    const cleanRoute = route.replace('#/', '/app/');
    navigate(cleanRoute);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <p className="text-destructive text-sm">Failed to load dashboard</p>
          <Button onClick={loadDashboard} variant="outline" size="sm" className="mt-3">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { work_stats, social_stats } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Here's what's happening.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full h-9 gap-2">
            <Briefcase className="w-4 h-4" />
            Browse Jobs
          </Button>
          <Button size="sm" className="rounded-full h-9 gap-2 bg-foreground text-background hover:bg-foreground/90">
            <Clock className="w-4 h-4" />
            Submit Timesheet
          </Button>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Earnings This Month"
          value={`$${work_stats.earnings.current_period.toLocaleString()}`}
          subtitle={`vs $${work_stats.earnings.previous_period.toLocaleString()} last month`}
          trend={work_stats.earnings.trend}
          icon={<DollarSign className="w-5 h-5" />}
          color="text-emerald-600"
          onClick={() => handleNavigate('#/approvals')}
        />
        <StatCard
          title="Hours This Month"
          value={work_stats.hours.total}
          subtitle={`${((work_stats.hours.billable / work_stats.hours.total) * 100).toFixed(0)}% billable`}
          icon={<Clock className="w-5 h-5" />}
          color="text-accent-brand"
        />
        <StatCard
          title="Pending Approvals"
          value={work_stats.pending_approvals.count}
          subtitle={`Worth $${work_stats.pending_approvals.total_value.toLocaleString()}`}
          icon={<AlertCircle className="w-5 h-5" />}
          color="text-amber-500"
          onClick={() => handleNavigate('#/approvals')}
        />
        <StatCard
          title="Active Contracts"
          value={work_stats.active_contracts.count}
          subtitle={
            work_stats.active_contracts.expiring_soon > 0
              ? `${work_stats.active_contracts.expiring_soon} expiring soon`
              : 'All current'
          }
          icon={<FileText className="w-5 h-5" />}
          color="text-violet-500"
          onClick={() => handleNavigate('#/contracts')}
        />
      </div>

      {/* Main Content Grid - 3 Columns */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <EarningsChart data={data.earnings_chart} />

          {/* Quick Actions */}
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-2">
                {data.quick_actions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-2 border-border/60 hover:bg-background/80"
                    onClick={() => handleNavigate(action.route)}
                  >
                    <div className={`p-2 rounded-lg bg-muted/50 ${action.color}`}>
                      {getIconComponent(action.icon)}
                    </div>
                    <span className="text-xs font-medium text-foreground">{action.label}</span>
                    {action.badge_count && action.badge_count > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {action.badge_count}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground">Insights</h3>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {data.insights.map((insight) => (
                  <InsightItem
                    key={insight.id}
                    insight={insight}
                    onAction={() => insight.action_url && handleNavigate(insight.action_url)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center Column */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <NetworkFeed items={data.network_feed} />
          <JobOpportunitiesCard
            opportunities={data.job_opportunities}
            onViewAll={() => handleNavigate('#/opportunities')}
          />
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          {/* Profile Stats */}
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground">Your Profile</h3>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Profile views</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground text-sm">{social_stats.profile_views.this_week}</p>
                  <p className="text-xs text-emerald-600">+{social_stats.profile_views.trend.toFixed(0)}%</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Connections</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground text-sm">{social_stats.connections.total}</p>
                  <p className="text-xs text-muted-foreground">
                    +{social_stats.connections.new_this_week} this week
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Endorsements</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground text-sm">{social_stats.endorsements.total}</p>
                  <p className="text-xs text-muted-foreground">
                    +{social_stats.endorsements.new_this_week} new
                  </p>
                </div>
              </div>

              {/* Network Strength */}
              <div className="pt-3 border-t border-border/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Network Strength</span>
                  <Badge variant="secondary" className="text-xs">{social_stats.network_strength.level}</Badge>
                </div>
                <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-accent-brand to-violet-500"
                    style={{ width: `${social_stats.network_strength.score}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {social_stats.network_strength.score}% to {social_stats.network_strength.level}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Connections */}
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground">Recent Connections</h3>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {data.recent_connections.map((connection) => (
                  <ConnectionItem key={connection.id} connection={connection} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Messages</h3>
                <Badge variant="secondary" className="text-xs">
                  {data.messages.filter((m) => m.unread).length} new
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {data.messages.map((message) => (
                  <MessageItem key={message.id} message={message} />
                ))}
              </div>
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

function InsightItem({
  insight,
  onAction,
}: {
  insight: Insight;
  onAction?: () => void;
}) {
  const IconComponent = getIconComponent(insight.icon);

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-muted/40">
      <div className={`p-2 rounded-lg bg-card ${insight.color}`}>
        {IconComponent}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground">{insight.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
        {insight.action_label && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs mt-1 text-accent-brand"
            onClick={onAction}
          >
            {insight.action_label} &rarr;
          </Button>
        )}
      </div>
    </div>
  );
}

function ConnectionItem({ connection }: { connection: RecentConnection }) {
  const timeAgo = formatDistanceToNow(new Date(connection.connected_at), {
    addSuffix: true,
  });

  return (
    <div className="p-3 hover:bg-muted/40 transition-colors cursor-pointer">
      <div className="flex gap-3">
        <Avatar className="w-9 h-9 flex-shrink-0">
          <AvatarImage src={connection.avatar} alt={connection.name} />
          <AvatarFallback className="text-xs">{connection.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{connection.name}</p>
          <p className="text-xs text-muted-foreground truncate">{connection.headline}</p>
          {connection.mutual_connections && connection.mutual_connections > 0 && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {connection.mutual_connections} mutual connections
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: MessagePreview }) {
  const timeAgo = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
  });

  return (
    <div
      className={`p-3 hover:bg-muted/40 transition-colors cursor-pointer ${
        message.unread ? 'bg-accent-brand/5' : ''
      }`}
    >
      <div className="flex gap-3">
        <Avatar className="w-9 h-9 flex-shrink-0">
          <AvatarImage src={message.sender_avatar} alt={message.sender_name} />
          <AvatarFallback className="text-xs">{message.sender_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className={`text-sm ${message.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
              {message.sender_name}
            </p>
            {message.unread && (
              <div className="w-1.5 h-1.5 rounded-full bg-accent-brand" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{message.preview}</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{timeAgo}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Icon Helper
// ============================================================================

function getIconComponent(iconName: string) {
  const icons: Record<string, React.ReactNode> = {
    Clock: <Clock className="w-4 h-4" />,
    Briefcase: <Briefcase className="w-4 h-4" />,
    CheckCircle: <CheckCircle className="w-4 h-4" />,
    FileText: <FileText className="w-4 h-4" />,
    TrendingUp: <TrendingUp className="w-4 h-4" />,
    Eye: <Eye className="w-4 h-4" />,
    AlertCircle: <AlertCircle className="w-4 h-4" />,
    MessageSquare: <MessageSquare className="w-4 h-4" />,
  };

  return icons[iconName] || <TrendingUp className="w-4 h-4" />;
}