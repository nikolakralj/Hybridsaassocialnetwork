/**
 * Password-recovery URL parsing.
 *
 * The Supabase client keeps flowType at the library default (`implicit` in
 * @supabase/auth-js 2.99) and only scans the URL for recovery callbacks.
 * Implicit recovery links arrive as `#access_token=…&type=recovery` (often on
 * `/`, because that is the Site URL). PKCE links, if flowType is later set to
 * `pkce`, arrive as `?code=` and the client stores a verifier ending in
 * `/PASSWORD_RECOVERY`.
 */

export const MIN_PASSWORD_LENGTH = 6;

export const PASSWORD_RESET_PATH = '/reset-password';

export const PASSWORD_RECOVERY_STORAGE_KEY = 'wg-password-recovery';

export const PASSWORD_RECOVERY_ERROR_KEY = 'wg-password-recovery-error';

export const PASSWORD_RESET_SENT_MESSAGE =
  'If an account exists for that email, we sent a link to reset the password.';

export const INVALID_RESET_LINK_MESSAGE =
  'This reset link is invalid or has expired. Request a new email.';

export type PasswordRecoveryLocation =
  | { kind: 'none' }
  | { kind: 'hash'; accessToken: string; refreshToken: string }
  | { kind: 'pkce'; code: string }
  | { kind: 'otp'; tokenHash: string }
  | { kind: 'error'; message: string };

export type ResetEmailError = { message?: string; code?: string; status?: number };

let capturedRecovery: PasswordRecoveryLocation | null = null;
let pkceRecoveryPending = false;
let recoverySuppressed = false;
let accessTokenAtCapture: string | null = null;

const SENSITIVE_QUERY_KEYS = [
  'code',
  'token_hash',
  'type',
  'error',
  'error_code',
  'error_description',
];

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const trimmed = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return trimmed || '/';
}

export function recoveryLinkErrorMessage(errorCode: string | null, errorDescription: string | null): string {
  const code = (errorCode || '').toLowerCase();
  const description = (errorDescription || '').toLowerCase();
  if (code === 'otp_expired' || description.includes('expired')) {
    return 'This reset link has expired. Request a new email.';
  }
  return INVALID_RESET_LINK_MESSAGE;
}

function mergedParams(search: string, hash: string): URLSearchParams {
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const queryParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const merged = new URLSearchParams(hashParams);
  queryParams.forEach((value, key) => {
    merged.set(key, value);
  });
  return merged;
}

function isSupabaseAuthFailure(params: URLSearchParams): boolean {
  const error = params.get('error');
  if (params.get('error_code') || params.get('error_description')) return true;
  return error === 'access_denied' || error === 'server_error' || error === 'unauthorized_client';
}

