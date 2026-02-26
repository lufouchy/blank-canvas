import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Mail, 
  Calendar, 
  MapPin, 
  Briefcase,
  Loader2,
  IdCard,
  Clock,
  KeyRound
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProfileData {
  full_name: string;
  email: string;
  avatar_url: string | null;
  cpf: string | null;
  birth_date: string | null;
  hire_date: string | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  sector: string | null;
  position: string | null;
  work_schedule_id: string | null;
}

interface WorkSchedule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
}

const EmployeeProfile = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Senha muito curta', description: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Senhas não conferem', description: 'A confirmação de senha deve ser igual à nova senha.' });
      return;
    }
    setIsChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-password', {
        body: { new_password: newPassword, is_self_update: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Senha alterada!', description: 'Sua senha foi atualizada com sucesso.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao alterar senha', description: error.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const profileWithExtras = profile as unknown as ProfileData;
        setProfileData(profileWithExtras);

        if (profileWithExtras.work_schedule_id) {
          const { data: schedule } = await supabase
            .from('work_schedules')
            .select('*')
            .eq('id', profileWithExtras.work_schedule_id)
            .single();

          if (schedule) {
            setWorkSchedule(schedule);
          }
        }
      }

      setIsLoading(false);
    };

    fetchProfile();
  }, [user?.id]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return '---';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatAddress = () => {
    if (!profileData?.address_street) return '---';
    const parts = [
      profileData.address_street,
      profileData.address_number,
      profileData.address_complement,
      profileData.address_neighborhood,
      profileData.address_city,
      profileData.address_state,
      profileData.address_cep ? `CEP: ${profileData.address_cep}` : null,
    ].filter(Boolean);
    return parts.join(', ');
  };

  if (loading || isLoading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in p-6">
        {/* Header Card */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                {profileData?.avatar_url ? (
                  <AvatarImage src={profileData.avatar_url} alt={profileData.full_name} />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {getInitials(profileData?.full_name)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{profileData?.full_name}</h1>
                <p className="text-muted-foreground">{profileData?.email}</p>
                <Badge variant="secondary" className="mt-2">
                  Colaborador
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Profile Details */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IdCard className="h-4 w-4" />
                  CPF
                </div>
                <p className="font-medium">{formatCPF(profileData?.cpf)}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Data de Nascimento
                </div>
                <p className="font-medium">
                  {profileData?.birth_date 
                    ? format(parseISO(profileData.birth_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : '---'}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  E-mail
                </div>
                <p className="font-medium">{profileData?.email || '---'}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Data de Admissão
                </div>
                <p className="font-medium">
                  {profileData?.hire_date 
                    ? format(parseISO(profileData.hire_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : '---'}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Setor/Departamento
                </div>
                <p className="font-medium">{profileData?.sector || '---'}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Cargo
                </div>
                <p className="font-medium">{profileData?.position || '---'}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Endereço
              </div>
              <p className="font-medium">{formatAddress()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Work Schedule */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Jornada de Trabalho
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workSchedule ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">{workSchedule.name}</span>
                  <Badge variant="outline">Ativa</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Entrada</p>
                    <p className="text-lg font-semibold">{workSchedule.start_time?.slice(0, 5) || '--:--'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Ent. Intervalo</p>
                    <p className="text-lg font-semibold">{workSchedule.break_start_time?.slice(0, 5) || '--:--'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Saí. Intervalo</p>
                    <p className="text-lg font-semibold">{workSchedule.break_end_time?.slice(0, 5) || '--:--'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Saída</p>
                    <p className="text-lg font-semibold">{workSchedule.end_time?.slice(0, 5) || '--:--'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma jornada de trabalho atribuída.
              </p>
            )}
          </CardContent>
        </Card>
        {/* Change Password */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-primary" />
              Alterar Senha de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">Nova Senha</Label>
              <Input
                id="new_password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirmar Nova Senha</Label>
              <Input
                id="confirm_password"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                'Alterar Senha'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
};

export default EmployeeProfile;
