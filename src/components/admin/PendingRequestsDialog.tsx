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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingRequestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  vacation_type: 'individual' | 'collective';
  reason: string | null;
  created_at: string;
  profile?: { full_name: string };
}

interface AdjustmentRequest {
  id: string;
  user_id: string;
  request_type: string;
  requested_time: string;
  record_type: string;
  reason: string;
  absence_type: string | null;
  absence_dates: string[] | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  profile?: { full_name: string };
}

const PendingRequestsDialog = ({ open, onOpenChange }: PendingRequestsDialogProps) => {
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [adjustmentRequests, setAdjustmentRequests] = useState<AdjustmentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchPendingRequests();
    }
  }, [open]);

  const fetchPendingRequests = async () => {
    setLoading(true);

    // Fetch profiles for mapping
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name');

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

    // Fetch pending vacation requests
    const { data: vacations } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Fetch pending adjustment requests
    const { data: adjustments } = await supabase
      .from('adjustment_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    setVacationRequests(
      (vacations || []).map(v => ({
        ...v,
        profile: { full_name: profileMap.get(v.user_id) || 'Desconhecido' }
      }))
    );

    setAdjustmentRequests(
      (adjustments || []).map(a => ({
        ...a,
        profile: { full_name: profileMap.get(a.user_id) || 'Desconhecido' }
      }))
    );

    setLoading(false);
  };

  const getAbsenceTypeLabel = (type: string | null) => {
    switch (type) {
      case 'vacation': return 'Férias';
      case 'medical_consultation': return 'Consulta Médica';
      case 'medical_leave': return 'Atestado Médico';
      case 'justified_absence': return 'Ausência Justificada';
      case 'bereavement_leave': return 'Licença Falecimento';
      default: return 'Ajuste de Ponto';
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'adjustment': return 'Ajuste';
      case 'absence': return 'Ausência';
      default: return type;
    }
  };

  const totalPending = vacationRequests.length + adjustmentRequests.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Solicitações Pendentes
          </DialogTitle>
          <DialogDescription>
            {totalPending} solicitação(ões) aguardando aprovação
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Clock className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : totalPending === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma solicitação pendente no momento.
          </div>
        ) : (
          <Tabs defaultValue="vacations" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vacations" className="gap-2">
                <Calendar className="h-4 w-4" />
                Férias ({vacationRequests.length})
              </TabsTrigger>
              <TabsTrigger value="adjustments" className="gap-2">
                <FileText className="h-4 w-4" />
                Ajustes ({adjustmentRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vacations" className="mt-4">
              {vacationRequests.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  Nenhuma solicitação de férias pendente.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                      <TableHead>Data Solicitação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vacationRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.profile?.full_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {request.vacation_type === 'individual' ? 'Individual' : 'Coletivas'}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {format(new Date(request.start_date), 'dd/MM/yyyy')} - {format(new Date(request.end_date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-semibold">
                          {request.days_count}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="adjustments" className="mt-4">
              {adjustmentRequests.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  Nenhuma solicitação de ajuste pendente.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Data/Horário</TableHead>
                      <TableHead>Data Solicitação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustmentRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.profile?.full_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getAbsenceTypeLabel(request.absence_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {request.reason}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {request.absence_dates && request.absence_dates.length > 0 
                            ? `${request.absence_dates.length} dia(s)`
                            : request.start_time && request.end_time
                              ? `${request.start_time} - ${request.end_time}`
                              : format(new Date(request.requested_time), 'dd/MM/yyyy HH:mm')
                          }
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PendingRequestsDialog;
