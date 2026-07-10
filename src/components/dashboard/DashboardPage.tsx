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
  X,
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

// Social/network surface (feed, connections, messaging, job board) is a
// pre-product stub with no backend. Hidden until the WorkGraph billing loop
// ships and the social layer is built for real (see ROADMAP.md Phase 9).
// Set VITE_SHOW_SOCIAL_FEATURES=true to restore the social dashboard surface.
const SHOW_SOCIAL_FEATURES = import.meta.env.VITE_SHOW_SOCIAL_FEATURES === 'true';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const userId = user?.id || "user-123";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    return localStorage.getItem(`workgraph-launchpad-dismissed:${userId}`) === 'true';
  });

  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(`workgraph-launchpad-completed:${userId}`);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    loadDashboard();
  }, [userId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const dashboardData = await getDashboardData(userId, accessToken);
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

  const persona = user?.persona_type || 'freelancer';

  const defaultItems = {
    agency: [
      { id: 'agency-org', label: 'Create or join your agency organization', actionText: 'Setup Org', route: '/app/settings', autoDone: !!user?.organization_id },
      { id: 'agency-client', label: 'Add your first Client organization to the project graph', actionText: 'Add Client', route: '/app/projects', autoDone: work_stats.active_contracts.count > 0 },
      { id: 'agency-roles', label: 'Define billing contract roles on your project workspace', actionText: 'Define Roles', route: '/app/projects', autoDone: work_stats.active_contracts.count > 0 },
      { id: 'agency-invite', label: 'Invite your first Contractor to log hours', actionText: 'Invite Team', route: '/app/projects', autoDone: work_stats.active_contracts.count > 1 },
      { id: 'agency-invoice', label: 'Generate your first draft invoice from approved hours', actionText: 'Invoice Workspace', route: '/app/projects', autoDone: work_stats.earnings.current_period > 0 },
    ],
    company: [
      { id: 'company-profile', label: 'Set up your company profile and details', actionText: 'Profile Setup', route: '/app/company-profile', autoDone: !!user?.headline || !!user?.bio },
      { id: 'company-project', label: 'Create your first project and define requirements', actionText: 'New Project', route: '/app/projects', autoDone: work_stats.active_contracts.count > 0 },
      { id: 'company-approval', label: 'Configure timesheet approval chain pathways', actionText: 'Review Approvals', route: '/app/approvals', autoDone: work_stats.pending_approvals.count > 0 || work_stats.hours.total > 0 },
      { id: 'company-finance', label: 'Invite a manager or finance team member', actionText: 'Add Teammate', route: '/app/settings', autoDone: false },
    ],
    freelancer: [
      { id: 'free-profile', label: 'Complete your professional profile details', actionText: 'Update Profile', route: '/app/profile', autoDone: !!user?.headline || !!user?.bio || (user?.skills && user.skills.length > 0) },
      { id: 'free-project', label: 'Create or join your first project workspace', actionText: 'Open Projects', route: '/app/projects', autoDone: work_stats.active_contracts.count > 0 },
      { id: 'free-log', label: 'Log your hours for the current week', actionText: 'Enter Hours', route: '/app/approvals', autoDone: work_stats.hours.total > 0 },
      { id: 'free-submit', label: 'Submit your timesheet for review', actionText: 'Submit Week', route: '/app/approvals', autoDone: work_stats.pending_approvals.count > 0 },
    ],
  };

  const currentItems = defaultItems[persona] || defaultItems.freelancer;

  const completedCount = currentItems.filter(item => item.autoDone || !!completedItems[item.id]).length;
  const percentComplete = currentItems.length > 0 ? (completedCount / currentItems.length) * 100 : 0;

  const toggleItem = (itemId: string) => {
    setCompletedItems(prev => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      localStorage.setItem(`workgraph-launchpad-completed:${userId}`, JSON.stringify(next));
      return next;
    });
  };

  const handleDismiss = () => {
    setOnboardingDismissed(true);
    localStorage.setItem(`workgraph-launchpad-dismissed:${userId}`, 'true');
  };

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
          {SHOW_SOCIAL_FEATURES && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 text-sm"
              onClick={() => handleNavigate('/app/feed')}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Browse Jobs
            </Button>
          )}
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

      {/* Launch Checklist */}
      {!onboardingDismissed && (
        <Card className="border-border/60 overflow-hidden bg-gradient-to-br from-card to-accent/5 relative group/checklist shadow-sm transition-all duration-200">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground hover:bg-accent/40 w-7 h-7"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent-brand/10 flex items-center justify-center text-accent-brand">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground m-0 font-sans">WorkGraph Launch Pad</h3>
                <p className="text-xs text-muted-foreground m-0 mt-0.5">Complete these setup steps to activate your workflow.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Progress Section */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                <span className="text-muted-foreground">Setup Progress</span>
                <span className="text-foreground font-semibold">{Math.round(percentComplete)}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-accent-brand to-violet-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>

            {/* Checklist items */}
            <div className="grid md:grid-cols-2 gap-3 pt-2">
              {currentItems.map((item) => {
                const isChecked = item.autoDone || !!completedItems[item.id];
                return (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 hover:border-border transition-all duration-150 group/item"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <button 
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        disabled={item.autoDone}
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                          isChecked 
                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                            : 'border-muted-foreground/30 hover:border-accent-brand/80'
                        } ${item.autoDone ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                      >
                        {isChecked && <CheckCircle className="w-3.5 h-3.5 fill-white text-emerald-500" />}
                      </button>
                      <span className={`text-xs font-medium truncate ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.label}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2.5 text-[11px] font-medium text-accent-brand hover:text-accent-brand hover:bg-accent-brand/10 transition-colors"
                      onClick={() => handleNavigate(item.route)}
                    >
                      {item.actionText}
                      <ArrowRight className="w-3 h-3 ml-1 transition-transform group-hover/item:translate-x-0.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
          subtitle={work_stats.hours.total > 0
            ? `${((work_stats.hours.billable / work_stats.hours.total) * 100).toFixed(0)}% billable`
            : 'No hours logged yet'}
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

          {SHOW_SOCIAL_FEATURES && <NetworkFeed items={data.network_feed} />}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Profile Card */}
          {SHOW_SOCIAL_FEATURES && (
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
          )}

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
          {SHOW_SOCIAL_FEATURES && (
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
          )}

          {/* Job Opportunities */}
          {SHOW_SOCIAL_FEATURES && (
            <JobOpportunitiesCard
              opportunities={data.job_opportunities}
              onViewAll={() => handleNavigate('/app/feed')}
            />
          )}

          {/* Messages */}
          {SHOW_SOCIAL_FEATURES && (
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
          )}
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
    Sparkles: <Sparkles className={`w-4 h-4 ${colorClass}`} />,
  };
  return icons[iconName] || <TrendingUp className={`w-4 h-4 ${colorClass}`} />;
}
