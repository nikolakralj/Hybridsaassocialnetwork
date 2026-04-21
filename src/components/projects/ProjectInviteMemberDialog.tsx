import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { createClient } from '../../utils/supabase/client';
import { projectId as supabaseProjectId } from '../../utils/supabase/info';
import type { ProjectRole } from '../../types/collaboration';

const supabase = createClient();
const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be`;
const INVITATIONS_ENDPOINT = `${BASE}/invitations`;

interface ProjectInviteMemberDialogProps {
  open: boolean;
  projectName?: string;
  onOpenChange: (open: boolean) => void;
  onInvite: (payload: { userName?: string; userEmail: string; role: ProjectRole }) => Promise<void>;
}

const INVITABLE_ROLES: ProjectRole[] = ['Editor', 'Contributor', 'Commenter', 'Viewer'];

export function ProjectInviteMemberDialog({
  open,
  projectName,
  onOpenChange,
  onInvite,
}: ProjectInviteMemberDialogProps) {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('Viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Legacy callback is retained for existing callers, but this dialog now owns
  // the submission flow directly.
  void onInvite;

  function resetForm() {
    setUserName('');
    setUserEmail('');
    setRole('Viewer');
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
          <div className="space-y-2">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input
              id="invite-name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Alex Rivera"
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
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as ProjectRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((projectRole) => (
                  <SelectItem key={projectRole} value={projectRole}>
                    {projectRole}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
