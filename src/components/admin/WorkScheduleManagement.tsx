import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Clock, Plus, Pencil, Trash2, Loader2, Calendar, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface WorkSchedule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  break_duration_minutes: number | null;
  schedule_type: string;
  monday_hours: number | null;
  tuesday_hours: number | null;
  wednesday_hours: number | null;
  thursday_hours: number | null;
  friday_hours: number | null;
  saturday_hours: number | null;
  sunday_hours: number | null;
  shift_work_hours: number | null;
  shift_rest_hours: number | null;
  employee_count?: number;
}

interface ScheduleForm {
  name: string;
  schedule_type: 'weekly' | 'shift';
  start_time: string;
  end_time: string;
  break_start_time: string;
  break_end_time: string;
  break_duration_minutes: string;
  monday_hours: string;
  tuesday_hours: string;
  wednesday_hours: string;
  thursday_hours: string;
  friday_hours: string;
  saturday_hours: string;
  sunday_hours: string;
  shift_work_hours: string;
  shift_rest_hours: string;
}

const DAYS_OF_WEEK = [
  { key: 'monday_hours', label: 'Seg', fullLabel: 'Segunda' },
  { key: 'tuesday_hours', label: 'Ter', fullLabel: 'Terça' },
  { key: 'wednesday_hours', label: 'Qua', fullLabel: 'Quarta' },
  { key: 'thursday_hours', label: 'Qui', fullLabel: 'Quinta' },
  { key: 'friday_hours', label: 'Sex', fullLabel: 'Sexta' },
  { key: 'saturday_hours', label: 'Sáb', fullLabel: 'Sábado' },
  { key: 'sunday_hours', label: 'Dom', fullLabel: 'Domingo' },
] as const;

