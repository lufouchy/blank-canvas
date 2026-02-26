import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Clock, 
  Settings, 
  AlertTriangle,
  ChevronRight,
  Plus,
  Bell,
  FileText
} from 'lucide-react';
import { format, isWeekend, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: string | null;
  specification: string | null;
}

interface TimeRecord {
  id: string;
  user_id: string;
  record_type: 'entry' | 'lunch_out' | 'lunch_in' | 'exit';
  recorded_at: string;
}

interface HoursBalance {
  user_id: string;
  balance_minutes: number;
}

interface WorkSchedule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
}

interface EmployeeStatus {
  profile: Profile;
  punchStatus: 'working' | 'break' | 'not_started';
  todayMinutes: number;
  balance: number;
  hasAlert: boolean;
  todayRecords: TimeRecord[];
}

import WorkingNowDialog from '@/components/admin/WorkingNowDialog';
import AlertsDialog from '@/components/admin/AlertsDialog';
import PendingRequestsDialog from '@/components/admin/PendingRequestsDialog';

const AdminDashboard = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeStatus[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStatus | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showWorkingNowDialog, setShowWorkingNowDialog] = useState(false);
  const [showAlertsDialog, setShowAlertsDialog] = useState(false);
  const [showPendingRequestsDialog, setShowPendingRequestsDialog] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    start_time: '08:00',
    end_time: '17:00',
    break_start_time: '',
    break_end_time: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime status changes
    const channel = supabase
      .channel('status-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'status_history',
        },
        async (payload) => {
          // Fetch the employee name for the notification
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', payload.new.user_id)
            .maybeSingle();

          const employeeName = profile?.full_name || 'Colaborador';
          const newStatus = payload.new.new_status || 'atualizado';
          const newSpec = payload.new.new_specification;

          toast({
            title: (
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Mudança de Status
              </div>
            ) as unknown as string,
            description: `${employeeName} teve seu status alterado para "${newStatus}"${newSpec ? ` (${newSpec})` : ''}.`,
          });

          // Refresh employee list
          fetchEmployees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchEmployees(),
      fetchSchedules(),
      fetchPendingRequestsCount(),
    ]);
    setLoading(false);
  };

  const fetchPendingRequestsCount = async () => {
    const [{ count: vacationCount }, { count: adjustmentCount }] = await Promise.all([
      supabase.from('vacation_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('adjustment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setPendingRequestsCount((vacationCount || 0) + (adjustmentCount || 0));
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('work_schedules')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (data) {
      setSchedules(data);
    }
  };

  const fetchEmployees = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Fetch all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (!profiles) return;

    // Filter out suporte users (master user should be invisible)
    const { data: suporteRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'suporte');
    
    const suporteUserIds = new Set((suporteRoles || []).map(r => r.user_id));
    const visibleProfiles = profiles.filter(p => !suporteUserIds.has(p.user_id));

    if (visibleProfiles.length === 0) return;

    // Fetch today's records for all users
    const { data: records } = await supabase
      .from('time_records')
      .select('*')
      .gte('recorded_at', `${today}T00:00:00`)
      .lte('recorded_at', `${today}T23:59:59`);

    // Fetch hours balance for all users
    const { data: balances } = await supabase
      .from('hours_balance')
      .select('*');

    // Build employee status list
    const employeeStatuses: EmployeeStatus[] = visibleProfiles.map((profile) => {
      const userRecords = (records || []).filter(r => r.user_id === profile.user_id) as TimeRecord[];
      const userBalance = (balances || []).find(b => b.user_id === profile.user_id);

      // Calculate today's worked minutes
      let todayMinutes = 0;
      if (userRecords.length >= 2) {
        const entry = userRecords.find(r => r.record_type === 'entry');
        const exit = userRecords.find(r => r.record_type === 'exit');
        const lunchOut = userRecords.find(r => r.record_type === 'lunch_out');
        const lunchIn = userRecords.find(r => r.record_type === 'lunch_in');

        if (entry) {
          const endTime = exit ? new Date(exit.recorded_at) : new Date();
          todayMinutes = Math.floor((endTime.getTime() - new Date(entry.recorded_at).getTime()) / 60000);
          
          // Subtract lunch time
          if (lunchOut && lunchIn) {
            const lunchMinutes = Math.floor(
              (new Date(lunchIn.recorded_at).getTime() - new Date(lunchOut.recorded_at).getTime()) / 60000
            );
            todayMinutes -= lunchMinutes;
          }
        }
      }

      // Determine punch status (situação de ponto hoje)
      let punchStatus: 'working' | 'break' | 'not_started' = 'not_started';
      if (userRecords.length > 0) {
        const lastRecord = userRecords[userRecords.length - 1];
        if (lastRecord.record_type === 'entry' || lastRecord.record_type === 'lunch_in') {
          punchStatus = 'working';
        } else if (lastRecord.record_type === 'lunch_out') {
          punchStatus = 'break';
        }
      }

      // Check for alerts (overtime > 2h or inconsistencies)
      const hasAlert = todayMinutes > 600 || // More than 10h worked
        (userRecords.some(r => r.record_type === 'entry') && 
         !userRecords.some(r => r.record_type === 'exit') && 
         todayMinutes > 540); // No exit but > 9h

      return {
        profile,
        punchStatus,
        todayMinutes,
        balance: userBalance?.balance_minutes || 0,
        hasAlert,
        todayRecords: userRecords,
      };
    });

    setEmployees(employeeStatuses);
  };

  const handleCreateSchedule = async () => {
    const { data: adOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
    const { error } = await supabase
      .from('work_schedules')
      .insert({
        name: newSchedule.name,
        start_time: newSchedule.start_time,
        end_time: newSchedule.end_time,
        break_start_time: newSchedule.break_start_time || null,
        break_end_time: newSchedule.break_end_time || null,
        organization_id: adOrgData?.organization_id,
      });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar regra',
        description: error.message,
      });
    } else {
      toast({
        title: 'Regra criada!',
        description: 'Nova regra de jornada cadastrada com sucesso.',
      });
      setShowScheduleDialog(false);
      setNewSchedule({
        name: '',
        start_time: '08:00',
        end_time: '17:00',
        break_start_time: '',
        break_end_time: '',
      });
      fetchSchedules();
    }
  };

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatBalance = (minutes: number) => {
    const sign = minutes >= 0 ? '+' : '-';
    return `${sign}${formatMinutes(minutes)}`;
  };

  // Generate month days for the timesheet
  const getMonthDays = () => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return eachDayOfInterval({ start, end });
  };

  const getRecordTime = (records: TimeRecord[], type: string) => {
    const record = records.find(r => r.record_type === type);
    return record ? format(new Date(record.recorded_at), 'HH:mm') : '--:--';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Clock className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Colaboradores</p>
                <p className="text-2xl font-bold">{employees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowWorkingNowDialog(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-success/10">
                <Clock className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Trabalhando Agora</p>
                <p className="text-2xl font-bold">
                  {employees.filter(e => e.punchStatus === 'working').length}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowAlertsDialog(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-warning/10">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Alertas</p>
                <p className="text-2xl font-bold">
                  {employees.filter(e => e.hasAlert).length}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowPendingRequestsDialog(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Solicitações Pendentes</p>
                <p className="text-2xl font-bold">{pendingRequestsCount}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Employees table */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Colaboradores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Horas Hoje</TableHead>
                <TableHead className="text-right">Saldo Banco</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow 
                  key={employee.profile.id}
                  className={employee.hasAlert ? 'table-row-alert' : ''}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {employee.hasAlert && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      {employee.profile.full_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge 
                        variant={
                          employee.profile.status === 'ativo' ? 'default' :
                          employee.profile.status === 'afastado' ? 'secondary' :
                          employee.profile.status === 'suspenso' ? 'outline' :
                          'destructive'
                        }
                        className="w-fit capitalize"
                      >
                        {employee.profile.status || 'ativo'}
                      </Badge>
                      {employee.profile.specification && employee.profile.specification !== 'normal' && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {employee.profile.specification}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinutes(employee.todayMinutes)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${
                    employee.balance >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {formatBalance(employee.balance)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Employee detail dialog (Espelho de Ponto) */}
      <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Espelho de Ponto - {selectedEmployee?.profile.full_name}</DialogTitle>
            <DialogDescription>
              {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead className="text-center">Ent 1</TableHead>
                  <TableHead className="text-center">Sai 1</TableHead>
                  <TableHead className="text-center">Ent 2</TableHead>
                  <TableHead className="text-center">Sai 2</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getMonthDays().map((day) => {
                  const isWeekendDay = isWeekend(day);
                  const dayRecords = selectedEmployee?.todayRecords.filter(r => 
                    format(new Date(r.recorded_at), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
                  ) || [];

                  return (
                    <TableRow 
                      key={day.toISOString()}
                      className={isWeekendDay ? 'table-row-weekend' : ''}
                    >
                      <TableCell>{format(day, 'dd/MM')}</TableCell>
                      <TableCell>{format(day, 'EEE', { locale: ptBR })}</TableCell>
                      <TableCell className="text-center tabular-nums">
                        {getRecordTime(dayRecords, 'entry')}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {getRecordTime(dayRecords, 'lunch_out')}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {getRecordTime(dayRecords, 'lunch_in')}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {getRecordTime(dayRecords, 'exit')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">--:--</TableCell>
                      <TableCell className="text-right tabular-nums">--:--</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Working Now Dialog */}
      <WorkingNowDialog 
        open={showWorkingNowDialog} 
        onOpenChange={setShowWorkingNowDialog} 
      />

      {/* Alerts Dialog */}
      <AlertsDialog 
        open={showAlertsDialog} 
        onOpenChange={setShowAlertsDialog} 
      />

      {/* Pending Requests Dialog */}
      <PendingRequestsDialog 
        open={showPendingRequestsDialog} 
        onOpenChange={setShowPendingRequestsDialog} 
      />
    </div>
  );
};

export default AdminDashboard;
