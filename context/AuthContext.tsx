import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const normalizeProfile = (data: Partial<Profile> | null | undefined, authUser: SupabaseUser) => {
    const now = new Date().toISOString();
    return {
      id: data?.id ?? authUser.id,
      name: data?.name ?? authUser.user_metadata?.name ?? authUser.email ?? 'User',
      age: data?.age ?? null,
      role: data?.role ?? 'Hybrid',
      skills: data?.skills ?? [],
      interests: data?.interests ?? [],
      avatar_url: data?.avatar_url ?? null,
      xp: data?.xp ?? 0,
      level: data?.level ?? 1,
      plan: data?.plan ?? 'free',
      stripe_customer_id: data?.stripe_customer_id ?? null,
      created_at: data?.created_at ?? now,
      updated_at: data?.updated_at ?? now,
    } as Profile;
  };

  const createProfile = async (authUser: SupabaseUser) => {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: authUser.id,
        name: authUser.user_metadata?.name ?? authUser.email ?? 'User',
        avatar_url: authUser.user_metadata?.avatar_url ?? null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('createProfile Supabase error:', error.message, error);
      return null;
    }
    return normalizeProfile(data as Profile, authUser);
  };

  const fetchProfile = async (authUser: SupabaseUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') {
          const created = await createProfile(authUser);
          if (created) {
            setProfile(created);
            return;
          }
        }
        console.error('fetchProfile Supabase error:', error.message, error);
        setProfile(normalizeProfile(null, authUser));
        return;
      }
      if (data) {
        setProfile(normalizeProfile(data as Profile, authUser));
        return;
      }

      const created = await createProfile(authUser);
      if (created) {
        setProfile(created);
      } else {
        setProfile(normalizeProfile(null, authUser));
      }
    } catch (err) {
      console.error('fetchProfile exception:', err);
      setProfile(normalizeProfile(null, authUser));
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Avoid UI hanging on refresh while profile fetch runs
        setProfile(normalizeProfile(null, session.user));
        void fetchProfile(session.user);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('getSession error:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Provide an immediate fallback profile during refresh
          setProfile(normalizeProfile(null, session.user));
          await fetchProfile(session.user);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error?.message ?? null };
    } catch (err) {
      console.error('signIn exception:', err);
      return { error: err instanceof Error ? err.message : 'Sign in failed' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (data) setProfile(data as Profile);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
