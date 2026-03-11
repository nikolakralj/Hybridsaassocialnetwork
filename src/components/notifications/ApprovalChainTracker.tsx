/**
 * ApprovalChainTracker — Visual tree showing multi-party approval progress
 *
 * Renders the progressive approval chain:
 *   ✅ Approved by Acme Dev Studio — 2h ago
 *   ⏳ Pending with TechCorp (Client)
 *   ⏺ Awaiting BigClient LLC
 *
 * Phase 5 Day 8: Progressive Notification System
 */

import React from 'react';
import {
  CheckCircle2, Clock, Circle, XCircle, Send,
  Building2, Users, Briefcase, ArrowRight,
  ChevronRight, PartyPopper,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { ApprovalChain, ApprovalStep, ApprovalStepStatus } from '../../contexts/NotificationContext';

// ============================================================================
// Status config
// ============================================================================

const STEP_CONFIG: Record<ApprovalStepStatus, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  label: string;
  lineColor: string;
}> = {
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: 'Approved',
    lineColor: 'bg-emerald-400',
  },
  pending: {
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Pending',
    lineColor: 'bg-blue-300',
  },
  awaiting: {
    icon: Circle,
    color: 'text-slate-400',
    bgColor: 'bg-slate-100',
    label: 'Awaiting',
    lineColor: 'bg-slate-200',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Rejected',
    lineColor: 'bg-red-400',
  },
};

const PARTY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  company: Building2,
  agency: Users,
  client: Briefcase,
};

// ============================================================================
// Main Component
// ============================================================================

interface ApprovalChainTrackerProps {
  chain: ApprovalChain;
  compact?: boolean;
  className?: string;
}

export function ApprovalChainTracker({ chain, compact = false, className = '' }: ApprovalChainTrackerProps) {
  const isFullyApproved = chain.overallStatus === 'fully_approved';
  const isRejected = chain.overallStatus === 'rejected';
  const completedCount = chain.steps.filter(s => s.status === 'completed').length;
  const progressPct = chain.steps.length > 0 ? (completedCount / chain.steps.length) * 100 : 0;

  if (compact) {
    return (
      <CompactChain chain={chain} className={className} />
    );
  }

  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${
        isFullyApproved ? 'bg-gradient-to-r from-emerald-50 to-white' :
        isRejected ? 'bg-gradient-to-r from-red-50 to-white' :
        'bg-gradient-to-r from-blue-50 to-white'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isFullyApproved ? (
              <PartyPopper className="h-4 w-4 text-emerald-600" />
            ) : isRejected ? (
              <XCircle className="h-4 w-4 text-red-600" />
            ) : (
              <Send className="h-4 w-4 text-blue-600" />
            )}
            <div>
              <div className="text-sm font-semibold">{chain.weekLabel}</div>
              <div className="text-[10px] text-muted-foreground">
                {chain.personName} · {chain.totalHours}h
              </div>
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] ${
            isFullyApproved ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
            isRejected ? 'text-red-600 bg-red-50 border-red-200' :
            'text-blue-600 bg-blue-50 border-blue-200'
          }`}>
            {isFullyApproved ? 'Fully Approved' :
             isRejected ? 'Rejected' :
             `${completedCount}/${chain.steps.length} approved`}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isRejected ? 'bg-red-400' : isFullyApproved ? 'bg-emerald-400' : 'bg-blue-400'
            }`}
            style={{ width: `${isRejected ? 100 : progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps tree */}
      <div className="px-4 py-3">
        {chain.steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            isLast={i === chain.steps.length - 1}
            isFirst={i === 0}
          />
        ))}
      </div>

      {/* Footer message */}
      {isFullyApproved && (
        <div className="px-4 py-2.5 border-t bg-emerald-50/50">
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
            <PartyPopper className="h-3.5 w-3.5" />
            Ready to invoice — all parties have approved
          </div>
        </div>
      )}
      {isRejected && (
        <div className="px-4 py-2.5 border-t bg-red-50/50">
          <div className="flex items-center gap-2 text-xs text-red-700 font-medium">
            <XCircle className="h-3.5 w-3.5" />
            Action needed — please review and resubmit
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step Row
// ============================================================================

function StepRow({ step, isLast, isFirst }: {
  step: ApprovalStep;
  isLast: boolean;
  isFirst: boolean;
}) {
  const config = STEP_CONFIG[step.status];
  const Icon = config.icon;
  const PartyIcon = PARTY_ICON[step.partyType] || Building2;

  return (
    <div className="flex gap-3 relative">
      {/* Vertical line connector */}
      <div className="flex flex-col items-center w-5 flex-shrink-0">
        <div className={`w-5 h-5 rounded-full ${config.bgColor} flex items-center justify-center z-10`}>
          <Icon className={`h-3 w-3 ${config.color}`} />
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 ${config.lineColor} mt-0.5`} />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-4 ${isLast ? 'pb-0' : ''}`}>
        <div className="flex items-center gap-2">
          <PartyIcon className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-semibold">{step.partyName}</span>
          <Badge variant="outline" className={`text-[8px] h-4 ${
            step.status === 'completed' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' :
            step.status === 'pending' ? 'text-blue-600 border-blue-200 bg-blue-50 animate-pulse' :
            step.status === 'rejected' ? 'text-red-600 border-red-200 bg-red-50' :
            'text-slate-400 border-slate-200'
          }`}>
            {config.label}
          </Badge>
        </div>
        {step.decidedBy && step.decidedAt && (
          <div className="text-[10px] text-muted-foreground mt-0.5 ml-5">
            by {step.decidedBy} · {formatDistanceToNow(new Date(step.decidedAt), { addSuffix: true })}
          </div>
        )}
        {step.note && (
          <div className="text-[10px] text-red-500 mt-1 ml-5 italic">
            "{step.note}"
          </div>
        )}
        {step.status === 'pending' && (
          <div className="text-[10px] text-blue-500 mt-0.5 ml-5">
            Waiting for decision...
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Compact variant (for inline display in week rows)
// ============================================================================

function CompactChain({ chain, className }: { chain: ApprovalChain; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {chain.steps.map((step, i) => {
        const config = STEP_CONFIG[step.status];
        const Icon = config.icon;
        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-1" title={`${step.partyName}: ${config.label}`}>
              <Icon className={`h-3 w-3 ${config.color}`} />
              <span className="text-[9px] font-medium text-muted-foreground hidden sm:inline">
                {step.partyName.split(' ')[0]}
              </span>
            </div>
            {i < chain.steps.length - 1 && (
              <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================================
// Empty state (for when no chain exists — draft timesheets)
// ============================================================================

export function ApprovalChainEmpty({ personName }: { personName: string }) {
  return (
    <div className="rounded-xl border border-dashed p-4 text-center">
      <Circle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
      <div className="text-xs font-medium text-muted-foreground">No approval chain active</div>
      <div className="text-[10px] text-muted-foreground mt-1">
        Submit the timesheet to start the approval flow
      </div>
    </div>
  );
}
