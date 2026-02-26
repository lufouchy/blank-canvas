import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, differenceInMinutes, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type TimeRecordType = 'entry' | 'lunch_out' | 'lunch_in' | 'exit';

interface TimeRecord {
  id: string;
  record_type: TimeRecordType;
  recorded_at: string;
}

interface AbsenceInfo {
  type: string;
  label: string;
}

interface AdjustmentInfo {
  date: string;
  hasAdjustment: boolean;
}

const ABSENCE_LABELS: Record<string, string> = {
  vacation: 'Férias',
  medical_leave: 'Licença Médica',
  medical_consultation: 'Consulta Médica',
  justified_absence: 'Ausência Justificada',
  maternity_leave: 'Licença Maternidade',
  paternity_leave: 'Licença Paternidade',
  unjustified_absence: 'Falta',
  work_accident: 'Acidente de Trabalho',
  punitive_suspension: 'Suspensão',
  day_off: 'Folga',
  bereavement_leave: 'Falecimento Familiar',
};

// Only these generate negative balance
const NEGATIVE_BALANCE_TYPES = ['unjustified_absence', 'punitive_suspension'];

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '-';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface MonthlyTimesheetCardProps {
  onBalanceCalculated?: (totalBalance: number) => void;
}

const MonthlyTimesheetCard = ({ onBalanceCalculated }: MonthlyTimesheetCardProps) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [absences, setAbsences] = useState<Map<string, AbsenceInfo>>(new Map());
  const [adjustments, setAdjustments] = useState<Set<string>>(new Set());
  const [expectedHours, setExpectedHours] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  useEffect(() => {
    if (!user?.id) return;
    
    const fetchAll = async () => {
      setIsLoading(true);
      const startStr = monthStart.toISOString();
      const endStr = monthEnd.toISOString();
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');

      const [recordsRes, vacRes, adjRes, profileRes] = await Promise.all([
        supabase
          .from('time_records')
          .select('id, record_type, recorded_at')
          .eq('user_id', user.id)
          .gte('recorded_at', startStr)
          .lte('recorded_at', endStr)
          .order('recorded_at', { ascending: true }),
        supabase
          .from('vacation_requests')
          .select('start_date, end_date, status')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .lte('start_date', endDate)
          .gte('end_date', startDate),
        supabase
          .from('adjustment_requests')
          .select('absence_dates, absence_type, status, request_type, requested_time')
          .eq('user_id', user.id)
          .eq('status', 'approved'),
        supabase
          .from('profiles')
          .select('work_schedule_id, organization_id')
          .eq('user_id', user.id)
          .single(),
      ]);

      if (recordsRes.data) setRecords(recordsRes.data as TimeRecord[]);

      // Fetch holidays using org id from profile
      const orgId = profileRes.data?.organization_id;
      const holidaysRes = orgId
        ? await supabase
            .from('holidays')
            .select('date, name')
            .eq('organization_id', orgId)
            .gte('date', startDate)
            .lte('date', endDate)
        : { data: null };

      // Build absence map
      const absMap = new Map<string, AbsenceInfo>();

      // Vacation periods
      vacRes.data?.forEach(v => {
        const vStart = new Date(v.start_date + 'T00:00:00');
        const vEnd = new Date(v.end_date + 'T00:00:00');
        const days = eachDayOfInterval({ start: vStart > monthStart ? vStart : monthStart, end: vEnd < monthEnd ? vEnd : monthEnd });
        days.forEach(d => {
          absMap.set(format(d, 'yyyy-MM-dd'), { type: 'vacation', label: 'Férias' });
        });
      });

      // Adjustment absences & track adjustments
      const adjSet = new Set<string>();
      adjRes.data?.forEach(a => {
        if (a.request_type === 'absence' && a.absence_dates?.length) {
          a.absence_dates.forEach((dateStr: string) => {
            if (dateStr >= startDate && dateStr <= endDate) {
              const absType = a.absence_type || 'justified_absence';
              absMap.set(dateStr, { type: absType, label: ABSENCE_LABELS[absType] || 'Ausência' });
            }
          });
        }
        // Mark dates that had adjustments (point adjustments)
        if (a.request_type === 'adjustment' && a.requested_time) {
          const adjDate = format(new Date(a.requested_time), 'yyyy-MM-dd');
          if (adjDate >= startDate && adjDate <= endDate) {
            adjSet.add(adjDate);
          }
        }
      });

      // Holidays - add to absence map (won't overwrite existing absences like vacation)
      holidaysRes.data?.forEach(h => {
        if (!absMap.has(h.date)) {
          absMap.set(h.date, { type: 'holiday', label: `Feriado: ${h.name}` });
        }
      });

      setAbsences(absMap);
      setAdjustments(adjSet);

      // Fetch work schedule for expected hours
      if (profileRes.data?.work_schedule_id) {
        const { data: schedule } = await supabase
          .from('work_schedules')
          .select('monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours')
          .eq('id', profileRes.data.work_schedule_id)
          .single();

        if (schedule) {
          setExpectedHours({
            0: (schedule.sunday_hours || 0) * 60,
            1: (schedule.monday_hours || 0) * 60,
            2: (schedule.tuesday_hours || 0) * 60,
            3: (schedule.wednesday_hours || 0) * 60,
            4: (schedule.thursday_hours || 0) * 60,
            5: (schedule.friday_hours || 0) * 60,
            6: (schedule.saturday_hours || 0) * 60,
          });
        }
      } else {
        // Default 8h weekdays
        setExpectedHours({
          0: 0, 1: 480, 2: 480, 3: 480, 4: 480, 5: 480, 6: 0,
        });
      }

      setIsLoading(false);
    };

    fetchAll();
  }, [user?.id]);

  const days = useMemo(() => {
    const allDays = eachDayOfInterval({ start: monthStart, end: now > monthEnd ? monthEnd : now });

    return allDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayOfWeek = getDay(day);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayRecords = records.filter(r => {
        const d = new Date(r.recorded_at);
        return d >= dayStart && d <= dayEnd;
      });

      const entry = dayRecords.find(r => r.record_type === 'entry');
      const lunchOut = dayRecords.find(r => r.record_type === 'lunch_out');
      const lunchIn = dayRecords.find(r => r.record_type === 'lunch_in');
      const exit = dayRecords.find(r => r.record_type === 'exit');

      const expectedMinutesForDay = expectedHours[dayOfWeek] ?? 0;
      const absence = absences.get(dateStr);
      const hasAdjustment = adjustments.has(dateStr);
      const isToday = format(day, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
      const isPastDay = dayStart < now && !isToday;

      // Check for inconsistency: has records but fewer than 4 (only for past days)
      const hasInconsistency = isPastDay && dayRecords.length > 0 && dayRecords.length < 4 && !absence;

      let workedMinutes = 0;
      let balanceMinutes = 0;

      if (hasInconsistency) {
        // Don't calculate hours for inconsistent days
        workedMinutes = 0;
        balanceMinutes = 0;
      } else if (absence) {
        if (NEGATIVE_BALANCE_TYPES.includes(absence.type)) {
          balanceMinutes = -expectedMinutesForDay;
        }
      } else {
        if (entry && lunchOut) {
          workedMinutes += differenceInMinutes(new Date(lunchOut.recorded_at), new Date(entry.recorded_at));
        }
        if (lunchIn && exit) {
          workedMinutes += differenceInMinutes(new Date(exit.recorded_at), new Date(lunchIn.recorded_at));
        }

        if (workedMinutes > 0) {
          balanceMinutes = workedMinutes - expectedMinutesForDay;
        } else if (expectedMinutesForDay > 0 && isPastDay) {
          balanceMinutes = -expectedMinutesForDay;
        }
      }

      return {
        date: day,
        dateStr,
        isWeekendDay: isWeekend(day),
        entry: entry ? format(new Date(entry.recorded_at), 'HH:mm') : null,
        lunchOut: lunchOut ? format(new Date(lunchOut.recorded_at), 'HH:mm') : null,
        lunchIn: lunchIn ? format(new Date(lunchIn.recorded_at), 'HH:mm') : null,
        exit: exit ? format(new Date(exit.recorded_at), 'HH:mm') : null,
        workedMinutes,
        balanceMinutes,
        hasRecords: dayRecords.length > 0,
        absence,
        hasAdjustment,
        hasInconsistency,
      };
    });
  }, [records, monthStart, monthEnd, absences, adjustments, expectedHours]);

  // Calculate and report total balance
  useEffect(() => {
    if (onBalanceCalculated && days.length > 0) {
      const total = days.reduce((sum, d) => sum + d.balanceMinutes, 0);
      onBalanceCalculated(total);
    }
  }, [days, onBalanceCalculated]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 h-8">
                  <TableHead className="w-[90px] py-1 text-xs">Dia</TableHead>
                  <TableHead className="py-1 text-xs">Entrada</TableHead>
                  <TableHead className="py-1 text-xs">Saída Alm.</TableHead>
                  <TableHead className="py-1 text-xs">Volta Alm.</TableHead>
                  <TableHead className="py-1 text-xs">Saída</TableHead>
                  <TableHead className="py-1 text-xs">Obs.</TableHead>
                  <TableHead className="text-right py-1 text-xs">Total</TableHead>
                  <TableHead className="text-right py-1 text-xs">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map(day => (
                  <TableRow
                    key={day.date.toISOString()}
                    className={cn(
                      day.isWeekendDay && 'bg-muted/30 text-muted-foreground',
                      day.absence && 'bg-accent/20'
                    )}
                  >
                    <TableCell className="font-medium whitespace-nowrap py-1 text-xs">
                      <span className="capitalize">
                        {format(day.date, 'EEE', { locale: ptBR })}
                      </span>
                      {' '}
                      {format(day.date, 'dd/MM')}
                    </TableCell>
                    <TableCell className="tabular-nums py-1 text-xs">{day.entry || '-'}</TableCell>
                    <TableCell className="tabular-nums py-1 text-xs">{day.lunchOut || '-'}</TableCell>
                    <TableCell className="tabular-nums py-1 text-xs">{day.lunchIn || '-'}</TableCell>
                    <TableCell className="tabular-nums py-1 text-xs">{day.exit || '-'}</TableCell>
                    <TableCell className="py-1 text-xs">
                      <div className="flex items-center gap-1">
                        {day.hasInconsistency && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                Inconsistência
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Menos de 4 marcações registradas</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {day.absence && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1">
                            {day.absence.label}
                          </Badge>
                        )}
                        {day.hasAdjustment && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertCircle className="h-3 w-3 text-orange-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Ponto ajustado por solicitação</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-right font-medium py-1 text-xs">
                      {day.workedMinutes > 0 ? formatMinutes(day.workedMinutes) : '-'}
                    </TableCell>
                    <TableCell className={cn(
                      "tabular-nums text-right font-bold py-1 text-xs",
                      day.balanceMinutes > 0 && "text-green-600",
                      day.balanceMinutes < 0 && "text-red-600",
                      day.balanceMinutes === 0 && "text-muted-foreground"
                    )}>
                      {day.balanceMinutes !== 0 ? (day.balanceMinutes > 0 ? '+' : '') + formatMinutes(day.balanceMinutes) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {days.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum registro encontrado neste mês.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default MonthlyTimesheetCard;
