import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, LogIn, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const GestorDashboard = () => {
  const { user, organizationId, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', org_code: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orgs:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as organizações.',
      });
    }
    setOrgs(data || []);
    setLoading(false);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrg.name.trim() || !newOrg.org_code.trim()) return;

    setCreating(true);
    const { error } = await supabase
      .from('organizations')
      .insert({ name: newOrg.name.trim(), org_code: newOrg.org_code.trim() });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Sucesso', description: 'Organização criada com sucesso!' });
      setNewOrg({ name: '', org_code: '' });
      setDialogOpen(false);
      fetchOrgs();
    }
    setCreating(false);
  };

  const handleSwitchOrg = async (orgId: string) => {
    if (!user) return;
    setSwitching(orgId);

    const { error } = await supabase
      .from('profiles')
      .update({ organization_id: orgId })
      .eq('user_id', user.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível trocar de organização.',
      });
      setSwitching(null);
      return;
    }

    await refreshProfile();
    toast({ title: 'Organização alterada', description: 'Visualizando como administrador.' });
    navigate('/');
  };

  return (
    <SidebarLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão do Sistema</h1>
            <p className="text-muted-foreground">
              Gerencie organizações e acesse como administrador
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova Organização
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Organização</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Organização</Label>
                  <Input
                    value={newOrg.name}
                    onChange={(e) => setNewOrg((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Empresa ABC Ltda"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código (ID da Organização)</Label>
                  <Input
                    value={newOrg.org_code}
                    onChange={(e) => setNewOrg((p) => ({ ...p, org_code: e.target.value }))}
                    placeholder="Ex: 12345"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Organização
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Organizações Cadastradas
            </h2>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orgs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma organização cadastrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgs.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>{org.org_code || '—'}</TableCell>
                        <TableCell>
                          {new Date(org.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={org.id === organizationId ? 'secondary' : 'default'}
                            disabled={switching === org.id || org.id === organizationId}
                            onClick={() => handleSwitchOrg(org.id)}
                          >
                            {switching === org.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <LogIn className="mr-1 h-3 w-3" />
                            )}
                            {org.id === organizationId ? 'Atual' : 'Acessar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
};

export default GestorDashboard;
