import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Loader2 } from 'lucide-react';
import { format, differenceInDays, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

interface VacationEditDialogProps {
  vacationId: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  onSuccess: () => void;
}

const VacationEditDialog = ({
  vacationId,
  userName,
  startDate,
  endDate,
  reason: initialReason,
  onSuccess,
}: VacationEditDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState(initialReason || '');

  useEffect(() => {
    if (open) {
      setDateRange({
        from: parseISO(startDate),
        to: parseISO(endDate),
      });
      setReason(initialReason || '');
    }
  }, [open, startDate, endDate, initialReason]);

  const canEdit = isBefore(startOfDay(new Date()), parseISO(startDate));

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !canEdit) {
      toast({
        variant: 'destructive',
        title: 'Não é possível editar',
        description: 'A edição só pode ser efetuada antes do início do período de férias do colaborador.',
      });
      return;
    }
    setOpen(newOpen);
  };

  const handleSave = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Selecione o período das férias.',
      });
      return;
    }

    setIsLoading(true);

    const daysCount = differenceInDays(dateRange.to, dateRange.from) + 1;

    const { error } = await supabase
      .from('vacation_requests')
      .update({
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd'),
        days_count: daysCount,
        reason: reason || null,
      })
      .eq('id', vacationId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: error.message,
      });
    } else {
      toast({
        title: 'Férias atualizadas!',
        description: `As férias de ${userName} foram atualizadas com sucesso.`,
      });
      setOpen(false);
      onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Editar Férias">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Férias</DialogTitle>
          <DialogDescription>
            Altere o período de férias de {userName}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Período das Férias</Label>
              <div className="border rounded-lg p-3">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={ptBR}
                  numberOfMonths={1}
                />
              </div>
              {dateRange?.from && dateRange?.to && (
                <p className="text-sm text-muted-foreground">
                  {differenceInDays(dateRange.to, dateRange.from) + 1} dias selecionados
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                placeholder="Adicione uma observação..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>

            <Button onClick={handleSave} className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default VacationEditDialog;
