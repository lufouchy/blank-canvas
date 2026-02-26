import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2, TrendingUp, Wallet, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from '@/hooks/use-toast';
import { exportReportToPDF, exportReportToExcel } from '@/utils/reportExport';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BRAND_COLORS = ['#023047', '#219EBC', '#8ECAE6', '#FFB703', '#FB8500'];

const OvertimeReportsTab = () => {
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    setLoading(true);
    const [decRes, balRes, empRes] = await Promise.all([
      supabase.from('monthly_overtime_decisions').select('*').eq('organization_id', organizationId!),
      supabase.from('hours_balance').select('*').eq('organization_id', organizationId!),
      supabase.from('profiles').select('user_id, full_name, sector').eq('organization_id', organizationId!),
    ]);
    setDecisions(decRes.data || []);
    setBalances(balRes.data || []);
    setEmployees(empRes.data || []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const totalOvertimeMin = decisions.reduce((s, d) => s + (d.overtime_minutes || 0), 0);
  const totalBankMin = decisions.reduce((s, d) => s + (d.bank_minutes || 0), 0);
  const totalPaymentMin = decisions.reduce((s, d) => s + (d.payment_minutes || 0), 0);
  const totalBalanceMin = balances.reduce((s, b) => s + (b.balance_minutes || 0), 0);

  const fmtHours = (min: number) => `${Math.floor(Math.abs(min) / 60)}h${String(Math.abs(min) % 60).padStart(2, '0')}`;

  const destMap: Record<string, number> = {};
  decisions.forEach(d => { destMap[d.destination] = (destMap[d.destination] || 0) + 1; });
  const destData = Object.entries(destMap).map(([name, value]) => ({
    name: name === 'bank' ? 'Banco de Horas' : name === 'payment' ? 'Pagamento' : name,
    value,
  }));

  const monthlyMap: Record<string, number> = {};
  decisions.forEach(d => {
    if (d.reference_month) {
      try {
        const key = format(parseISO(d.reference_month), 'MMM/yy', { locale: ptBR });
        monthlyMap[key] = (monthlyMap[key] || 0) + (d.overtime_minutes || 0);
      } catch {}
    }
  });
  const monthlyData = Object.entries(monthlyMap).slice(-6).map(([name, value]) => ({ name, hours: +(value / 60).toFixed(1) }));

  const empOvertimeMap: Record<string, number> = {};
  decisions.forEach(d => { empOvertimeMap[d.user_id] = (empOvertimeMap[d.user_id] || 0) + (d.overtime_minutes || 0); });
  const topEmployees = Object.entries(empOvertimeMap)
    .map(([userId, min]) => ({ name: employees.find(e => e.user_id === userId)?.full_name || 'Desconhecido', hours: +(min / 60).toFixed(1) }))
    .sort((a, b) => b.hours - a.hours).slice(0, 10);

  const renderCustomLabel = ({ percent }: any) => `${(percent * 100).toFixed(0)}%`;

  const handleExportPDF = () => {
    exportReportToPDF({
      title: 'Relatório de Horas Extras e Banco de Horas',
      stats: [
        { label: 'Total HE', value: fmtHours(totalOvertimeMin) },
        { label: 'Banco', value: fmtHours(totalBankMin) },
        { label: 'Pagamento', value: fmtHours(totalPaymentMin) },
        { label: 'Saldo Atual', value: fmtHours(totalBalanceMin) },
      ],
      tableHeaders: ['Colaborador', 'H. Extra', 'Banco', 'Pagamento', 'Destino', 'Mês Ref.'],
      tableData: decisions.map(d => {
        const emp = employees.find(e => e.user_id === d.user_id);
        return [
          emp?.full_name || '-',
          fmtHours(d.overtime_minutes || 0),
          fmtHours(d.bank_minutes || 0),
          fmtHours(d.payment_minutes || 0),
          d.destination === 'bank' ? 'Banco' : 'Pagamento',
          d.reference_month ? format(parseISO(d.reference_month), 'MM/yyyy') : '-',
        ];
      }),
    });
    toast({ title: 'PDF gerado com sucesso' });
  };

  const handleExportExcel = async () => {
    await exportReportToExcel({
      sheetName: 'Horas Extras',
      headers: ['Colaborador', 'Setor', 'H. Extra (min)', 'Banco (min)', 'Pagamento (min)', 'Destino', 'Mês Ref.', 'Finalizado'],
      rows: decisions.map(d => {
        const emp = employees.find(e => e.user_id === d.user_id);
        return [
          emp?.full_name || '-',
          emp?.sector || '-',
          String(d.overtime_minutes || 0),
          String(d.bank_minutes || 0),
          String(d.payment_minutes || 0),
          d.destination === 'bank' ? 'Banco' : 'Pagamento',
          d.reference_month ? format(parseISO(d.reference_month), 'MM/yyyy') : '-',
          d.finalized ? 'Sim' : 'Não',
        ];
      }),
      fileName: 'relatorio_horas_extras',
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
        <Card><CardContent className="pt-6 text-center"><TrendingUp className="h-8 w-8 mx-auto mb-2" style={{ color: '#023047' }} /><p className="text-2xl font-bold">{fmtHours(totalOvertimeMin)}</p><p className="text-sm text-muted-foreground">Total HE</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Clock className="h-8 w-8 mx-auto mb-2" style={{ color: '#219EBC' }} /><p className="text-2xl font-bold">{fmtHours(totalBankMin)}</p><p className="text-sm text-muted-foreground">Banco de Horas</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Wallet className="h-8 w-8 mx-auto mb-2" style={{ color: '#FFB703' }} /><p className="text-2xl font-bold">{fmtHours(totalPaymentMin)}</p><p className="text-sm text-muted-foreground">Pagamento</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Clock className="h-8 w-8 mx-auto mb-2" style={{ color: '#FB8500' }} /><p className="text-2xl font-bold">{fmtHours(totalBalanceMin)}</p><p className="text-sm text-muted-foreground">Saldo Total</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Destino das Horas Extras</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={destData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={renderCustomLabel} labelLine={true}>
                  {destData.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Evolução Mensal de HE (horas)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="#219EBC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {topEmployees.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Top 10 Colaboradores em Horas Extras</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topEmployees} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v}h`} />
                  <Bar dataKey="hours" fill="#023047" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OvertimeReportsTab;
