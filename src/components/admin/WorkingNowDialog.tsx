import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Coffee, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkSchedule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  sector: string | null;
  position: string | null;
  work_schedule_id: string | null;
}

interface TimeRecord {
  id: string;
  user_id: string;
  record_type: 'entry' | 'lunch_out' | 'lunch_in' | 'exit';
  recorded_at: string;
}

interface WorkingEmployee {
  profile: Profile;
  schedule: WorkSchedule | null;
  status: 'working' | 'break';
  entryTime: string | null;
  lastRecord: TimeRecord | null;
}

interface WorkingNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WorkingNowDialog = ({ open, onOpenChange }: WorkingNowDialogProps) => {
  const [employees, setEmployees] = useState<WorkingEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchWorkingEmployees();
    }
  }, [open]);

  const fetchWorkingEmployees = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    // Fetch all profiles with schedules
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, sector, position, work_schedule_id')
      .order('full_name');

    // Fetch schedules
    const { data: schedules } = await supabase
      .from('work_schedules')
      .select('*');

    // Fetch today's records
    const { data: records } = await supabase
      .from('time_records')
      .select('*')
      .gte('recorded_at', `${today}T00:00:00`)
      .lte('recorded_at', `${today}T23:59:59`)
      .order('recorded_at', { ascending: true });

    if (!profiles) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const currentTime = format(now, 'HH:mm:ss');

    const workingList: WorkingEmployee[] = [];

    profiles.forEach((profile) => {
      const schedule = schedules?.find(s => s.id === profile.work_schedule_id) || null;
      const userRecords = (records || []).filter(r => r.user_id === profile.user_id) as TimeRecord[];

      // Check if employee has records today
      if (userRecords.length > 0) {
        const lastRecord = userRecords[userRecords.length - 1];
        const entryRecord = userRecords.find(r => r.record_type === 'entry');

        // Check if currently working or on break
        if (lastRecord.record_type === 'entry' || lastRecord.record_type === 'lunch_in') {
          workingList.push({
            profile,
            schedule,
            status: 'working',
            entryTime: entryRecord ? format(new Date(entryRecord.recorded_at), 'HH:mm') : null,
            lastRecord,
          });
        } else if (lastRecord.record_type === 'lunch_out') {
          workingList.push({
            profile,
            schedule,
            status: 'break',
            entryTime: entryRecord ? format(new Date(entryRecord.recorded_at), 'HH:mm') : null,
            lastRecord,
          });
        }
      } else if (schedule) {
        // No records today, but check if should be working based on schedule
        const isWithinSchedule = currentTime >= schedule.start_time && currentTime <= schedule.end_time;
        
        // Only add to list if within work hours (they should have punched in)
        // This is a "no-show" scenario - employee hasn't punched in but should be working
        // We won't include these in "Working Now" since they haven't actually started
      }
    });

    setEmployees(workingList);
    setLoading(false);
  };

  const getStatusBadge = (status: 'working' | 'break') => {
    if (status === 'working') {
      return (
        <Badge variant="default" className="bg-success hover:bg-success/90">
          <Clock className="h-3 w-3 mr-1" />
          Trabalhando
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Coffee className="h-3 w-3 mr-1" />
        Intervalo
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-success" />
            Colaboradores Trabalhando Agora
          </DialogTitle>
          <DialogDescription>
            Lista de colaboradores que estão trabalhando ou em intervalo no momento.
            <span className="block text-xs mt-1">
              Atualizado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum colaborador trabalhando no momento.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Jornada</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.profile.id}>
                  <TableCell className="font-medium">{emp.profile.full_name}</TableCell>
                  <TableCell>{emp.profile.sector || '-'}</TableCell>
                  <TableCell>{emp.profile.position || '-'}</TableCell>
                  <TableCell>
                    {emp.schedule ? (
                      <span className="text-sm">
                        {emp.schedule.start_time.slice(0, 5)} - {emp.schedule.end_time.slice(0, 5)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{emp.entryTime || '-'}</TableCell>
                  <TableCell>{getStatusBadge(emp.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
          <p className="flex items-center gap-2">
            <Badge variant="default" className="bg-success">Trabalhando</Badge>
            Colaborador com ponto de entrada registrado
          </p>
          <p className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">Intervalo</Badge>
            Colaborador em horário de almoço/intervalo
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkingNowDialog;
