import { useState, useEffect, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * AdminRoute component that provides server-side verified admin access control.
 * 
 * Instead of relying solely on client-side userRole checks (which can be bypassed),
 * this component verifies the admin role directly from the database before rendering
 * admin content. This provides defense-in-depth protection beyond RLS policies.
 */
const AdminRoute = ({ children }: AdminRouteProps) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const verifyAdminRole = async () => {
      if (!user) {
        setAuthorized(false);
        return;
      }

      try {
        // Server-side verification by querying the database
        // RLS policies ensure this query only succeeds if the user has admin role
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'suporte'])
          .maybeSingle();

        if (error) {
          console.error('Error verifying admin role:', error.message);
          setAuthorized(false);
          return;
        }

        setAuthorized(!!data);
      } catch (err) {
        console.error('Admin verification failed:', err);
        setAuthorized(false);
      }
    };

    if (!authLoading) {
      verifyAdminRole();
    }
  }, [user, authLoading]);

  // Still loading auth state
  if (authLoading || authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authorized
  if (!authorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
