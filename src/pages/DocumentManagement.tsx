import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  FileText,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle,
  Eye,
  Download,
  Calendar,
  Pen,
  ExternalLink,
  Trash2,
  Bell,
} from 'lucide-react';
import { format, differenceInDays, parseISO, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type DocumentStatus = 'pending_signature' | 'signed' | 'expired' | 'late';

interface Document {
  id: string;
  user_id: string;
  document_type: string;
  title: string;
  reference_month: string;
  file_url: string | null;
  signature_data: string | null;
  signed_at: string | null;
  status: DocumentStatus;
  expires_at: string | null;
  created_at: string;
  userName?: string;
  userEmail?: string;
}

const statusConfig: Record<DocumentStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending_signature: {
    label: 'Pendente de Assinatura',
    className: 'bg-warning/10 text-warning border-warning/20',
    icon: Clock,
  },
  signed: {
    label: 'Ativo',
    className: 'bg-success/10 text-success border-success/20',
    icon: CheckCircle,
  },
  expired: {
    label: 'Vencido',
    className: 'bg-muted text-muted-foreground border-muted',
    icon: AlertTriangle,
  },
  late: {
    label: 'Em Atraso',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: AlertTriangle,
  },
};

const DocumentManagement = () => {
  const { user, userRole, loading } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showExpiringAlert, setShowExpiringAlert] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const userIds = [...new Set(data.map((d) => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, { name: p.full_name, email: p.email }]) || []
      );

      // Calculate document status based on signature and time
      const now = new Date();
      const documentsWithStatus = data.map((d) => {
        let calculatedStatus: DocumentStatus = d.status as DocumentStatus;
        
        // Check if document is pending and past the 5-day grace period
        if (d.status === 'pending_signature') {
          const referenceMonth = parseISO(d.reference_month);
          const lastDayOfMonth = endOfMonth(referenceMonth);
          const gracePeriodEnd = new Date(lastDayOfMonth);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 5);
          
          if (now > gracePeriodEnd) {
            calculatedStatus = 'late';
          }
        }
        
        return {
          ...d,
          status: calculatedStatus,
          userName: profileMap.get(d.user_id)?.name || 'Usuário',
          userEmail: profileMap.get(d.user_id)?.email || '',
        };
      });

      setDocuments(documentsWithStatus);
    }
    setIsLoading(false);
  };

  const getExpirationInfo = (expiresAt: string | null, status: DocumentStatus) => {
    if (!expiresAt || status === 'expired') return null;
    const days = differenceInDays(parseISO(expiresAt), new Date());
    if (days < 0) return 'Vencido';
    if (days === 0) return 'Vence hoje';
    return `Vence em ${days} dias`;
  };

  const handleViewDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setShowViewDialog(true);
  };

  const handleDownload = async (doc: Document) => {
    if (doc.file_url) {
      try {
        // Extract the file path from the URL - handle both old public URLs and new signed URLs
        let filePath: string;
        const urlParts = doc.file_url.split('/timesheet-documents/');
        if (urlParts.length > 1) {
          // Remove any query params from path (for signed URLs)
          filePath = urlParts[1].split('?')[0];
        } else {
          throw new Error('URL inválida');
        }
        
        // Get a fresh signed URL (1 hour expiry)
        const { data, error } = await supabase.storage
          .from('timesheet-documents')
          .createSignedUrl(filePath, 3600);
        
        if (error) throw error;
        
        // Create a link and trigger download
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = `espelho-ponto-${format(parseISO(doc.reference_month), "yyyy-MM")}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: 'Download iniciado',
          description: 'O documento está sendo baixado.',
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Erro ao baixar',
          description: 'Não foi possível baixar o documento.',
        });
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Documento não disponível',
        description: 'O arquivo PDF não está disponível para download.',
      });
    }
  };

  const handleOpenInNewTab = async (doc: Document) => {
    if (doc.file_url) {
      try {
        // Extract the file path - handle both old public URLs and new signed URLs
        const urlParts = doc.file_url.split('/timesheet-documents/');
        if (urlParts.length > 1) {
          // Remove any query params from path (for signed URLs)
          const filePath = urlParts[1].split('?')[0];
          
          // Get a fresh signed URL (1 hour expiry)
          const { data, error } = await supabase.storage
            .from('timesheet-documents')
            .createSignedUrl(filePath, 3600);
          
          if (error) throw error;
          window.open(data.signedUrl, '_blank');
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro ao abrir documento',
            description: 'URL do documento inválida.',
          });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Erro ao abrir documento',
          description: 'Não foi possível gerar URL de acesso.',
        });
      }
    }
  };

  const handleDeleteClick = (doc: Document) => {
    setDocumentToDelete(doc);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;

    setIsDeleting(true);
    try {
      // Delete from storage if file exists
      if (documentToDelete.file_url) {
        const fileName = `${documentToDelete.user_id}/${format(parseISO(documentToDelete.reference_month), "yyyy-MM")}-espelho-ponto.pdf`;
        await supabase.storage.from('timesheet-documents').remove([fileName]);
      }

      // Delete from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentToDelete.id);

      if (error) throw error;

      toast({
        title: 'Documento excluído',
        description: 'O documento foi removido com sucesso.',
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDocumentToDelete(null);
    }
  };

  const handleDeleteAllExpired = async () => {
    const expiredDocs = documents.filter((d) => d.status === 'expired');
    if (expiredDocs.length === 0) return;

    setIsDeleting(true);
    try {
      // Delete files from storage
      const filesToDelete = expiredDocs
        .filter((d) => d.file_url)
        .map((d) => `${d.user_id}/${format(parseISO(d.reference_month), "yyyy-MM")}-espelho-ponto.pdf`);
      
      if (filesToDelete.length > 0) {
        await supabase.storage.from('timesheet-documents').remove(filesToDelete);
      }

      // Delete from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', expiredDocs.map((d) => d.id));

      if (error) throw error;

      toast({
        title: 'Documentos excluídos',
        description: `${expiredDocs.length} documento(s) expirado(s) foram removidos.`,
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const pendingCount = documents.filter((d) => d.status === 'pending_signature').length;
  const expiredCount = documents.filter((d) => d.status === 'expired').length;
  
  // Documents expiring within 30 days
  const expiringDocuments = documents.filter((d) => {
    if (!d.expires_at || d.status !== 'signed') return false;
    const days = differenceInDays(parseISO(d.expires_at), new Date());
    return days > 0 && days <= 30;
  });
  
  // Documents expiring within 60 days (for card)
  const expiringCount = documents.filter((d) => {
    if (!d.expires_at || d.status !== 'signed') return false;
    const days = differenceInDays(parseISO(d.expires_at), new Date());
    return days > 0 && days <= 60;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (userRole !== 'admin' && userRole !== 'suporte')) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-6">
        {/* Expiring Alert Banner */}
        {showExpiringAlert && expiringDocuments.length > 0 && (
          <Alert className="border-warning/50 bg-warning/10">
            <Bell className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">Documentos próximos ao vencimento</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                {expiringDocuments.length} documento(s) vencem nos próximos 30 dias. 
                Colaboradores afetados: {[...new Set(expiringDocuments.map((d) => d.userName))].join(', ')}.
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExpiringAlert(false)}
                className="text-warning hover:text-warning"
              >
                Dispensar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Expired Documents Alert */}
        {expiredCount > 0 && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Documentos expirados</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                Existem {expiredCount} documento(s) expirado(s) que podem ser removidos.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={handleDeleteAllExpired}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir todos expirados
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Espelhos Ponto</h1>
            <p className="text-muted-foreground">
              Gerencie os espelhos de ponto assinados dos colaboradores
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar documento
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-warning/10">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documentos a vencer</p>
                <p className="text-xs text-muted-foreground/70">Vencem nos próximos 60 dias</p>
                <p className="text-3xl font-bold text-foreground">{expiringCount}</p>
                <button 
                  className="text-sm text-primary hover:underline"
                  onClick={() => setStatusFilter('signed')}
                >
                  Ver detalhes
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-destructive/10">
                <FileText className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documentos vencidos</p>
                <p className="text-xs text-muted-foreground/70">Prazo de assinatura expirado</p>
                <p className="text-3xl font-bold text-foreground">{expiredCount}</p>
                <button 
                  className="text-sm text-primary hover:underline"
                  onClick={() => setStatusFilter('expired')}
                >
                  Ver detalhes
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aguardando assinatura</p>
                <p className="text-xs text-muted-foreground/70">Pendentes de assinatura do colaborador</p>
                <p className="text-3xl font-bold text-foreground">{pendingCount}</p>
                <button 
                  className="text-sm text-primary hover:underline"
                  onClick={() => setStatusFilter('pending_signature')}
                >
                  Ver detalhes
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Buscar documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por pessoa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending_signature">Aguardando assinatura</SelectItem>
                  <SelectItem value="signed">Ativo</SelectItem>
                  <SelectItem value="expired">Vencido</SelectItem>
                </SelectContent>
              </Select>
              {statusFilter !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
                  Limpar filtro
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-1">
                  Nenhum documento encontrado
                </p>
                <p className="text-muted-foreground text-sm">
                  Os espelhos de ponto assinados aparecerão aqui.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo do documento</TableHead>
                    <TableHead>Status do documento</TableHead>
                    <TableHead>Pessoa associada</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => {
                    const expirationInfo = getExpirationInfo(doc.expires_at, doc.status);
                    const daysToExpire = doc.expires_at 
                      ? differenceInDays(parseISO(doc.expires_at), new Date())
                      : null;
                    const isExpiringSoon = daysToExpire !== null && daysToExpire > 0 && daysToExpire <= 30;

                    return (
                      <TableRow key={doc.id} className={isExpiringSoon ? 'bg-warning/5' : ''}>
                        <TableCell>
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            Espelho de ponto
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={statusConfig[doc.status].className}>
                              {statusConfig[doc.status].label}
                            </Badge>
                            {expirationInfo && (
                              <p className={`text-xs flex items-center gap-1 ${isExpiringSoon ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                                <Clock className="h-3 w-3" />
                                {expirationInfo}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {doc.userName?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{doc.userName}</p>
                              <p className="text-xs text-muted-foreground">{doc.userEmail}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(doc.reference_month), "MMMM 'de' yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-1.5"
                              onClick={() => handleViewDocument(doc)}
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                            {doc.file_url && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDownload(doc)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteClick(doc)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* View Document Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Detalhes do Documento
              </DialogTitle>
              <DialogDescription>
                Visualize os detalhes e baixe o documento assinado.
              </DialogDescription>
            </DialogHeader>

            {selectedDocument && (
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {selectedDocument.userName?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedDocument.userName}</p>
                      <p className="text-sm text-muted-foreground">{selectedDocument.userEmail}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Período</p>
                        <p className="font-medium">
                          {format(parseISO(selectedDocument.reference_month), "MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge className={statusConfig[selectedDocument.status].className}>
                          {statusConfig[selectedDocument.status].label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {selectedDocument.signed_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <Pen className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Assinado em</p>
                        <p className="font-medium">
                          {format(parseISO(selectedDocument.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedDocument.expires_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Expira em</p>
                        <p className="font-medium">
                          {format(parseISO(selectedDocument.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedDocument.signature_data && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Assinatura Digital</p>
                    <div className="border border-border rounded-lg bg-background p-3">
                      <img 
                        src={selectedDocument.signature_data} 
                        alt="Assinatura digital" 
                        className="max-h-[100px] mx-auto"
                      />
                    </div>
                  </div>
                )}

                {selectedDocument.file_url ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-destructive/10">
                          <FileText className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">espelho-ponto-{format(parseISO(selectedDocument.reference_month), "yyyy-MM")}.pdf</p>
                          <p className="text-xs text-muted-foreground">Documento PDF assinado</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2"
                        onClick={() => handleOpenInNewTab(selectedDocument)}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Abrir em nova aba
                      </Button>
                      <Button 
                        className="flex-1 gap-2"
                        onClick={() => handleDownload(selectedDocument)}
                      >
                        <Download className="h-4 w-4" />
                        Baixar PDF
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Documento ainda não possui arquivo PDF anexado.
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O documento "{documentToDelete?.title}" será permanentemente removido do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarLayout>
  );
};

export default DocumentManagement;
