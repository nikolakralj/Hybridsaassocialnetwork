// ============================================================================
// DashboardPage - Hybrid SaaS + Social Dashboard
// ============================================================================

import React, { useEffect, useState } from 'react';
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

interface DashboardPageProps {
  userId: string;
  onNavigate?: (route: string) => void;
}

export function DashboardPage({ userId, onNavigate }: DashboardPageProps) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load dashboard</p>
          <Button onClick={loadDashboard} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { work_stats, social_stats } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's what's happening.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Briefcase className="w-4 h-4 mr-2" />
              Browse Jobs
            </Button>
            <Button>
              <Clock className="w-4 h-4 mr-2" />
              Submit Timesheet
            </Button>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Earnings This Month"
            value={`$${work_stats.earnings.current_period.toLocaleString()}`}
            subtitle={`vs $${work_stats.earnings.previous_period.toLocaleString()} last month`}
            trend={work_stats.earnings.trend}
            icon={<DollarSign className="w-6 h-6" />}
            color="text-green-600"
            onClick={() => onNavigate?.('#/approvals')}
          />
          <StatCard
            title="Hours This Month"
            value={work_stats.hours.total}
            subtitle={`${((work_stats.hours.billable / work_stats.hours.total) * 100).toFixed(0)}% billable`}
            icon={<Clock className="w-6 h-6" />}
            color="text-blue-600"
          />
          <StatCard
            title="Pending Approvals"
            value={work_stats.pending_approvals.count}
            subtitle={`Worth $${work_stats.pending_approvals.total_value.toLocaleString()}`}
            icon={<AlertCircle className="w-6 h-6" />}
            color="text-amber-600"
            onClick={() => onNavigate?.('#/approvals')}
          />
          <StatCard
            title="Active Contracts"
            value={work_stats.active_contracts.count}
            subtitle={
              work_stats.active_contracts.expiring_soon > 0
                ? `${work_stats.active_contracts.expiring_soon} expiring soon`
                : 'All current'
            }
            icon={<FileText className="w-6 h-6" />}
            color="text-purple-600"
            onClick={() => onNavigate?.('#/contracts')}
          />
        </div>

        {/* Main Content Grid - 3 Columns */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Work Stats (4 cols) */}
          <div className="col-span-4 space-y-6">
            {/* Earnings Chart */}
            <EarningsChart data={data.earnings_chart} />

            {/* Quick Actions */}
            <Card>
              <CardHeader className="border-b">
                <h3 className="font-semibold">Quick Actions</h3>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {data.quick_actions.map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-2"
                      onClick={() => onNavigate?.(action.route)}
                    >
                      <div className={`p-2 rounded-lg ${action.color} bg-opacity-10`}>
                        {getIconComponent(action.icon)}
                      </div>
                      <span className="text-sm font-medium">{action.label}</span>
                      {action.badge_count && action.badge_count > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {action.badge_count}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Insights */}
            <Card>
              <CardHeader className="border-b">
                <h3 className="font-semibold">Insights</h3>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {data.insights.map((insight) => (
                    <InsightItem
                      key={insight.id}
                      insight={insight}
                      onAction={() => insight.action_url && onNavigate?.(insight.action_url)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Network Feed (5 cols) */}
          <div className="col-span-5 space-y-6">
            <NetworkFeed items={data.network_feed} />
            
            {/* Job Opportunities */}
            <JobOpportunitiesCard
              opportunities={data.job_opportunities}
              onViewAll={() => onNavigate?.('#/opportunities')}
            />
          </div>

          {/* Right Column - Social Stats (3 cols) */}
          <div className="col-span-3 space-y-6">
            {/* Profile Stats */}
            <Card>
              <CardHeader className="border-b">
                <h3 className="font-semibold">Your Profile</h3>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Profile views</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{social_stats.profile_views.this_week}</p>
                    <p className="text-xs text-green-600">+{social_stats.profile_views.trend.toFixed(0)}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Connections</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{social_stats.connections.total}</p>
                    <p className="text-xs text-gray-500">
                      +{social_stats.connections.new_this_week} this week
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Endorsements</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{social_stats.endorsements.total}</p>
                    <p className="text-xs text-gray-500">
                      +{social_stats.endorsements.new_this_week} new
                    </p>
                  </div>
                </div>

                {/* Network Strength */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Network Strength</span>
                    <Badge variant="secondary">{social_stats.network_strength.level}</Badge>
                  </div>
                  <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{ width: `${social_stats.network_strength.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {social_stats.network_strength.score}% to {social_stats.network_strength.level}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Connections */}
            <Card>
              <CardHeader className="border-b">
                <h3 className="font-semibold">Recent Connections</h3>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {data.recent_connections.map((connection) => (
                    <ConnectionItem key={connection.id} connection={connection} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Messages</h3>
                  <Badge variant="secondary">
                    {data.messages.filter((m) => m.unread).length} new
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {data.messages.map((message) => (
                    <MessageItem key={message.id} message={message} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
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
    <div className="flex gap-3 p-3 rounded-lg bg-gray-50">
      <div className={`p-2 rounded-lg bg-white ${insight.color}`}>
        {IconComponent}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900">{insight.title}</p>
        <p className="text-xs text-gray-600 mt-0.5">{insight.description}</p>
        {insight.action_label && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs mt-1"
            onClick={onAction}
          >
            {insight.action_label} →
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
    <div className="p-3 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className="flex gap-3">
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={connection.avatar} alt={connection.name} />
          <AvatarFallback>{connection.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900">{connection.name}</p>
          <p className="text-xs text-gray-600 truncate">{connection.headline}</p>
          {connection.mutual_connections && connection.mutual_connections > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
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
      className={`p-3 hover:bg-gray-50 transition-colors cursor-pointer ${
        message.unread ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex gap-3">
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={message.sender_avatar} alt={message.sender_name} />
          <AvatarFallback>{message.sender_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className={`text-sm ${message.unread ? 'font-semibold' : 'font-medium'}`}>
              {message.sender_name}
            </p>
            {message.unread && (
              <div className="w-2 h-2 rounded-full bg-blue-600" />
            )}
          </div>
          <p className="text-xs text-gray-600 truncate">{message.preview}</p>
          <p className="text-xs text-gray-400 mt-0.5">{timeAgo}</p>
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
    Clock: <Clock className="w-5 h-5" />,
    Briefcase: <Briefcase className="w-5 h-5" />,
    CheckCircle: <CheckCircle className="w-5 h-5" />,
    FileText: <FileText className="w-5 h-5" />,
    TrendingUp: <TrendingUp className="w-5 h-5" />,
    Eye: <Eye className="w-5 h-5" />,
    AlertCircle: <AlertCircle className="w-5 h-5" />,
    MessageSquare: <MessageSquare className="w-5 h-5" />,
  };

  return icons[iconName] || <TrendingUp className="w-5 h-5" />;
}
