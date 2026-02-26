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
import { Loader2, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StatusHistoryEntry {
  id: string;
  user_id: string;
  previous_status: string | null;
  new_status: string | null;
  previous_specification: string | null;
  new_specification: string | null;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
  changed_by_name?: string;
}

interface StatusHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  employeeName: string;
}

const getStatusBadgeVariant = (status: string | null) => {
  switch (status?.toLowerCase()) {
    case 'ativo':
      return 'default';
    case 'suspenso':
      return 'secondary';
    case 'afastado':
      return 'outline';
    case 'desligado':
      return 'destructive';
    default:
      return 'default';
  }
};

export function StatusHistoryDialog({
  open,
  onOpenChange,
  userId,
  employeeName,
}: StatusHistoryDialogProps) {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      fetchHistory();
    }
  }, [open, userId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('status_history')
      .select('*')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false });

    if (data && !error) {
      // Fetch names for changed_by users
      const changedByIds = [...new Set(data.filter(h => h.changed_by).map(h => h.changed_by))];
      
      let profilesMap: Record<string, string> = {};
      if (changedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', changedByIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p.full_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const historyWithNames = data.map(h => ({
        ...h,
        changed_by_name: h.changed_by ? (profilesMap[h.changed_by] || 'Sistema') : 'Sistema',
      }));

      setHistory(historyWithNames);
    }
    
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Status
          </DialogTitle>
          <DialogDescription>
            Histórico de mudanças de status e especificação de {employeeName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma alteração de status registrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status Anterior</TableHead>
                <TableHead>Novo Status</TableHead>
                <TableHead>Alterado Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(entry.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {entry.previous_status && (
                        <Badge variant={getStatusBadgeVariant(entry.previous_status)} className="w-fit">
                          {entry.previous_status}
                        </Badge>
                      )}
                      {entry.previous_specification && (
                        <span className="text-xs text-muted-foreground">
                          {entry.previous_specification}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {entry.new_status && (
                        <Badge variant={getStatusBadgeVariant(entry.new_status)} className="w-fit">
                          {entry.new_status}
                        </Badge>
                      )}
                      {entry.new_specification && (
                        <span className="text-xs text-muted-foreground">
                          {entry.new_specification}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.changed_by_name}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
