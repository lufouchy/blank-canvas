import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Loader2, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  PiggyBank, 
  Scale, 
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  sector: string | null;
}

interface OvertimeDecision {
  id?: string;
  user_id: string;
  reference_month: string;
  overtime_minutes: number;
  destination: 'bank' | 'payment' | 'mixed';
  bank_minutes: number;
  payment_minutes: number;
  payment_amount: number;
  is_edited: boolean;
  finalized: boolean;
}

const destinationOptions = [
  { value: 'bank', label: 'Banco de Horas', icon: PiggyBank },
  { value: 'payment', label: 'Pagar na Folha', icon: DollarSign },
  { value: 'mixed', label: 'Misto (50/50)', icon: Scale },
];

const formatMinutesToHours = (minutes: number) => {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '+';
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const MonthlyClosingPanel = () => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [decisions, setDecisions] = useState<Map<string, OvertimeDecision>>(new Map());

  const referenceMonthStr = format(selectedMonth, 'yyyy-MM-01');

  // Fetch employees
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees-for-closing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, sector')
        .eq('status', 'ativo')
        .order('full_name');

      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch hours balance for all employees
  const { data: hoursBalances = [], isLoading: loadingBalances } = useQuery({
    queryKey: ['hours-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hours_balance')
        .select('user_id, balance_minutes');

      if (error) throw error;
      return data;
    },
  });

  // Fetch existing decisions for this month
  const { data: existingDecisions = [], isLoading: loadingDecisions } = useQuery({
    queryKey: ['overtime-decisions', referenceMonthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_overtime_decisions')
        .select('*')
        .eq('reference_month', referenceMonthStr);

      if (error) throw error;
      return data as OvertimeDecision[];
    },
  });

  // Fetch payroll settings
  const { data: payrollSettings } = useQuery({
    queryKey: ['payroll-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_settings')
        .select('overtime_strategy')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Combine employee data with their hours and decisions
  const employeesWithData = useMemo(() => {
    return employees.map((emp) => {
      const balance = hoursBalances.find((b) => b.user_id === emp.user_id);
      const existingDecision = existingDecisions.find((d) => d.user_id === emp.user_id);
      const localDecision = decisions.get(emp.user_id);

      const overtimeMinutes = balance?.balance_minutes || 0;
      const defaultDestination = payrollSettings?.overtime_strategy || 'bank';

      const decision: OvertimeDecision = localDecision || existingDecision || {
        user_id: emp.user_id,
        reference_month: referenceMonthStr,
        overtime_minutes: overtimeMinutes,
        destination: defaultDestination as 'bank' | 'payment' | 'mixed',
        bank_minutes: defaultDestination === 'bank' ? overtimeMinutes : defaultDestination === 'mixed' ? Math.floor(overtimeMinutes / 2) : 0,
        payment_minutes: defaultDestination === 'payment' ? overtimeMinutes : defaultDestination === 'mixed' ? Math.ceil(overtimeMinutes / 2) : 0,
        payment_amount: 0,
        is_edited: false,
        finalized: false,
      };

      return {
        ...emp,
        overtimeMinutes,
        decision,
        isFinalized: existingDecision?.finalized || false,
      };
    }).filter(emp => emp.overtimeMinutes !== 0); // Only show employees with overtime
  }, [employees, hoursBalances, existingDecisions, decisions, payrollSettings, referenceMonthStr]);

  // Update decision mutation
  const updateDecisionMutation = useMutation({
    mutationFn: async (decision: OvertimeDecision) => {
      const { data: mcOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
      const { error } = await supabase
        .from('monthly_overtime_decisions')
        .upsert({
          ...decision,
          reference_month: referenceMonthStr,
          organization_id: mcOrgData?.organization_id,
        }, {
          onConflict: 'user_id,reference_month',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime-decisions', referenceMonthStr] });
    },
  });

  // Finalize mutation
  const finalizeMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const { data: fOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
      const updates = userIds.map((userId) => {
        const emp = employeesWithData.find((e) => e.user_id === userId);
        if (!emp) return null;

        return {
          user_id: userId,
          reference_month: referenceMonthStr,
          overtime_minutes: emp.overtimeMinutes,
          destination: emp.decision.destination,
          bank_minutes: emp.decision.bank_minutes,
          payment_minutes: emp.decision.payment_minutes,
          payment_amount: emp.decision.payment_amount,
          is_edited: emp.decision.is_edited,
          finalized: true,
          finalized_at: new Date().toISOString(),
          organization_id: fOrgData?.organization_id,
        };
      }).filter(Boolean);

      const { error } = await supabase
        .from('monthly_overtime_decisions')
        .upsert(updates as any[], {
          onConflict: 'user_id,reference_month',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime-decisions', referenceMonthStr] });
      setSelectedEmployees(new Set());
      toast({
        title: 'Fechamento finalizado',
        description: 'As decisões foram salvas com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao finalizar',
        description: 'Não foi possível salvar as decisões.',
        variant: 'destructive',
      });
      console.error('Error finalizing:', error);
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(employeesWithData.filter(e => !e.isFinalized).map((e) => e.user_id)));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const handleSelectEmployee = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedEmployees);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedEmployees(newSelected);
  };

  const handleDestinationChange = (userId: string, destination: 'bank' | 'payment' | 'mixed') => {
    const emp = employeesWithData.find((e) => e.user_id === userId);
    if (!emp) return;

    const overtimeMinutes = emp.overtimeMinutes;
    let bankMinutes = 0;
    let paymentMinutes = 0;

    switch (destination) {
      case 'bank':
        bankMinutes = overtimeMinutes;
        break;
      case 'payment':
        paymentMinutes = overtimeMinutes;
        break;
      case 'mixed':
        bankMinutes = Math.floor(overtimeMinutes / 2);
        paymentMinutes = Math.ceil(overtimeMinutes / 2);
        break;
    }

    const newDecision: OvertimeDecision = {
      ...emp.decision,
      destination,
      bank_minutes: bankMinutes,
      payment_minutes: paymentMinutes,
      is_edited: true,
    };

    setDecisions(new Map(decisions.set(userId, newDecision)));
    updateDecisionMutation.mutate(newDecision);
  };

  const handleBulkAction = (action: 'bank' | 'payment' | 'mixed') => {
    selectedEmployees.forEach((userId) => {
      handleDestinationChange(userId, action);
    });
    toast({
      title: 'Ação em massa aplicada',
      description: `${selectedEmployees.size} funcionários atualizados.`,
    });
  };

  const handleFinalize = () => {
    const toFinalize = Array.from(selectedEmployees);
    if (toFinalize.length === 0) {
      toast({
        title: 'Nenhum funcionário selecionado',
        description: 'Selecione ao menos um funcionário para finalizar.',
        variant: 'destructive',
      });
      return;
    }
    finalizeMutation.mutate(toFinalize);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth((current) =>
      direction === 'prev' ? subMonths(current, 1) : subMonths(current, -1)
    );
    setSelectedEmployees(new Set());
    setDecisions(new Map());
  };

  const isLoading = loadingEmployees || loadingBalances || loadingDecisions;

  // Calculate totals
  const totals = useMemo(() => {
    let totalBankMinutes = 0;
    let totalPaymentMinutes = 0;

    employeesWithData.forEach((emp) => {
      totalBankMinutes += emp.decision.bank_minutes;
      totalPaymentMinutes += emp.decision.payment_minutes;
    });

    return { totalBankMinutes, totalPaymentMinutes };
  }, [employeesWithData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Painel de Fechamento Mensal
            </CardTitle>
            <CardDescription>
              Gerencie o destino das horas extras dos colaboradores
            </CardDescription>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[140px] text-center font-medium capitalize">
              {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : employeesWithData.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum colaborador com horas extras neste período.
          </div>
        ) : (
          <>
            {/* Bulk Actions Bar */}
            {selectedEmployees.size > 0 && (
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4 shadow-lg">
                <span className="font-medium">
                  {selectedEmployees.size} selecionado(s)
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('bank')}
                  >
                    <PiggyBank className="mr-2 h-4 w-4" />
                    Enviar para Banco
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('payment')}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Pagar Tudo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('mixed')}
                  >
                    <Scale className="mr-2 h-4 w-4" />
                    Misto (50/50)
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleFinalize}
                    disabled={finalizeMutation.isPending}
                  >
                    {finalizeMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Finalizar Fechamento
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedEmployees.size === employeesWithData.filter(e => !e.isFinalized).length &&
                          employeesWithData.filter(e => !e.isFinalized).length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead className="text-right">Saldo Extra</TableHead>
                    <TableHead>Destino das Horas</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeesWithData.map((emp) => {
                    const DestIcon = destinationOptions.find(
                      (o) => o.value === emp.decision.destination
                    )?.icon || PiggyBank;

                    return (
                      <TableRow
                        key={emp.user_id}
                        className={cn(
                          emp.isFinalized && 'bg-muted/50',
                          emp.decision.is_edited && !emp.isFinalized && 'bg-amber-50 dark:bg-amber-950/20'
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedEmployees.has(emp.user_id)}
                            onCheckedChange={(checked) =>
                              handleSelectEmployee(emp.user_id, !!checked)
                            }
                            disabled={emp.isFinalized}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{emp.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {emp.sector || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'font-mono font-medium',
                              emp.overtimeMinutes > 0 ? 'text-green-600' : 'text-red-600'
                            )}
                          >
                            {formatMinutesToHours(emp.overtimeMinutes)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={emp.decision.destination}
                            onValueChange={(value) =>
                              handleDestinationChange(
                                emp.user_id,
                                value as 'bank' | 'payment' | 'mixed'
                              )
                            }
                            disabled={emp.isFinalized}
                          >
                            <SelectTrigger className="w-[180px]">
                              <DestIcon className="mr-2 h-4 w-4" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {destinationOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <div className="flex items-center gap-2">
                                    <opt.icon className="h-4 w-4" />
                                    {opt.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          {emp.isFinalized ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Finalizado
                            </Badge>
                          ) : emp.decision.is_edited ? (
                            <Badge variant="secondary">Editado</Badge>
                          ) : (
                            <Badge variant="outline">Padrão</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Total p/ Banco:</span>
                <span className="font-mono font-medium">
                  {formatMinutesToHours(totals.totalBankMinutes)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="text-sm text-muted-foreground">Total p/ Pagamento:</span>
                <span className="font-mono font-medium">
                  {formatMinutesToHours(totals.totalPaymentMinutes)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyClosingPanel;
