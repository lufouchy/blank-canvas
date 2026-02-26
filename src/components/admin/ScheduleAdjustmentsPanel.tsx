import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { CalendarClock, Plus, Trash2, Loader2, Clock, Zap, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduleAdjustment {
  id: string;
  user_id: string;
  adjustment_type: string;
  start_date: string;
  end_date: string;
  custom_start_time: string | null;
  custom_end_time: string | null;
  custom_break_start: string | null;
  custom_break_end: string | null;
  overtime_authorized: boolean;
  overtime_max_minutes: number | null;
  reason: string | null;
  created_at: string;
  employee_name?: string;
}

interface Employee {
  user_id: string;
  full_name: string;
  work_schedule_id: string | null;
}

const ScheduleAdjustmentsPanel = () => {
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<ScheduleAdjustment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ScheduleAdjustment | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    user_id: '',
    adjustment_type: 'temporary_change' as 'temporary_change' | 'overtime_authorization',
    start_date: '',
    end_date: '',
    custom_start_time: '',
    custom_end_time: '',
    custom_break_start: '',
    custom_break_end: '',
    overtime_authorized: false,
    overtime_max_minutes: '120',
    reason: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) return;
    setOrganizationId(profile.organization_id);

    // Fetch employees and adjustments in parallel
    const [empResult, adjResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, full_name, work_schedule_id')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'ativo')
        .order('full_name'),
      supabase
        .from('schedule_adjustments')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('start_date', { ascending: false }),
    ]);

    if (empResult.data) setEmployees(empResult.data);

    if (adjResult.data) {
      const empMap = new Map((empResult.data || []).map(e => [e.user_id, e.full_name]));
      setAdjustments(
        adjResult.data.map(a => ({
          ...a,
          employee_name: empMap.get(a.user_id) || 'Colaborador',
        }))
      );
    }

    setIsLoading(false);
  };

  const resetForm = () => {
    setForm({
      user_id: '',
      adjustment_type: 'temporary_change',
      start_date: '',
      end_date: '',
      custom_start_time: '',
      custom_end_time: '',
      custom_break_start: '',
      custom_break_end: '',
      overtime_authorized: false,
      overtime_max_minutes: '120',
      reason: '',
    });
  };

  const handleSubmit = async () => {
    if (!form.user_id || !form.start_date || !form.end_date) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Selecione o colaborador e informe as datas.',
      });
      return;
    }

    if (!organizationId || !currentUserId) return;

    setIsSaving(true);
    try {
      const insertData: any = {
        organization_id: organizationId,
        user_id: form.user_id,
        adjustment_type: form.adjustment_type,
        start_date: form.start_date,
        end_date: form.end_date,
        overtime_authorized: form.adjustment_type === 'overtime_authorization' ? true : form.overtime_authorized,
        overtime_max_minutes: form.overtime_authorized || form.adjustment_type === 'overtime_authorization'
          ? parseInt(form.overtime_max_minutes) || 120
          : null,
        reason: form.reason || null,
        created_by: currentUserId,
      };

      if (form.adjustment_type === 'temporary_change') {
        insertData.custom_start_time = form.custom_start_time || null;
        insertData.custom_end_time = form.custom_end_time || null;
        insertData.custom_break_start = form.custom_break_start || null;
        insertData.custom_break_end = form.custom_break_end || null;
      }

      const { error } = await supabase.from('schedule_adjustments').insert(insertData);
      if (error) throw error;

      toast({
        title: 'Ajuste criado!',
        description: form.adjustment_type === 'overtime_authorization'
          ? 'Autorização de horas extras registrada com sucesso.'
          : 'Ajuste temporário de jornada registrado com sucesso.',
      });

      setDialogOpen(false);
      resetForm();
      fetchData();
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
    if (!toDelete) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('schedule_adjustments')
        .delete()
        .eq('id', toDelete.id);
      if (error) throw error;

      toast({ title: 'Ajuste removido com sucesso.' });
      setDeleteDialogOpen(false);
      setToDelete(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const isExpired = (endDate: string) => isBefore(parseISO(endDate), new Date());

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Ajustes de Jornada e Horas Extras
          </CardTitle>
          <CardDescription>
            Gerencie alterações temporárias de horário e autorizações de horas extras
          </CardDescription>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          Novo Ajuste
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : adjustments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum ajuste registrado.</p>
            <p className="text-sm">Clique em "Novo Ajuste" para criar uma alteração temporária ou autorizar horas extras.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Período</TableHead>
                  <TableHead className="text-center">Horário</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adj) => (
                  <TableRow key={adj.id} className={isExpired(adj.end_date) ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{adj.employee_name}</TableCell>
                    <TableCell>
                      {adj.adjustment_type === 'overtime_authorization' ? (
                        <Badge variant="default" className="gap-1">
                          <Zap className="h-3 w-3" /> Hora Extra
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <UserCog className="h-3 w-3" /> Ajuste
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {format(parseISO(adj.start_date), 'dd/MM/yy')} - {format(parseISO(adj.end_date), 'dd/MM/yy')}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {adj.custom_start_time && adj.custom_end_time
                        ? `${adj.custom_start_time.slice(0, 5)} - ${adj.custom_end_time.slice(0, 5)}`
                        : adj.overtime_max_minutes
                          ? `+${Math.floor(adj.overtime_max_minutes / 60)}h${adj.overtime_max_minutes % 60 ? (adj.overtime_max_minutes % 60) + 'min' : ''}`
                          : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {isExpired(adj.end_date) ? (
                        <Badge variant="secondary">Expirado</Badge>
                      ) : (
                        <Badge variant="default">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setToDelete(adj); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Novo Ajuste de Jornada</DialogTitle>
              <DialogDescription>
                Crie um ajuste temporário de horário ou autorize horas extras para um colaborador.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 overflow-y-auto flex-1 pr-2">
              {/* Type */}
              <div className="space-y-2">
                <Label>Tipo de Ajuste</Label>
                <Select
                  value={form.adjustment_type}
                  onValueChange={(v: 'temporary_change' | 'overtime_authorization') =>
                    setForm(prev => ({ ...prev, adjustment_type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temporary_change">
                      <span className="flex items-center gap-2">
                        <UserCog className="h-4 w-4" /> Alteração Temporária de Horário
                      </span>
                    </SelectItem>
                    <SelectItem value="overtime_authorization">
                      <span className="flex items-center gap-2">
                        <Zap className="h-4 w-4" /> Autorização de Horas Extras
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Employee */}
              <div className="space-y-2">
                <Label>Colaborador *</Label>
                <Select
                  value={form.user_id}
                  onValueChange={(v) => setForm(prev => ({ ...prev, user_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.user_id} value={emp.user_id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início *</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim *</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Custom times for temporary change */}
              {form.adjustment_type === 'temporary_change' && (
                <div className="border-t pt-4 space-y-4">
                  <Label className="text-sm font-medium">Horários Temporários</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Nova Entrada</Label>
                      <Input
                        type="time"
                        value={form.custom_start_time}
                        onChange={(e) => setForm(prev => ({ ...prev, custom_start_time: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Nova Saída</Label>
                      <Input
                        type="time"
                        value={form.custom_end_time}
                        onChange={(e) => setForm(prev => ({ ...prev, custom_end_time: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Início Intervalo</Label>
                      <Input
                        type="time"
                        value={form.custom_break_start}
                        onChange={(e) => setForm(prev => ({ ...prev, custom_break_start: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Fim Intervalo</Label>
                      <Input
                        type="time"
                        value={form.custom_break_end}
                        onChange={(e) => setForm(prev => ({ ...prev, custom_break_end: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Also allow overtime during temp change */}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <Label>Autorizar horas extras neste período</Label>
                      <p className="text-xs text-muted-foreground">
                        Permite que o colaborador registre ponto além do horário temporário
                      </p>
                    </div>
                    <Switch
                      checked={form.overtime_authorized}
                      onCheckedChange={(v) => setForm(prev => ({ ...prev, overtime_authorized: v }))}
                    />
                  </div>
                </div>
              )}

              {/* Overtime max minutes */}
              {(form.adjustment_type === 'overtime_authorization' || form.overtime_authorized) && (
                <div className="space-y-2">
                  <Label>Limite de horas extras (minutos)</Label>
                  <Input
                    type="number"
                    min="15"
                    max="480"
                    step="15"
                    value={form.overtime_max_minutes}
                    onChange={(e) => setForm(prev => ({ ...prev, overtime_max_minutes: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo de {Math.floor(parseInt(form.overtime_max_minutes || '0') / 60)}h
                    {parseInt(form.overtime_max_minutes || '0') % 60 ? ` e ${parseInt(form.overtime_max_minutes || '0') % 60}min` : ''} extras por dia
                  </p>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label>Motivo / Observação</Label>
                <Textarea
                  placeholder="Descreva o motivo do ajuste..."
                  value={form.reason}
                  onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Ajuste
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja remover este ajuste de jornada para {toDelete?.employee_name}?
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

export default ScheduleAdjustmentsPanel;
