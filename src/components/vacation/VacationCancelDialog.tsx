import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Ban, Loader2 } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VacationCancelDialogProps {
  vacationId: string;
  userName: string;
  startDate: string;
  endDate: string;
  onSuccess: () => void;
}

const VacationCancelDialog = ({
  vacationId,
  userName,
  startDate,
  endDate,
  onSuccess,
}: VacationCancelDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canCancel = isBefore(startOfDay(new Date()), parseISO(startDate));

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !canCancel) {
      toast({
        variant: 'destructive',
        title: 'Não é possível cancelar',
        description: 'O cancelamento só pode ser efetuado antes do início do período de férias do colaborador.',
      });
      return;
    }
    setOpen(newOpen);
  };

  const handleCancel = async () => {
    setIsLoading(true);

    const { error } = await supabase
      .from('vacation_requests')
      .update({
        status: 'rejected',
      })
      .eq('id', vacationId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar',
        description: error.message,
      });
    } else {
      toast({
        title: 'Férias canceladas!',
        description: `As férias de ${userName} foram canceladas.`,
      });
      setOpen(false);
      onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Cancelar Férias">
          <Ban className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar Férias</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja cancelar as férias de <strong>{userName}</strong>?
            <br /><br />
            <span className="text-muted-foreground">
              Período: {format(parseISO(startDate), 'dd/MM/yyyy', { locale: ptBR })} a{' '}
              {format(parseISO(endDate), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
            <br /><br />
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              'Confirmar Cancelamento'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default VacationCancelDialog;
