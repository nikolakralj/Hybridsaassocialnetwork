import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Check, Clock, Loader2, Mail, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import type { StoredProjectInvitation } from '../../utils/api/projects-api';

interface ProjectInvitationsPanelProps {
  invitations: StoredProjectInvitation[];
  onAccept: (invitationId: string) => Promise<void>;
  onDecline: (invitationId: string) => Promise<void>;
}

export function ProjectInvitationsPanel({
  invitations,
  onAccept,
  onDecline,
}: ProjectInvitationsPanelProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function handleAction(invitationId: string, action: 'accept' | 'decline') {
    setProcessingId(invitationId);
    try {
      if (action === 'accept') {
        await onAccept(invitationId);
      } else {
        await onDecline(invitationId);
      }
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Card className="border-sky-200 bg-sky-50/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
            <Mail className="h-5 w-5 text-sky-700" />
          </div>
          <div className="flex-1">
            <h2 className="m-0 text-sm font-semibold text-sky-950">Pending project invites</h2>
            <p className="mt-1 text-xs text-sky-800">
              Accept an invite to add that project to your dashboard.
            </p>
          </div>
          <Badge className="bg-sky-700 text-white">{invitations.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation) => {
          const processing = processingId === invitation.id;
          return (
            <div
              key={invitation.id}
              className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="m-0 text-sm font-medium text-foreground">{invitation.projectName || 'Project invite'}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {invitation.role}
                    </Badge>
                  </div>
                  <p className="m-0 text-xs text-muted-foreground">
                    Invited by {invitation.invitedByName || invitation.invitedBy}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDistanceToNow(new Date(invitation.invitedAt), { addSuffix: true })}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => handleAction(invitation.id, 'accept')}
                    disabled={processing}
                  >
                    {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleAction(invitation.id, 'decline')}
                    disabled={processing}
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
