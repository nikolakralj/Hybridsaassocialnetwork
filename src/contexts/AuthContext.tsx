import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Singleton supabase client — created once outside component
const supabase = createClient();

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    loading: true,
    error: null,
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
          });
        } else {
          setState(s => ({ ...s, loading: false }));
        }
      } catch (err) {
        if (cancelled) return;
        console.log('Session check failed:', err);
        setState(s => ({ ...s, loading: false }));
      }
    };

    checkSession();

    // Lightweight auth listener — only handle sign-in/sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        if (event === 'SIGNED_IN' && session) {
          const profile = buildProfile(session.user);
          setState({
            user: profile,
            accessToken: session.access_token,
            loading: false,
            error: null,
          });
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, accessToken: null, loading: false, error: null });
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
        const profile = buildProfile(data.session.user);
        setState({
          user: profile,
          accessToken: data.session.access_token,
          loading: false,
          error: null,
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
        const profile = buildProfile(data.session.user);
        setState({
          user: profile,
          accessToken: data.session.access_token,
          loading: false,
          error: null,
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
    await supabase.auth.signOut();
    if (mountedRef.current) {
      setState({ user: null, accessToken: null, loading: false, error: null });
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

  // CRITICAL: Memoize the context value to prevent re-renders of all consumers
  const contextValue = useMemo<AuthContextValue>(() => ({
    ...state,
    signUp,
    signIn,
    signOut,
    updateProfile,
    clearError,
  }), [state, signUp, signIn, signOut, updateProfile, clearError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
