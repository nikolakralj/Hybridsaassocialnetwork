import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  accessTokenBeforeRecovery,
  capturePasswordRecoveryFromWindow,
  clearPasswordRecoveryPending,
  clearStoredRecoveryError,
  consumePkcePasswordRecovery,
  hasPasswordRecoveryPending,
  initialRecoveryError,
  interpretPasswordResetError,
  INVALID_RESET_LINK_MESSAGE,
  isPlausibleEmail,
  markPasswordRecoveryPending,
  passwordResetFailureMessage,
  passwordResetRedirectTo,
  readStoredRecoveryError,
  storeRecoveryError,
  stripPasswordRecoveryFromAddressBar,
  suppressPasswordRecovery,
  wasPkcePasswordRecovery,
} from '../utils/auth/password-recovery';
import { createClient } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  headline?: string;
  bio?: string;
  avatar_url?: string;
  persona_type?: 'freelancer' | 'company' | 'agency';
  location?: string;
  website?: string;
  skills?: string[];
  organization_id?: string;
  role?: string;
  created_at?: string;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  passwordRecovery: boolean;
  recoveryError: string | null;
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  dismissPasswordRecovery: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Snapshot recovery tokens before the client initializes and possibly clears the hash.
const capturedRecovery = capturePasswordRecoveryFromWindow();

// Singleton supabase client — created once outside component
const supabase = createClient();

type RecoverySession = { access_token: string; user: any };
type RecoveryConsumeResult =
  | { type: 'none' }
  | { type: 'ready'; session: RecoverySession }
  | { type: 'failed'; message: string };

let recoveryConsumePromise: Promise<RecoveryConsumeResult> | null = null;

async function consumeCapturedRecovery(): Promise<RecoveryConsumeResult> {
  const captured = capturePasswordRecoveryFromWindow();

  if (captured.kind === 'error') {
    stripPasswordRecoveryFromAddressBar();
    return { type: 'failed', message: captured.message };
  }

  if (captured.kind === 'otp') {
    await supabase.auth.getSession();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: captured.tokenHash,
      type: 'recovery',
    });
    stripPasswordRecoveryFromAddressBar();
    if (error || !data.session) {
      return { type: 'failed', message: INVALID_RESET_LINK_MESSAGE };
    }
    return { type: 'ready', session: data.session };
  }

  if (captured.kind === 'hash') {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token === captured.accessToken) {
      stripPasswordRecoveryFromAddressBar();
      return { type: 'ready', session: data.session };
    }
    const setResult = await supabase.auth.setSession({
      access_token: captured.accessToken,
      refresh_token: captured.refreshToken,
    });
    stripPasswordRecoveryFromAddressBar();
    if (setResult.error || !setResult.data.session) {
      return { type: 'failed', message: INVALID_RESET_LINK_MESSAGE };
    }
    return { type: 'ready', session: setResult.data.session };
  }

  if (captured.kind === 'pkce') {
    const before = accessTokenBeforeRecovery();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token && data.session.access_token !== before) {
      stripPasswordRecoveryFromAddressBar();
      return { type: 'ready', session: data.session };
    }
    const exchanged = await supabase.auth.exchangeCodeForSession(captured.code);
    stripPasswordRecoveryFromAddressBar();
    if (exchanged.error || !exchanged.data.session) {
      return { type: 'failed', message: INVALID_RESET_LINK_MESSAGE };
    }
    return { type: 'ready', session: exchanged.data.session };
  }

  return { type: 'none' };
}

function consumeCapturedRecoveryOnce(): Promise<RecoveryConsumeResult> {
  if (!recoveryConsumePromise) {
    recoveryConsumePromise = consumeCapturedRecovery();
  }
  return recoveryConsumePromise;
}

function clearRecoveryMarkers(): void {
  clearPasswordRecoveryPending();
  clearStoredRecoveryError();
  consumePkcePasswordRecovery();
}

