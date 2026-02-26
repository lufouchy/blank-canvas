import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'employee' | 'suporte' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  organizationId: string | null;
  profile: { full_name: string; email: string; avatar_url: string | null; position: string | null } | null;
  refreshProfile: () => Promise<void>;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, companyName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; email: string; avatar_url: string | null; position: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    // Fetch profile (includes organization_id)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_url, organization_id, position')
      .eq('user_id', userId)
      .single();

    if (profileData) {
      setProfile({ full_name: profileData.full_name, email: profileData.email, avatar_url: profileData.avatar_url, position: profileData.position });
      setOrganizationId(profileData.organization_id);
    }

    // Fetch role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleData) {
      setUserRole(roleData.role as UserRole);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setUserRole(null);
          setOrganizationId(null);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserData(session.user.id);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, companyName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && data.user) {
      // 1. Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: companyName,
        })
        .select('id')
        .single();

      if (orgError) {
        console.error('Error creating organization:', orgError.message);
        return { error: orgError };
      }

      const newOrgId = orgData.id;

      // 2. Create profile with organization_id
      await supabase.from('profiles').insert({
        user_id: data.user.id,
        full_name: fullName,
        email: email,
        organization_id: newOrgId,
      });

      // 3. Create admin role (first user of org is admin)
      await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: 'admin',
        organization_id: newOrgId,
      });

      // 4. Create hours balance
      await supabase.from('hours_balance').insert({
        user_id: data.user.id,
        balance_minutes: 0,
        organization_id: newOrgId,
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    setOrganizationId(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        organizationId,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
