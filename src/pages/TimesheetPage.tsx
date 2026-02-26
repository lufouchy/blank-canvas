import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CalendarDays, AlertTriangle, Clock, FileDown, Pen, CheckCircle } from "lucide-react";
import { endOfDay, format, startOfDay, isWeekend, differenceInMinutes, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "@/components/timesheet/SignatureCanvas";
import { generateTimesheetPDF, downloadPDF } from "@/components/timesheet/TimesheetPDF";

type TimeRecordType = "entry" | "lunch_out" | "lunch_in" | "exit";

interface TimeRecord {
  id: string;
  record_type: TimeRecordType;
  recorded_at: string;
}

const recordTypeLabel: Record<TimeRecordType, string> = {
  entry: "Entrada",
  lunch_out: "Saída Almoço",
  lunch_in: "Volta Almoço",
  exit: "Saída",
};

const EXPECTED_SEQUENCE: TimeRecordType[] = ["entry", "lunch_out", "lunch_in", "exit"];
const STANDARD_WORK_MINUTES = 8 * 60;
const OVERTIME_THRESHOLD_MINUTES = 2 * 60;

interface DayAnalysis {
  isWeekendDay: boolean;
  missingRecords: TimeRecordType[];
  workedMinutes: number;
  overtimeMinutes: number;
  hasExcessiveOvertime: boolean;
}

function analyzeDayRecords(date: Date, records: TimeRecord[]): DayAnalysis {
  const isWeekendDay = isWeekend(date);
  const recordTypes = records.map((r) => r.record_type);
  const missingRecords = EXPECTED_SEQUENCE.filter((type) => !recordTypes.includes(type));

  let workedMinutes = 0;
  const entry = records.find((r) => r.record_type === "entry");
  const lunchOut = records.find((r) => r.record_type === "lunch_out");
  const lunchIn = records.find((r) => r.record_type === "lunch_in");
  const exit = records.find((r) => r.record_type === "exit");

  if (entry && lunchOut) {
    workedMinutes += differenceInMinutes(new Date(lunchOut.recorded_at), new Date(entry.recorded_at));
  }
  if (lunchIn && exit) {
    workedMinutes += differenceInMinutes(new Date(exit.recorded_at), new Date(lunchIn.recorded_at));
  }

  const overtimeMinutes = Math.max(0, workedMinutes - STANDARD_WORK_MINUTES);
  const hasExcessiveOvertime = overtimeMinutes > OVERTIME_THRESHOLD_MINUTES;

  return {
    isWeekendDay,
    missingRecords,
    workedMinutes,
    overtimeMinutes,
    hasExcessiveOvertime,
  };
}

function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ""}`;
}

const TimesheetPage = () => {
  const { user, profile, loading } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [monthRecords, setMonthRecords] = useState<TimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  // Check if current month can be signed (only after last day of month)
  const canSignMonth = useMemo(() => {
    const selectedMonth = startOfMonth(date);
    const lastDayOfSelectedMonth = endOfMonth(selectedMonth);
    const today = new Date();
    return today > lastDayOfSelectedMonth;
  }, [date]);

  const dayRange = useMemo(() => {
    const start = startOfDay(date).toISOString();
    const end = endOfDay(date).toISOString();
    return { start, end };
  }, [date]);

  const monthRange = useMemo(() => {
    const start = startOfMonth(date).toISOString();
    const end = endOfMonth(date).toISOString();
    return { start, end };
  }, [date]);

  // Fetch daily records
  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from("time_records")
        .select("id, record_type, recorded_at")
        .eq("user_id", user.id)
        .gte("recorded_at", dayRange.start)
        .lte("recorded_at", dayRange.end)
        .order("recorded_at", { ascending: true });

      if (!error && data) setRecords(data as TimeRecord[]);
      setIsLoading(false);
    };

    run();
  }, [user?.id, dayRange.start, dayRange.end]);

  // Fetch monthly records for PDF
  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("time_records")
        .select("id, record_type, recorded_at")
        .eq("user_id", user.id)
        .gte("recorded_at", monthRange.start)
        .lte("recorded_at", monthRange.end)
        .order("recorded_at", { ascending: true });

      if (!error && data) setMonthRecords(data as TimeRecord[]);
    };

    run();
  }, [user?.id, monthRange.start, monthRange.end]);

  const analysis = useMemo(() => analyzeDayRecords(date, records), [date, records]);

  // Check for inconsistencies across the entire month
  const monthInconsistencies = useMemo(() => {
    const mStart = startOfMonth(date);
    const mEnd = endOfMonth(date);
    const today = new Date();
    // Exclude current day - only check up to yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastDay = yesterday < mStart ? null : (yesterday < mEnd ? yesterday : mEnd);
    if (!lastDay) return [];
    const allDays = eachDayOfInterval({ start: mStart, end: lastDay });
    
    const daysWithIssues: string[] = [];
    allDays.forEach(day => {
      if (isWeekend(day)) return;
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayRecs = monthRecords.filter(r => r.recorded_at.startsWith(dayStr));
      if (dayRecs.length === 0) return; // no records = no partial inconsistency
      const types = dayRecs.map(r => r.record_type);
      const missing = EXPECTED_SEQUENCE.filter(t => !types.includes(t));
      if (missing.length > 0) {
        daysWithIssues.push(format(day, 'dd/MM'));
      }
    });
    return daysWithIssues;
  }, [date, monthRecords]);

  const handleDownloadPDF = async () => {
    try {
      // Fetch company info
      const { data: companyData } = await supabase
        .from('company_info')
        .select('logo_url, cnpj, nome_fantasia')
        .limit(1)
        .single();

      const pdf = await generateTimesheetPDF({
        records: monthRecords,
        month: date,
        employeeName: profile?.full_name || "Colaborador",
        signatureData: null,
        companyInfo: companyData,
      });
      downloadPDF(pdf, `espelho-ponto-${format(date, "yyyy-MM")}.pdf`);
      toast({
        title: "PDF gerado com sucesso!",
        description: "O espelho de ponto foi baixado.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao gerar PDF",
        description: error.message,
      });
    }
  };

  const handleSignAndSave = async () => {
    if (!signature) {
      toast({
        variant: "destructive",
        title: "Assinatura obrigatória",
        description: "Por favor, desenhe sua assinatura antes de salvar.",
      });
      return;
    }

    setIsSigning(true);

    try {
      // Fetch company info
      const { data: companyData } = await supabase
        .from('company_info')
        .select('logo_url, cnpj, nome_fantasia')
        .limit(1)
        .single();

      // Generate signed PDF
      const pdf = await generateTimesheetPDF({
        records: monthRecords,
        month: date,
        employeeName: profile?.full_name || "Colaborador",
        signatureData: signature,
        companyInfo: companyData,
      });

      // Convert PDF to blob
      const pdfBlob = pdf.output("blob");
      const fileName = `${user?.id}/${format(date, "yyyy-MM")}-espelho-ponto.pdf`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("timesheet-documents")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get signed URL (1 hour expiry)
      const { data: urlData, error: urlError } = await supabase.storage
        .from("timesheet-documents")
        .createSignedUrl(fileName, 3600);

      if (urlError) throw urlError;

      // Save document reference in database
      const { data: tsOrgData } = await supabase.from("profiles").select("organization_id").eq("user_id", user?.id).single();
      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user?.id,
        document_type: "timesheet",
        title: `Espelho de Ponto - ${format(date, "MMMM yyyy", { locale: ptBR })}`,
        reference_month: format(startOfMonth(date), "yyyy-MM-dd"),
        file_url: urlData.signedUrl,
        signature_data: signature,
        signed_at: new Date().toISOString(),
        status: "signed",
        expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
        organization_id: tsOrgData?.organization_id,
      });

      if (dbError) throw dbError;

      toast({
        title: "Documento assinado com sucesso!",
        description: "O espelho de ponto foi salvo e arquivado.",
      });

      setShowSignDialog(false);
      setSignature(null);

      // Also download the signed PDF
      downloadPDF(pdf, `espelho-ponto-assinado-${format(date, "yyyy-MM")}.pdf`);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar documento",
        description: error.message,
      });
    } finally {
      setIsSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const showInconsistencyAlert = !isLoading && monthInconsistencies.length > 0;
  const showOvertimeAlert = !isLoading && analysis.hasExcessiveOvertime;

  return (
    <SidebarLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in p-6">
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Espelho do Ponto
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={handleDownloadPDF}>
                  <FileDown className="h-4 w-4" />
                  Baixar PDF
                </Button>
                <Button 
                  className="gap-2" 
                  onClick={() => setShowSignDialog(true)}
                  disabled={!canSignMonth}
                  title={!canSignMonth ? 'Só é possível assinar após o último dia do mês' : ''}
                >
                  <Pen className="h-4 w-4" />
                  Assinar e Salvar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[360px_1fr]">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Selecione um dia para ver as marcações.
              </p>
              <div className="rounded-lg border border-border bg-card p-3">
                <Calendar
                  mode="single"
                  selected={date}
                  month={date}
                  onMonthChange={(m) => setDate(m)}
                  onSelect={(d) => d && setDate(d)}
                  locale={ptBR}
                  modifiers={{ weekend: (d) => isWeekend(d) }}
                  modifiersClassNames={{
                    weekend: "bg-muted/70 text-muted-foreground",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Mês de referência: <strong>{format(date, "MMMM 'de' yyyy", { locale: ptBR })}</strong>
              </p>
            </div>

            <div className="space-y-4">
              {/* Day header with badges */}
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className={cn(
                    "text-base font-semibold",
                    analysis.isWeekendDay ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </h2>
                {analysis.isWeekendDay && (
                  <Badge variant="secondary" className="text-xs">
                    Final de semana
                  </Badge>
                )}
                {isLoading && (
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando
                  </span>
                )}
              </div>

              {/* Signature availability info */}
              {!canSignMonth && (
                <Alert className="border-primary/50 bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-primary">Assinatura disponível após o mês</AlertTitle>
                  <AlertDescription>
                    O espelho de ponto só pode ser assinado após o último dia do mês de referência.
                  </AlertDescription>
                </Alert>
              )}

              {/* Alerts */}
              {showInconsistencyAlert && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Inconsistência no ponto</AlertTitle>
                  <AlertDescription>
                    Existem marcações incompletas nos dias: {monthInconsistencies.join(', ')}.
                  </AlertDescription>
                </Alert>
              )}

              {showOvertimeAlert && (
                <Alert className="border-warning/50 bg-warning/10">
                  <Clock className="h-4 w-4 text-warning" />
                  <AlertTitle className="text-warning">Hora extra excessiva</AlertTitle>
                  <AlertDescription>
                    Você trabalhou {formatMinutesToHours(analysis.workedMinutes)} neste dia, com{" "}
                    <strong>{formatMinutesToHours(analysis.overtimeMinutes)}</strong> de hora extra (acima de 2h).
                  </AlertDescription>
                </Alert>
              )}

              {/* Records table */}
              {records.length === 0 && !isLoading ? (
                <div
                  className={cn(
                    "rounded-lg border p-6 text-center text-sm",
                    analysis.isWeekendDay
                      ? "bg-muted/50 border-muted text-muted-foreground"
                      : "bg-muted/30 border-border text-muted-foreground"
                  )}
                >
                  {analysis.isWeekendDay
                    ? "Final de semana — sem marcações esperadas."
                    : "Nenhuma marcação encontrada para este dia."}
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-lg border overflow-hidden",
                    analysis.isWeekendDay && "border-muted bg-muted/20"
                  )}
                >
                  <Table>
                    <TableHeader>
                      <TableRow className={cn(analysis.isWeekendDay && "bg-muted/40")}>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Horário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => (
                        <TableRow key={r.id} className={cn(analysis.isWeekendDay && "bg-muted/20")}>
                          <TableCell className="font-medium">{recordTypeLabel[r.record_type]}</TableCell>
                          <TableCell className="tabular-nums">
                            {format(new Date(r.recorded_at), "HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Summary row */}
                  {records.length > 0 && (
                    <div className="border-t border-border bg-muted/30 px-4 py-3 flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Trabalhado: </span>
                        <span className="font-medium">{formatMinutesToHours(analysis.workedMinutes)}</span>
                      </div>
                      {analysis.overtimeMinutes > 0 && (
                        <div>
                          <span className="text-muted-foreground">Hora extra: </span>
                          <span
                            className={cn(
                              "font-medium",
                              analysis.hasExcessiveOvertime && "text-warning"
                            )}
                          >
                            +{formatMinutesToHours(analysis.overtimeMinutes)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sign Dialog */}
        <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pen className="h-5 w-5 text-primary" />
                Assinar Espelho de Ponto
              </DialogTitle>
              <DialogDescription>
                Assine digitalmente o espelho de ponto de{" "}
                <strong>{format(date, "MMMM 'de' yyyy", { locale: ptBR })}</strong>.
                O documento será salvo e arquivado automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Período:</span>
                  <span className="font-medium">{format(date, "MMMM 'de' yyyy", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Registros:</span>
                  <span className="font-medium">{monthRecords.length} marcações</span>
                </div>
              </div>

              <SignatureCanvas onSignatureChange={setSignature} />

              {signature && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle className="h-4 w-4" />
                  Assinatura capturada
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowSignDialog(false);
                    setSignature(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleSignAndSave}
                  disabled={isSigning || !signature}
                >
                  {isSigning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Assinar e Salvar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarLayout>
  );
};

export default TimesheetPage;
