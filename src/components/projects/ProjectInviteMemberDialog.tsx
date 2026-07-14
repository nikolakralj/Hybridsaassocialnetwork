import { useEffect, useMemo, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { createClient } from '../../utils/supabase/client';
import { projectId as supabaseProjectId } from '../../utils/supabase/info';
import { getInvitableRolesForRole, getRoleDescription } from '../../utils/collaboration/permissions';
import type { ProjectRole } from '../../types/collaboration';

const supabase = createClient();
const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be`;
const INVITATIONS_ENDPOINT = `${BASE}/invitations`;

interface ProjectInviteMemberDialogProps {
  open: boolean;
  projectName?: string;
  currentUserRole?: ProjectRole | null;
  onOpenChange: (open: boolean) => void;
  onInvite: (payload: { userName?: string; userEmail: string; role: ProjectRole }) => Promise<void>;
}

export function ProjectInviteMemberDialog({
  open,
  projectName,
  currentUserRole,
  onOpenChange,
  onInvite,
}: ProjectInviteMemberDialogProps) {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('Viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const availableRoles = useMemo(() => getInvitableRolesForRole(currentUserRole), [currentUserRole]);
  const canSendInvite = availableRoles.length > 0;

  // Legacy callback is retained for existing callers, but this dialog now owns
  // the submission flow directly.
  void onInvite;

  useEffect(() => {
    if (!open || availableRoles.length === 0 || availableRoles.includes(role)) return;
    setRole(availableRoles.includes('Viewer') ? 'Viewer' : availableRoles[0]);
  }, [availableRoles, open, role]);

  function resetForm() {
    setUserName('');
    setUserEmail('');
    setRole(availableRoles.includes('Viewer') ? 'Viewer' : availableRoles[0] || 'Viewer');
    setError('');
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedProjectName = projectName?.trim();
    const normalizedEmail = userEmail.trim().toLowerCase();
    if (!trimmedProjectName) {
      const message = 'Project name is required to send invitations.';
      setError(message);
      toast.error(message);
      return;
    }

    if (!availableRoles.includes(role)) {
      const message = 'Your project role cannot invite members with that role.';
      setError(message);
      toast.error(message);
      return;
    }

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      const message = 'Enter a valid email address.';
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Please sign in again to send invitations.');
      }

      const response = await fetch(INVITATIONS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          projectName: trimmedProjectName,
          userName: userName.trim() || undefined,
          userEmail: normalizedEmail,
          role,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send invitation.');
      }

      resetForm();
      onOpenChange(false);
      toast.success('Invitation sent', {
        description:
          data?.emailStatus === 'logged'
            ? 'Email was logged locally because SMTP is not configured yet.'
            : `${normalizedEmail} will receive the invite for ${trimmedProjectName}.`,
      });
    } catch (err: any) {
      const message = err?.message || 'Failed to send invitation.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </DialogTitle>
          <DialogDescription>
            Invite someone to {projectName ? `"${projectName}"` : 'this project'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4">
          {!canSendInvite ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Only project Owners and Editors can invite members. Editors can invite Contributor,
              Commenter, or Viewer roles only.
            </p>
          ) : (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Your role: <span className="font-medium text-foreground">{currentUserRole}</span>.{' '}
              {currentUserRole === 'Editor'
                ? 'You can add collaborators, but not another Editor or Owner.'
                : 'Owner transfer is kept separate from normal invitations.'}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input
              id="invite-name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Alex Rivera"
              disabled={!canSendInvite || loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="alex@company.com"
              disabled={!canSendInvite || loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as ProjectRole)}
              disabled={!canSendInvite || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((projectRole) => (
                  <SelectItem key={projectRole} value={projectRole}>
                    {projectRole}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableRoles.includes(role) ? (
              <p className="text-xs text-muted-foreground">{getRoleDescription(role)}</p>
            ) : null}
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canSendInvite}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
