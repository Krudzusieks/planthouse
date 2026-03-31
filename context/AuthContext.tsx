import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  full_name: string;
  role: 'boss' | 'manager' | 'worker';
  company_id: string;
  must_change_password: boolean;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  code: string;
}

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  lockSession: () => void;
  unlockSession: (bossUserId: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null, profile: null, company: null, loading: true,
  refreshProfile: async () => {},
  lockSession: () => {},
  unlockSession: () => {},
});

export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null);
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [company, setCompany]   = useState<Company | null>(null);
  const [loading, setLoading]   = useState(true);
  const sessionLocked           = useRef(false);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, company_id, must_change_password')
      .eq('id', userId)
      .single();
    if (error || !data) return;
    setProfile(data as Profile);

    if (data.company_id) {
      const { data: co } = await supabase
        .from('companies')
        .select('id, name, slug, code')
        .eq('id', data.company_id)
        .single();
      if (co) setCompany(co as Company);
    }
  };

  const refreshProfile = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user?.id) await fetchProfile(s.user.id);
  };

  const lockSession = () => { sessionLocked.current = true; };
  const unlockSession = (bossUserId: string) => {
    sessionLocked.current = false;
    fetchProfile(bossUserId);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (sessionLocked.current) return;
      setSession(newSession);
      if (newSession?.user) fetchProfile(newSession.user.id);
      else { setProfile(null); setCompany(null); }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, company, loading, refreshProfile, lockSession, unlockSession }}>
      {children}
    </AuthContext.Provider>
  );
}