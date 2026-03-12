// ============================================================================
// JobOpportunitiesCard - Clean job listings
// ============================================================================

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MapPin,
  DollarSign,
  Users,
  ExternalLink,
  Network,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { JobOpportunity } from '../../types/dashboard';

interface JobOpportunitiesCardProps {
  opportunities: JobOpportunity[];
  onViewAll?: () => void;
}

export function JobOpportunitiesCard({
  opportunities,
  onViewAll,
}: JobOpportunitiesCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Job Opportunities</h3>
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-[11px] text-muted-foreground hover:text-foreground h-7 px-2">
              View all
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {opportunities.slice(0, 3).map((job) => (
          <JobItem key={job.id} job={job} />
        ))}
      </CardContent>
    </Card>
  );
}

function JobItem({ job }: { job: JobOpportunity }) {
  return (
    <div className="p-2.5 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer">
      <div className="flex gap-3">
        {job.company_logo && (
          <div className="w-8 h-8 flex-shrink-0 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
            <img
              src={job.company_logo}
              alt={job.company_name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h4 className="font-medium text-xs text-foreground leading-tight">{job.title}</h4>
            {job.in_your_network && (
              <Badge variant="secondary" className="flex items-center gap-0.5 text-[9px] px-1 py-0 h-4 flex-shrink-0">
                <Network className="w-2.5 h-2.5" />
                In network
              </Badge>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground mb-1.5">{job.company_name}</p>

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {job.remote && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                Remote
              </span>
            )}
            {job.rate_min && job.rate_max && (
              <span className="flex items-center gap-0.5">
                <DollarSign className="w-2.5 h-2.5" />
                ${job.rate_min}-${job.rate_max}/hr
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Users className="w-2.5 h-2.5" />
              {job.applicants_count} applicants
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
