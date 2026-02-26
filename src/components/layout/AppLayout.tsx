import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Users, 
  FileText, 
  LogOut, 
  Menu,
  X,
  CalendarDays,
  FolderOpen,
  Palmtree,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { userRole, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = userRole === 'admin' || userRole === 'suporte';

  const navItems = isAdmin
    ? [
        { icon: Users, label: 'Gestão de Jornada', path: '/' },
        { icon: FileText, label: 'Solicitações', path: '/requests' },
        { icon: Palmtree, label: 'Férias', path: '/vacations' },
        { icon: FolderOpen, label: 'Espelhos Ponto', path: '/documents' },
      ]
    : [
        { icon: Clock, label: 'Registrar Ponto', path: '/' },
        { icon: CalendarDays, label: 'Espelho do Ponto', path: '/timesheet' },
        { icon: FileText, label: 'Minhas Solicitações', path: '/requests' },
      ];

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#023047] border-b border-[#034a6b]">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#219EBC]">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-white">Ponto Digital</h1>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "gap-2 text-white/70 hover:text-white hover:bg-white/10",
                  location.pathname === item.path && "bg-[#219EBC]/20 text-white"
                )}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white">{profile?.full_name}</p>
              <p className="text-xs text-white/60 capitalize">
                {userRole === 'admin' || userRole === 'suporte' ? 'Administrador' : 'Colaborador'}
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-5 w-5" />
            </Button>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-[#034a6b] bg-[#023047] p-4 space-y-2">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2 text-white/70 hover:text-white hover:bg-white/10",
                  location.pathname === item.path && "bg-[#219EBC]/20 text-white"
                )}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="container px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