export function parsePasswordRecoveryLocation(
  input: { pathname?: string; search?: string; hash?: string },
  options?: { pkceRecoveryPending?: boolean },
): PasswordRecoveryLocation {
  const pathname = normalizePath(input.pathname ?? '/');
  const params = mergedParams(input.search ?? '', input.hash ?? '');
  const type = params.get('type');
  const onResetPage = pathname === PASSWORD_RESET_PATH;
  const onSiteRoot = pathname === '/';
  const onRecoveryLanding = onResetPage || onSiteRoot;

  if (isSupabaseAuthFailure(params) && (type === 'recovery' || onRecoveryLanding)) {
    return {
      kind: 'error',
      message: recoveryLinkErrorMessage(params.get('error_code'), params.get('error_description')),
    };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (type === 'recovery' && accessToken && refreshToken) {
    return { kind: 'hash', accessToken, refreshToken };
  }

  const tokenHash = params.get('token_hash');
  if (tokenHash && (type === 'recovery' || onResetPage)) {
    return { kind: 'otp', tokenHash };
  }

  const code = params.get('code');
  if (code && (type === 'recovery' || onResetPage || (onSiteRoot && options?.pkceRecoveryPending))) {
    return { kind: 'pkce', code };
  }

  if (type === 'recovery') {
    return { kind: 'error', message: INVALID_RESET_LINK_MESSAGE };
  }

  return { kind: 'none' };
}

export function parsePasswordRecoveryHref(
  href: string,
  options?: { pkceRecoveryPending?: boolean },
): PasswordRecoveryLocation {
  try {
    const url = new URL(href, 'http://localhost');
    return parsePasswordRecoveryLocation({
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    }, options);
  } catch {
    return { kind: 'none' };
  }
}

/**
 * True only for implicit recovery callbacks the auth client should consume so
 * it emits PASSWORD_RECOVERY. Error hashes and PKCE codes stay false: errors
 * are shown by the app, and a `code` must remain eligible for the PKCE check.
 */
export function shouldDetectPasswordRecoverySession(
  url: URL,
  params: { [parameter: string]: string },
): boolean {
  // Recovery hashes are valid on the Site URL (`/`) and on /reset-password.
  if (!url.pathname) return false;
  return params.type === 'recovery'
    && Boolean(params.access_token)
    && Boolean(params.refresh_token)
    && !params.error
    && !params.error_description
    && !params.error_code;
}

function readPkceRecoveryVerifier(): boolean {
  try {
    const key = Object.keys(localStorage).find((entry) => entry.endsWith('-code-verifier'));
    if (!key) return false;
    return (localStorage.getItem(key) || '').includes('PASSWORD_RECOVERY');
  } catch {
    return false;
  }
}

/** Snapshot the recovery URL once, before the Supabase client initializes. */
export function capturePasswordRecoveryFromWindow(): PasswordRecoveryLocation {
  if (capturedRecovery) return capturedRecovery;
  if (typeof window === 'undefined') {
    capturedRecovery = { kind: 'none' };
    return capturedRecovery;
  }

  accessTokenAtCapture = readStoredAccessToken();
  pkceRecoveryPending = readPkceRecoveryVerifier();
  capturedRecovery = parsePasswordRecoveryHref(window.location.href, { pkceRecoveryPending });
  if (capturedRecovery.kind !== 'pkce') pkceRecoveryPending = false;

  if (capturedRecovery.kind === 'hash' || capturedRecovery.kind === 'pkce' || capturedRecovery.kind === 'otp') {
    clearStoredRecoveryError();
    markPasswordRecoveryPending();
  } else if (capturedRecovery.kind === 'error') {
    storeRecoveryError(capturedRecovery.message);
    markPasswordRecoveryPending();
  }

  return capturedRecovery;
}

export function wasPkcePasswordRecovery(): boolean {
  return pkceRecoveryPending;
}

export function accessTokenBeforeRecovery(): string | null {
  return accessTokenAtCapture;
}

function readStoredAccessToken(): string | null {
  try {
    const key = Object.keys(localStorage).find((entry) => entry.endsWith('-auth-token'));
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: unknown };
    return typeof parsed.access_token === 'string' ? parsed.access_token : null;
  } catch {
    return null;
  }
}

export function stripPasswordRecoveryFromAddressBar(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let changed = false;
  if (url.hash) {
    url.hash = '';
    changed = true;
  }
  SENSITIVE_QUERY_KEYS.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (!changed) return;
  const next = `${url.pathname}${url.search}`;
  window.history.replaceState(window.history.state, '', next);
}

export function consumePkcePasswordRecovery(): void {
  pkceRecoveryPending = false;
}

export function passwordResetRedirectTo(origin: string): string {
  return `${origin.replace(/\/$/, '')}${PASSWORD_RESET_PATH}`;
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password !== confirm) {
    return 'Passwords do not match';
  }
  return null;
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function interpretPasswordResetError(error: ResetEmailError | null): 'sent' | 'retry' {
  if (!error) return 'sent';
  const code = (error.code || '').toLowerCase();
  const message = (error.message || '').toLowerCase();
  if (
    code.includes('not_found')
    || code === 'user_not_found'
    || message.includes('user not found')
    || message.includes('email not found')
  ) {
    return 'sent';
  }
  return 'retry';
}

export function passwordResetFailureMessage(error: ResetEmailError | null): string {
  const message = (error?.message || '').toLowerCase();
  const code = (error?.code || '').toLowerCase();
  if (code.includes('rate') || message.includes('rate') || message.includes('too many') || error?.status === 429) {
    return 'Please wait a moment and try again.';
  }
  return 'Could not send a reset email. Please try again.';
}

export function markPasswordRecoveryPending(): void {
  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1');
  } catch {
    // sessionStorage can be blocked; the in-memory flag still routes this load.
  }
}

export function clearPasswordRecoveryPending(): void {
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasPasswordRecoveryPending(): boolean {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function storeRecoveryError(message: string): void {
  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_ERROR_KEY, message);
  } catch {
    // ignore
  }
}

export function readStoredRecoveryError(): string | null {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_ERROR_KEY);
  } catch {
    return null;
  }
}

export function clearStoredRecoveryError(): void {
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_ERROR_KEY);
  } catch {
    // ignore
  }
}

export function suppressPasswordRecovery(): void {
  recoverySuppressed = true;
  clearPasswordRecoveryPending();
  clearStoredRecoveryError();
}

export function isPasswordRecoverySuppressed(): boolean {
  return recoverySuppressed;
}

export function initialRecoveryError(captured: PasswordRecoveryLocation): string | null {
  if (captured.kind === 'error') return captured.message;
  if (captured.kind === 'none') return readStoredRecoveryError();
  return null;
}
