import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from '@/hooks/use-toast';
import { exportReportToPDF, exportReportToExcel } from '@/utils/reportExport';
import { isAfter, parseISO } from 'date-fns';

const BRAND_COLORS = ['#023047', '#219EBC', '#8ECAE6', '#FFB703', '#FB8500'];

const ScheduleReportsTab = () => {
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    setLoading(true);
    const [schRes, empRes, adjRes] = await Promise.all([
      supabase.from('work_schedules').select('*').eq('organization_id', organizationId!),
      supabase.from('profiles').select('user_id, full_name, work_schedule_id, sector').eq('organization_id', organizationId!),
      supabase.from('schedule_adjustments').select('*').eq('organization_id', organizationId!),
    ]);
    setSchedules(schRes.data || []);
    setEmployees(empRes.data || []);
    setAdjustments(adjRes.data || []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const today = new Date();
  const activeAdj = adjustments.filter(a => isAfter(parseISO(a.end_date), today));
  const overtimeAuth = adjustments.filter(a => a.adjustment_type === 'overtime_authorization');
  const tempChanges = adjustments.filter(a => a.adjustment_type === 'temporary_change');
  const noSchedule = employees.filter(e => !e.work_schedule_id).length;

  const typeMap: Record<string, number> = {};
  schedules.forEach(s => {
    const type = s.schedule_type === 'weekly' ? 'Semanal' : s.schedule_type === 'shift' ? 'Escala' : s.schedule_type;
    typeMap[type] = (typeMap[type] || 0) + 1;
  });
  const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  const scheduleDistribution = schedules.map(s => ({
    name: s.name,
    value: employees.filter(e => e.work_schedule_id === s.id).length,
  })).sort((a, b) => b.value - a.value);

  const renderCustomLabel = ({ percent }: any) => `${(percent * 100).toFixed(0)}%`;

  const handleExportPDF = () => {
    exportReportToPDF({
      title: 'Relatório de Gestão de Jornada',
      stats: [
        { label: 'Jornadas Cadastradas', value: schedules.length },
        { label: 'Ajustes Ativos', value: activeAdj.length },
        { label: 'Autorizações HE', value: overtimeAuth.length },
        { label: 'Sem Jornada', value: noSchedule },
      ],
      tableHeaders: ['Jornada', 'Tipo', 'Entrada', 'Saída', 'Colaboradores'],
      tableData: schedules.map(s => [
        s.name,
        s.schedule_type === 'weekly' ? 'Semanal' : 'Escala',
        s.start_time,
        s.end_time,
        String(employees.filter(e => e.work_schedule_id === s.id).length),
      ]),
    });
    toast({ title: 'PDF gerado com sucesso' });
  };

  const handleExportExcel = async () => {
    await exportReportToExcel({
      sheetName: 'Jornada',
      headers: ['Jornada', 'Tipo', 'Entrada', 'Saída', 'Intervalo Início', 'Intervalo Fim', 'Colaboradores'],
      rows: schedules.map(s => [
        s.name,
        s.schedule_type === 'weekly' ? 'Semanal' : 'Escala',
        s.start_time,
        s.end_time,
        s.break_start_time || '-',
        s.break_end_time || '-',
        String(employees.filter(e => e.work_schedule_id === s.id).length),
      ]),
      fileName: 'relatorio_jornada',
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
        <Card><CardContent className="pt-6 text-center"><Clock className="h-8 w-8 mx-auto mb-2" style={{ color: '#023047' }} /><p className="text-2xl font-bold">{schedules.length}</p><p className="text-sm text-muted-foreground">Jornadas</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Calendar className="h-8 w-8 mx-auto mb-2" style={{ color: '#219EBC' }} /><p className="text-2xl font-bold">{activeAdj.length}</p><p className="text-sm text-muted-foreground">Ajustes Ativos</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Clock className="h-8 w-8 mx-auto mb-2" style={{ color: '#FFB703' }} /><p className="text-2xl font-bold">{overtimeAuth.length}</p><p className="text-sm text-muted-foreground">Autorizações HE</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><AlertTriangle className="h-8 w-8 mx-auto mb-2" style={{ color: '#FB8500' }} /><p className="text-2xl font-bold">{noSchedule}</p><p className="text-sm text-muted-foreground">Sem Jornada</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Tipos de Jornada</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={true}>
                  {typeData.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Colaboradores por Jornada</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={scheduleDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#219EBC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ScheduleReportsTab;
