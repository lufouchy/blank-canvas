import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { Loader2, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VacationReportsTab from '@/components/reports/VacationReportsTab';
import EmployeeReportsTab from '@/components/reports/EmployeeReportsTab';
import OvertimeReportsTab from '@/components/reports/OvertimeReportsTab';
import ScheduleReportsTab from '@/components/reports/ScheduleReportsTab';

const ManagementReports = () => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  if (!user || (userRole !== 'admin' && userRole !== 'suporte')) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Relatórios Gerenciais
          </h1>
          <p className="text-muted-foreground">
            Visualize dados consolidados e exporte relatórios para gestão do time
          </p>
        </div>

        <Tabs defaultValue="employees" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="employees">Colaboradores</TabsTrigger>
            <TabsTrigger value="vacations">Férias</TabsTrigger>
            <TabsTrigger value="overtime">Horas Extras</TabsTrigger>
            <TabsTrigger value="schedules">Jornada</TabsTrigger>
          </TabsList>

          <TabsContent value="employees">
            <EmployeeReportsTab />
          </TabsContent>
          <TabsContent value="vacations">
            <VacationReportsTab />
          </TabsContent>
          <TabsContent value="overtime">
            <OvertimeReportsTab />
          </TabsContent>
          <TabsContent value="schedules">
            <ScheduleReportsTab />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
};

export default ManagementReports;
