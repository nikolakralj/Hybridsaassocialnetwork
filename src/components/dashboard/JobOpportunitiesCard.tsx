// ============================================================================
// JobOpportunitiesCard - Apple-minimalistic job display
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
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Job Opportunities</h3>
            <p className="text-xs text-muted-foreground mt-1">Matches in your network</p>
          </div>
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs text-muted-foreground hover:text-foreground">
              View all
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/60">
          {opportunities.slice(0, 3).map((job) => (
            <JobItem key={job.id} job={job} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function JobItem({ job }: { job: JobOpportunity }) {
  const timeAgo = formatDistanceToNow(new Date(job.posted_at), {
    addSuffix: true,
  });

  return (
    <div className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
      <div className="flex gap-3">
        {job.company_logo && (
          <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
            <img
              src={job.company_logo}
              alt={job.company_name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-medium text-sm text-foreground">{job.title}</h4>
            {job.in_your_network && (
              <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
                <Network className="w-3 h-3" />
                Network
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-2">{job.company_name}</p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-2">
            {job.remote && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Remote
              </span>
            )}
            {job.rate_min && job.rate_max && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                ${job.rate_min}-${job.rate_max}/hr
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {job.applicants_count} applicants
            </span>
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {job.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="outline" className="text-[10px] border-border/60">
                {skill}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground/70">Posted {timeAgo}</p>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs text-accent-brand">
              View details &rarr;
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
