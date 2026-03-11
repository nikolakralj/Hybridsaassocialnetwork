import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    loading: true,
    error: null,
  });

  const supabase = createClient();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.log('Session check error (non-critical):', error.message);
          setState(s => ({ ...s, loading: false }));
          return;
        }
        if (data?.session) {
          const user = data.session.user;
          const profile: UserProfile = {
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
            created_at: user.created_at,
          };
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
        console.log('Session check failed:', err);
        setState(s => ({ ...s, loading: false }));
      }
    };
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const user = session.user;
          const profile: UserProfile = {
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
            created_at: user.created_at,
          };
          setState({
            user: profile,
            accessToken: session.access_token,
            loading: false,
            error: null,
          });
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, accessToken: null, loading: false, error: null });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      // Use server-side signup to auto-confirm email
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
      // Now sign in
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Auth state change listener will handle the rest
    } catch (err: any) {
      console.error('Sign up error:', err);
      setState(s => ({ ...s, loading: false, error: err.message || 'Sign up failed' }));
      throw err;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Auth state change listener handles state update
    } catch (err: any) {
      console.error('Sign in error:', err);
      setState(s => ({ ...s, loading: false, error: err.message || 'Sign in failed' }));
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, accessToken: null, loading: false, error: null });
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: updates,
      });
      if (error) throw error;
      setState(s => ({
        ...s,
        user: s.user ? { ...s.user, ...updates } : null,
      }));
    } catch (err: any) {
      console.error('Profile update error:', err);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut, updateProfile, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}