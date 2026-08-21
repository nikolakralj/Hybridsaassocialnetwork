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
import { fetchScopedGraph } from '../../utils/api/scoped-graph-api';
import type { ProjectRole } from '../../types/collaboration';

const supabase = createClient();
const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be`;
const INVITATIONS_ENDPOINT = `${BASE}/invitations`;

// Project roles are PERMISSION levels, not job titles. This maps each to the
// real-world person it's actually for, so "invite an employee" doesn't get
// mis-assigned to Editor (which cannot be turned into a billable worker).
const ROLE_PERSONA: Record<ProjectRole, string> = {
  Owner: 'You / company admin — full control',
  Editor: 'Co-manager who helps run the project (not a billable worker)',
  Contributor: 'Employee or contractor who logs time ← pick this for workers',
  Commenter: 'Client contact / reviewer who only comments',
  Viewer: 'Observer with read-only access',
};

// Only these roles can be turned into a mapped, time-submitting worker
// (wg_assign_project_member_as_worker rejects Owner/Editor).
const WORKER_ELIGIBLE_ROLES: ProjectRole[] = ['Contributor'];
const NO_APPROVAL_PARTY = 'none';

interface ApprovalPartyOption {
  id: string;
  name: string;
}

interface ProjectInviteMemberDialogProps {
  open: boolean;
  projectId?: string;
  projectName?: string;
  currentUserRole?: ProjectRole | null;
  onOpenChange: (open: boolean) => void;
  onInvite: (payload: { userName?: string; userEmail: string; role: ProjectRole }) => Promise<void>;
}

export function ProjectInviteMemberDialog({
  open,
  projectId,
  projectName,
  currentUserRole,
  onOpenChange,
  onInvite,
}: ProjectInviteMemberDialogProps) {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('Viewer');
  const [partyGraphNodeId, setPartyGraphNodeId] = useState(NO_APPROVAL_PARTY);
  const [approvalParties, setApprovalParties] = useState<ApprovalPartyOption[]>([]);
  const [partyOptionsLoading, setPartyOptionsLoading] = useState(false);
  const [partyOptionsError, setPartyOptionsError] = useState('');
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

  useEffect(() => {
    if (!open || !projectId || !canSendInvite) {
      setApprovalParties([]);
      setPartyOptionsError('');
      return;
    }

    let cancelled = false;
    setPartyOptionsLoading(true);
    setPartyOptionsError('');

    void fetchScopedGraph(projectId)
      .then((graph) => {
        if (cancelled) return;
        const permittedPartyIds = currentUserRole === 'Owner'
          ? null
          : new Set(graph.meta.viewerPartyIds || []);
        const parties = graph.nodes
          .filter((node) => node?.type === 'party' && typeof node?.id === 'string')
          .filter((node) => !permittedPartyIds || permittedPartyIds.has(node.id))
          .map((node) => ({
            id: node.id as string,
            name: String(node?.data?.name || node?.data?.label || node.id),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setApprovalParties(parties);
        setPartyGraphNodeId((current) => (
          current === NO_APPROVAL_PARTY || parties.some((party) => party.id === current)
            ? current
            : NO_APPROVAL_PARTY
        ));
      })
      .catch((err: any) => {
        if (cancelled) return;
        setApprovalParties([]);
        setPartyOptionsError(err?.message || 'Approval organizations could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setPartyOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canSendInvite, currentUserRole, open, projectId]);

  function resetForm() {
    setUserName('');
    setUserEmail('');
    setRole(availableRoles.includes('Viewer') ? 'Viewer' : availableRoles[0] || 'Viewer');
    setPartyGraphNodeId(NO_APPROVAL_PARTY);
    setPartyOptionsError('');
    setError('');
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedProjectName = projectName?.trim();
    const normalizedEmail = userEmail.trim().toLowerCase();
    if (!projectId || !trimmedProjectName) {
      const message = 'Project identity is required to send invitations.';
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
          projectId,
          projectName: trimmedProjectName,
          userName: userName.trim() || undefined,
          userEmail: normalizedEmail,
          role,
          partyGraphNodeId: partyGraphNodeId === NO_APPROVAL_PARTY ? undefined : partyGraphNodeId,
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
            : partyGraphNodeId === NO_APPROVAL_PARTY
              ? `${normalizedEmail} will receive the invite for ${trimmedProjectName}.`
              : `${normalizedEmail} will join as a real approver for the selected organization.`,
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

          {canSendInvite ? (
            WORKER_ELIGIBLE_ROLES.includes(role) ? (
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
                This invite grants project access only. After they accept, open <span className="font-medium">Team → Set up as worker</span> to
                assign their company and worker identity so they can log time.
              </p>
            ) : (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{role}s don't submit timesheets.</span> To invite an
                employee or contractor who logs hours, choose <span className="font-medium text-foreground">Contributor</span>.
              </p>
            )
          ) : null}

          {canSendInvite ? (
            <p className="text-xs text-muted-foreground">
              Normal members join your active project organization. An explicit approval responsibility is verified again by the server and may target only an organization you administer; project Owners can bootstrap a counterparty approver.
            </p>
          ) : null}

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
                    <span className="flex flex-col">
                      <span className="font-medium">{projectRole}</span>
                      <span className="text-xs text-muted-foreground">{ROLE_PERSONA[projectRole]}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableRoles.includes(role) ? (
              <p className="text-xs text-muted-foreground">{getRoleDescription(role)}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Approval responsibility (optional)</Label>
            <Select
              value={partyGraphNodeId}
              onValueChange={setPartyGraphNodeId}
              disabled={!canSendInvite || loading || partyOptionsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={partyOptionsLoading ? 'Loading organizations...' : 'No approval responsibility'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_APPROVAL_PARTY}>No approval responsibility</SelectItem>
                {approvalParties.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    Represents {party.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {partyGraphNodeId !== NO_APPROVAL_PARTY ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                On acceptance, this real account becomes an approver for the selected organization. It receives no rate visibility and cannot edit timesheets.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Leave this unset for a normal collaborator or worker invitation.
              </p>
            )}
            {partyOptionsError ? (
              <p className="text-xs text-amber-700">{partyOptionsError} Normal invitations are still available.</p>
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
