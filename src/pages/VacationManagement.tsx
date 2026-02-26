import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Plus,
  Calendar as CalendarIcon,
  Users,
  User,
  CheckCircle,
  XCircle,
  Clock,
  Palmtree,
  CalendarDays,
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import VacationReceiptExport from '@/components/vacation/VacationReceiptExport';
import VacationReceiptExportAdmin from '@/components/vacation/VacationReceiptExportAdmin';
import VacationHistoryPanel from '@/components/admin/VacationHistoryPanel';
import VacationEditDialog from '@/components/vacation/VacationEditDialog';
import VacationCancelDialog from '@/components/vacation/VacationCancelDialog';
import VacationPlanningPanel from '@/components/admin/VacationPlanningPanel';

type VacationType = 'individual' | 'collective';
type VacationStatus = 'pending' | 'approved' | 'rejected';

interface VacationRequest {
  id: string;
  user_id: string;
  vacation_type: VacationType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: VacationStatus;
  is_admin_created: boolean;
  created_at: string;
  userName?: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

const statusConfig: Record<VacationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: typeof Clock }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Reprovado', variant: 'destructive', icon: XCircle },
};

const VacationManagement = () => {
  const { user, userRole, loading } = useAuth();
  const { toast } = useToast();
  const [vacations, setVacations] = useState<VacationRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [vacationType, setVacationType] = useState<VacationType>('individual');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: vacationsData, error: vacationsError } = await supabase
      .from('vacation_requests')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name');

    if (!vacationsError && vacationsData) {
      const profileMap = new Map(profilesData?.map((p) => [p.user_id, p.full_name]) || []);
      setVacations(
        vacationsData.map((v) => ({
          ...v,
          vacation_type: v.vacation_type as VacationType,
          status: v.status as VacationStatus,
          userName: profileMap.get(v.user_id) || 'Usuário',
        }))
      );
    }

    setProfiles(profilesData || []);
    setIsLoading(false);
  };

  const handleCreateVacation = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Selecione o período das férias.' });
      return;
    }
    if (vacationType === 'individual' && !selectedEmployee) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Selecione o colaborador.' });
      return;
    }

    setSubmitting(true);
    const daysCount = differenceInDays(dateRange.to, dateRange.from) + 1;

    if (vacationType === 'collective') {
      const { data: vacOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', user?.id).single();
      const inserts = profiles.map((profile) => ({
        user_id: profile.user_id,
        vacation_type: 'collective' as const,
        start_date: format(dateRange.from!, 'yyyy-MM-dd'),
        end_date: format(dateRange.to!, 'yyyy-MM-dd'),
        days_count: daysCount,
        reason: reason || 'Férias coletivas',
        status: 'approved' as const,
        created_by: user?.id,
        is_admin_created: true,
        organization_id: vacOrgData?.organization_id,
      }));
      const { error } = await supabase.from('vacation_requests').insert(inserts);
      if (error) {
        toast({ variant: 'destructive', title: 'Erro ao registrar férias', description: error.message });
      } else {
        toast({ title: 'Férias coletivas registradas!', description: `${profiles.length} colaboradores terão férias de ${daysCount} dias.` });
        resetForm();
        fetchData();
      }
    } else {
      const { data: indOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', user?.id).single();
      const { error } = await supabase.from('vacation_requests').insert({
        user_id: selectedEmployee,
        vacation_type: 'individual',
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd'),
        days_count: daysCount,
        reason: reason || null,
        status: 'approved',
        created_by: user?.id,
        is_admin_created: true,
        organization_id: indOrgData?.organization_id,
      });
      if (error) {
        toast({ variant: 'destructive', title: 'Erro ao registrar férias', description: error.message });
      } else {
        toast({ title: 'Férias registradas!', description: `Férias de ${daysCount} dias registradas com sucesso.` });
        resetForm();
        fetchData();
      }
    }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: VacationStatus) => {
    const { error } = await supabase
      .from('vacation_requests')
      .update({ status: newStatus, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
    } else {
      toast({ title: newStatus === 'approved' ? 'Férias aprovadas!' : 'Férias reprovadas' });
      fetchData();
    }
  };

  const resetForm = () => {
    setShowDialog(false);
    setVacationType('individual');
    setSelectedEmployee('');
    setDateRange(undefined);
    setReason('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (userRole !== 'admin' && userRole !== 'suporte')) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Palmtree className="h-6 w-6 text-primary" />
            Férias
          </h1>
          <p className="text-muted-foreground">
            Gerencie férias e visualize a programação de ausências
          </p>
        </div>

        <Tabs defaultValue="management" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="management" className="flex items-center gap-2">
              <Palmtree className="h-4 w-4" />
              <span className="hidden sm:inline">Gestão de Férias</span>
              <span className="sm:hidden">Gestão</span>
            </TabsTrigger>
            <TabsTrigger value="planning" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Programação de Férias</span>
              <span className="sm:hidden">Programação</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="management" className="space-y-6">
            <div className="flex items-center justify-between">
              <div />
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Registrar Férias
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>Registrar Férias</DialogTitle>
                    <DialogDescription>
                      Registre férias individuais ou coletivas para os colaboradores.
                    </DialogDescription>
                  </DialogHeader>

                  <ScrollArea className="flex-1 overflow-y-auto pr-4" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Tipo de Férias</Label>
                        <Select value={vacationType} onValueChange={(v) => setVacationType(v as VacationType)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual">
                              <div className="flex items-center gap-2"><User className="h-4 w-4" />Individual</div>
                            </SelectItem>
                            <SelectItem value="collective">
                              <div className="flex items-center gap-2"><Users className="h-4 w-4" />Coletivas</div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {vacationType === 'individual' && (
                        <div className="space-y-2">
                          <Label>Colaborador</Label>
                          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                            <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                            <SelectContent>
                              {profiles.map((profile) => (
                                <SelectItem key={profile.user_id} value={profile.user_id}>{profile.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Período das Férias</Label>
                        <div className="border rounded-lg p-3">
                          <Calendar mode="range" selected={dateRange} onSelect={setDateRange} locale={ptBR} numberOfMonths={1} />
                        </div>
                        {dateRange?.from && dateRange?.to && (
                          <p className="text-sm text-muted-foreground">
                            {differenceInDays(dateRange.to, dateRange.from) + 1} dias selecionados
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Observação (opcional)</Label>
                        <Textarea placeholder="Adicione uma observação..." value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
                      </div>

                      <Button onClick={handleCreateVacation} className="w-full" disabled={submitting}>
                        {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</>) : 'Registrar Férias'}
                      </Button>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Registro de Férias
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : vacations.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Nenhuma férias registrada</p>
                    <p className="text-muted-foreground text-sm">Clique em "Registrar Férias" para adicionar.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Dias</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Recibo</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacations.map((vacation) => {
                        const StatusIcon = statusConfig[vacation.status].icon;
                        return (
                          <TableRow key={vacation.id}>
                            <TableCell className="font-medium">{vacation.userName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {vacation.vacation_type === 'collective' ? (
                                  <><Users className="h-3 w-3 mr-1" />Coletivas</>
                                ) : (
                                  <><User className="h-3 w-3 mr-1" />Individual</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(parseISO(vacation.start_date), 'dd/MM/yyyy')} - {format(parseISO(vacation.end_date), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>
                              {vacation.days_count} dias
                              {(vacation as any).sell_days > 0 && (
                                <span className="text-xs text-muted-foreground block">+ {(vacation as any).sell_days} vendidos</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusConfig[vacation.status].variant} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig[vacation.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {vacation.status === 'approved' && (
                                <VacationReceiptExportAdmin
                                  vacationId={vacation.id}
                                  userId={vacation.user_id}
                                  userName={vacation.userName || 'Colaborador'}
                                  startDate={vacation.start_date}
                                  endDate={vacation.end_date}
                                  daysCount={vacation.days_count}
                                />
                              )}
                              {vacation.status === 'pending' && !vacation.is_admin_created && (
                                <div className="flex justify-center gap-2">
                                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(vacation.id, 'rejected')}>
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" onClick={() => handleUpdateStatus(vacation.id, 'approved')}>
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {vacation.status !== 'rejected' && (
                                <div className="flex justify-center gap-1">
                                  <VacationEditDialog
                                    vacationId={vacation.id}
                                    userName={vacation.userName || 'Colaborador'}
                                    startDate={vacation.start_date}
                                    endDate={vacation.end_date}
                                    reason={vacation.reason}
                                    onSuccess={fetchData}
                                  />
                                  <VacationCancelDialog
                                    vacationId={vacation.id}
                                    userName={vacation.userName || 'Colaborador'}
                                    startDate={vacation.start_date}
                                    endDate={vacation.end_date}
                                    onSuccess={fetchData}
                                  />
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <VacationHistoryPanel />
          </TabsContent>

          <TabsContent value="planning" className="space-y-4">
            <VacationPlanningPanel />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
};

export default VacationManagement;