function buildProfile(user: any): UserProfile {
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    headline: user.user_metadata?.headline || '',
    bio: user.user_metadata?.bio || '',
    avatar_url: user.user_metadata?.avatar_url || '',
    persona_type: user.user_metadata?.persona_type || 'freelancer',
    location: user.user_metadata?.location || '',
    website: user.user_metadata?.website || '',
    skills: user.user_metadata?.skills || [],
    organization_id: user.user_metadata?.organization_id || undefined,
    role: user.user_metadata?.role || undefined,
    created_at: user.created_at,
  };
}

const AUTH_SCOPED_STORAGE_PREFIXES = ['workgraph-', 'wg-'];
const AUTH_SCOPED_STORAGE_KEYS = [
  'currentProjectId',
  'currentProjectName',
  'currentProjectSource',
  'currentProjectStartDate',
];

function clearAuthScopedBrowserStorage(): void {
  if (typeof window === 'undefined') return;

  const shouldClear = (key: string) => (
    AUTH_SCOPED_STORAGE_KEYS.includes(key)
    || AUTH_SCOPED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );

  [window.sessionStorage, window.localStorage].forEach((storage) => {
    try {
      Object.keys(storage)
        .filter(shouldClear)
        .forEach((key) => storage.removeItem(key));
    } catch (error) {
      console.warn('[auth] Failed to clear WorkGraph browser cache on sign-out:', error);
    }
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    loading: true,
    error: null,
    passwordRecovery: capturedRecovery.kind !== 'none' || hasPasswordRecoveryPending(),
    recoveryError: initialRecoveryError(capturedRecovery),
  });

  // Track if mounted to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Check for existing session on mount — ONE TIME only
  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const consumed = await consumeCapturedRecoveryOnce();
        if (cancelled) return;

        if (consumed.type === 'ready') {
          clearStoredRecoveryError();
          setState({
            user: buildProfile(consumed.session.user),
            accessToken: consumed.session.access_token,
            loading: false,
            error: null,
            passwordRecovery: true,
            recoveryError: null,
          });
          return;
        }

        if (consumed.type === 'failed') {
          storeRecoveryError(consumed.message);
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          setState({
            user: data.session ? buildProfile(data.session.user) : null,
            accessToken: data.session?.access_token ?? null,
            loading: false,
            error: null,
            passwordRecovery: true,
            recoveryError: consumed.message,
          });
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error) {
          console.log('Session check error (non-critical):', error.message);
          setState(s => ({ ...s, loading: false }));
          return;
        }
        if (data?.session) {
          const profile = buildProfile(data.session.user);
          setState({
            user: profile,
            accessToken: data.session.access_token,
            loading: false,
            error: null,
            passwordRecovery: hasPasswordRecoveryPending(),
            recoveryError: readStoredRecoveryError(),
          });
        } else {
          setState(s => ({
            ...s,
            loading: false,
            passwordRecovery: hasPasswordRecoveryPending(),
            recoveryError: readStoredRecoveryError(),
          }));
        }
      } catch (err) {
        if (cancelled) return;
        console.log('Session check failed:', err);
        setState(s => ({ ...s, loading: false }));
      }
    };

    checkSession();

    // Sign-in/out plus PASSWORD_RECOVERY (implicit recovery hashes).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        if (event === 'PASSWORD_RECOVERY') {
          markPasswordRecoveryPending();
          clearStoredRecoveryError();
          setState(s => ({
            ...s,
            passwordRecovery: true,
            recoveryError: null,
            loading: false,
            error: null,
            user: session ? buildProfile(session.user) : s.user,
            accessToken: session?.access_token ?? s.accessToken,
          }));
          return;
        }
        if (event === 'SIGNED_IN' && session && wasPkcePasswordRecovery()) {
          consumePkcePasswordRecovery();
          markPasswordRecoveryPending();
          clearStoredRecoveryError();
          setState(s => ({
            ...s,
            passwordRecovery: true,
            recoveryError: null,
            loading: false,
            error: null,
            user: buildProfile(session.user),
            accessToken: session.access_token,
          }));
          return;
        }
        if (event === 'SIGNED_IN' && session) {
          const profile = buildProfile(session.user);
          setState(s => ({
            ...s,
            user: profile,
            accessToken: session.access_token,
            loading: false,
            error: null,
          }));
        } else if (event === 'SIGNED_OUT') {
          clearAuthScopedBrowserStorage();
          clearRecoveryMarkers();
          setState({
            user: null,
            accessToken: null,
            loading: false,
            error: null,
            passwordRecovery: false,
            recoveryError: null,
          });
        }
        // Ignore TOKEN_REFRESHED and other events to avoid unnecessary re-renders
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f8b491be/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ email, password, name }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Sign up failed');
      }
      // Sign in after signup
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Directly update state (don't rely solely on listener)
      if (data?.session && mountedRef.current) {
        clearRecoveryMarkers();
        const profile = buildProfile(data.session.user);
        setState({
          user: profile,
          accessToken: data.session.access_token,
          loading: false,
          error: null,
          passwordRecovery: false,
          recoveryError: null,
        });
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      if (mountedRef.current) {
        setState(s => ({ ...s, loading: false, error: err.message || 'Sign up failed' }));
      }
      throw err;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Directly update state
      if (data?.session && mountedRef.current) {
        clearRecoveryMarkers();
        const profile = buildProfile(data.session.user);
        setState({
          user: profile,
          accessToken: data.session.access_token,
          loading: false,
          error: null,
          passwordRecovery: false,
          recoveryError: null,
        });
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      if (mountedRef.current) {
        setState(s => ({ ...s, loading: false, error: err.message || 'Sign in failed' }));
      }
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    clearAuthScopedBrowserStorage();
    clearRecoveryMarkers();
    await supabase.auth.signOut();
    if (mountedRef.current) {
      setState({
        user: null,
        accessToken: null,
        loading: false,
        error: null,
        passwordRecovery: false,
        recoveryError: null,
      });
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    try {
      const { error } = await supabase.auth.updateUser({ data: updates });
      if (error) throw error;
      if (mountedRef.current) {
        setState(s => ({
          ...s,
          user: s.user ? { ...s.user, ...updates } : null,
        }));
      }
    } catch (err: any) {
      console.error('Profile update error:', err);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }));
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!isPlausibleEmail(trimmed)) {
      throw new Error('Enter a valid email address.');
    }
    const redirectTo = passwordResetRedirectTo(window.location.origin);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
    if (interpretPasswordResetError(error) === 'sent') return;
    throw new Error(passwordResetFailureMessage(error));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const message = error.message || 'Could not update password';
      if (/session missing|not authenticated|invalid jwt|jwt expired/i.test(message)) {
        storeRecoveryError(INVALID_RESET_LINK_MESSAGE);
        if (mountedRef.current) {
          setState(s => ({
            ...s,
            passwordRecovery: true,
            recoveryError: INVALID_RESET_LINK_MESSAGE,
          }));
        }
        throw new Error(INVALID_RESET_LINK_MESSAGE);
      }
      throw new Error(message);
    }
    clearRecoveryMarkers();
    if (mountedRef.current) {
      setState(s => ({ ...s, passwordRecovery: false, recoveryError: null }));
    }
  }, []);

  const dismissPasswordRecovery = useCallback(() => {
    suppressPasswordRecovery();
    if (mountedRef.current) {
      setState(s => ({ ...s, passwordRecovery: false, recoveryError: null }));
    }
  }, []);

  // CRITICAL: Memoize the context value to prevent re-renders of all consumers
  const contextValue = useMemo<AuthContextValue>(() => ({
    ...state,
    signUp,
    signIn,
    signOut,
    updateProfile,
    requestPasswordReset,
    updatePassword,
    dismissPasswordRecovery,
    clearError,
  }), [state, signUp, signIn, signOut, updateProfile, requestPasswordReset, updatePassword, dismissPasswordRecovery, clearError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
