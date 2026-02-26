import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLayout from '@/components/layout/SidebarLayout';

import PayrollSettings from '@/components/admin/PayrollSettings';
import MonthlyClosingPanel from '@/components/admin/MonthlyClosingPanel';
import HolidaysCalendar from '@/components/admin/HolidaysCalendar';
import ScheduleFlexibilitySettings from '@/components/admin/ScheduleFlexibilitySettings';
import { Settings, Loader2, Calendar, FileText, CalendarDays, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminSettings = () => {
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
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configurações
          </h1>
          <p className="text-muted-foreground">
            Gerencie as configurações do sistema de ponto
          </p>
        </div>

        <Tabs defaultValue="overtime" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overtime" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Horas Extras</span>
              <span className="sm:hidden">H. Extras</span>
            </TabsTrigger>
            <TabsTrigger value="journey" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Jornada</span>
              <span className="sm:hidden">Jornada</span>
            </TabsTrigger>
            <TabsTrigger value="holidays" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Feriados</span>
              <span className="sm:hidden">Feriados</span>
            </TabsTrigger>
            <TabsTrigger value="closing" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Fechamento</span>
              <span className="sm:hidden">Fecham.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overtime" className="space-y-4">
            <PayrollSettings />
          </TabsContent>

          <TabsContent value="journey" className="space-y-4">
            <ScheduleFlexibilitySettings />
          </TabsContent>

          <TabsContent value="holidays" className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium">
              <CalendarDays className="h-5 w-5 text-primary" />
              Calendário de Feriados
            </div>
            <HolidaysCalendar />
          </TabsContent>

          <TabsContent value="closing" className="space-y-4">
            <MonthlyClosingPanel />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
};

export default AdminSettings;
