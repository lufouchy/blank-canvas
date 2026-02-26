import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2 } from 'lucide-react';
import { generateTimesheetPDF, downloadPDF } from '@/components/timesheet/TimesheetPDF';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmployeeTimesheetExportProps {
  employeeId: string;
  employeeName: string;
  userId: string;
}

const EmployeeTimesheetExport = ({ employeeId, employeeName, userId }: EmployeeTimesheetExportProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Generate last 12 months options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  });

  const handleExport = async () => {
    if (!selectedMonth) {
      toast({
        variant: 'destructive',
        title: 'Selecione um mês',
        description: 'Escolha o mês para gerar o relatório.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Fetch time records for the selected month
      const { data: records, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', userId)
        .gte('recorded_at', startDate.toISOString())
        .lte('recorded_at', endDate.toISOString())
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      // Check if there's a signed document for this month
      const { data: signedDoc } = await supabase
        .from('documents')
        .select('signature_data')
        .eq('user_id', userId)
        .eq('reference_month', format(startDate, 'yyyy-MM-dd'))
        .eq('status', 'signed')
        .maybeSingle();

      // Fetch company info
      const { data: companyData } = await supabase
        .from('company_info')
        .select('logo_url, cnpj, nome_fantasia')
        .limit(1)
        .single();

      const pdf = await generateTimesheetPDF({
        records: records || [],
        month: startDate,
        employeeName,
        signatureData: signedDoc?.signature_data,
        companyInfo: companyData,
      });

      const filename = `espelho-ponto-${employeeName.toLowerCase().replace(/\s+/g, '-')}-${selectedMonth}.pdf`;
      downloadPDF(pdf, filename);

      toast({
        title: 'Relatório exportado!',
        description: `Espelho de ponto de ${format(startDate, "MMMM 'de' yyyy", { locale: ptBR })} exportado com sucesso.`,
      });

      setOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Exportar Espelho de Ponto">
          <FileText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Exportar Espelho de Ponto
          </DialogTitle>
          <DialogDescription>
            Gere o relatório de ponto de {employeeName} em PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Mês de Referência</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleExport} disabled={isLoading || !selectedMonth} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Exportar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeTimesheetExport;
