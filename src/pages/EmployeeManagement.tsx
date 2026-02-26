import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Search, Plus, Users, Pencil, Trash2, Filter, X, History, FileDown, FileSpreadsheet, FileText, KeyRound } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/utils/employeeExport';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusHistoryDialog } from '@/components/admin/StatusHistoryDialog';
import EmployeeTimesheetExport from '@/components/admin/EmployeeTimesheetExport';

// Status and Specification options
const STATUS_OPTIONS = ['ativo', 'suspenso', 'afastado', 'desligado'] as const;
type StatusType = typeof STATUS_OPTIONS[number];

const SPECIFICATION_OPTIONS: Record<StatusType, string[]> = {
  ativo: ['normal', 'férias', 'aviso prévio', 'contrato de experiência'],
  suspenso: ['disciplinar', 'administrativo'],
  afastado: ['licença médica - atestado', 'licença médica - INSS', 'licença maternidade', 'licença paternidade', 'folga', 'outros'],
  desligado: ['sem justa causa', 'com justa causa', 'pedido de demissão', 'término de contrato'],
};

interface WorkSchedule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  break_duration_minutes: number | null;
}

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  cpf: string | null;
  birth_date: string | null;
  hire_date: string | null;
  termination_date: string | null;
  phone: string | null;
  sector: string | null;
  position: string | null;
  work_schedule_id: string | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  status: string | null;
  specification: string | null;
}

interface EmployeeForm {
  full_name: string;
  email: string;
  cpf: string;
  birth_date: string;
  hire_date: string;
  termination_date: string;
  phone: string;
  address_cep: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  sector: string;
  position: string;
  work_schedule_id: string;
  password: string;
  status: string;
  specification: string;
}

interface NewScheduleForm {
  name: string;
  start_time: string;
  end_time: string;
  break_start_time: string;
  break_end_time: string;
  break_duration_minutes: string;
}

const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 10) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return numbers
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const getStatusBadgeVariant = (status: string | null) => {
  switch (status?.toLowerCase()) {
    case 'ativo':
      return 'default';
    case 'suspenso':
      return 'secondary';
    case 'afastado':
      return 'outline';
    case 'desligado':
      return 'destructive';
    default:
      return 'default';
  }
};

