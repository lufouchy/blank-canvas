import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, History, CalendarDays, Edit } from 'lucide-react';
import { format, parseISO, addYears, addMonths, isAfter, isBefore, differenceInMonths } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface EmployeeWithPeriods {
  userId: string;
  fullName: string;
  hireDate: Date;
  periods: AcquisitivePeriod[];
}

interface AcquisitivePeriod {
  index: number;
  start: Date;
  end: Date;
  concessiveEnd: Date;
  usedDays: number;
  soldDays: number;
  remainingDays: number;
}

interface VacationRecord {
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  sell_days: number | null;
  status: string;
}

const VacationHistoryPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeWithPeriods[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{
    employee: EmployeeWithPeriods;
    period: AcquisitivePeriod;
  } | null>(null);
  const [usedDaysInput, setUsedDaysInput] = useState(0);
  const [soldDaysInput, setSoldDaysInput] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployeePeriods();
  }, []);

  const fetchEmployeePeriods = async () => {
    setIsLoading(true);

    const [profilesRes, vacationsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, full_name, hire_date')
        .not('hire_date', 'is', null),
      supabase
        .from('vacation_requests')
        .select('user_id, start_date, end_date, days_count, sell_days, status')
        .neq('status', 'rejected'),
    ]);

    const profiles = profilesRes.data || [];
    const vacations = (vacationsRes.data || []) as VacationRecord[];
    const today = new Date();

    const result: EmployeeWithPeriods[] = [];

    for (const profile of profiles) {
      if (!profile.hire_date) continue;
      const hireDate = parseISO(profile.hire_date);
      const monthsWorked = differenceInMonths(today, hireDate);
      
      // Only show employees with > 12 months tenure
      if (monthsWorked < 12) continue;

      const userVacs = vacations.filter(v => v.user_id === profile.user_id);
      const periods: AcquisitivePeriod[] = [];

      // Generate the last 2 complete acquisition periods
      let periodStart = new Date(hireDate);
      const allPeriods: { start: Date; end: Date; concessiveEnd: Date; index: number }[] = [];
      
      const maxPeriods = Math.ceil((today.getTime() - hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) + 1;
      for (let i = 0; i < maxPeriods; i++) {
        const periodEnd = addYears(periodStart, 1);
        if (isAfter(periodStart, today)) break;
        allPeriods.push({
          start: new Date(periodStart),
          end: periodEnd,
          concessiveEnd: addMonths(periodEnd, 12),
          index: i + 1,
        });
        periodStart = periodEnd;
      }

      // Get the last 2 periods that have started
      const relevantPeriods = allPeriods.slice(-2);

      // Assign vacations to periods (same logic as employee page)
      const assignedVacs = new Map<number, VacationRecord[]>();
      allPeriods.forEach((_, idx) => assignedVacs.set(idx, []));

      for (const vac of userVacs) {
        const vStart = parseISO(vac.start_date);
        for (let i = 0; i < allPeriods.length; i++) {
          const p = allPeriods[i];
          if (!isBefore(vStart, p.start) && isBefore(vStart, p.concessiveEnd)) {
            assignedVacs.get(i)!.push(vac);
            break;
          }
        }
      }

      for (const p of relevantPeriods) {
        const idx = allPeriods.indexOf(p);
        const periodVacs = assignedVacs.get(idx) || [];
        const usedDays = periodVacs.reduce((sum, v) => sum + v.days_count, 0);
        const soldDays = periodVacs.reduce((sum, v) => sum + (v.sell_days || 0), 0);

        periods.push({
          index: p.index,
          start: p.start,
          end: p.end,
          concessiveEnd: p.concessiveEnd,
          usedDays,
          soldDays,
          remainingDays: Math.max(0, 30 - usedDays - soldDays),
        });
      }

      result.push({
        userId: profile.user_id,
        fullName: profile.full_name,
        hireDate,
        periods,
      });
    }

    // Sort by name
    result.sort((a, b) => a.fullName.localeCompare(b.fullName));
    setEmployees(result);
    setIsLoading(false);
  };

  const handleRegisterHistorical = async () => {
    if (!editDialog || !user) return;
    const { employee, period } = editDialog;

    if (usedDaysInput < 0 || usedDaysInput > 30) {
      toast({ variant: 'destructive', title: 'Valor inválido', description: 'Dias gozados deve ser entre 0 e 30.' });
      return;
    }
    if (soldDaysInput < 0 || soldDaysInput > 10) {
      toast({ variant: 'destructive', title: 'Valor inválido', description: 'Dias vendidos deve ser entre 0 e 10.' });
      return;
    }
    if (usedDaysInput + soldDaysInput > 30) {
      toast({ variant: 'destructive', title: 'Valor inválido', description: 'Total de dias gozados + vendidos não pode exceder 30.' });
      return;
    }

    // Calculate net days to add (subtract what's already recorded)
    const netUsedDays = usedDaysInput - period.usedDays;
    const netSoldDays = soldDaysInput - period.soldDays;

    if (netUsedDays <= 0 && netSoldDays <= 0) {
      toast({ title: 'Nenhuma alteração', description: 'Os valores informados são iguais ou menores que os já registrados.' });
      setEditDialog(null);
      return;
    }

    setSubmitting(true);

    const { data: orgData } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (netUsedDays > 0) {
      // Create a historical vacation record
      // Place it in the middle of the concessive period
      const startDate = period.end; // Start of concessive period
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + netUsedDays - 1);

      const { error } = await supabase.from('vacation_requests').insert({
        user_id: employee.userId,
        vacation_type: 'individual',
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        days_count: netUsedDays,
        sell_days: netSoldDays > 0 ? netSoldDays : 0,
        reason: `Férias históricas - ${period.index}º período aquisitivo (registro retroativo)`,
        status: 'approved',
        created_by: user.id,
        is_admin_created: true,
        organization_id: orgData?.organization_id,
      });

      if (error) {
        toast({ variant: 'destructive', title: 'Erro ao registrar', description: error.message });
        setSubmitting(false);
        return;
      }
    } else if (netSoldDays > 0) {
      // Only sold days to add
      const startDate = period.end;
      const { error } = await supabase.from('vacation_requests').insert({
        user_id: employee.userId,
        vacation_type: 'individual',
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(startDate, 'yyyy-MM-dd'),
        days_count: 0,
        sell_days: netSoldDays,
        reason: `Abono pecuniário histórico - ${period.index}º período aquisitivo (registro retroativo)`,
        status: 'approved',
        created_by: user.id,
        is_admin_created: true,
        organization_id: orgData?.organization_id,
      });

      if (error) {
        toast({ variant: 'destructive', title: 'Erro ao registrar', description: error.message });
        setSubmitting(false);
        return;
      }
    }

    toast({ title: 'Férias históricas registradas!', description: `Registro atualizado para ${employee.fullName}.` });
    setEditDialog(null);
    setSubmitting(false);
    fetchEmployeePeriods();
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Períodos Aquisitivos dos Colaboradores
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Colaboradores com mais de 12 meses de vínculo. Informe férias já gozadas antes do sistema.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : employees.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum colaborador com mais de 12 meses de vínculo encontrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Admissão</TableHead>
                <TableHead>Período Aquisitivo</TableHead>
                <TableHead className="text-center">Dias Gozados</TableHead>
                <TableHead className="text-center">Dias Vendidos</TableHead>
                <TableHead className="text-center">Restantes</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.flatMap((emp) =>
                emp.periods.map((period, pIdx) => (
                  <TableRow key={`${emp.userId}-${period.index}`}>
                    {pIdx === 0 ? (
                      <>
                        <TableCell rowSpan={emp.periods.length} className="font-medium align-top">
                          {emp.fullName}
                        </TableCell>
                        <TableCell rowSpan={emp.periods.length} className="align-top">
                          {format(emp.hireDate, 'dd/MM/yyyy')}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{period.index}º Período</p>
                          <p className="text-xs text-muted-foreground">
                            {format(period.start, 'dd/MM/yyyy')} - {format(period.end, 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {period.usedDays > 0 ? (
                        <Badge variant="default">{period.usedDays}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {period.soldDays > 0 ? (
                        <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">{period.soldDays}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={period.remainingDays > 0 ? 'outline' : 'secondary'}>
                        {period.remainingDays}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setEditDialog({ employee: emp, period });
                          setUsedDaysInput(period.usedDays);
                          setSoldDaysInput(period.soldDays);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                        Informar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Informar Férias Históricas</DialogTitle>
            <DialogDescription>
              {editDialog && (
                <>
                  <strong>{editDialog.employee.fullName}</strong> — {editDialog.period.index}º Período Aquisitivo
                  <br />
                  {format(editDialog.period.start, 'dd/MM/yyyy')} - {format(editDialog.period.end, 'dd/MM/yyyy')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Total de dias gozados</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={usedDaysInput}
                onChange={(e) => setUsedDaysInput(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
              />
              <p className="text-xs text-muted-foreground">Inclui dias já registrados no sistema ({editDialog?.period.usedDays || 0}).</p>
            </div>
            <div className="space-y-2">
              <Label>Total de dias vendidos (abono pecuniário)</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={soldDaysInput}
                onChange={(e) => setSoldDaysInput(Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
            <Button onClick={handleRegisterHistorical} className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Registro Histórico'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default VacationHistoryPanel;
