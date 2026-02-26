import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Plus,
  Palmtree,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar as CalendarIcon,
  DollarSign,
} from 'lucide-react';
import { format, differenceInDays, parseISO, addMonths, addYears, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import VacationReceiptExport from '@/components/vacation/VacationReceiptExport';

type VacationStatus = 'pending' | 'approved' | 'rejected';

interface VacationRequest {
  id: string;
  user_id: string;
  vacation_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  sell_days: number;
  reason: string | null;
  status: VacationStatus;
  created_at: string;
}

interface AcquisitivePeriod {
  start: Date;
  end: Date;
  concessiveStart: Date;
  concessiveEnd: Date;
  label: string;
  usedDays: number;
  soldDays: number;
  remainingDays: number;
  isOverdue: boolean;
}

const statusConfig: Record<VacationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: typeof Clock }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Reprovado', variant: 'destructive', icon: XCircle },
};

const EmployeeVacation = () => {
  const { user, userRole, loading: authLoading, profile } = useAuth();
  const { toast } = useToast();
  const [vacations, setVacations] = useState<VacationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState('');
  const [wantToSell, setWantToSell] = useState(false);
  const [sellDays, setSellDays] = useState(0);

  // Profile data
  const [hireDate, setHireDate] = useState<Date | null>(null);
  const [acquisitivePeriods, setAcquisitivePeriods] = useState<AcquisitivePeriod[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);

    const [vacRes, profileRes] = await Promise.all([
      supabase
        .from('vacation_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('hire_date')
        .eq('user_id', user?.id)
        .single(),
    ]);

    const vacData = (vacRes.data || []) as VacationRequest[];
    setVacations(vacData);

    if (profileRes.data?.hire_date) {
      const hd = parseISO(profileRes.data.hire_date);
      setHireDate(hd);
      calculatePeriods(hd, vacData);
    }

    setIsLoading(false);
  };

  const calculatePeriods = (hd: Date, vacs: VacationRequest[]) => {
    const periods: AcquisitivePeriod[] = [];
    const today = new Date();
    
    // Generate all acquisition periods first
    const allPeriods: { start: Date; end: Date; concessiveStart: Date; concessiveEnd: Date }[] = [];
    let periodStart = new Date(hd);
    const maxPeriods = Math.ceil((today.getTime() - hd.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) + 1;
    for (let i = 0; i < maxPeriods; i++) {
      const periodEnd = addYears(periodStart, 1);
      if (isAfter(periodStart, today)) break;
      
      const concessiveStart = periodEnd;
      const concessiveEnd = addMonths(concessiveStart, 12);
      allPeriods.push({ start: periodStart, end: periodEnd, concessiveStart, concessiveEnd });
      periodStart = periodEnd;
    }

    // Filter valid (non-rejected) vacations
    const validVacs = vacs.filter(v => v.status !== 'rejected');

    // Assign each vacation to exactly ONE period (the earliest matching)
    const assignedVacs = new Map<number, VacationRequest[]>();
    allPeriods.forEach((_, idx) => assignedVacs.set(idx, []));

    for (const vac of validVacs) {
      const vStart = parseISO(vac.start_date);
      // Find the earliest period whose concessive window covers the vacation
      for (let i = 0; i < allPeriods.length; i++) {
        const p = allPeriods[i];
        // Vacation belongs to this period if it falls within periodStart -> concessiveEnd
        if (!isBefore(vStart, p.start) && isBefore(vStart, p.concessiveEnd)) {
          assignedVacs.get(i)!.push(vac);
          break; // Only assign to one period
        }
      }
    }

    // Build period objects
    for (let i = 0; i < allPeriods.length; i++) {
      const p = allPeriods[i];
      const periodVacs = assignedVacs.get(i) || [];
      const usedDays = periodVacs.reduce((sum, v) => sum + v.days_count, 0);
      const soldDays = periodVacs.reduce((sum, v) => sum + (v.sell_days || 0), 0);
      const remainingDays = 30 - usedDays - soldDays;
      const periodComplete = !isAfter(p.end, today);
      const isOverdue = periodComplete && isAfter(today, addMonths(p.concessiveStart, 6)) && usedDays === 0 && soldDays === 0;

      if (periodComplete || isBefore(p.start, today)) {
        periods.push({
          start: p.start,
          end: p.end,
          concessiveStart: p.concessiveStart,
          concessiveEnd: p.concessiveEnd,
          label: `${format(p.start, 'dd/MM/yyyy')} - ${format(p.end, 'dd/MM/yyyy')}`,
          usedDays,
          soldDays,
          remainingDays: Math.max(0, remainingDays),
          isOverdue,
        });
      }
    }

    setAcquisitivePeriods(periods);
  };

  const getOverdueAlert = (): AcquisitivePeriod | null => {
    // Find the second (or later) acquisition period where no vacation was taken
    // and the previous period also had no vacation
    for (let i = 1; i < acquisitivePeriods.length; i++) {
      const current = acquisitivePeriods[i];
      const previous = acquisitivePeriods[i - 1];
      if (previous.usedDays === 0 && previous.soldDays === 0 && 
          current.usedDays === 0 && current.soldDays === 0 &&
          !isAfter(current.start, new Date())) {
        return previous;
      }
    }
    return null;
  };

  // Check if employee has at least one complete acquisition period
  const hasCompletePeriod = acquisitivePeriods.some(p => !isAfter(p.end, new Date()));

  const handleCreateVacation = async () => {
    if (!hasCompletePeriod) {
      toast({ variant: 'destructive', title: 'Período aquisitivo incompleto', description: 'Você ainda não completou 12 meses de trabalho. As férias só podem ser solicitadas após completar o período aquisitivo.' });
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast({ variant: 'destructive', title: 'Campo obrigatório', description: 'Selecione o período de férias.' });
      return;
    }

    const daysCount = differenceInDays(dateRange.to, dateRange.from) + 1;

    // Validate splitting rules
    if (daysCount < 5) {
      toast({ variant: 'destructive', title: 'Período inválido', description: 'O período mínimo de férias é de 5 dias corridos.' });
      return;
    }

    // Check sell days
    const effectiveSellDays = wantToSell ? sellDays : 0;
    if (effectiveSellDays > 10) {
      toast({ variant: 'destructive', title: 'Limite excedido', description: 'É permitido vender no máximo 10 dias de férias (1/3 de 30 dias).' });
      return;
    }

    // Check how many vacation periods already exist for the current acquisition period
    const currentPeriod = acquisitivePeriods.find(p => {
      const today = new Date();
      return !isAfter(p.start, today) && !isBefore(p.concessiveEnd, today);
    });

    if (currentPeriod) {
      const existingVacs = vacations.filter(v => {
        if (v.status === 'rejected') return false;
        const vStart = parseISO(v.start_date);
        return !isBefore(vStart, currentPeriod.start) && isBefore(vStart, currentPeriod.concessiveEnd);
      });

      if (existingVacs.length >= 3) {
        toast({ variant: 'destructive', title: 'Limite de fracionamento', description: 'As férias podem ser fracionadas em no máximo 3 períodos.' });
        return;
      }

      // At least one period must be >= 14 days
      const allPeriodDays = existingVacs.map(v => v.days_count);
      allPeriodDays.push(daysCount);
      const hasLargePeriod = allPeriodDays.some(d => d >= 14);
      if (!hasLargePeriod && allPeriodDays.length > 1) {
        toast({ variant: 'destructive', title: 'Regra de fracionamento', description: 'Pelo menos um período de férias deve ter no mínimo 14 dias corridos.' });
        return;
      }

      // Check remaining days
      const totalUsed = currentPeriod.usedDays + currentPeriod.soldDays;
      if (totalUsed + daysCount + effectiveSellDays > 30) {
        toast({ variant: 'destructive', title: 'Dias insuficientes', description: `Restam apenas ${currentPeriod.remainingDays} dias de férias para este período aquisitivo.` });
        return;
      }
    }

    setSubmitting(true);

    const { data: profileData } = await supabase.from('profiles').select('organization_id').eq('user_id', user?.id).single();
    const { error } = await supabase
      .from('vacation_requests')
      .insert({
        user_id: user?.id,
        vacation_type: 'individual',
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd'),
        days_count: daysCount,
        sell_days: effectiveSellDays,
        reason: reason || null,
        status: 'pending',
        created_by: user?.id,
        is_admin_created: false,
        organization_id: profileData?.organization_id,
      });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao solicitar férias', description: error.message });
    } else {
      toast({ title: 'Solicitação de férias enviada!', description: `${daysCount} dias de férias${effectiveSellDays > 0 ? ` + ${effectiveSellDays} dias vendidos` : ''}.` });
      resetForm();
      fetchData();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setShowDialog(false);
    setDateRange(undefined);
    setReason('');
    setWantToSell(false);
    setSellDays(0);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const overdueAlert = getOverdueAlert();

  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Minhas Férias</h1>
            <p className="text-muted-foreground">Gerencie seus períodos de férias</p>
          </div>
          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!hasCompletePeriod && !isLoading}>
                <Plus className="h-4 w-4" />
                Solicitar Férias
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Solicitar Férias</DialogTitle>
                <DialogDescription>
                  Selecione o período desejado para suas férias.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Período das Férias</Label>
                  <div className="border rounded-lg p-3">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      locale={ptBR}
                      numberOfMonths={1}
                    />
                  </div>
                  {dateRange?.from && dateRange?.to && (
                    <p className="text-sm text-muted-foreground">
                      {differenceInDays(dateRange.to, dateRange.from) + 1} dias selecionados
                    </p>
                  )}
                </div>

                {/* Sell vacation option */}
                <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sell-vacation"
                      checked={wantToSell}
                      onCheckedChange={(checked) => {
                        setWantToSell(!!checked);
                        if (!checked) setSellDays(0);
                      }}
                    />
                    <Label htmlFor="sell-vacation" className="flex items-center gap-2 cursor-pointer">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Vender Férias (Abono Pecuniário)
                    </Label>
                  </div>
                  {wantToSell && (
                    <div className="space-y-2 ml-6">
                      <Label>Quantidade de dias a vender (máx. 10)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={sellDays || ''}
                        onChange={(e) => setSellDays(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-32"
                      />
                      <p className="text-xs text-muted-foreground">
                        Você pode converter até 1/3 dos dias de férias (10 dias) em abono pecuniário.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Observação (opcional)</Label>
                  <Textarea
                    placeholder="Adicione uma observação..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button onClick={handleCreateVacation} className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Solicitar Férias'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Overdue alert */}
        {overdueAlert && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção! Férias vencidas</AlertTitle>
            <AlertDescription>
              O período aquisitivo de {overdueAlert.label} está vencendo sem que as férias tenham sido gozadas. 
              Solicite suas férias o quanto antes para evitar perda de direitos.
            </AlertDescription>
          </Alert>
        )}

        {/* Acquisition periods */}
        {hireDate && acquisitivePeriods.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Períodos Aquisitivos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {acquisitivePeriods.map((period, idx) => {
                  const isComplete = !isAfter(period.end, new Date());
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border ${
                        period.isOverdue ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {idx + 1}º Período: {period.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Concessivo: {format(period.concessiveStart, 'dd/MM/yyyy')} - {format(period.concessiveEnd, 'dd/MM/yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        {!isComplete && (
                          <Badge variant="secondary">Em andamento</Badge>
                        )}
                        {isComplete && period.remainingDays > 0 && (
                          <Badge variant="outline">{period.remainingDays} dias restantes</Badge>
                        )}
                        {period.usedDays > 0 && (
                          <Badge variant="default">{period.usedDays} dias gozados</Badge>
                        )}
                        {period.soldDays > 0 && (
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                            {period.soldDays} dias vendidos
                          </Badge>
                        )}
                        {period.isOverdue && (
                          <Badge variant="destructive">Vencendo</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {!hireDate && !isLoading && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Data de admissão não cadastrada</AlertTitle>
            <AlertDescription>
              Solicite ao administrador que cadastre sua data de admissão para visualizar os períodos aquisitivos.
            </AlertDescription>
          </Alert>
        )}

        {hireDate && !isLoading && !hasCompletePeriod && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Período aquisitivo em andamento</AlertTitle>
            <AlertDescription>
              Você ainda não completou 12 meses de trabalho. As férias só poderão ser solicitadas após completar o período aquisitivo.
            </AlertDescription>
          </Alert>
        )}

        {/* Vacation history */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palmtree className="h-5 w-5 text-primary" />
              Minhas Solicitações de Férias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : vacations.length === 0 ? (
              <div className="text-center py-12">
                <Palmtree className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhuma férias solicitada</p>
                <p className="text-muted-foreground text-sm">
                  Clique em "Solicitar Férias" para enviar sua solicitação.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vacations.map((vac) => {
                  const StatusIcon = statusConfig[vac.status].icon;
                  return (
                    <div key={vac.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {format(parseISO(vac.start_date), 'dd/MM/yyyy')} - {format(parseISO(vac.end_date), 'dd/MM/yyyy')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {vac.days_count} dias de férias
                          {(vac.sell_days || 0) > 0 && ` + ${vac.sell_days} dias vendidos`}
                        </p>
                        {vac.reason && (
                          <p className="text-xs text-muted-foreground">{vac.reason}</p>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Solicitado em {format(parseISO(vac.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <Badge variant={statusConfig[vac.status].variant} className="gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig[vac.status].label}
                        </Badge>
                        {vac.status === 'approved' && (
                          <VacationReceiptExport
                            vacationId={vac.id}
                            userId={vac.user_id}
                            userName={profile?.full_name || 'Colaborador'}
                            startDate={vac.start_date}
                            endDate={vac.end_date}
                            daysCount={vac.days_count}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
};

export default EmployeeVacation;
