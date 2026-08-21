import { projectId as supabaseProjectId, publicAnonKey } from '../supabase/info';

const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be/invitations`;

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface TokenInvitation {
  token: string;
  projectId: string;
  projectName?: string;
  inviter?: string;
  role: string;
  partyGraphNodeId?: string;
  partyName?: string;
  expiry?: string;
  status: InvitationStatus;
  email?: string;
}

export interface InvitationActionResult {
  success?: boolean;
  invitation?: TokenInvitation;
  member?: {
    id: string;
    projectId: string;
    role: string;
    acceptedAt?: string | null;
  };
  project?: {
    id: string;
    name?: string;
  };
}

function authHeaders(accessToken?: string | null): HeadersInit {
  // The edge gateway verifies JWTs on every request. Signed-out visitors
  // (e.g. opening an invite link from email) authenticate with the public
  // anon key; the routes still enforce real auth internally where required.
  // NOTE: only headers in the function's CORS allowHeaders may be sent.
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

async function parseJson(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

export async function getProjectInvitationByToken(token: string): Promise<TokenInvitation> {
  const trimmedToken = token.trim();
  if (!trimmedToken) throw new Error('Invitation token is missing.');

  const response = await fetch(`${BASE}/${encodeURIComponent(trimmedToken)}`, {
    headers: authHeaders(),
  });
  const data = await parseJson(response);

  if (!response.ok) {
    if (response.status === 404) throw new Error('Invitation not found.');
    throw new Error(data.error || 'Failed to load invitation.');
  }

  if (!data?.invitation) throw new Error('Invitation not found.');
  return data.invitation as TokenInvitation;
}

export async function acceptProjectInvitationToken(
  token: string,
  accessToken?: string | null,
): Promise<InvitationActionResult> {
  const response = await fetch(`${BASE}/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
  const data = await parseJson(response);

  if (!response.ok) {
    if (response.status === 401) throw new Error('Please sign in to accept this invitation.');
    if (response.status === 410) throw new Error('This invitation has expired.');
    if (response.status === 403) throw new Error(data.error || 'This invitation is for a different email address.');
    throw new Error(data.error || 'Failed to accept invitation.');
  }

  return data as InvitationActionResult;
}

export async function declineProjectInvitationToken(
  token: string,
  accessToken?: string | null,
): Promise<InvitationActionResult> {
  const response = await fetch(`${BASE}/${encodeURIComponent(token)}/decline`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
  const data = await parseJson(response);

  if (!response.ok) {
    if (response.status === 401) throw new Error('Please sign in to decline this invitation.');
    if (response.status === 410) throw new Error('This invitation has expired.');
    if (response.status === 403) throw new Error(data.error || 'This invitation is for a different email address.');
    throw new Error(data.error || 'Failed to decline invitation.');
  }

  return data as InvitationActionResult;
}
