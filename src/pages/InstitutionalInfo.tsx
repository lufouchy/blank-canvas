import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompanyInfoForm from '@/components/institutional/CompanyInfoForm';
import BranchesForm from '@/components/institutional/BranchesForm';
import CompanyAdminsForm from '@/components/institutional/CompanyAdminsForm';

const InstitutionalInfo = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [hasBranches, setHasBranches] = useState(false);

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('company_info')
          .select('id, has_branches')
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setCompanyId(data.id);
          setHasBranches(data.has_branches);
        }
      } catch (error) {
        console.error('Error fetching company info:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchCompanyInfo();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  if (!user || (userRole !== 'admin' && userRole !== 'suporte')) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Informações Institucionais
            </h1>
            <p className="text-muted-foreground">
              Cadastre os dados da sua empresa
            </p>
          </div>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company">Dados da Empresa</TabsTrigger>
            <TabsTrigger value="branches" disabled={!companyId}>
              Filiais
            </TabsTrigger>
            <TabsTrigger value="admins" disabled={!companyId}>
              Administradores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <CompanyInfoForm 
              companyId={companyId} 
              onSave={(id, hasBranches) => {
                setCompanyId(id);
                setHasBranches(hasBranches);
              }} 
            />
          </TabsContent>

          <TabsContent value="branches">
            {companyId && (
              <BranchesForm 
                companyId={companyId} 
                hasBranches={hasBranches} 
              />
            )}
          </TabsContent>

          <TabsContent value="admins">
            {companyId && <CompanyAdminsForm companyId={companyId} />}
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
};

export default InstitutionalInfo;
