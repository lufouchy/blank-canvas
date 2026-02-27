import { useState, useEffect, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface GestorRouteProps {
  children: ReactNode;
}

const GestorRoute = ({ children }: GestorRouteProps) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const verify = async () => {
      if (!user) {
        setAuthorized(false);
        return;
      }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'suporte')
        .maybeSingle();

      setAuthorized(!!data);
    };

    if (!authLoading) verify();
  }, [user, authLoading]);

  if (authLoading || authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default GestorRoute;
