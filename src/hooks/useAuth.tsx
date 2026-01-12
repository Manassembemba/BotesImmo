import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  nom: string;
  prenom: string;
  avatar_url?: string;
  location_id?: string;
  locations?: { nom: string } | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nom: string, prenom: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserDetails = async (userId: string) => {
    console.log('Fetching details for user...', userId);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout after 8s')), 8000)
    );

    try {
      const fetchPromise = (async () => {
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
        if (roleError) console.error('Role fetch error:', roleError);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('nom, prenom, avatar_url, location_id, locations(nom)')
          .eq('user_id', userId)
          .maybeSingle();
        if (profileError) console.error('Profile fetch error:', profileError);

        return { role: roleData?.role || null, profile: profileData || null };
      })();

      const result = await Promise.race([fetchPromise, timeoutPromise]) as { role: string | null, profile: Profile | null };

      console.log('Successfully fetched user details:', result);
      setRole(result.role);
      setProfile(result.profile);
    } catch (err) {
      console.error('fetchUserDetails failed or timed out:', err);
      setRole(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async (session: Session | null) => {
      if (!mounted) return;

      console.log('Initializing auth state with session:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserDetails(session.user.id);
      } else {
        setRole(null);
        setProfile(null);
      }

      if (mounted) setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      initialize(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          initialize(session);
        } else if (event === 'SIGNED_OUT') {
          initialize(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, nom: string, prenom: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nom,
          prenom,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
