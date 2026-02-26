import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Users, UserCheck, UserX, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from '@/hooks/use-toast';
import { exportReportToPDF, exportReportToExcel } from '@/utils/reportExport';
import { differenceInYears, differenceInMonths, parseISO } from 'date-fns';

const BRAND_COLORS = ['#023047', '#219EBC', '#8ECAE6', '#FFB703', '#FB8500'];

const EmployeeReportsTab = () => {
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    setLoading(true);
    const [empRes, schedRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('organization_id', organizationId!),
      supabase.from('work_schedules').select('id, name').eq('organization_id', organizationId!),
    ]);
    setEmployees(empRes.data || []);
    setSchedules(schedRes.data || []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const total = employees.length;
  const active = employees.filter(e => e.status === 'ativo').length;
  const away = employees.filter(e => e.status === 'afastado').length;
  const inactive = employees.filter(e => e.status === 'inativo').length;

  const statusData = [
    { name: 'Ativos', value: active },
    { name: 'Afastados', value: away },
    { name: 'Inativos', value: inactive },
  ].filter(d => d.value > 0);

  // By sector
  const sectorMap: Record<string, number> = {};
  employees.forEach(e => { const s = e.sector || 'Sem setor'; sectorMap[s] = (sectorMap[s] || 0) + 1; });
  const sectorData = Object.entries(sectorMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // By schedule
  const scheduleMap: Record<string, number> = {};
  employees.forEach(e => {
    const sch = schedules.find(s => s.id === e.work_schedule_id);
    const name = sch?.name || 'Sem jornada';
    scheduleMap[name] = (scheduleMap[name] || 0) + 1;
  });
  const scheduleData = Object.entries(scheduleMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Age distribution
  const ageBuckets: Record<string, number> = { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0 };
  employees.forEach(e => {
    if (!e.birth_date) return;
    const age = differenceInYears(new Date(), parseISO(e.birth_date));
    if (age <= 25) ageBuckets['18-25']++;
    else if (age <= 35) ageBuckets['26-35']++;
    else if (age <= 45) ageBuckets['36-45']++;
    else if (age <= 55) ageBuckets['46-55']++;
    else ageBuckets['56+']++;
  });
  const ageData = Object.entries(ageBuckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  // Tenure distribution
  const tenureBuckets: Record<string, number> = { '< 1 ano': 0, '1-3 anos': 0, '3-5 anos': 0, '5-10 anos': 0, '10+ anos': 0 };
  employees.forEach(e => {
    if (!e.hire_date) return;
    const months = differenceInMonths(new Date(), parseISO(e.hire_date));
    if (months < 12) tenureBuckets['< 1 ano']++;
    else if (months < 36) tenureBuckets['1-3 anos']++;
    else if (months < 60) tenureBuckets['3-5 anos']++;
    else if (months < 120) tenureBuckets['5-10 anos']++;
    else tenureBuckets['10+ anos']++;
  });
  const tenureData = Object.entries(tenureBuckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  // Gender — inferred from specification or a simple heuristic (not available in schema, so we show if data exists)
  // Since there's no gender field, we skip this or show placeholder
  // For now, we'll omit gender chart since no field exists in profiles

  const renderCustomLabel = ({ name, percent }: any) => {
    return `${(percent * 100).toFixed(0)}%`;
  };

  const handleExportPDF = () => {
    exportReportToPDF({
      title: 'Relatório de Colaboradores',
      stats: [
        { label: 'Total', value: total },
        { label: 'Ativos', value: active },
        { label: 'Afastados', value: away },
        { label: 'Inativos', value: inactive },
      ],
      tableHeaders: ['Nome', 'E-mail', 'CPF', 'Setor', 'Cargo', 'Status'],
      tableData: employees.map(e => [
        e.full_name, e.email, e.cpf || '-', e.sector || '-', e.position || '-',
        (e.status || 'ativo').charAt(0).toUpperCase() + (e.status || 'ativo').slice(1),
      ]),
    });
    toast({ title: 'PDF gerado com sucesso' });
  };

  const handleExportExcel = async () => {
    await exportReportToExcel({
      sheetName: 'Colaboradores',
      headers: ['Nome', 'E-mail', 'CPF', 'Setor', 'Cargo', 'Status', 'Admissão'],
      rows: employees.map(e => [
        e.full_name, e.email, e.cpf || '-', e.sector || '-', e.position || '-',
        (e.status || 'ativo').charAt(0).toUpperCase() + (e.status || 'ativo').slice(1),
        e.hire_date || '-',
      ]),
      fileName: 'relatorio_colaboradores',
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
        <Card><CardContent className="pt-6 text-center"><Users className="h-8 w-8 mx-auto mb-2" style={{ color: '#023047' }} /><p className="text-2xl font-bold">{total}</p><p className="text-sm text-muted-foreground">Total</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><UserCheck className="h-8 w-8 mx-auto mb-2" style={{ color: '#219EBC' }} /><p className="text-2xl font-bold">{active}</p><p className="text-sm text-muted-foreground">Ativos</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><UserX className="h-8 w-8 mx-auto mb-2" style={{ color: '#FFB703' }} /><p className="text-2xl font-bold">{away}</p><p className="text-sm text-muted-foreground">Afastados</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><UserX className="h-8 w-8 mx-auto mb-2" style={{ color: '#FB8500' }} /><p className="text-2xl font-bold">{inactive}</p><p className="text-sm text-muted-foreground">Inativos</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Status</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">Colaboradores por Setor</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sectorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#219EBC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Colaboradores por Jornada</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={scheduleData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8ECAE6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Demographics */}
        {ageData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Faixa Etária</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#FFB703" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {tenureData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Tempo de Empresa</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={tenureData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#FB8500" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EmployeeReportsTab;
