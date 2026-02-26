import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Palmtree, Clock, CheckCircle, XCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from '@/hooks/use-toast';
import { exportReportToPDF, exportReportToExcel } from '@/utils/reportExport';
import { format, parseISO, differenceInMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BRAND_COLORS = ['#023047', '#219EBC', '#8ECAE6', '#FFB703', '#FB8500'];

const VacationReportsTab = () => {
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vacations, setVacations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    setLoading(true);
    const [vacRes, empRes] = await Promise.all([
      supabase.from('vacation_requests').select('*').eq('organization_id', organizationId!),
      supabase.from('profiles').select('user_id, full_name, hire_date, sector, status').eq('organization_id', organizationId!),
    ]);
    setVacations(vacRes.data || []);
    setEmployees(empRes.data || []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const pending = vacations.filter(v => v.status === 'pending').length;
  const approved = vacations.filter(v => v.status === 'approved').length;
  const rejected = vacations.filter(v => v.status === 'rejected').length;
  const totalDays = vacations.filter(v => v.status === 'approved').reduce((sum, v) => sum + (v.days_count || 0), 0);

  const statusData = [
    { name: 'Pendentes', value: pending },
    { name: 'Aprovadas', value: approved },
    { name: 'Rejeitadas', value: rejected },
  ].filter(d => d.value > 0);

  // Monthly distribution
  const currentYear = new Date().getFullYear();
  const monthlyMap: Record<string, number> = {};
  vacations.filter(v => v.status === 'approved').forEach(v => {
    try {
      const d = parseISO(v.start_date);
      if (d.getFullYear() === currentYear) {
        const key = format(d, 'MMM', { locale: ptBR });
        monthlyMap[key] = (monthlyMap[key] || 0) + 1;
      }
    } catch {}
  });
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const monthlyData = months.map(m => ({ name: m, value: monthlyMap[m] || 0 }));

  // Overdue vacations
  const overdueEmployees = employees.filter(emp => {
    if (!emp.hire_date) return false;
    const m = differenceInMonths(new Date(), parseISO(emp.hire_date));
    if (m < 12) return false;
    const hasRecent = vacations.some(v => v.user_id === emp.user_id && v.status === 'approved' && differenceInMonths(new Date(), parseISO(v.end_date)) < 12);
    return !hasRecent;
  });

  // Currently on vacation vs working
  const today = new Date();
  const activeEmployees = employees.filter(e => e.status === 'ativo');
  const onVacationNow = activeEmployees.filter(emp => {
    return vacations.some(v => {
      if (v.user_id !== emp.user_id || v.status !== 'approved') return false;
      try {
        return isWithinInterval(today, { start: parseISO(v.start_date), end: parseISO(v.end_date) });
      } catch { return false; }
    });
  }).length;
  const workingNow = activeEmployees.length - onVacationNow;

  const vacationStatusData = [
    { name: 'Trabalhando', value: workingNow },
    { name: 'Em Férias', value: onVacationNow },
  ].filter(d => d.value > 0);

  const renderCustomLabel = ({ percent }: any) => `${(percent * 100).toFixed(0)}%`;

  const handleExportPDF = () => {
    exportReportToPDF({
      title: 'Relatório de Férias',
      stats: [
        { label: 'Total Solicitações', value: vacations.length },
        { label: 'Aprovadas', value: approved },
        { label: 'Pendentes', value: pending },
        { label: 'Dias Concedidos', value: totalDays },
      ],
      tableHeaders: ['Colaborador', 'Início', 'Fim', 'Dias', 'Tipo', 'Status'],
      tableData: vacations.map(v => {
        const emp = employees.find(e => e.user_id === v.user_id);
        return [
          emp?.full_name || '-',
          v.start_date ? format(parseISO(v.start_date), 'dd/MM/yyyy') : '-',
          v.end_date ? format(parseISO(v.end_date), 'dd/MM/yyyy') : '-',
          String(v.days_count),
          v.vacation_type === 'collective' ? 'Coletiva' : 'Individual',
          v.status === 'approved' ? 'Aprovada' : v.status === 'pending' ? 'Pendente' : 'Rejeitada',
        ];
      }),
    });
    toast({ title: 'PDF gerado com sucesso' });
  };

  const handleExportExcel = async () => {
    await exportReportToExcel({
      sheetName: 'Férias',
      headers: ['Colaborador', 'Início', 'Fim', 'Dias', 'Abono', 'Tipo', 'Status'],
      rows: vacations.map(v => {
        const emp = employees.find(e => e.user_id === v.user_id);
        return [
          emp?.full_name || '-',
          v.start_date ? format(parseISO(v.start_date), 'dd/MM/yyyy') : '-',
          v.end_date ? format(parseISO(v.end_date), 'dd/MM/yyyy') : '-',
          String(v.days_count),
          String(v.sell_days || 0),
          v.vacation_type === 'collective' ? 'Coletiva' : 'Individual',
          v.status === 'approved' ? 'Aprovada' : v.status === 'pending' ? 'Pendente' : 'Rejeitada',
        ];
      }),
      fileName: 'relatorio_ferias',
    });
    toast({ title: 'Excel gerado com sucesso' });
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleExportPDF}><Download className="h-4 w-4 mr-2" />PDF</Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="h-4 w-4 mr-2" />Excel</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><Palmtree className="h-8 w-8 mx-auto mb-2" style={{ color: '#023047' }} /><p className="text-2xl font-bold">{vacations.length}</p><p className="text-sm text-muted-foreground">Total</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><CheckCircle className="h-8 w-8 mx-auto mb-2" style={{ color: '#219EBC' }} /><p className="text-2xl font-bold">{approved}</p><p className="text-sm text-muted-foreground">Aprovadas</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Clock className="h-8 w-8 mx-auto mb-2" style={{ color: '#FFB703' }} /><p className="text-2xl font-bold">{pending}</p><p className="text-sm text-muted-foreground">Pendentes</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><XCircle className="h-8 w-8 mx-auto mb-2" style={{ color: '#FB8500' }} /><p className="text-2xl font-bold">{overdueEmployees.length}</p><p className="text-sm text-muted-foreground">Férias Vencidas</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Status das Solicitações</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={true}>
                  {statusData.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Colaboradores em Férias vs Trabalhando</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={vacationStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={true}>
                  <Cell fill="#219EBC" />
                  <Cell fill="#FFB703" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Férias Aprovadas por Mês ({currentYear})</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#023047" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {overdueEmployees.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader><CardTitle className="text-base text-destructive">⚠️ Colaboradores com Férias Vencidas</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueEmployees.map(emp => (
                <div key={emp.user_id} className="flex justify-between items-center p-2 rounded bg-destructive/5">
                  <span className="font-medium text-sm">{emp.full_name}</span>
                  <span className="text-xs text-muted-foreground">{emp.sector || 'Sem setor'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VacationReportsTab;
