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
import { AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TimeRecord {
  id: string;
  user_id: string;
  record_type: 'entry' | 'lunch_out' | 'lunch_in' | 'exit';
  recorded_at: string;
}

interface EmployeeAlert {
  userId: string;
  fullName: string;
  sector: string | null;
  position: string | null;
  alertType: 'overtime' | 'missing_exit';
  todayMinutes: number;
  entryTime: string | null;
}

const AlertsDialog = ({ open, onOpenChange }: AlertsDialogProps) => {
  const [alerts, setAlerts] = useState<EmployeeAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchAlerts();
    }
  }, [open]);

  const fetchAlerts = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, sector, position')
      .order('full_name', { ascending: true });

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Fetch today's records
    const { data: records } = await supabase
      .from('time_records')
      .select('*')
      .gte('recorded_at', `${today}T00:00:00`)
      .lte('recorded_at', `${today}T23:59:59`)
      .order('recorded_at', { ascending: true });

    const employeeAlerts: EmployeeAlert[] = [];

    profiles.forEach((profile) => {
      const userRecords = (records || []).filter(r => r.user_id === profile.user_id) as TimeRecord[];
      
      if (userRecords.length === 0) return;

      // Calculate today's worked minutes
      let todayMinutes = 0;
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

      // Check for alerts
      const hasOvertime = todayMinutes > 600; // More than 10h
      const hasMissingExit = entry && !exit && todayMinutes > 540; // No exit but > 9h

      if (hasOvertime) {
        employeeAlerts.push({
          userId: profile.user_id,
          fullName: profile.full_name,
          sector: profile.sector,
          position: profile.position,
          alertType: 'overtime',
          todayMinutes,
          entryTime: entry ? format(new Date(entry.recorded_at), 'HH:mm') : null,
        });
      } else if (hasMissingExit) {
        employeeAlerts.push({
          userId: profile.user_id,
          fullName: profile.full_name,
          sector: profile.sector,
          position: profile.position,
          alertType: 'missing_exit',
          todayMinutes,
          entryTime: entry ? format(new Date(entry.recorded_at), 'HH:mm') : null,
        });
      }
    });

    setAlerts(employeeAlerts);
    setLoading(false);
  };

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getAlertLabel = (type: 'overtime' | 'missing_exit') => {
    switch (type) {
      case 'overtime':
        return { label: 'Hora extra excessiva', variant: 'destructive' as const };
      case 'missing_exit':
        return { label: 'Saída não registrada', variant: 'warning' as const };
      default:
        return { label: 'Alerta', variant: 'secondary' as const };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Alertas Ativos
          </DialogTitle>
          <DialogDescription>
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Clock className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum alerta ativo no momento.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Tipo de Alerta</TableHead>
                <TableHead className="text-center">Entrada</TableHead>
                <TableHead className="text-right">Horas Trabalhadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => {
                const alertInfo = getAlertLabel(alert.alertType);
                return (
                  <TableRow key={`${alert.userId}-${alert.alertType}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        {alert.fullName}
                      </div>
                      {alert.position && (
                        <span className="text-xs text-muted-foreground">{alert.position}</span>
                      )}
                    </TableCell>
                    <TableCell>{alert.sector || '-'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={alertInfo.variant === 'warning' ? 'secondary' : alertInfo.variant}
                        className={alertInfo.variant === 'warning' ? 'bg-warning/20 text-warning-foreground border-warning' : ''}
                      >
                        {alertInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {alert.entryTime || '--:--'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-destructive">
                      {formatMinutes(alert.todayMinutes)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AlertsDialog;
