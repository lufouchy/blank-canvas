import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AdminRoute from "@/components/auth/AdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import RequestsPage from "./pages/RequestsPage";
import TimesheetPage from "./pages/TimesheetPage";
import DocumentManagement from "./pages/DocumentManagement";
import VacationManagement from "./pages/VacationManagement";
import EmployeeProfile from "./pages/EmployeeProfile";
import EmployeeManagement from "./pages/EmployeeManagement";
import AdminSettings from "./pages/AdminSettings";
import ManagementReports from "./pages/ManagementReports";
import WorkSchedulesPage from "./pages/WorkSchedulesPage";
import InstitutionalInfo from "./pages/InstitutionalInfo";
import EmployeeVacation from "./pages/EmployeeVacation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/timesheet" element={<TimesheetPage />} />
            <Route path="/my-vacations" element={<EmployeeVacation />} />
            <Route path="/documents" element={<AdminRoute><DocumentManagement /></AdminRoute>} />
            <Route path="/vacations" element={<AdminRoute><VacationManagement /></AdminRoute>} />
            
            <Route path="/profile" element={<EmployeeProfile />} />
            <Route path="/employees" element={<AdminRoute><EmployeeManagement /></AdminRoute>} />
            <Route path="/schedules" element={<AdminRoute><WorkSchedulesPage /></AdminRoute>} />
            <Route path="/reports" element={<AdminRoute><ManagementReports /></AdminRoute>} />
            <Route path="/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
            <Route path="/institutional" element={<AdminRoute><InstitutionalInfo /></AdminRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
