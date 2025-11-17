// ============================================================================
// InvitationInbox - Display and manage pending contract invitations
// ============================================================================

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Mail, 
  Check, 
  X, 
  ChevronDown,
  ChevronUp,
  Clock,
  Building2,
  DollarSign,
  FileText,
} from 'lucide-react';
import type { ContractInvitation } from '../../types/project-contracts';
import { formatDistanceToNow } from 'date-fns';

interface InvitationInboxProps {
  invitations: ContractInvitation[];
  onAccept: (invitationId: string) => Promise<void>;
  onDecline: (invitationId: string) => Promise<void>;
}

export function InvitationInbox({
  invitations,
  onAccept,
  onDecline,
}: InvitationInboxProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (invitationId: string) => {
    setProcessingId(invitationId);
    try {
      await onAccept(invitationId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessingId(invitationId);
    try {
      await onDecline(invitationId);
    } finally {
      setProcessingId(null);
    }
  };

  if (invitations.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-100">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Pending Invitations</h3>
            <p className="text-sm text-blue-700">
              {invitations.length} invitation{invitations.length !== 1 ? 's' : ''} waiting for your response
            </p>
          </div>
          <Badge className="bg-blue-600 text-white">
            {invitations.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {invitations.map((invitation) => (
          <InvitationCard
            key={invitation.id}
            invitation={invitation}
            expanded={expandedId === invitation.id}
            processing={processingId === invitation.id}
            onToggle={() => setExpandedId(expandedId === invitation.id ? null : invitation.id)}
            onAccept={() => handleAccept(invitation.id)}
            onDecline={() => handleDecline(invitation.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Individual Invitation Card
// ============================================================================

interface InvitationCardProps {
  invitation: ContractInvitation;
  expanded: boolean;
  processing: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

function InvitationCard({
  invitation,
  expanded,
  processing,
  onToggle,
  onAccept,
  onDecline,
}: InvitationCardProps) {
  const fromOrg = invitation.from_org_name;
  const toOrg = invitation.to_org_name;

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={onToggle}
        disabled={processing}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            {invitation.from_org_logo ? (
              <span className="text-xl">{invitation.from_org_logo}</span>
            ) : (
              <Building2 className="w-5 h-5 text-blue-600" />
            )}
          </div>

          <div className="flex-1">
            <p className="font-medium">
              {fromOrg}
              <span className="text-gray-500 mx-2">→</span>
              {toOrg}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-500">
                {invitation.project_name}
              </p>
              <Badge variant="outline" className="text-xs">
                {invitation.contract_type.toUpperCase()}
              </Badge>
              {invitation.rate && (
                <span className="text-sm text-gray-600">
                  ${invitation.rate}/hr
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            {formatDistanceToNow(new Date(invitation.invited_at), { addSuffix: true })}
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 ml-2" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 ml-2" />
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="p-4 border-t bg-gray-50">
          <div className="space-y-3">
            {/* Contract Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Contract Type</p>
                  <p className="font-medium capitalize">
                    {invitation.contract_type.replace('_', ' ')}
                  </p>
                </div>
              </div>

              {invitation.rate && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Rate</p>
                    <p className="font-medium">
                      {invitation.currency} ${invitation.rate.toFixed(2)}/hr
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">From</p>
                  <p className="font-medium">{fromOrg}</p>
                </div>
              </div>

              {invitation.invited_by_name && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Invited By</p>
                    <p className="font-medium">{invitation.invited_by_name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>What happens when you accept:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                <li>This contract will become active</li>
                <li>You'll be able to assign workers to this project</li>
                <li>Timesheets can be submitted under this contract</li>
                <li>The project will appear in your dashboard</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={onAccept}
                disabled={processing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {processing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>
              <Button
                onClick={onDecline}
                disabled={processing}
                variant="outline"
                className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" />
                Decline
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Empty State for No Invitations
// ============================================================================

export function InvitationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <Mail className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">No pending invitations</p>
    </div>
  );
}
