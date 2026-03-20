import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { ProjectRole } from '../../types/collaboration';

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

  function resetForm() {
    setUserName('');
    setUserEmail('');
    setRole('Viewer');
    setError('');
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const normalizedEmail = userEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await onInvite({
        userName: userName.trim() || undefined,
        userEmail: normalizedEmail,
        role,
      });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to send invitation.');
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
