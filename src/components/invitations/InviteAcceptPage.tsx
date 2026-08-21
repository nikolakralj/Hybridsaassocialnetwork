import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { AuthModal } from '../AuthModal';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Toaster } from '../ui/sonner';
import {
  acceptProjectInvitationToken,
  declineProjectInvitationToken,
  getProjectInvitationByToken,
  type TokenInvitation,
} from '../../utils/api/project-invitations';

type PendingAction = 'accept' | 'decline' | null;

function formatExpiry(value?: string): string {
  if (!value) return 'No expiry set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No expiry set';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusCopy(status?: string): { label: string; className: string } {
  switch (status) {
    case 'accepted':
      return { label: 'Accepted', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    case 'declined':
      return { label: 'Declined', className: 'border-rose-200 bg-rose-50 text-rose-700' };
    case 'expired':
      return { label: 'Expired', className: 'border-amber-200 bg-amber-50 text-amber-700' };
    default:
      return { label: 'Pending', className: 'border-sky-200 bg-sky-50 text-sky-700' };
  }
}

function syncAcceptedProject(project?: { id?: string; name?: string }) {
  if (!project?.id || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem('currentProjectId', project.id);
  sessionStorage.setItem('currentProjectSource', 'cloud');
  if (project.name) sessionStorage.setItem('currentProjectName', project.name);
  window.dispatchEvent(new CustomEvent('workgraph-project-selected', {
    detail: {
      projectId: project.id,
      projectName: project.name || null,
      projectSource: 'cloud',
    },
  }));
}

export function InviteAcceptPage() {
  const { token: tokenParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, accessToken, loading: authLoading } = useAuth();
  const token = useMemo(() => (tokenParam || searchParams.get('token') || '').trim(), [searchParams, tokenParam]);

  const [invitation, setInvitation] = useState<TokenInvitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const loadInvitation = useCallback(async () => {
    if (!token) {
      setError('Invitation token is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const data = await getProjectInvitationByToken(token);
      setInvitation(data);
    } catch (err: any) {
      setError(err?.message || 'Could not load this invitation.');
      setInvitation(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInvitation();
  }, [loadInvitation]);

  const requestAuth = useCallback((action: PendingAction, mode: 'signin' | 'signup' = 'signin') => {
    setPendingAction(action);
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const handleAccept = useCallback(async () => {
    if (!token || !invitation) return;
    if (!user || !accessToken) {
      requestAuth('accept', 'signin');
      return;
    }

    setIsSubmitting(true);
    setPendingAction('accept');
    setError('');
    try {
      const result = await acceptProjectInvitationToken(token, accessToken);
      syncAcceptedProject(result.project || {
        id: invitation.projectId,
        name: invitation.projectName,
      });
      toast.success('Invitation accepted', {
        description: invitation.partyName
          ? `You can now approve work for ${invitation.partyName}.`
          : result.project?.name
            ? `${result.project.name} is now ready in your workspace.`
            : 'The project is now ready in your workspace.',
      });
      navigate('/app/project-workspace');
    } catch (err: any) {
      setError(err?.message || 'Could not accept this invitation.');
      toast.error(err?.message || 'Could not accept this invitation.');
      void loadInvitation();
    } finally {
      setIsSubmitting(false);
      setPendingAction(null);
    }
  }, [accessToken, invitation, loadInvitation, navigate, requestAuth, token, user]);

  const handleDecline = useCallback(async () => {
    if (!token || !invitation) return;
    if (!user || !accessToken) {
      requestAuth('decline', 'signin');
      return;
    }

    setIsSubmitting(true);
    setPendingAction('decline');
    setError('');
    try {
      await declineProjectInvitationToken(token, accessToken);
      toast.success('Invitation declined');
      await loadInvitation();
    } catch (err: any) {
      setError(err?.message || 'Could not decline this invitation.');
      toast.error(err?.message || 'Could not decline this invitation.');
    } finally {
      setIsSubmitting(false);
      setPendingAction(null);
    }
  }, [accessToken, invitation, loadInvitation, requestAuth, token, user]);

  useEffect(() => {
    if (authLoading || !user || !accessToken || !pendingAction || authOpen) return;
    if (pendingAction === 'accept') {
      void handleAccept();
    } else {
      void handleDecline();
    }
  }, [accessToken, authLoading, authOpen, handleAccept, handleDecline, pendingAction, user]);

  const badge = statusCopy(invitation?.status);
  const isPending = invitation?.status === 'pending';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_32rem),linear-gradient(180deg,#f8fafc,#eef2ff)] px-4 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col justify-center">
        <div className="mb-6">
          <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-950">
            WorkGraph
          </Link>
        </div>

        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-xl shadow-slate-900/10">
          <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Project invitation
                </CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  Join the project as a real member. No persona switching, no demo shortcut.
                </p>
              </div>
              {invitation ? (
                <Badge variant="outline" className={badge.className}>
                  {badge.label}
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Loading invitation...
              </div>
            ) : error && !invitation ? (
              <Alert className="border-rose-200 bg-rose-50 text-rose-900">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Invitation unavailable</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : invitation ? (
              <>
                {error ? (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Action needed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                {!user ? (
                  <Alert className="border-sky-200 bg-sky-50 text-sky-950">
                    <Mail className="h-4 w-4" />
                    <AlertTitle>Sign in with the invited email</AlertTitle>
                    <AlertDescription>
                      This invite is for {invitation.email || 'the email address that received the invite'}.
                      Sign in or create an account with that email to accept it.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Project</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {invitation.projectName || 'WorkGraph project'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Role</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{invitation.role}</p>
                  </div>
                  {invitation.partyName ? (
                    <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approval responsibility</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-950">
                        You will represent {invitation.partyName} as a real approver.
                      </p>
                      <p className="mt-1 text-xs text-emerald-800">
                        Acceptance links this signed-in account to the organization's approval queue without granting rate visibility or timesheet editing.
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invited by</p>
                    <p className="mt-1 text-sm text-slate-700">{invitation.inviter || 'Project admin'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expires</p>
                    <p className="mt-1 text-sm text-slate-700">{formatExpiry(invitation.expiry)}</p>
                  </div>
                </div>

                {isPending ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="bg-slate-950 text-white hover:bg-slate-800"
                      onClick={() => void handleAccept()}
                      disabled={isSubmitting}
                    >
                      {isSubmitting && pendingAction !== 'decline' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Accept invitation
                    </Button>
                    <Button
                      variant="outline"
                      className="border-slate-300"
                      onClick={() => void handleDecline()}
                      disabled={isSubmitting}
                    >
                      {isSubmitting && pendingAction === 'decline' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Decline
                    </Button>
                  </div>
                ) : (
                  <Alert className="border-slate-200 bg-slate-50 text-slate-800">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>This invitation is {badge.label.toLowerCase()}.</AlertTitle>
                    <AlertDescription>
                      You can return to Projects to see invitations that are still pending.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                  {!user ? (
                    <>
                      <Button variant="outline" onClick={() => requestAuth(null, 'signin')}>
                        Sign in
                      </Button>
                      <Button variant="ghost" onClick={() => requestAuth(null, 'signup')}>
                        Create account
                      </Button>
                    </>
                  ) : null}
                  <Button variant="ghost" onClick={() => navigate('/app/projects')}>
                    Go to projects
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
      <Toaster />
    </div>
  );
}
