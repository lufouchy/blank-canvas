import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
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
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Clock, 
  FileText, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Loader2,
  Stethoscope,
  Briefcase,
  Paperclip,
  Download,
  X,
  CalendarDays,
  Baby,
  UserPlus,
  AlertTriangle,
  ShieldAlert,
  Ban,
  ClipboardPlus,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type RecordType = 'entry' | 'lunch_out' | 'lunch_in' | 'exit';
type RequestStatus = 'pending' | 'approved' | 'rejected';
type RequestType = 'adjustment' | 'medical_consultation' | 'medical_leave' | 'justified_absence' | 'day_off' | 'bereavement_leave';
type AdminRecordType = 'maternity_leave' | 'paternity_leave' | 'unjustified_absence' | 'work_accident' | 'punitive_suspension';

interface AdjustmentRequest {
  id: string;
  user_id: string;
  request_type: string;
  requested_time: string;
  record_type: RecordType;
  reason: string;
  status: RequestStatus;
  created_at: string;
  userName?: string;
  start_time?: string;
  end_time?: string;
  absence_dates?: string[];
  absence_reason?: string;
  attachment_url?: string | null;
}

const recordTypeLabels: Record<RecordType, string> = {
  entry: 'Entrada',
  lunch_out: 'Saída Almoço',
  lunch_in: 'Volta Almoço',
  exit: 'Saída',
};

const adminRecordTypeLabels: Record<AdminRecordType, { label: string; icon: typeof Clock }> = {
  maternity_leave: { label: 'Licença Maternidade', icon: Baby },
  paternity_leave: { label: 'Licença Paternidade', icon: UserPlus },
  unjustified_absence: { label: 'Ausência Não Justificada (Falta)', icon: Ban },
  work_accident: { label: 'Acidente de Trabalho', icon: AlertTriangle },
  punitive_suspension: { label: 'Suspensão (Punitiva)', icon: ShieldAlert },
};

const requestTypeLabels: Record<RequestType, { label: string; icon: typeof Clock }> = {
  adjustment: { label: 'Ajuste de Ponto', icon: AlertCircle },
  medical_consultation: { label: 'Atestado Médico - Consultas/Exames', icon: Stethoscope },
  medical_leave: { label: 'Atestado Médico - Afastamento', icon: Stethoscope },
  justified_absence: { label: 'Ausência Justificada', icon: Briefcase },
  day_off: { label: 'Folga', icon: CalendarDays },
  bereavement_leave: { label: 'Licença Falecimento de Familiar', icon: CalendarDays },
};

const statusConfig: Record<RequestStatus, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: typeof Clock }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Reprovado', variant: 'destructive', icon: XCircle },
};

