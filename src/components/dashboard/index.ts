// ============================================================================
// Dashboard Components - Exports
// ============================================================================

export { DashboardPage } from './DashboardPage';
export { StatCard } from './StatCard';
export { EarningsChart } from './EarningsChart';
export { NetworkFeed } from './NetworkFeed';
export { JobOpportunitiesCard } from './JobOpportunitiesCard';

// Re-export types for convenience
export type {
  DashboardData,
  WorkStats,
  SocialStats,
  FeedItem,
  JobOpportunity,
  EarningsDataPoint,
  HoursBreakdown,
} from '../../types/dashboard';
