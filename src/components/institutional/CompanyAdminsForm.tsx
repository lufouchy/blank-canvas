import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, UserCheck, AlertCircle } from 'lucide-react';
import { validateCPF, formatCPF } from '@/utils/cpfValidation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CompanyAdminsFormProps {
  companyId: string;
}

interface Admin {
  id?: string;
  full_name: string;
  cpf: string;
  email: string;
  position: string;
  password?: string;
  confirm_password?: string;
}

const positions = [
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'diretor', label: 'Diretor' },
  { value: 'dono', label: 'Dono/Proprietário' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'rh', label: 'RH' },
  { value: 'socio', label: 'Sócio' },
  { value: 'outro', label: 'Outro' },
];

const emptyAdmin: Admin = {
  full_name: '',
  cpf: '',
  email: '',
  position: 'rh',
  password: '',
  confirm_password: '',
};

const MAX_ADMINS = 4;

const CompanyAdminsForm = ({ companyId }: CompanyAdminsFormProps) => {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<Admin>(emptyAdmin);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [cpfError, setCpfError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<number | null>(null);

  useEffect(() => {
    const fetchAdmins = async () => {
      if (!companyId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('company_admins')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        if (data) {
          setAdmins(data.map(a => ({
            id: a.id,
            full_name: a.full_name || '',
            cpf: formatCPF(a.cpf || ''),
            email: a.email || '',
            position: a.position || 'rh',
          })));
        }
      } catch (error) {
        console.error('Error fetching admins:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdmins();
  }, [companyId]);

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    setCurrentAdmin({ ...currentAdmin, cpf: formatted });
    
    const cleanCPF = value.replace(/\D/g, '');
    if (cleanCPF.length === 11) {
      if (!validateCPF(cleanCPF)) {
        setCpfError('CPF inválido');
      } else {
        setCpfError('');
      }
    } else {
      setCpfError('');
    }
  };

  const handlePasswordChange = (field: 'password' | 'confirm_password', value: string) => {
    const newAdmin = { ...currentAdmin, [field]: value };
    setCurrentAdmin(newAdmin);
    
    if (newAdmin.password && newAdmin.confirm_password) {
      if (newAdmin.password !== newAdmin.confirm_password) {
        setPasswordError('As senhas não coincidem');
      } else if (newAdmin.password.length < 6) {
        setPasswordError('A senha deve ter pelo menos 6 caracteres');
      } else {
        setPasswordError('');
      }
    } else {
      setPasswordError('');
    }
  };

  const handleSaveAdmin = async () => {
    const cleanCPF = currentAdmin.cpf.replace(/\D/g, '');
    if (!validateCPF(cleanCPF)) {
      setCpfError('CPF inválido');
      return;
    }

    // For new admins, password is required
    if (editingIndex === null) {
      if (!currentAdmin.password || currentAdmin.password.length < 6) {
        setPasswordError('A senha deve ter pelo menos 6 caracteres');
        return;
      }
      if (currentAdmin.password !== currentAdmin.confirm_password) {
        setPasswordError('As senhas não coincidem');
        return;
      }
    }

    setLoading(true);
    try {
      const adminData = {
        company_id: companyId,
        full_name: currentAdmin.full_name,
        cpf: cleanCPF,
        email: currentAdmin.email,
        position: currentAdmin.position as any,
      };

      if (editingIndex !== null && admins[editingIndex]?.id) {
        const { error } = await supabase
          .from('company_admins')
          .update(adminData)
          .eq('id', admins[editingIndex].id);

        if (error) throw error;

        const updatedAdmins = [...admins];
        updatedAdmins[editingIndex] = { ...currentAdmin, id: admins[editingIndex].id };
        setAdmins(updatedAdmins);
        
        toast({
          title: 'Administrador atualizado',
          description: 'Os dados do administrador foram atualizados com sucesso',
        });
      } else {
        // Get organization_id
        const { data: caOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
        const orgId = caOrgData?.organization_id;

        // First, get the company's organization_id (for suporte users viewing other orgs)
        const { data: companyData } = await supabase
          .from('company_info')
          .select('organization_id')
          .eq('id', companyId)
          .single();

        const targetOrgId = companyData?.organization_id || orgId;

        // Create auth user via edge function
        const { data: fnData, error: fnError } = await supabase.functions.invoke('create-employee', {
          body: {
            email: currentAdmin.email,
            password: currentAdmin.password,
            full_name: currentAdmin.full_name,
            role: 'admin',
            organization_id: userRole === 'suporte' ? targetOrgId : undefined,
            profileData: {
              cpf: cleanCPF,
              position: currentAdmin.position,
            },
          },
        });

        if (fnError) throw new Error(fnError.message || 'Erro ao criar usuário');
        if (fnData?.error) throw new Error(fnData.error);

        const newUserId = fnData?.user_id;

        // Save to company_admins table
        const { data, error } = await supabase
          .from('company_admins')
          .insert({ 
            ...adminData, 
            organization_id: targetOrgId!,
            user_id: newUserId || null,
          })
          .select('id')
          .single();

        if (error) throw error;

        setAdmins([...admins, { ...currentAdmin, id: data.id }]);
        
        toast({
          title: 'Administrador cadastrado',
          description: 'O administrador foi criado com sucesso e já pode acessar o sistema.',
        });
      }

      setCurrentAdmin(emptyAdmin);
      setEditingIndex(null);
      setCpfError('');
      setPasswordError('');
    } catch (error: any) {
      console.error('Error saving admin:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar o responsável',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditAdmin = (index: number) => {
    setCurrentAdmin({ ...admins[index], password: '', confirm_password: '' });
    setEditingIndex(index);
  };

  const handleDeleteAdmin = async () => {
    if (adminToDelete === null) return;
    
    const admin = admins[adminToDelete];
    if (!admin.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('company_admins')
        .delete()
        .eq('id', admin.id);

      if (error) throw error;

      setAdmins(admins.filter((_, i) => i !== adminToDelete));
      toast({
        title: 'Administrador excluído',
        description: 'O administrador foi removido com sucesso',
      });
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message || 'Não foi possível excluir o responsável',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setAdminToDelete(null);
    }
  };

  const canAddMore = admins.length < MAX_ADMINS;
  const isFormDisabled = !canAddMore && editingIndex === null;

  return (
    <div className="space-y-6">
      {/* Info about max admins */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Você pode cadastrar até {MAX_ADMINS} administradores do sistema.
          Estes usuários terão acesso completo a todas as funcionalidades administrativas.
        </AlertDescription>
      </Alert>

      {/* List of existing admins */}
      {admins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Administradores Cadastrados</CardTitle>
            <CardDescription>
              {admins.length} de {MAX_ADMINS} administrador(es) registrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {admins.map((admin, index) => (
              <div
                key={admin.id || index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium">{admin.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {admin.email} • {positions.find(p => p.value === admin.position)?.label}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditAdmin(index)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setAdminToDelete(index);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Admin form */}
      {(canAddMore || editingIndex !== null) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              {editingIndex !== null ? 'Editar Administrador' : 'Novo Administrador do Sistema'}
            </CardTitle>
            <CardDescription>
              Preencha os dados do administrador do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin_name">Nome Completo *</Label>
                <Input
                  id="admin_name"
                  value={currentAdmin.full_name}
                  onChange={(e) => setCurrentAdmin({ ...currentAdmin, full_name: e.target.value })}
                  placeholder="Nome completo do responsável"
                  disabled={isFormDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin_cpf">CPF *</Label>
                <Input
                  id="admin_cpf"
                  value={currentAdmin.cpf}
                  onChange={(e) => handleCPFChange(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  disabled={isFormDisabled}
                />
                {cpfError && (
                  <p className="text-sm text-destructive">{cpfError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin_email">E-mail de Login *</Label>
                <Input
                  id="admin_email"
                  type="email"
                  value={currentAdmin.email}
                  onChange={(e) => setCurrentAdmin({ ...currentAdmin, email: e.target.value })}
                  placeholder="email@empresa.com"
                  disabled={isFormDisabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin_position">Cargo *</Label>
                <Select
                  value={currentAdmin.position}
                  onValueChange={(value) => setCurrentAdmin({ ...currentAdmin, position: value })}
                  disabled={isFormDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos.value} value={pos.value}>
                        {pos.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Password fields - only for new admins */}
            {editingIndex === null && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="admin_password">Senha *</Label>
                  <Input
                    id="admin_password"
                    type="password"
                    value={currentAdmin.password || ''}
                    onChange={(e) => handlePasswordChange('password', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    disabled={isFormDisabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_confirm_password">Confirmar Senha *</Label>
                  <Input
                    id="admin_confirm_password"
                    type="password"
                    value={currentAdmin.confirm_password || ''}
                    onChange={(e) => handlePasswordChange('confirm_password', e.target.value)}
                    placeholder="Confirme a senha"
                    disabled={isFormDisabled}
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-destructive md:col-span-2">{passwordError}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              {editingIndex !== null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentAdmin(emptyAdmin);
                    setEditingIndex(null);
                    setCpfError('');
                    setPasswordError('');
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSaveAdmin}
                disabled={
                  loading || 
                  !!cpfError || 
                  !!passwordError ||
                  !currentAdmin.full_name || 
                  !currentAdmin.cpf || 
                  !currentAdmin.email ||
                  (editingIndex === null && (!currentAdmin.password || !currentAdmin.confirm_password))
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : editingIndex !== null ? (
                  'Atualizar Administrador'
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar Administrador
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!canAddMore && editingIndex === null && (
        <Card>
          <CardContent className="py-8 text-center">
            <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Limite máximo de {MAX_ADMINS} administradores atingido.
              Para adicionar um novo, remova um existente.
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O administrador será permanentemente removido
              e perderá acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAdmin}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyAdminsForm;