const Requests = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AdjustmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [requestType, setRequestType] = useState<RequestType>('adjustment');
  const [recordType, setRecordType] = useState<RecordType>('entry');
  const [requestedTime, setRequestedTime] = useState('');
  const [reason, setReason] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [absenceDates, setAbsenceDates] = useState<Date[]>([]);
  const [absenceReason, setAbsenceReason] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin record form state
  const [showAdminRecordDialog, setShowAdminRecordDialog] = useState(false);
  const [adminRecordType, setAdminRecordType] = useState<AdminRecordType>('maternity_leave');
  const [adminRecordDates, setAdminRecordDates] = useState<Date[]>([]);
  const [adminRecordReason, setAdminRecordReason] = useState('');
  const [adminRecordSubmitting, setAdminRecordSubmitting] = useState(false);
  const [adminEmployees, setAdminEmployees] = useState<{ user_id: string; full_name: string }[]>([]);
  const [adminSelectedEmployee, setAdminSelectedEmployee] = useState('');

  // Filter state
  const [filterName, setFilterName] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const isAdmin = userRole === 'admin' || userRole === 'suporte';

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allTypeOptions = [
    ...Object.entries(requestTypeLabels).map(([key, { label }]) => ({ key, label })),
    ...Object.entries(adminRecordTypeLabels).map(([key, { label }]) => ({ key, label })),
  ];

  const filteredRequests = requests.filter((r) => {
    if (filterName && !r.userName?.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterType !== 'all' && r.request_type !== filterType) return false;
    if (filterDate) {
      const requestDate = format(new Date(r.created_at), 'yyyy-MM-dd');
      if (requestDate !== filterDate) return false;
    }
    return true;
  });

  useEffect(() => {
    fetchRequests();
    if (isAdmin) fetchEmployees();
  }, [user, isAdmin]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name');
    if (data) setAdminEmployees(data);
  };

  const fetchRequests = async () => {
    setLoading(true);
    
    let query = supabase
      .from('adjustment_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      if (isAdmin) {
        const userIds = [...new Set(data.map((r) => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
        
        setRequests(data.map((r) => ({
          ...r,
          userName: profileMap.get(r.user_id) || 'Usuário',
        })) as AdjustmentRequest[]);
      } else {
        setRequests(data as AdjustmentRequest[]);
      }
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setRequestType('adjustment');
    setRecordType('entry');
    setRequestedTime('');
    setReason('');
    setStartTime('');
    setEndTime('');
    setAbsenceDates([]);
    setAbsenceReason('');
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetAdminForm = () => {
    setAdminRecordType('maternity_leave');
    setAdminRecordDates([]);
    setAdminRecordReason('');
    setAdminSelectedEmployee('');
  };

  const handleCreateAdminRecord = async () => {
    if (!adminSelectedEmployee) {
      toast({ variant: 'destructive', title: 'Selecione um colaborador' });
      return;
    }
    if (adminRecordDates.length === 0) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Selecione o(s) dia(s) no calendário.' });
      return;
    }

    setAdminRecordSubmitting(true);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', adminSelectedEmployee)
      .single();

    const { error } = await supabase
      .from('adjustment_requests')
      .insert({
        user_id: adminSelectedEmployee,
        request_type: 'absence',
        requested_time: new Date().toISOString(),
        record_type: 'entry' as RecordType,
        reason: adminRecordReason || adminRecordTypeLabels[adminRecordType].label,
        status: 'approved',
        organization_id: profileData?.organization_id,
        absence_dates: adminRecordDates.map(d => format(d, 'yyyy-MM-dd')),
        absence_type: adminRecordType,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao incluir registro', description: error.message });
    } else {
      toast({ title: 'Registro incluído!', description: 'O registro foi salvo com sucesso.' });
      setShowAdminRecordDialog(false);
      resetAdminForm();
      fetchRequests();
    }

    setAdminRecordSubmitting(false);
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachmentFile || !user?.id) return null;
    const fileExt = attachmentFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage
      .from('request-attachments')
      .upload(fileName, attachmentFile);
    if (error) {
      console.error('Upload error:', error);
      toast({ variant: 'destructive', title: 'Erro ao enviar anexo', description: error.message });
      return null;
    }
    return fileName;
  };

  const handleCreateRequest = async () => {
    // Validation based on request type
    if (requestType === 'adjustment') {
      if (!requestedTime || !reason) {
        toast({
          variant: 'destructive',
          title: 'Campos obrigatórios',
          description: 'Preencha todos os campos.',
        });
        return;
      }
    } else if (requestType === 'medical_consultation' || requestType === 'justified_absence') {
      if (!startTime || !endTime || !reason) {
        toast({
          variant: 'destructive',
          title: 'Campos obrigatórios',
          description: 'Preencha horário de início, término e motivo.',
        });
        return;
      }
    } else if (requestType === 'medical_leave' || requestType === 'day_off') {
      if (absenceDates.length === 0 || !reason) {
        toast({
          variant: 'destructive',
          title: 'Campos obrigatórios',
          description: requestType === 'day_off' 
            ? 'Selecione o(s) dia(s) de folga e adicione o motivo.'
            : 'Selecione os dias de afastamento e adicione o motivo.',
        });
        return;
      }
    } else if (requestType === 'bereavement_leave') {
      if (absenceDates.length === 0 || !reason) {
        toast({
          variant: 'destructive',
          title: 'Campos obrigatórios',
          description: 'Selecione a data de início e fim e adicione o motivo.',
        });
        return;
      }
    }

    setSubmitting(true);


    // Regular adjustment requests
    const attachmentPath = await uploadAttachment();
    const { data: adjProfileData } = await supabase.from('profiles').select('organization_id').eq('user_id', user?.id).single();
    const insertData: any = {
      user_id: user?.id,
      request_type: requestType,
      requested_time: requestType === 'adjustment' 
        ? new Date(requestedTime).toISOString()
        : new Date().toISOString(),
      record_type: recordType,
      reason: reason,
      status: 'pending',
      organization_id: adjProfileData?.organization_id,
      attachment_url: attachmentPath,
    };

    if (requestType === 'medical_consultation' || requestType === 'justified_absence') {
      insertData.start_time = startTime;
      insertData.end_time = endTime;
      insertData.absence_reason = requestType === 'justified_absence' ? absenceReason : null;
    }

    if (requestType === 'medical_leave' || requestType === 'day_off' || requestType === 'bereavement_leave') {
      insertData.absence_dates = absenceDates.map(d => format(d, 'yyyy-MM-dd'));
      if (requestType === 'bereavement_leave') {
        insertData.absence_type = 'bereavement_leave';
      }
    }

    const { error } = await supabase
      .from('adjustment_requests')
      .insert(insertData);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar solicitação',
        description: error.message,
      });
    } else {
      toast({
        title: 'Solicitação enviada!',
        description: 'Aguarde a análise do gestor.',
      });
      setShowNewDialog(false);
      resetForm();
      fetchRequests();
    }

    setSubmitting(false);
  };

  const handleUpdateStatus = async (requestId: string, newStatus: RequestStatus) => {
    const { error } = await supabase
      .from('adjustment_requests')
      .update({
        status: newStatus,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: error.message,
      });
    } else {
      toast({
        title: newStatus === 'approved' ? 'Solicitação aprovada!' : 'Solicitação reprovada',
        description: newStatus === 'approved' 
          ? 'O registro foi ajustado.'
          : 'O colaborador será notificado.',
      });
      fetchRequests();
    }
  };

  const getRequestTypeInfo = (type: string) => {
    return requestTypeLabels[type as RequestType] || adminRecordTypeLabels[type as AdminRecordType] || { label: type, icon: FileText };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Clock className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isAdmin ? 'Ajuste de Ponto' : 'Minhas Solicitações'}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin 
            ? 'Gerencie as solicitações dos colaboradores e inclua registros'
            : 'Solicite ajustes de ponto, férias e folgas'}
        </p>
      </div>

      {!isAdmin && (
        <div className="flex justify-end">
          <Dialog open={showNewDialog} onOpenChange={(open) => { setShowNewDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Solicitação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Solicitação</DialogTitle>
                <DialogDescription>
                  Solicite ajustes de ponto, férias e folgas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Tipo de Solicitação</Label>
                  <Select
                    value={requestType}
                    onValueChange={(value) => setRequestType(value as RequestType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adjustment">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Ajuste de Ponto
                        </div>
                      </SelectItem>
                      <SelectItem value="medical_consultation">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4" />
                          Atestado Médico - Consultas/Exames
                        </div>
                      </SelectItem>
                      <SelectItem value="medical_leave">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4" />
                          Atestado Médico - Afastamento Dia
                        </div>
                      </SelectItem>
                      <SelectItem value="justified_absence">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Ausência Justificada
                        </div>
                      </SelectItem>
                      <SelectItem value="day_off">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          Folga
                        </div>
                      </SelectItem>
                      <SelectItem value="bereavement_leave">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          Licença Falecimento de Familiar
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Adjustment fields */}
                {requestType === 'adjustment' && (
                  <>
                    <div className="space-y-2">
                      <Label>Tipo de Registro</Label>
                      <Select
                        value={recordType}
                        onValueChange={(value) => setRecordType(value as RecordType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entry">Entrada</SelectItem>
                          <SelectItem value="lunch_out">Saída Almoço</SelectItem>
                          <SelectItem value="lunch_in">Volta Almoço</SelectItem>
                          <SelectItem value="exit">Saída</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Data e Hora Correta</Label>
                      <Input
                        type="datetime-local"
                        value={requestedTime}
                        onChange={(e) => setRequestedTime(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Motivo</Label>
                      <Textarea
                        placeholder="Descreva o motivo da solicitação..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {/* Medical consultation and justified absence fields */}
                {(requestType === 'medical_consultation' || requestType === 'justified_absence') && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Horário de Início</Label>
                        <Input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Horário de Término</Label>
                        <Input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {requestType === 'justified_absence' ? 'Motivo da Ausência' : 'Descrição'}
                      </Label>
                      <Textarea
                        placeholder={requestType === 'justified_absence' 
                          ? "Descreva o motivo da ausência..."
                          : "Descreva os detalhes da consulta..."}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {/* Medical leave, day off, bereavement leave fields */}
                {(requestType === 'medical_leave' || requestType === 'day_off' || requestType === 'bereavement_leave') && (
                  <>
                    <div className="space-y-2">
                      <Label>{requestType === 'day_off' ? 'Dia(s) de Folga' : requestType === 'bereavement_leave' ? 'Período da Licença' : 'Dias de Afastamento'}</Label>
                      <div className="border rounded-lg p-3">
                        <Calendar
                          mode="multiple"
                          selected={absenceDates}
                          onSelect={(dates) => setAbsenceDates(dates || [])}
                          locale={ptBR}
                        />
                      </div>
                      {absenceDates.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {absenceDates.length} dia(s) selecionado(s)
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{requestType === 'day_off' ? 'Motivo da Folga' : requestType === 'bereavement_leave' ? 'Grau de Parentesco / Observações' : 'Motivo do Afastamento'}</Label>
                      <Textarea
                        placeholder={requestType === 'day_off' ? "Descreva o motivo da folga..." : requestType === 'bereavement_leave' ? "Informe o grau de parentesco e observações..." : "Descreva o motivo do afastamento..."}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {/* Attachment field */}
                {(
                  <div className="space-y-2">
                    <Label>Anexar Documento (opcional)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                        className="flex-1"
                      />
                      {attachmentFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAttachmentFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {attachmentFile && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {attachmentFile.name}
                      </p>
                    )}
                  </div>
                )}

                <Button onClick={handleCreateRequest} className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Solicitação'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isAdmin && (
        <>
          <div>
            <Dialog open={showAdminRecordDialog} onOpenChange={(open) => { setShowAdminRecordDialog(open); if (!open) resetAdminForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <ClipboardPlus className="h-4 w-4" />
                  Incluir Registro
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Incluir Registro</DialogTitle>
                  <DialogDescription>
                    Inclua registro de ausências não justificadas, licenças e afastamentos.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Colaborador</Label>
                    <Select value={adminSelectedEmployee} onValueChange={setAdminSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        {adminEmployees.map((emp) => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Registro</Label>
                    <Select value={adminRecordType} onValueChange={(v) => setAdminRecordType(v as AdminRecordType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(adminRecordTypeLabels) as [AdminRecordType, { label: string; icon: typeof Clock }][]).map(([key, { label, icon: Icon }]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {adminRecordType === 'unjustified_absence' ? 'Dia(s) de Falta' : 'Período'}
                    </Label>
                    <div className="border rounded-lg p-3">
                      <Calendar
                        mode="multiple"
                        selected={adminRecordDates}
                        onSelect={(dates) => setAdminRecordDates(dates || [])}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </div>
                    {adminRecordDates.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {adminRecordDates.length} dia(s) selecionado(s)
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      placeholder="Adicione observações sobre o registro..."
                      value={adminRecordReason}
                      onChange={(e) => setAdminRecordReason(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button onClick={handleCreateAdminRecord} className="w-full" disabled={adminRecordSubmitting}>
                    {adminRecordSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Incluir Registro'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <p className="text-xs text-muted-foreground mt-1">
              Inclua registro de ausências não justificadas, licenças e afastamentos.
            </p>
          </div>

          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filtros</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome do colaborador..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de registro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {allTypeOptions.map(({ key, label }) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {(isAdmin ? filteredRequests : requests).length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-1">
              Nenhuma solicitação encontrada
            </p>
            <p className="text-muted-foreground text-sm">
              {isAdmin 
                ? 'Não há solicitações pendentes no momento.'
                : 'Você ainda não fez nenhuma solicitação.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(isAdmin ? filteredRequests : requests).map((request) => {
            const StatusIcon = statusConfig[request.status].icon;
            const typeInfo = getRequestTypeInfo(request.request_type);
            const TypeIcon = typeInfo.icon;
            const isResolved = request.status === 'approved' || request.status === 'rejected';
            const isExpanded = expandedCards.has(request.id);

            const summaryRow = (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
                    <TypeIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {typeInfo.label}
                    </h3>
                    {isAdmin && request.userName && (
                      <p className="text-sm text-muted-foreground truncate">
                        {request.userName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge 
                    variant={statusConfig[request.status].variant}
                    className="gap-1.5"
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig[request.status].label}
                  </Badge>
                  {isResolved && (
                    isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            );

            const detailContent = (
              <div className="space-y-2 pt-3 border-t mt-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {request.request_type === 'adjustment' && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Tipo de Registro</p>
                        <p className="font-medium">{recordTypeLabels[request.record_type]}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Horário Solicitado</p>
                        <p className="font-medium">
                          {format(new Date(request.requested_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </>
                  )}
                  
                  {(request.request_type === 'medical_consultation' || request.request_type === 'justified_absence') && request.start_time && request.end_time && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Horário de Afastamento</p>
                      <p className="font-medium">
                        {request.start_time} às {request.end_time}
                      </p>
                    </div>
                  )}

                  {request.request_type === 'medical_leave' && request.absence_dates && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Dias de Afastamento</p>
                      <p className="font-medium">
                        {request.absence_dates.length} dia(s)
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-sm">
                  <p className="text-muted-foreground">Motivo</p>
                  <p className="text-foreground">{request.reason}</p>
                </div>

                {request.attachment_url && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Documento Anexado</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 mt-1"
                      onClick={async () => {
                        const { data } = await supabase.storage
                          .from('request-attachments')
                          .createSignedUrl(request.attachment_url!, 3600);
                        if (data?.signedUrl) {
                          window.open(data.signedUrl, '_blank');
                        }
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Visualizar / Baixar
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Solicitado em {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
            );

            if (isResolved) {
              return (
                <Card key={request.id} className="border-0 shadow-md">
                  <CardContent className="p-6">
                    <div
                      className="cursor-pointer"
                      onClick={() => toggleCard(request.id)}
                    >
                      {summaryRow}
                    </div>
                    {isExpanded && detailContent}
                  </CardContent>
                </Card>
              );
            }
            
            return (
              <Card key={request.id} className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                          <TypeIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {typeInfo.label}
                          </h3>
                          {isAdmin && request.userName && (
                            <p className="text-sm text-muted-foreground">
                              {request.userName}
                            </p>
                          )}
                        </div>
                      </div>
                      {detailContent}
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <Badge 
                        variant={statusConfig[request.status].variant}
                        className="gap-1.5"
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[request.status].label}
                      </Badge>

                      {isAdmin && request.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => handleUpdateStatus(request.id, 'rejected')}
                          >
                            <XCircle className="h-4 w-4" />
                            Reprovar
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleUpdateStatus(request.id, 'approved')}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Aprovar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Requests;
