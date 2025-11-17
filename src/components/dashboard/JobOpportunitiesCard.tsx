// ============================================================================
// JobOpportunitiesCard - Display job opportunities
// ============================================================================

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Briefcase,
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
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Job Opportunities</h3>
            <p className="text-sm text-gray-500 mt-1">Matches in your network</p>
          </div>
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              View all
              <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
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
    <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className="flex gap-3">
        {/* Company Logo */}
        {job.company_logo && (
          <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
            <img
              src={job.company_logo}
              alt={job.company_name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{job.title}</h4>
            {job.in_your_network && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Network className="w-3 h-3" />
                Network
              </Badge>
            )}
          </div>

          {/* Company */}
          <p className="text-sm text-gray-600 mb-2">{job.company_name}</p>

          {/* Details */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-2">
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

          {/* Skills */}
          <div className="flex flex-wrap gap-1 mb-2">
            {job.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Posted {timeAgo}</p>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs">
              View details →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
