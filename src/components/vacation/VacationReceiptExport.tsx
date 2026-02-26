import { useState, useEffect } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';

import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2, Download, CheckCircle } from 'lucide-react';
import { generateVacationReceiptPDF, downloadVacationReceiptPDF } from './VacationReceiptPDF';
import SignatureCanvas from '@/components/timesheet/SignatureCanvas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VacationReceiptExportProps {
  vacationId: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  daysCount: number;
}

const VacationReceiptExport = ({
  vacationId,
  userId,
  userName,
  startDate,
  endDate,
  daysCount,
}: VacationReceiptExportProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [existingDocument, setExistingDocument] = useState<{
    id: string;
    signature_data: string | null;
    signed_at: string | null;
    status: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      checkExistingDocument();
    }
  }, [open, vacationId]);

  const checkExistingDocument = async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, signature_data, signed_at, status')
      .eq('user_id', userId)
      .eq('document_type', 'vacation_receipt')
      .eq('reference_month', startDate)
      .maybeSingle();

    setExistingDocument(data);
    if (data?.signature_data) {
      setSignatureData(data.signature_data);
    }
  };

  const fetchDataAndGeneratePDF = async (signatureToUse: string | null = null, signedAtToUse: string | null = null) => {
    // Fetch employee profile for CPF
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, cpf')
      .eq('user_id', userId)
      .single();

    if (profileError) throw profileError;

    // Fetch company info
    const { data: companyData, error: companyError } = await supabase
      .from('company_info')
      .select('logo_url, cnpj, nome_fantasia, address_city, address_state')
      .limit(1)
      .single();

    if (companyError && companyError.code !== 'PGRST116') {
      throw companyError;
    }

    const pdf = await generateVacationReceiptPDF({
      companyInfo: companyData,
      employeeInfo: {
        full_name: profileData.full_name || userName,
        cpf: profileData.cpf,
      },
      vacationData: {
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
      },
      signatureData: signatureToUse,
      signedAt: signedAtToUse,
    });

    return pdf;
  };

  const handleExport = async () => {
    setIsLoading(true);

    try {
      // Use existing signature data if document is signed
      const sigToUse = existingDocument?.signature_data || null;
      const signedAtToUse = existingDocument?.signed_at || null;
      
      const pdf = await fetchDataAndGeneratePDF(sigToUse, signedAtToUse);
      const filename = `recibo-ferias-${userName.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(startDate), 'yyyy-MM')}.pdf`;
      downloadVacationReceiptPDF(pdf, filename);

      toast({
        title: 'Recibo exportado!',
        description: `Recibo de férias de ${userName} exportado com sucesso.`,
      });
    } catch (error: any) {
      console.error('Error generating vacation receipt:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar',
        description: error.message || 'Erro ao gerar recibo de férias.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signatureData) {
      toast({
        variant: 'destructive',
        title: 'Assinatura obrigatória',
        description: 'Por favor, desenhe sua assinatura no campo acima.',
      });
      return;
    }

    setIsSigning(true);

    try {
      const documentTitle = `Recibo de Férias - ${format(new Date(startDate), "MMMM 'de' yyyy", { locale: ptBR })}`;
      const signedAt = new Date().toISOString();

      if (existingDocument) {
        // Update existing document
        const { error } = await supabase
          .from('documents')
          .update({
            signature_data: signatureData,
            signed_at: signedAt,
            status: 'signed',
          })
          .eq('id', existingDocument.id);

        if (error) throw error;
      } else {
        // Create new document
        const { data: vrOrgData, error: orgError } = await supabase.from('profiles').select('organization_id').eq('user_id', userId).single();
        if (orgError) throw new Error('Erro ao buscar dados do perfil: ' + orgError.message);
        if (!vrOrgData?.organization_id) throw new Error('Organização não encontrada no perfil.');
        
        const { error } = await supabase
          .from('documents')
          .insert({
            user_id: userId,
            title: documentTitle,
            document_type: 'vacation_receipt',
            reference_month: startDate,
            signature_data: signatureData,
            signed_at: signedAt,
            status: 'signed',
            organization_id: vrOrgData.organization_id,
          });

        if (error) throw error;
      }

      // Generate and download signed PDF - pass signature directly to ensure it's included
      const pdf = await fetchDataAndGeneratePDF(signatureData, signedAt);
      const filename = `recibo-ferias-assinado-${userName.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(startDate), 'yyyy-MM')}.pdf`;
      downloadVacationReceiptPDF(pdf, filename);

      toast({
        title: 'Recibo assinado!',
        description: 'O recibo foi assinado e exportado com sucesso.',
      });

      await checkExistingDocument();
    } catch (error: any) {
      console.error('Error signing vacation receipt:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao assinar',
        description: error.message || 'Erro ao assinar o recibo de férias.',
      });
    } finally {
      setIsSigning(false);
    }
  };

  const isSigned = existingDocument?.status === 'signed';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" title={isSigned ? 'Recibo Assinado' : 'Assinar Recibo de Férias'}>
          <FileText className="h-4 w-4" />
          {isSigned ? 'Recibo Assinado' : 'Assinar Recibo'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Recibo de Férias
          </DialogTitle>
          <DialogDescription>
            {isSigned ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                Recibo assinado digitalmente
              </span>
            ) : (
              'Assine digitalmente o recibo de férias abaixo para validá-lo.'
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 pt-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm">
                <span className="font-medium">Colaborador:</span> {userName}
              </p>
              <p className="text-sm">
                <span className="font-medium">Período:</span>{' '}
                {format(new Date(startDate), 'dd/MM/yyyy', { locale: ptBR })} a{' '}
                {format(new Date(endDate), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
              <p className="text-sm">
                <span className="font-medium">Dias:</span> {daysCount}
              </p>
              {isSigned && existingDocument?.signed_at && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Assinado em:</span>{' '}
                  {format(new Date(existingDocument.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>

            {!isSigned && (
              <>
                <div className="border-2 border-dashed border-primary/40 rounded-lg p-4 bg-primary/5">
                  <p className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                    ✍️ Assine no campo abaixo para validar o recibo
                  </p>
                  <SignatureCanvas onSignatureChange={setSignatureData} />
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              {!isSigned && (
                <Button onClick={handleSign} disabled={isSigning || !signatureData} className="w-full" size="lg">
                  {isSigning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Assinando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Assinar Recibo de Férias
                    </>
                  )}
                </Button>
              )}

              {isSigned && (
                <Button 
                  onClick={handleExport} 
                  disabled={isLoading} 
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Baixar Recibo Assinado
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default VacationReceiptExport;