const EmployeeManagement = () => {
  const { user, userRole, loading } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const initialForm: EmployeeForm = {
    full_name: '',
    email: '',
    cpf: '',
    birth_date: '',
    hire_date: '',
    termination_date: '',
    phone: '',
    address_cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    sector: '',
    position: '',
    work_schedule_id: '',
    password: '',
    status: 'ativo',
    specification: 'normal',
  };

  const [form, setForm] = useState<EmployeeForm>(initialForm);
  const [editForm, setEditForm] = useState<EmployeeForm>(initialForm);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [newSchedule, setNewSchedule] = useState<NewScheduleForm>({
    name: '',
    start_time: '08:00',
    end_time: '17:00',
    break_start_time: '',
    break_end_time: '',
    break_duration_minutes: '60',
  });

  // Get unique sectors for filter dropdown
  const uniqueSectors = [...new Set(employees.filter(e => e.sector).map(e => e.sector as string))];

  useEffect(() => {
    fetchSchedules();
    fetchEmployees();
    
    // Listen for employee creation event to refresh list
    const handleEmployeeCreated = () => {
      fetchEmployees();
    };
    
    window.addEventListener('employee-created', handleEmployeeCreated);
    
    return () => {
      window.removeEventListener('employee-created', handleEmployeeCreated);
    };
  }, []);

  // Filter employees when search/filter changes
  useEffect(() => {
    let result = [...employees];

    // Search by name
    if (searchTerm) {
      result = result.filter(e => 
        e.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by sector
    if (filterSector !== 'all') {
      result = result.filter(e => e.sector === filterSector);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(e => (e.status || 'ativo').toLowerCase() === filterStatus.toLowerCase());
    }

    setFilteredEmployees(result);
  }, [employees, searchTerm, filterSector, filterStatus]);

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('work_schedules')
      .select('*')
      .order('name');
    
    if (data) {
      setSchedules(data);
    }
  };

  const fetchEmployees = async () => {
    setIsLoadingEmployees(true);
    
    // Fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    
    if (profilesData) {
      // Filter out suporte users (master user should be invisible)
      const { data: suporteRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'suporte');
      
      const suporteUserIds = new Set((suporteRoles || []).map(r => r.user_id));
      const visibleProfiles = profilesData.filter(p => !suporteUserIds.has(p.user_id));
      
      // Update statuses based on active vacations/leaves
      const updatedEmployees = await Promise.all(
        visibleProfiles.map(async (employee) => {
          const calculatedStatus = await calculateEmployeeStatus(employee.user_id);
          return {
            ...employee,
            status: calculatedStatus.status,
            specification: calculatedStatus.specification,
          };
        })
      );
      
      setEmployees(updatedEmployees as Employee[]);
      setFilteredEmployees(updatedEmployees as Employee[]);
    }
    setIsLoadingEmployees(false);
  };

  // Calculate employee status based on active vacations and medical leaves
  const calculateEmployeeStatus = async (userId: string): Promise<{ status: string; specification: string }> => {
    const today = new Date().toISOString().split('T')[0];
    
    // Check for active approved vacations
    const { data: vacationData } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today)
      .limit(1);
    
    if (vacationData && vacationData.length > 0) {
      return { status: 'ativo', specification: 'férias' };
    }
    
    // Check for active approved medical leaves
    const { data: adjustmentData } = await supabase
      .from('adjustment_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .in('absence_type', ['medical_leave', 'justified_absence']);
    
    if (adjustmentData && adjustmentData.length > 0) {
      // Check if any of the absence_dates include today
      const hasActiveLeave = adjustmentData.some(adj => {
        if (adj.absence_dates && Array.isArray(adj.absence_dates)) {
          return adj.absence_dates.includes(today);
        }
        return false;
      });
      
      if (hasActiveLeave) {
        const activeLeave = adjustmentData.find(adj => 
          adj.absence_dates?.includes(today)
        );
        
        if (activeLeave?.absence_type === 'medical_leave') {
          return { status: 'afastado', specification: 'licença médica - atestado' };
        }
        return { status: 'afastado', specification: 'folga' };
      }
    }
    
    // Check profile's stored status (for manually set statuses like 'desligado')
    const { data: profileData } = await supabase
      .from('profiles')
      .select('status, specification, termination_date')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (profileData) {
      // If employee has termination date, they are 'desligado'
      if (profileData.termination_date) {
        return { 
          status: 'desligado', 
          specification: profileData.specification || 'sem justa causa' 
        };
      }
      
      // Return stored status if it's not a leave-related status
      // (leave statuses are calculated dynamically above)
      const leaveSpecs = ['férias', 'licença médica - atestado', 'folga', 'licença médica - INSS', 'licença maternidade', 'licença paternidade'];
      if (profileData.status && !leaveSpecs.includes(profileData.specification || '')) {
        return { 
          status: profileData.status, 
          specification: profileData.specification || 'normal' 
        };
      }
    }
    
    // Default status
    return { status: 'ativo', specification: 'normal' };
  };

  const searchCep = async (isEdit = false) => {
    const currentForm = isEdit ? editForm : form;
    const setCurrentForm = isEdit ? setEditForm : setForm;
    
    const cep = currentForm.address_cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      toast({
        variant: 'destructive',
        title: 'CEP inválido',
        description: 'O CEP deve conter 8 dígitos.',
      });
      return;
    }

    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          variant: 'destructive',
          title: 'CEP não encontrado',
          description: 'Verifique o CEP informado.',
        });
        return;
      }

      setCurrentForm(prev => ({
        ...prev,
        address_street: data.logradouro || '',
        address_neighborhood: data.bairro || '',
        address_city: data.localidade || '',
        address_state: data.uf || '',
      }));

      toast({
        title: 'Endereço encontrado!',
        description: 'Preencha o número e complemento.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível buscar o endereço.',
      });
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!newSchedule.name) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe o nome da jornada.',
      });
      return;
    }

    const { data: emOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', user?.id).single();
    const { data, error } = await supabase
      .from('work_schedules')
      .insert({
        name: newSchedule.name,
        start_time: newSchedule.start_time,
        end_time: newSchedule.end_time,
        break_start_time: newSchedule.break_start_time || null,
        break_end_time: newSchedule.break_end_time || null,
        break_duration_minutes: parseInt(newSchedule.break_duration_minutes) || 60,
        organization_id: emOrgData?.organization_id,
      })
      .select()
      .single();

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar jornada',
        description: error.message,
      });
    } else {
      toast({
        title: 'Jornada criada!',
        description: 'A nova jornada foi cadastrada.',
      });
      setSchedules(prev => [...prev, data]);
      setForm(prev => ({ ...prev, work_schedule_id: data.id }));
      setShowNewSchedule(false);
      setNewSchedule({
        name: '',
        start_time: '08:00',
        end_time: '17:00',
        break_start_time: '',
        break_end_time: '',
        break_duration_minutes: '60',
      });
    }
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha nome, e-mail e senha.',
      });
      return;
    }

    if (form.password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          profileData: {
            cpf: form.cpf.replace(/\D/g, '') || null,
            birth_date: form.birth_date || null,
            hire_date: form.hire_date || null,
            termination_date: form.termination_date || null,
            phone: form.phone.replace(/\D/g, '') || null,
            address_cep: form.address_cep.replace(/\D/g, '') || null,
            address_street: form.address_street || null,
            address_number: form.address_number || null,
            address_complement: form.address_complement || null,
            address_neighborhood: form.address_neighborhood || null,
            address_city: form.address_city || null,
            address_state: form.address_state || null,
            sector: form.sector || null,
            position: form.position || null,
            work_schedule_id: form.work_schedule_id || null,
            status: form.status || 'ativo',
            specification: form.specification || 'normal',
          },
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Colaborador cadastrado!',
        description: `${form.full_name} foi cadastrado com sucesso.`,
      });

      setOpen(false);
      setForm(initialForm);
      fetchEmployees();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditForm({
      full_name: employee.full_name,
      email: employee.email,
      cpf: employee.cpf ? formatCPF(employee.cpf) : '',
      birth_date: employee.birth_date || '',
      hire_date: employee.hire_date || '',
      termination_date: employee.termination_date || '',
      phone: employee.phone ? formatPhone(employee.phone) : '',
      address_cep: employee.address_cep || '',
      address_street: employee.address_street || '',
      address_number: employee.address_number || '',
      address_complement: employee.address_complement || '',
      address_neighborhood: employee.address_neighborhood || '',
      address_city: employee.address_city || '',
      address_state: employee.address_state || '',
      sector: employee.sector || '',
      position: employee.position || '',
      work_schedule_id: employee.work_schedule_id || '',
      password: '',
      status: employee.status || 'ativo',
      specification: employee.specification || 'normal',
    });
    setEditOpen(true);
    setNewPassword('');
  };

  const handleUpdate = async () => {
    if (!selectedEmployee) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          cpf: editForm.cpf.replace(/\D/g, '') || null,
          birth_date: editForm.birth_date || null,
          hire_date: editForm.hire_date || null,
          termination_date: editForm.termination_date || null,
          phone: editForm.phone.replace(/\D/g, '') || null,
          address_cep: editForm.address_cep.replace(/\D/g, '') || null,
          address_street: editForm.address_street || null,
          address_number: editForm.address_number || null,
          address_complement: editForm.address_complement || null,
          address_neighborhood: editForm.address_neighborhood || null,
          address_city: editForm.address_city || null,
          address_state: editForm.address_state || null,
          sector: editForm.sector || null,
          position: editForm.position || null,
          work_schedule_id: editForm.work_schedule_id || null,
          status: editForm.status || 'ativo',
          specification: editForm.specification || 'normal',
        })
        .eq('id', selectedEmployee.id);

      if (error) throw error;

      toast({
        title: 'Colaborador atualizado!',
        description: `${editForm.full_name} foi atualizado com sucesso.`,
      });

      setEditOpen(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDeleteDialogOpen(true);
  };

  const handleHistoryClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setHistoryDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedEmployee.id);

      if (error) throw error;

      toast({
        title: 'Colaborador excluído',
        description: `${selectedEmployee.full_name} foi removido.`,
      });

      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: error.message,
      });
    }
  };

  const getScheduleName = (scheduleId: string | null) => {
    if (!scheduleId) return '-';
    const schedule = schedules.find(s => s.id === scheduleId);
    return schedule?.name || '-';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterSector('all');
    setFilterStatus('all');
  };

  const getAvailableSpecifications = (status: string) => {
    return SPECIFICATION_OPTIONS[status.toLowerCase() as StatusType] || SPECIFICATION_OPTIONS.ativo;
  };

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

  const renderEmployeeForm = (
    currentForm: EmployeeForm,
    setCurrentForm: React.Dispatch<React.SetStateAction<EmployeeForm>>,
    isEdit: boolean
  ) => (
    <div className="space-y-6 pt-4">
      {/* Personal Data */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground">Dados Pessoais</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}full_name`}>Nome Completo *</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}full_name`}
              placeholder="João da Silva"
              value={currentForm.full_name}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, full_name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}cpf`}>CPF</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}cpf`}
              placeholder="000.000.000-00"
              value={currentForm.cpf}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, cpf: formatCPF(e.target.value) }))}
              maxLength={14}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}birth_date`}>Data de Nascimento</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}birth_date`}
              type="date"
              value={currentForm.birth_date}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, birth_date: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}email`}>E-mail {!isEdit && '*'}</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}email`}
              type="email"
              placeholder="joao@empresa.com"
              value={currentForm.email}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, email: e.target.value }))}
              disabled={isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}phone`}>Telefone</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}phone`}
              placeholder="(00) 00000-0000"
              value={currentForm.phone}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
              maxLength={15}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}hire_date`}>Data de Admissão</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}hire_date`}
              type="date"
              value={currentForm.hire_date}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, hire_date: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}termination_date`}>Data de Desligamento</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}termination_date`}
              type="date"
              value={currentForm.termination_date}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, termination_date: e.target.value }))}
            />
          </div>

          {!isEdit && (
            <div className="col-span-2 space-y-2">
              <Label htmlFor="password">Senha Inicial *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Senha para o primeiro acesso (mín. 6 caracteres)"
                value={currentForm.password}
                onChange={(e) => setCurrentForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Status and Specification */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-medium text-sm text-muted-foreground">Status do Colaborador</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}status`}>Status</Label>
            <Select
              value={currentForm.status}
              onValueChange={(value) => {
                const specs = getAvailableSpecifications(value);
                setCurrentForm(prev => ({ 
                  ...prev, 
                  status: value, 
                  specification: specs[0] || 'normal' 
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}specification`}>Especificação</Label>
            <Select
              value={currentForm.specification}
              onValueChange={(value) => setCurrentForm(prev => ({ ...prev, specification: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a especificação" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableSpecifications(currentForm.status).map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec.charAt(0).toUpperCase() + spec.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-medium text-sm text-muted-foreground">Endereço</h3>
        
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}cep`}>CEP</Label>
            <div className="flex gap-2">
              <Input
                id={`${isEdit ? 'edit_' : ''}cep`}
                placeholder="00000-000"
                value={currentForm.address_cep}
                onChange={(e) => setCurrentForm(prev => ({ ...prev, address_cep: e.target.value }))}
                maxLength={9}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => searchCep(isEdit)}
                disabled={isSearchingCep}
              >
                {isSearchingCep ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${isEdit ? 'edit_' : ''}street`}>Rua</Label>
          <Input
            id={`${isEdit ? 'edit_' : ''}street`}
            placeholder="Nome da rua"
            value={currentForm.address_street}
            readOnly
            className="bg-muted/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}number`}>Número</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}number`}
              placeholder="123"
              value={currentForm.address_number}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, address_number: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}complement`}>Complemento</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}complement`}
              placeholder="Apto 101"
              value={currentForm.address_complement}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, address_complement: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}neighborhood`}>Bairro</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}neighborhood`}
              value={currentForm.address_neighborhood}
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}city`}>Cidade</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}city`}
              value={currentForm.address_city}
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}state`}>Estado</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}state`}
              value={currentForm.address_state}
              readOnly
              className="bg-muted/50"
              maxLength={2}
            />
          </div>
        </div>
      </div>

      {/* Professional Data */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-medium text-sm text-muted-foreground">Dados Profissionais</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}sector`}>Setor/Departamento</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}sector`}
              placeholder="Ex: Administrativo, TI, RH..."
              value={currentForm.sector}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, sector: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${isEdit ? 'edit_' : ''}position`}>Cargo/Função</Label>
            <Input
              id={`${isEdit ? 'edit_' : ''}position`}
              placeholder="Ex: Analista, Gerente, Assistente..."
              value={currentForm.position}
              onChange={(e) => setCurrentForm(prev => ({ ...prev, position: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Work Schedule */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-medium text-sm text-muted-foreground">Jornada de Trabalho</h3>
        
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label>Selecionar Jornada</Label>
            <Select
              value={currentForm.work_schedule_id}
              onValueChange={(value) => setCurrentForm(prev => ({ ...prev, work_schedule_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma jornada" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map((schedule) => (
                  <SelectItem key={schedule.id} value={schedule.id}>
                    {schedule.name} ({schedule.start_time} - {schedule.end_time})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isEdit && (
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowNewSchedule(!showNewSchedule)}
                title="Adicionar nova jornada"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {!isEdit && showNewSchedule && (
          <Card className="border-dashed">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Nova Jornada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Jornada</Label>
                <Input
                  placeholder="Ex: Turno Comercial"
                  value={newSchedule.name}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entrada</Label>
                  <Input
                    type="time"
                    value={newSchedule.start_time}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Saída</Label>
                  <Input
                    type="time"
                    value={newSchedule.end_time}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Ent. Intervalo</Label>
                  <Input
                    type="time"
                    value={newSchedule.break_start_time}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, break_start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Saí. Intervalo</Label>
                  <Input
                    type="time"
                    value={newSchedule.break_end_time}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, break_end_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo (min)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="60"
                    value={newSchedule.break_duration_minutes}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, break_duration_minutes: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={handleCreateSchedule} size="sm" className="w-full">
                Criar Jornada
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Cadastro de Colaboradores
            </h1>
            <p className="text-muted-foreground">
              Gerencie os colaboradores da empresa
            </p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Cadastrar Novo Colaborador
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do novo colaborador. Os campos marcados com * são obrigatórios.
                </DialogDescription>
              </DialogHeader>

              {renderEmployeeForm(form, setForm, false)}

              <Button onClick={handleSubmit} disabled={isLoading} className="w-full mt-4">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  'Cadastrar Colaborador'
                )}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Busca e Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label>Buscar por nome</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite o nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="min-w-[180px] space-y-2">
                <Label>Setor</Label>
                <Select value={filterSector} onValueChange={setFilterSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os setores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    {uniqueSectors.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[150px] space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(searchTerm || filterSector !== 'all' || filterStatus !== 'all') && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}

              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToPDF({
                    employees: filteredEmployees,
                    schedules,
                    filters: { searchTerm, filterSector, filterStatus }
                  })}
                  className="gap-2"
                  disabled={filteredEmployees.length === 0}
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await exportToExcel({
                      employees: filteredEmployees,
                      schedules,
                      filters: { searchTerm, filterSector, filterStatus }
                    });
                  }}
                  className="gap-2"
                  disabled={filteredEmployees.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>

            <div className="mt-3 text-sm text-muted-foreground">
              {filteredEmployees.length} colaborador(es) encontrado(s)
            </div>
          </CardContent>
        </Card>

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Colaboradores Cadastrados</CardTitle>
            <CardDescription>Lista de todos os colaboradores da empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEmployees ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {employees.length === 0 ? 'Nenhum colaborador cadastrado ainda.' : 'Nenhum colaborador encontrado com os filtros aplicados.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Jornada</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Especificação</TableHead>
                      <TableHead className="text-center">Ponto</TableHead>
                      <TableHead className="text-center">Histórico</TableHead>
                      <TableHead className="text-center">Editar</TableHead>
                      <TableHead className="text-center">Excluir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => handleEdit(employee)}
                            className="text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                            title="Clique para editar"
                          >
                            {employee.full_name}
                          </button>
                        </TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell>{employee.sector || '-'}</TableCell>
                        <TableCell>{employee.position || '-'}</TableCell>
                        <TableCell>{getScheduleName(employee.work_schedule_id)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(employee.status)}>
                            {(employee.status || 'ativo').charAt(0).toUpperCase() + (employee.status || 'ativo').slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {(employee.specification || 'normal').charAt(0).toUpperCase() + (employee.specification || 'normal').slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <EmployeeTimesheetExport
                            employeeId={employee.id}
                            employeeName={employee.full_name}
                            userId={employee.user_id}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleHistoryClick(employee)}
                            title="Ver histórico de status"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(employee)}
                            title="Editar colaborador"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(employee)}
                            title="Excluir colaborador"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Editar Colaborador
              </DialogTitle>
              <DialogDescription>
                Atualize os dados do colaborador.
              </DialogDescription>
            </DialogHeader>

            {renderEmployeeForm(editForm, setEditForm, true)}

            {/* Change Password Section */}
            <div className="space-y-4 border-t pt-4 mt-4">
              <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Alterar Senha de Acesso
              </h3>
              <div className="space-y-2">
                <Label htmlFor="edit_new_password">Nova Senha</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit_new_password"
                    type="password"
                    placeholder="Nova senha (mín. 6 caracteres)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isChangingPassword || !newPassword || newPassword.length < 6}
                    onClick={async () => {
                      if (!selectedEmployee) return;
                      setIsChangingPassword(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('update-password', {
                          body: {
                            target_user_id: selectedEmployee.user_id,
                            new_password: newPassword,
                          },
                        });
                        if (error) throw new Error(error.message);
                        if (data?.error) throw new Error(data.error);
                        toast({
                          title: 'Senha alterada!',
                          description: `A senha de ${selectedEmployee.full_name} foi atualizada.`,
                        });
                        setNewPassword('');
                      } catch (error: any) {
                        toast({
                          variant: 'destructive',
                          title: 'Erro ao alterar senha',
                          description: error.message,
                        });
                      } finally {
                        setIsChangingPassword(false);
                      }
                    }}
                  >
                    {isChangingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Alterar'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use este campo para redefinir a senha de acesso do colaborador.
                </p>
              </div>
            </div>

            <Button onClick={handleUpdate} disabled={isLoading} className="w-full mt-4">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  A exclusão do cadastro de <strong>{selectedEmployee?.full_name}</strong> implica em remoção de todos os dados cadastrais.
                </p>
                <p className="text-amber-600 font-medium">
                  Para manter o cadastro, você pode editar o cadastro e mudar o status para "Desligado".
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Status History Dialog */}
        {selectedEmployee && (
          <StatusHistoryDialog
            open={historyDialogOpen}
            onOpenChange={setHistoryDialogOpen}
            userId={selectedEmployee.user_id}
            employeeName={selectedEmployee.full_name}
          />
        )}
      </div>
    </SidebarLayout>
  );
};

export default EmployeeManagement;
