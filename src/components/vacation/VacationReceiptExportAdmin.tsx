import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Clock } from 'lucide-react';
import { generateVacationReceiptPDF, downloadVacationReceiptPDF } from './VacationReceiptPDF';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VacationReceiptExportAdminProps {
  vacationId: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  daysCount: number;
}

const VacationReceiptExportAdmin = ({
  vacationId,
  userId,
  userName,
  startDate,
  endDate,
  daysCount,
}: VacationReceiptExportAdminProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [signedDocument, setSignedDocument] = useState<{
    id: string;
    signature_data: string | null;
    signed_at: string | null;
    status: string;
  } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    checkSignedDocument();
  }, [vacationId]);

  const checkSignedDocument = async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, signature_data, signed_at, status')
      .eq('user_id', userId)
      .eq('document_type', 'vacation_receipt')
      .eq('reference_month', startDate)
      .eq('status', 'signed')
      .maybeSingle();

    setSignedDocument(data);
    setChecked(true);
  };

  const handleExport = async () => {
    if (!signedDocument) return;
    setIsLoading(true);

    try {
      // Fetch signature data fresh from DB to ensure it's always included
      const [profileRes, companyRes, docRes] = await Promise.all([
        supabase.from('profiles').select('full_name, cpf').eq('user_id', userId).single(),
        supabase.from('company_info').select('logo_url, cnpj, nome_fantasia, address_city, address_state').limit(1).single(),
        supabase.from('documents')
          .select('signature_data, signed_at')
          .eq('id', signedDocument.id)
          .single(),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (docRes.error) {
        console.error('Error fetching document signature:', docRes.error);
      }

      const freshSignatureData = docRes.data?.signature_data || signedDocument.signature_data;
      const freshSignedAt = docRes.data?.signed_at || signedDocument.signed_at;

      if (!freshSignatureData) {
        throw new Error('Assinatura do colaborador não encontrada. O colaborador precisa assinar o recibo primeiro.');
      }

      const pdf = await generateVacationReceiptPDF({
        companyInfo: companyRes.data,
        employeeInfo: {
          full_name: profileRes.data.full_name || userName,
          cpf: profileRes.data.cpf,
        },
        vacationData: { start_date: startDate, end_date: endDate, days_count: daysCount },
        signatureData: freshSignatureData,
        signedAt: freshSignedAt,
      });

      const filename = `recibo-ferias-assinado-${userName.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(startDate), 'yyyy-MM')}.pdf`;
      downloadVacationReceiptPDF(pdf, filename);

      toast({ title: 'Recibo exportado!', description: `Recibo assinado de ${userName} exportado.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao exportar', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (!checked) return null;

  if (!signedDocument) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 text-xs cursor-default">
              <Clock className="h-3 w-3" />
              Aguardando assinatura
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>O colaborador ainda não assinou o recibo de férias.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleExport} disabled={isLoading} title="Baixar Recibo Assinado">
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
};

export default VacationReceiptExportAdmin;
