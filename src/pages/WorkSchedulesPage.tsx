import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLayout from '@/components/layout/SidebarLayout';
import WorkScheduleManagement from '@/components/admin/WorkScheduleManagement';
import ScheduleAdjustmentsPanel from '@/components/admin/ScheduleAdjustmentsPanel';
import { Loader2, Clock, CalendarClock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const WorkSchedulesPage = () => {
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
      <div className="max-w-5xl mx-auto p-6 animate-fade-in space-y-6">
        <Tabs defaultValue="schedules" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedules" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Jornadas de Trabalho
            </TabsTrigger>
            <TabsTrigger value="adjustments" className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Ajustes e Horas Extras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedules">
            <WorkScheduleManagement />
          </TabsContent>

          <TabsContent value="adjustments">
            <ScheduleAdjustmentsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
};

export default WorkSchedulesPage;
