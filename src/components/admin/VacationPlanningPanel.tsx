import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, List, ChevronLeft, ChevronRight, Palmtree, Loader2, UserX, Stethoscope, Baby, HardHat, Ban, Clock, Heart } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AbsentEmployee {
  id: string;
  userId: string;
  fullName: string;
  sector: string | null;
  position: string | null;
  type: 'vacation' | 'absence';
  subType?: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: string;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const ABSENCE_COLORS: Record<string, string> = {
  vacation: 'bg-primary',
  medical_leave: 'bg-destructive',
  medical_consultation: 'bg-orange-500',
  justified_absence: 'bg-warning',
  maternity_leave: 'bg-pink-500',
  paternity_leave: 'bg-sky-500',
  unjustified_absence: 'bg-red-700',
  work_accident: 'bg-amber-600',
  punitive_suspension: 'bg-gray-700',
  day_off: 'bg-teal-500',
  bereavement_leave: 'bg-violet-600',
  default: 'bg-muted-foreground',
};

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

const VacationPlanningPanel = () => {
  const { organizationId } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [absentees, setAbsentees] = useState<AbsentEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const [vacRes, absRes] = await Promise.all([
      supabase
        .from('vacation_requests')
        .select('id, user_id, start_date, end_date, days_count, status, vacation_type')
        .eq('organization_id', organizationId!)
        .eq('status', 'approved')
        .lte('start_date', monthEnd)
        .gte('end_date', monthStart),
      supabase
        .from('adjustment_requests')
        .select('id, user_id, absence_dates, absence_type, status, request_type')
        .eq('organization_id', organizationId!)
        .eq('status', 'approved')
        .eq('request_type', 'absence'),
    ]);

    const userIds = new Set<string>();
    vacRes.data?.forEach(v => userIds.add(v.user_id));
    absRes.data?.forEach(a => userIds.add(a.user_id));

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, sector, position')
      .in('user_id', Array.from(userIds));

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    const result: AbsentEmployee[] = [];

    vacRes.data?.forEach(v => {
      const p = profileMap.get(v.user_id);
      if (p) {
        result.push({
          id: v.id, userId: v.user_id, fullName: p.full_name, sector: p.sector,
          position: p.position, type: 'vacation', startDate: v.start_date,
          endDate: v.end_date, daysCount: v.days_count, status: v.status,
        });
      }
    });

    absRes.data?.forEach(a => {
      const p = profileMap.get(a.user_id);
      if (!p || !a.absence_dates?.length) return;
      const dates = a.absence_dates.sort();
      const start = dates[0];
      const end = dates[dates.length - 1];
      if (start <= monthEnd && end >= monthStart) {
        result.push({
          id: a.id, userId: a.user_id, fullName: p.full_name, sector: p.sector,
          position: p.position, type: 'absence', subType: a.absence_type || undefined,
          startDate: start, endDate: end, daysCount: dates.length, status: a.status,
        });
      }
    });

    setAbsentees(result);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (filterType === 'all') return absentees;
    if (filterType === 'vacation') return absentees.filter(a => a.type === 'vacation');
    return absentees.filter(a => a.type === 'absence' && a.subType === filterType);
  }, [absentees, filterType]);

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOffset = getDay(startOfMonth(currentMonth));

  const getAbsenteesForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return filtered.filter(a => dateStr >= a.startDate && dateStr <= a.endDate);
  };

  const getTypeColor = (emp: AbsentEmployee) => {
    if (emp.type === 'vacation') return ABSENCE_COLORS.vacation;
    return ABSENCE_COLORS[emp.subType || 'default'] || ABSENCE_COLORS.default;
  };

  const getTypeLabel = (emp: AbsentEmployee) => {
    if (emp.type === 'vacation') return 'Férias';
    return ABSENCE_LABELS[emp.subType || ''] || 'Ausência';
  };

  const getTypeIcon = (emp: AbsentEmployee) => {
    if (emp.type === 'vacation') return <Palmtree className="h-3 w-3" />;
    if (emp.subType === 'medical_leave' || emp.subType === 'medical_consultation') return <Stethoscope className="h-3 w-3" />;
    if (emp.subType === 'maternity_leave' || emp.subType === 'paternity_leave') return <Baby className="h-3 w-3" />;
    if (emp.subType === 'work_accident') return <HardHat className="h-3 w-3" />;
    if (emp.subType === 'punitive_suspension') return <Ban className="h-3 w-3" />;
    if (emp.subType === 'day_off') return <Clock className="h-3 w-3" />;
    if (emp.subType === 'bereavement_leave') return <Heart className="h-3 w-3" />;
    if (emp.subType === 'unjustified_absence') return <UserX className="h-3 w-3" />;
    return <UserX className="h-3 w-3" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-foreground min-w-[180px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="vacation">Férias</SelectItem>
              <SelectItem value="medical_leave">Licença Médica</SelectItem>
              <SelectItem value="medical_consultation">Consulta Médica</SelectItem>
              <SelectItem value="justified_absence">Ausência Justificada</SelectItem>
              <SelectItem value="maternity_leave">Licença Maternidade</SelectItem>
              <SelectItem value="paternity_leave">Licença Paternidade</SelectItem>
              <SelectItem value="unjustified_absence">Falta</SelectItem>
              <SelectItem value="work_accident">Acidente de Trabalho</SelectItem>
              <SelectItem value="punitive_suspension">Suspensão</SelectItem>
              <SelectItem value="day_off">Folga</SelectItem>
              <SelectItem value="bereavement_leave">Falecimento Familiar</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              <Palmtree className="h-3 w-3" />
              {absentees.filter(a => a.type === 'vacation').length} em férias
            </Badge>
            <Badge variant="outline" className="gap-1">
              <UserX className="h-3 w-3" />
              {absentees.filter(a => a.type === 'absence').length} ausentes
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Calendário
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-2">
            <List className="h-4 w-4" /> Tabela
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <div className="flex flex-col lg:flex-row gap-6">
            <Card className="lg:w-72 shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ausências neste mês ({filtered.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ausência no período.</p>
                ) : (
                  filtered.map(emp => (
                    <div key={emp.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={cn('w-1 h-full min-h-[40px] rounded-full', getTypeColor(emp))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{emp.fullName}</p>
                        <p className="text-xs text-muted-foreground">{emp.position || emp.sector || '-'}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                            {getTypeIcon(emp)}
                            {getTypeLabel(emp)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-semibold">{emp.daysCount} dias</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(parseISO(emp.startDate), 'dd/MM')} - {format(parseISO(emp.endDate), 'dd/MM')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardContent className="pt-6">
                <div className="grid grid-cols-7 gap-px">
                  {WEEKDAY_LABELS.map(d => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground pb-2">{d}</div>
                  ))}
                  {Array.from({ length: firstDayOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[80px]" />
                  ))}
                  {monthDays.map(day => {
                    const dayAbsentees = getAbsenteesForDay(day);
                    const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'min-h-[80px] border border-border rounded-md p-1 transition-colors',
                          isToday && 'ring-2 ring-primary/50',
                          isWeekend && 'bg-muted/30'
                        )}
                      >
                        <span className={cn(
                          'text-xs font-medium',
                          isToday && 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center',
                          !isToday && 'text-foreground'
                        )}>
                          {format(day, 'd')}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {dayAbsentees.slice(0, 3).map(emp => (
                            <div
                              key={emp.id}
                              className={cn('text-[9px] text-white px-1 py-0.5 rounded truncate', getTypeColor(emp))}
                              title={`${emp.fullName} - ${getTypeLabel(emp)}`}
                            >
                              {emp.fullName.split(' ')[0]}
                            </div>
                          ))}
                          {dayAbsentees.length > 3 && (
                            <div className="text-[9px] text-muted-foreground text-center">
                              +{dayAbsentees.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                  {Object.entries(ABSENCE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs">
                      <div className={cn('w-3 h-3 rounded-sm', ABSENCE_COLORS[key] || ABSENCE_COLORS.default)} /> {label}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma ausência registrada neste mês.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(emp => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.fullName}</TableCell>
                        <TableCell>{emp.sector || '-'}</TableCell>
                        <TableCell>{emp.position || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            {getTypeIcon(emp)}
                            {getTypeLabel(emp)}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(parseISO(emp.startDate), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{format(parseISO(emp.endDate), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-center font-semibold">{emp.daysCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VacationPlanningPanel;