const WorkScheduleManagement = () => {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<WorkSchedule | null>(null);

  const defaultForm: ScheduleForm = {
    name: '',
    schedule_type: 'weekly',
    start_time: '08:00',
    end_time: '17:00',
    break_start_time: '',
    break_end_time: '',
    break_duration_minutes: '60',
    monday_hours: '8',
    tuesday_hours: '8',
    wednesday_hours: '8',
    thursday_hours: '8',
    friday_hours: '8',
    saturday_hours: '0',
    sunday_hours: '0',
    shift_work_hours: '12',
    shift_rest_hours: '36',
  };

  const [form, setForm] = useState<ScheduleForm>(defaultForm);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setIsLoading(true);
    
    const { data: schedulesData, error: schedulesError } = await supabase
      .from('work_schedules')
      .select('*')
      .order('name');

    if (schedulesError) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar jornadas',
        description: schedulesError.message,
      });
      setIsLoading(false);
      return;
    }

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('work_schedule_id');

    const countMap: Record<string, number> = {};
    profilesData?.forEach(profile => {
      if (profile.work_schedule_id) {
        countMap[profile.work_schedule_id] = (countMap[profile.work_schedule_id] || 0) + 1;
      }
    });

    const schedulesWithCounts = (schedulesData || []).map(schedule => ({
      ...schedule,
      employee_count: countMap[schedule.id] || 0,
    }));

    setSchedules(schedulesWithCounts);
    setIsLoading(false);
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingSchedule(null);
  };

  const openEditDialog = (schedule: WorkSchedule) => {
    setEditingSchedule(schedule);
    setForm({
      name: schedule.name,
      schedule_type: (schedule.schedule_type as 'weekly' | 'shift') || 'weekly',
      start_time: schedule.start_time?.slice(0, 5) || '08:00',
      end_time: schedule.end_time?.slice(0, 5) || '17:00',
      break_start_time: schedule.break_start_time ? schedule.break_start_time.slice(0, 5) : '',
      break_end_time: schedule.break_end_time ? schedule.break_end_time.slice(0, 5) : '',
      break_duration_minutes: schedule.break_duration_minutes?.toString() || '60',
      monday_hours: schedule.monday_hours?.toString() || '8',
      tuesday_hours: schedule.tuesday_hours?.toString() || '8',
      wednesday_hours: schedule.wednesday_hours?.toString() || '8',
      thursday_hours: schedule.thursday_hours?.toString() || '8',
      friday_hours: schedule.friday_hours?.toString() || '8',
      saturday_hours: schedule.saturday_hours?.toString() || '0',
      sunday_hours: schedule.sunday_hours?.toString() || '0',
      shift_work_hours: schedule.shift_work_hours?.toString() || '12',
      shift_rest_hours: schedule.shift_rest_hours?.toString() || '36',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (schedule: WorkSchedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe o nome da jornada.',
      });
      return;
    }

    setIsSaving(true);

    try {
      const scheduleData: any = {
        name: form.name,
        schedule_type: form.schedule_type,
        start_time: form.start_time,
        end_time: form.end_time,
        break_start_time: form.break_start_time || null,
        break_end_time: form.break_end_time || null,
        break_duration_minutes: parseInt(form.break_duration_minutes) || null,
      };

      if (form.schedule_type === 'weekly') {
        scheduleData.monday_hours = parseFloat(form.monday_hours) || 0;
        scheduleData.tuesday_hours = parseFloat(form.tuesday_hours) || 0;
        scheduleData.wednesday_hours = parseFloat(form.wednesday_hours) || 0;
        scheduleData.thursday_hours = parseFloat(form.thursday_hours) || 0;
        scheduleData.friday_hours = parseFloat(form.friday_hours) || 0;
        scheduleData.saturday_hours = parseFloat(form.saturday_hours) || 0;
        scheduleData.sunday_hours = parseFloat(form.sunday_hours) || 0;
        scheduleData.shift_work_hours = null;
        scheduleData.shift_rest_hours = null;
      } else {
        scheduleData.shift_work_hours = parseInt(form.shift_work_hours) || 12;
        scheduleData.shift_rest_hours = parseInt(form.shift_rest_hours) || 36;
        scheduleData.monday_hours = null;
        scheduleData.tuesday_hours = null;
        scheduleData.wednesday_hours = null;
        scheduleData.thursday_hours = null;
        scheduleData.friday_hours = null;
        scheduleData.saturday_hours = null;
        scheduleData.sunday_hours = null;
      }

      if (editingSchedule) {
        const { error } = await supabase
          .from('work_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);

        if (error) throw error;

        toast({
          title: 'Jornada atualizada!',
          description: `A jornada "${form.name}" foi atualizada com sucesso.`,
        });
      } else {
        const { data: wsOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
        const { error } = await supabase
          .from('work_schedules')
          .insert({ ...scheduleData, organization_id: wsOrgData?.organization_id });

        if (error) throw error;

        toast({
          title: 'Jornada criada!',
          description: `A jornada "${form.name}" foi cadastrada com sucesso.`,
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchSchedules();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!scheduleToDelete) return;

    // Verificar se há colaboradores vinculados
    if (scheduleToDelete.employee_count && scheduleToDelete.employee_count > 0) {
      toast({
        variant: 'destructive',
        title: 'Não é possível excluir',
        description: `Esta jornada possui ${scheduleToDelete.employee_count} colaborador(es) vinculado(s). Remova ou altere a jornada dos colaboradores antes de excluir.`,
      });
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('work_schedules')
        .delete()
        .eq('id', scheduleToDelete.id);

      if (error) throw error;

      toast({
        title: 'Jornada excluída!',
        description: `A jornada "${scheduleToDelete.name}" foi removida.`,
      });

      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
      fetchSchedules();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const calculateWeeklyHours = (schedule: WorkSchedule) => {
    if (schedule.schedule_type === 'shift') {
      return `${schedule.shift_work_hours}x${schedule.shift_rest_hours}`;
    }
    const total = (schedule.monday_hours || 0) +
      (schedule.tuesday_hours || 0) +
      (schedule.wednesday_hours || 0) +
      (schedule.thursday_hours || 0) +
      (schedule.friday_hours || 0) +
      (schedule.saturday_hours || 0) +
      (schedule.sunday_hours || 0);
    return `${total}h/sem`;
  };

  const getScheduleDescription = (schedule: WorkSchedule) => {
    if (schedule.schedule_type === 'shift') {
      return `Escala ${schedule.shift_work_hours}x${schedule.shift_rest_hours}`;
    }
    
    const workingDays: string[] = [];
    if (schedule.monday_hours && schedule.monday_hours > 0) workingDays.push('Seg');
    if (schedule.tuesday_hours && schedule.tuesday_hours > 0) workingDays.push('Ter');
    if (schedule.wednesday_hours && schedule.wednesday_hours > 0) workingDays.push('Qua');
    if (schedule.thursday_hours && schedule.thursday_hours > 0) workingDays.push('Qui');
    if (schedule.friday_hours && schedule.friday_hours > 0) workingDays.push('Sex');
    if (schedule.saturday_hours && schedule.saturday_hours > 0) workingDays.push('Sáb');
    if (schedule.sunday_hours && schedule.sunday_hours > 0) workingDays.push('Dom');
    
    if (workingDays.length === 0) return 'Sem dias configurados';
    
    // Check if it's a range
    const allSame = [schedule.monday_hours, schedule.tuesday_hours, schedule.wednesday_hours, 
      schedule.thursday_hours, schedule.friday_hours].every(h => h === schedule.monday_hours);
    
    if (workingDays.length === 5 && allSame && !schedule.saturday_hours && !schedule.sunday_hours) {
      return `Seg-Sex ${schedule.monday_hours}h`;
    }
    
    return workingDays.join(', ');
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Gerenciar Jornadas de Trabalho
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Jornada
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Editar Jornada' : 'Nova Jornada'}
              </DialogTitle>
              <DialogDescription>
                {editingSchedule
                  ? 'Atualize as informações da jornada de trabalho.'
                  : 'Cadastre uma nova jornada de trabalho para os colaboradores.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4 overflow-y-auto flex-1 pr-2">
              <div className="space-y-2">
                <Label htmlFor="schedule_name">Nome da Jornada *</Label>
                <Input
                  id="schedule_name"
                  placeholder="Ex: Comercial, Noturno, 12x36..."
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <Label>Tipo de Jornada</Label>
                <RadioGroup
                  value={form.schedule_type}
                  onValueChange={(value: 'weekly' | 'shift') => setForm(prev => ({ ...prev, schedule_type: value }))}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="weekly" id="weekly" />
                    <Label htmlFor="weekly" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Calendar className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">Semanal Fixa</p>
                        <p className="text-xs text-muted-foreground">Dias e horas fixos por semana</p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="shift" id="shift" />
                    <Label htmlFor="shift" className="flex items-center gap-2 cursor-pointer flex-1">
                      <RotateCcw className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">Escala</p>
                        <p className="text-xs text-muted-foreground">Ex: 12x36, 12x24, 24x48</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {form.schedule_type === 'weekly' ? (
                <>
                  <div className="space-y-2">
                    <Label>Carga Horária por Dia</Label>
                    <div className="grid grid-cols-7 gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <div key={day.key} className="text-center">
                          <Label className="text-xs text-muted-foreground">{day.label}</Label>
                          <Input
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            className="text-center mt-1"
                            value={form[day.key as keyof ScheduleForm]}
                            onChange={(e) => setForm(prev => ({ ...prev, [day.key]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use 0 para dias de folga. Total: {
                        (parseFloat(form.monday_hours) || 0) +
                        (parseFloat(form.tuesday_hours) || 0) +
                        (parseFloat(form.wednesday_hours) || 0) +
                        (parseFloat(form.thursday_hours) || 0) +
                        (parseFloat(form.friday_hours) || 0) +
                        (parseFloat(form.saturday_hours) || 0) +
                        (parseFloat(form.sunday_hours) || 0)
                      }h/semana
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Configuração da Escala</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shift_work" className="text-sm text-muted-foreground">Horas de Trabalho</Label>
                      <Input
                        id="shift_work"
                        type="number"
                        min="1"
                        max="24"
                        value={form.shift_work_hours}
                        onChange={(e) => setForm(prev => ({ ...prev, shift_work_hours: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shift_rest" className="text-sm text-muted-foreground">Horas de Folga</Label>
                      <Input
                        id="shift_rest"
                        type="number"
                        min="1"
                        max="72"
                        value={form.shift_rest_hours}
                        onChange={(e) => setForm(prev => ({ ...prev, shift_rest_hours: e.target.value }))}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Escala: {form.shift_work_hours}x{form.shift_rest_hours} (trabalha {form.shift_work_hours}h, folga {form.shift_rest_hours}h)
                  </p>
                </div>
              )}

              <div className="border-t pt-4 space-y-4">
                <Label className="text-sm font-medium">Horários Padrão</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time" className="text-sm text-muted-foreground">Hora de Entrada</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm(prev => ({ ...prev, start_time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time" className="text-sm text-muted-foreground">Hora de Saída</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm(prev => ({ ...prev, end_time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="break_start_time" className="text-sm text-muted-foreground">Início Intervalo</Label>
                    <Input
                      id="break_start_time"
                      type="time"
                      value={form.break_start_time}
                      onChange={(e) => setForm(prev => ({ ...prev, break_start_time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="break_end_time" className="text-sm text-muted-foreground">Fim Intervalo</Label>
                    <Input
                      id="break_end_time"
                      type="time"
                      value={form.break_end_time}
                      onChange={(e) => setForm(prev => ({ ...prev, break_end_time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="break_duration" className="text-sm text-muted-foreground">Duração (min)</Label>
                    <Input
                      id="break_duration"
                      type="number"
                      min="0"
                      placeholder="60"
                      value={form.break_duration_minutes}
                      onChange={(e) => setForm(prev => ({ ...prev, break_duration_minutes: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingSchedule ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma jornada cadastrada.</p>
            <p className="text-sm">Clique em "Nova Jornada" para começar.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jornada</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Carga</TableHead>
                  <TableHead className="text-center">Colaboradores</TableHead>
                  <TableHead className="text-center">Horário</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell>
                      <Badge variant={schedule.schedule_type === 'shift' ? 'secondary' : 'outline'} className="gap-1">
                        {schedule.schedule_type === 'shift' ? (
                          <><RotateCcw className="h-3 w-3" /> Escala</>
                        ) : (
                          <><Calendar className="h-3 w-3" /> Semanal</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-medium">{calculateWeeklyHours(schedule)}</span>
                        <span className="text-xs text-muted-foreground">{getScheduleDescription(schedule)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-medium ${
                        schedule.employee_count ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {schedule.employee_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {schedule.start_time?.slice(0, 5)} - {schedule.end_time?.slice(0, 5)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(schedule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(schedule)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir a jornada "{scheduleToDelete?.name}"?
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default WorkScheduleManagement;
