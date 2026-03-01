import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Building2, LogIn, Loader2, Search, Download, Plus, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { validateCNPJ, formatCNPJ } from '@/utils/cnpjValidation';

interface OrgWithCompany {
  id: string;
  name: string;
  org_code: string | null;
  created_at: string;
  cnpj?: string;
  nome_fantasia?: string;
}

const GestorDashboard = () => {
  const { user, organizationId, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [orgs, setOrgs] = useState<OrgWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('organizations');

  // New org creation
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCnpj, setNewOrgCnpj] = useState('');
  const [cnpjError, setCnpjError] = useState('');
  const [creating, setCreating] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);
  const [exportOrgId, setExportOrgId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    setLoading(true);
    // Fetch all organizations
    const { data: orgData, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as organizações.' });
      setOrgs([]);
      setLoading(false);
      return;
    }

    // Fetch company_info for all orgs to get CNPJ and nome_fantasia
    const { data: companies } = await supabase
      .from('company_info')
      .select('organization_id, cnpj, nome_fantasia');

    const companyMap = new Map<string, { cnpj: string; nome_fantasia: string }>();
    (companies || []).forEach((c) => {
      companyMap.set(c.organization_id, { cnpj: c.cnpj, nome_fantasia: c.nome_fantasia });
    });

    const merged: OrgWithCompany[] = (orgData || []).map((org) => {
      const company = companyMap.get(org.id);
      return {
        ...org,
        cnpj: company?.cnpj,
        nome_fantasia: company?.nome_fantasia,
      };
    });

    setOrgs(merged);
    setLoading(false);
  };

  const generateOrgCode = async (cnpjDigits: string): Promise<string> => {
    const { data: allOrgs } = await supabase
      .from('organizations')
      .select('org_code')
      .not('org_code', 'is', null);

    const existingCodes = new Set((allOrgs || []).map((o) => o.org_code));
    const base = parseInt(cnpjDigits.substring(0, 5), 10);

    let candidate = base;
    while (existingCodes.has(String(candidate).padStart(5, '0'))) {
      candidate++;
    }
    return String(candidate).padStart(5, '0');
  };

  const handleCreateOrg = async () => {
    const cleanCnpj = newOrgCnpj.replace(/\D/g, '');
    if (!newOrgName.trim()) return;
    if (cleanCnpj.length !== 14 || !validateCNPJ(cleanCnpj)) {
      setCnpjError('CNPJ inválido');
      return;
    }

    setCreating(true);
    try {
      // Generate unique org_code
      const orgCode = await generateOrgCode(cleanCnpj);

      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: newOrgName.trim(), org_code: orgCode })
        .select('id')
        .single();

      if (orgError) throw orgError;

      toast({ title: 'Sucesso', description: `Organização criada com ID ${orgCode}` });
      setNewOrgName('');
      setNewOrgCnpj('');
      setCnpjError('');
      setCreateDialogOpen(false);
      fetchOrgs();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleSwitchOrg = async (orgId: string) => {
    if (!user) return;
    setSwitching(orgId);

    const { error } = await supabase
      .from('profiles')
      .update({ organization_id: orgId })
      .eq('user_id', user.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível trocar de organização.' });
      setSwitching(null);
      return;
    }

    // Also update user_roles to point to the new org so RLS works
    await supabase
      .from('user_roles')
      .update({ organization_id: orgId })
      .eq('user_id', user.id);

    await refreshProfile();
    toast({ title: 'Organização alterada', description: 'Agora você está visualizando os dados desta organização.' });
    setSwitching(null);
  };

  const handleExport = async (orgId: string, format: 'csv' | 'sql') => {
    setExporting(true);
    setExportOrgId(orgId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke('export-database', {
        body: { organization_id: orgId, format },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (format === 'sql') {
        const blob = new Blob([data.data], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${orgId.substring(0, 8)}.sql`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV: multiple files zipped conceptually — download as single combined file
        const csvData = data.data as Record<string, string>;
        let combined = '';
        for (const [table, csv] of Object.entries(csvData)) {
          combined += `\n--- TABLE: ${table} ---\n${csv}\n`;
        }
        const blob = new Blob([combined], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${orgId.substring(0, 8)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({ title: 'Exportação concluída', description: `Dados exportados em ${format.toUpperCase()}.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro na exportação', description: err.message });
    } finally {
      setExporting(false);
      setExportOrgId(null);
    }
  };

  const handleCnpjInput = (value: string) => {
    const formatted = formatCNPJ(value);
    setNewOrgCnpj(formatted);
    const clean = value.replace(/\D/g, '');
    if (clean.length === 14) {
      setCnpjError(validateCNPJ(clean) ? '' : 'CNPJ inválido');
    } else {
      setCnpjError('');
    }
  };

  const filteredOrgs = orgs.filter((org) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (org.org_code || '').toLowerCase().includes(term) ||
      (org.cnpj || '').includes(term.replace(/\D/g, '')) ||
      (org.name || '').toLowerCase().includes(term) ||
      (org.nome_fantasia || '').toLowerCase().includes(term)
    );
  });

  return (
    <SidebarLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão do Sistema</h1>
            <p className="text-muted-foreground">
              Gerencie organizações, acesse como administrador e exporte dados
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="organizations">Organizações</TabsTrigger>
            <TabsTrigger value="export">Exportar Dados</TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, CNPJ ou Nome da empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Nova Organização
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Nova Organização</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome da Organização *</Label>
                      <Input
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="Ex: Empresa ABC Ltda"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CNPJ *</Label>
                      <Input
                        value={newOrgCnpj}
                        onChange={(e) => handleCnpjInput(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                      />
                      {cnpjError && <p className="text-sm text-destructive">{cnpjError}</p>}
                      <p className="text-xs text-muted-foreground">
                        O ID da organização será gerado automaticamente a partir dos primeiros 5 dígitos do CNPJ.
                      </p>
                    </div>
                    <Button
                      onClick={handleCreateOrg}
                      className="w-full"
                      disabled={creating || !newOrgName.trim() || !newOrgCnpj || !!cnpjError}
                    >
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Criar Organização
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Organizações Cadastradas
                </CardTitle>
                <CardDescription>
                  Selecione uma organização para acessar seus dados como administrador
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredOrgs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {searchTerm ? 'Nenhuma organização encontrada para o filtro.' : 'Nenhuma organização cadastrada.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Criada em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrgs.map((org) => (
                          <TableRow key={org.id} className={org.id === organizationId ? 'bg-primary/5' : ''}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {org.org_code || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{org.nome_fantasia || org.name}</p>
                                {org.nome_fantasia && org.name !== org.nome_fantasia && (
                                  <p className="text-xs text-muted-foreground">{org.name}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {org.cnpj ? formatCNPJ(org.cnpj) : '—'}
                            </TableCell>
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
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" /> Exportar Banco de Dados
                </CardTitle>
                <CardDescription>
                  Exporte todos os dados de uma organização em formato CSV ou SQL
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : orgs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma organização cadastrada.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Organização</TableHead>
                          <TableHead className="text-right">Exportar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orgs.map((org) => (
                          <TableRow key={org.id}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {org.org_code || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {org.nome_fantasia || org.name}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={exporting && exportOrgId === org.id}
                                onClick={() => handleExport(org.id, 'csv')}
                              >
                                {exporting && exportOrgId === org.id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="mr-1 h-3 w-3" />
                                )}
                                CSV
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={exporting && exportOrgId === org.id}
                                onClick={() => handleExport(org.id, 'sql')}
                              >
                                {exporting && exportOrgId === org.id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="mr-1 h-3 w-3" />
                                )}
                                SQL
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
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
};

export default GestorDashboard;
