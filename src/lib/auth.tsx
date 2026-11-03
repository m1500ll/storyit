import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeToRealtime } from '@/services/repository/supabaseRepository';
import { store } from '@/services/store';
import { supabase } from './supabase';

interface AuthState {
  /** `undefined` while the initial session is loading. Always a truthy stub in mock mode. */
  session: Session | null | undefined;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ session: undefined, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : ({} as Session));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      store.notify();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    return subscribeToRealtime(supabase);
  }, [session]);

  const signOut = async () => { await supabase?.auth.signOut(); };
  return <AuthContext.Provider value={{ session, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
