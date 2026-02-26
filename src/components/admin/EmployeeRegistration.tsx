import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Search, Plus, MapPin, Building2 } from 'lucide-react';
import { validateCPF, formatCPF } from '@/utils/cpfValidation';

interface WorkSchedule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  schedule_type: string;
  monday_hours: number | null;
  tuesday_hours: number | null;
  wednesday_hours: number | null;
  thursday_hours: number | null;
  friday_hours: number | null;
  saturday_hours: number | null;
  sunday_hours: number | null;
  shift_work_hours: number | null;
  shift_rest_hours: number | null;
}

interface CompanyBranch {
  id: string;
  cnpj: string;
  address_city: string | null;
  address_state: string | null;
}

type LocationMode = 'disabled' | 'log_only' | 'require_exact' | 'require_radius';
type WorkLocationType = 'sede' | 'filial';

interface EmployeeForm {
  full_name: string;
  email: string;
  cpf: string;
  birth_date: string;
  hire_date: string;
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
  // Work location
  work_location_type: WorkLocationType;
  branch_id: string;
  // Location settings
  location_mode: LocationMode;
  work_address_cep: string;
  work_address_street: string;
  work_address_number: string;
  work_address_complement: string;
  work_address_neighborhood: string;
  work_address_city: string;
  work_address_state: string;
  allowed_radius_meters: number;
}

interface NewScheduleForm {
  name: string;
  start_time: string;
  end_time: string;
  break_start_time: string;
  break_end_time: string;
}

const EmployeeRegistration = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [hasBranches, setHasBranches] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [isSearchingWorkCep, setIsSearchingWorkCep] = useState(false);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [orgCode, setOrgCode] = useState<string>('');
  
  const [form, setForm] = useState<EmployeeForm>({
    full_name: '',
    email: '',
    cpf: '',
    birth_date: '',
    hire_date: '',
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
    work_location_type: 'sede',
    branch_id: '',
    location_mode: 'disabled',
    work_address_cep: '',
    work_address_street: '',
    work_address_number: '',
    work_address_complement: '',
    work_address_neighborhood: '',
    work_address_city: '',
    work_address_state: '',
    allowed_radius_meters: 100,
  });

  const [newSchedule, setNewSchedule] = useState<NewScheduleForm>({
    name: '',
    start_time: '08:00',
    end_time: '17:00',
    break_start_time: '',
    break_end_time: '',
  });

  const generateOrgCode = async () => {
    try {
      // Get current org's existing code first
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!profileData?.organization_id) return;

      // Check if org already has a code
      const { data: orgData } = await supabase
        .from('organizations')
        .select('org_code')
        .eq('id', profileData.organization_id)
        .single();

      if (orgData?.org_code) {
        setOrgCode(orgData.org_code);
        return;
      }

      // Fetch company CNPJ
      const { data: companyData } = await supabase
        .from('company_info')
        .select('cnpj')
        .limit(1)
        .maybeSingle();

      if (!companyData?.cnpj) {
        setOrgCode('');
        return;
      }

      const cnpjDigits = companyData.cnpj.replace(/\D/g, '');
      
      // Get all existing org_codes
      const { data: allOrgs } = await supabase
        .from('organizations')
        .select('org_code')
        .not('org_code', 'is', null);

      const existingCodes = new Set((allOrgs || []).map(o => o.org_code));

      // Try first 5 digits, then skip digits if taken
      let code = '';
      let startIndex = 0;
      
      while (startIndex + 5 <= cnpjDigits.length) {
        const candidate = cnpjDigits.substring(startIndex, startIndex + 5);
        if (!existingCodes.has(candidate)) {
          code = candidate;
          break;
        }
        startIndex++;
      }

      // Fallback: if all 5-digit combinations are taken
      if (!code) {
        code = cnpjDigits.substring(0, 5) + cnpjDigits.substring(cnpjDigits.length - 1);
      }

      // Save the code
      await supabase
        .from('organizations')
        .update({ org_code: code })
        .eq('id', profileData.organization_id);

      setOrgCode(code);
    } catch (error) {
      console.error('Error generating org code:', error);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchBranchesInfo();
    generateOrgCode();
  }, []);

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('work_schedules')
      .select('*')
      .order('name');
    
    if (data) {
      setSchedules(data);
    }
  };

  const fetchBranchesInfo = async () => {
    // Check if company has branches
    const { data: companyData } = await supabase
      .from('company_info')
      .select('has_branches')
      .limit(1)
      .single();
    
    if (companyData?.has_branches) {
      setHasBranches(true);
      
      // Fetch branches
      const { data: branchesData } = await supabase
        .from('company_branches')
        .select('id, cnpj, address_city, address_state')
        .order('address_city');
      
      if (branchesData) {
        setBranches(branchesData);
      }
    }
  };

  const searchCep = async () => {
    const cep = form.address_cep.replace(/\D/g, '');
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

      setForm(prev => ({
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

  const searchWorkCep = async () => {
    const cep = form.work_address_cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      toast({
        variant: 'destructive',
        title: 'CEP inválido',
        description: 'O CEP deve conter 8 dígitos.',
      });
      return;
    }

    setIsSearchingWorkCep(true);
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

      setForm(prev => ({
        ...prev,
        work_address_street: data.logradouro || '',
        work_address_neighborhood: data.bairro || '',
        work_address_city: data.localidade || '',
        work_address_state: data.uf || '',
      }));

      toast({
        title: 'Endereço de trabalho encontrado!',
        description: 'Preencha o número e complemento.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível buscar o endereço.',
      });
    } finally {
      setIsSearchingWorkCep(false);
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

    const { data: erOrgData } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
    const { data, error } = await supabase
      .from('work_schedules')
      .insert({
        name: newSchedule.name,
        start_time: newSchedule.start_time,
        end_time: newSchedule.end_time,
        break_start_time: newSchedule.break_start_time || null,
        break_end_time: newSchedule.break_end_time || null,
        organization_id: erOrgData?.organization_id,
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
      });
    }
  };

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    setForm(prev => ({ ...prev, cpf: formatted }));
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast({
        variant: 'destructive',
        title: 'E-mail inválido',
        description: 'O e-mail informado não possui um formato válido. Verifique e tente novamente.',
      });
      return;
    }

    // Validate CPF if provided
    if (form.cpf && !validateCPF(form.cpf)) {
      toast({
        variant: 'destructive',
        title: 'CPF inválido',
        description: 'O CPF informado não é válido. Verifique os dígitos.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-employee', {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          profileData: {
            cpf: form.cpf || null,
            birth_date: form.birth_date || null,
            hire_date: form.hire_date || null,
            address_cep: form.address_cep || null,
            address_street: form.address_street || null,
            address_number: form.address_number || null,
            address_complement: form.address_complement || null,
            address_neighborhood: form.address_neighborhood || null,
            address_city: form.address_city || null,
            address_state: form.address_state || null,
            sector: form.sector || null,
            position: form.position || null,
            work_schedule_id: form.work_schedule_id || null,
            // Work location
            work_location_type: form.work_location_type,
            branch_id: form.work_location_type === 'filial' && form.branch_id ? form.branch_id : null,
            // Location settings
            location_mode: form.location_mode,
            work_address_cep: form.work_address_cep || null,
            work_address_street: form.work_address_street || null,
            work_address_number: form.work_address_number || null,
            work_address_complement: form.work_address_complement || null,
            work_address_neighborhood: form.work_address_neighborhood || null,
            work_address_city: form.work_address_city || null,
            work_address_state: form.work_address_state || null,
            allowed_radius_meters: form.allowed_radius_meters,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao cadastrar colaborador');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Colaborador cadastrado!',
        description: `${form.full_name} foi cadastrado com sucesso.`,
      });

      setOpen(false);
      setForm({
        full_name: '',
        email: '',
        cpf: '',
        birth_date: '',
        hire_date: '',
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
        work_location_type: 'sede',
        branch_id: '',
        location_mode: 'disabled',
        work_address_cep: '',
        work_address_street: '',
        work_address_number: '',
        work_address_complement: '',
        work_address_neighborhood: '',
        work_address_city: '',
        work_address_state: '',
        allowed_radius_meters: 100,
      });

      // Dispatch event to refresh employee list
      window.dispatchEvent(new CustomEvent('employee-created'));
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

  return (
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

        <div className="space-y-6 pt-4">
          {/* Organization ID */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Identificação da Organização</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="org_code">ID da Organização</Label>
                <Input
                  id="org_code"
                  value={orgCode}
                  readOnly
                  disabled
                  className="bg-muted font-mono"
                  placeholder="Cadastre o CNPJ nas Informações Institucionais"
                />
                <p className="text-xs text-muted-foreground">
                  Gerado automaticamente a partir do CNPJ da empresa
                </p>
              </div>
            </div>
          </div>

          {/* Personal Data */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Dados Pessoais</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  placeholder="João da Silva"
                  value={form.full_name}
                  onChange={(e) => setForm(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(e) => handleCPFChange(e.target.value)}
                  maxLength={14}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birth_date">Data de Nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm(prev => ({ ...prev, birth_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hire_date">Data de Admissão</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={form.hire_date}
                  onChange={(e) => setForm(prev => ({ ...prev, hire_date: e.target.value }))}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="password">Senha Inicial *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Senha para o primeiro acesso"
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium text-sm text-muted-foreground">Endereço</h3>
            
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={form.address_cep}
                    onChange={(e) => setForm(prev => ({ ...prev, address_cep: e.target.value }))}
                    maxLength={9}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={searchCep}
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
              <Label htmlFor="street">Rua</Label>
              <Input
                id="street"
                placeholder="Nome da rua"
                value={form.address_street}
                readOnly
                className="bg-muted/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  placeholder="123"
                  value={form.address_number}
                  onChange={(e) => setForm(prev => ({ ...prev, address_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  placeholder="Apto 101"
                  value={form.address_complement}
                  onChange={(e) => setForm(prev => ({ ...prev, address_complement: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={form.address_neighborhood}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={form.address_city}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={form.address_state}
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
                <Label htmlFor="sector">Setor/Departamento</Label>
                <Input
                  id="sector"
                  placeholder="Ex: Administrativo, TI, RH..."
                  value={form.sector}
                  onChange={(e) => setForm(prev => ({ ...prev, sector: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Cargo</Label>
                <Input
                  id="position"
                  placeholder="Ex: Analista, Gerente, Assistente..."
                  value={form.position}
                  onChange={(e) => setForm(prev => ({ ...prev, position: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Work Location */}
          {hasBranches && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Local de Trabalho
              </h3>
              
              <div className="space-y-3">
                <RadioGroup
                  value={form.work_location_type}
                  onValueChange={(value) => {
                    setForm(prev => ({ 
                      ...prev, 
                      work_location_type: value as WorkLocationType,
                      branch_id: value === 'sede' ? '' : prev.branch_id 
                    }));
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sede" id="work_loc_sede" />
                    <Label htmlFor="work_loc_sede" className="cursor-pointer font-medium">
                      Sede (Matriz)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="filial" id="work_loc_filial" />
                    <Label htmlFor="work_loc_filial" className="cursor-pointer font-medium">
                      Filial
                    </Label>
                  </div>
                </RadioGroup>

                {form.work_location_type === 'filial' && (
                  <div className="space-y-2">
                    <Label>Selecionar Filial</Label>
                    <Select
                      value={form.branch_id}
                      onValueChange={(value) => setForm(prev => ({ ...prev, branch_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a filial" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            <span className="flex items-center gap-2">
                              {branch.address_city && branch.address_state 
                                ? `${branch.address_city}/${branch.address_state}` 
                                : 'Filial'}
                              <span className="text-muted-foreground text-xs">
                                (CNPJ: {branch.cnpj})
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {branches.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma filial cadastrada. Cadastre filiais em Informações Institucionais.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Work Schedule */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium text-sm text-muted-foreground">Jornada de Trabalho</h3>
            
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>Selecionar Jornada</Label>
                <Select
                  value={form.work_schedule_id}
                  onValueChange={(value) => setForm(prev => ({ ...prev, work_schedule_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma jornada" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {schedules.map((schedule) => {
                      const getScheduleInfo = () => {
                        if (schedule.schedule_type === 'shift') {
                          return `Escala ${schedule.shift_work_hours}x${schedule.shift_rest_hours}`;
                        }
                        const total = (schedule.monday_hours || 0) + (schedule.tuesday_hours || 0) +
                          (schedule.wednesday_hours || 0) + (schedule.thursday_hours || 0) +
                          (schedule.friday_hours || 0) + (schedule.saturday_hours || 0) +
                          (schedule.sunday_hours || 0);
                        return `${total}h/sem`;
                      };
                      return (
                        <SelectItem key={schedule.id} value={schedule.id}>
                          <span className="flex items-center gap-2">
                            {schedule.name}
                            <span className="text-muted-foreground text-xs">
                              ({getScheduleInfo()} • {schedule.start_time?.slice(0, 5)}-{schedule.end_time?.slice(0, 5)})
                            </span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewSchedule(!showNewSchedule)}
                  title="Criar nova jornada"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Show selected schedule details */}
            {form.work_schedule_id && (() => {
              const selected = schedules.find(s => s.id === form.work_schedule_id);
              if (!selected) return null;
              
              const isShift = selected.schedule_type === 'shift';
              const weeklyTotal = !isShift ? (
                (selected.monday_hours || 0) + (selected.tuesday_hours || 0) +
                (selected.wednesday_hours || 0) + (selected.thursday_hours || 0) +
                (selected.friday_hours || 0) + (selected.saturday_hours || 0) +
                (selected.sunday_hours || 0)
              ) : 0;

              return (
                <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium">{isShift ? 'Escala de Revezamento' : 'Jornada Semanal Fixa'}</span>
                  </div>
                  {isShift ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Padrão:</span>
                      <span className="font-medium">{selected.shift_work_hours}h trabalho / {selected.shift_rest_hours}h folga</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Carga Semanal:</span>
                        <span className="font-medium">{weeklyTotal}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dias:</span>
                        <span className="font-medium text-xs">
                          {[
                            selected.monday_hours && selected.monday_hours > 0 ? `Seg(${selected.monday_hours}h)` : null,
                            selected.tuesday_hours && selected.tuesday_hours > 0 ? `Ter(${selected.tuesday_hours}h)` : null,
                            selected.wednesday_hours && selected.wednesday_hours > 0 ? `Qua(${selected.wednesday_hours}h)` : null,
                            selected.thursday_hours && selected.thursday_hours > 0 ? `Qui(${selected.thursday_hours}h)` : null,
                            selected.friday_hours && selected.friday_hours > 0 ? `Sex(${selected.friday_hours}h)` : null,
                            selected.saturday_hours && selected.saturday_hours > 0 ? `Sáb(${selected.saturday_hours}h)` : null,
                            selected.sunday_hours && selected.sunday_hours > 0 ? `Dom(${selected.sunday_hours}h)` : null,
                          ].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horário:</span>
                    <span className="font-medium">{selected.start_time?.slice(0, 5)} às {selected.end_time?.slice(0, 5)}</span>
                  </div>
                </div>
              );
            })()}

            {showNewSchedule && (
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
                  <div className="grid grid-cols-3 gap-4">
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
                  </div>
                  <Button onClick={handleCreateSchedule} size="sm" className="w-full">
                    Criar Jornada
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Location Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Configurações de Localização
            </h3>
            
            <div className="space-y-3">
              <Label className="text-sm font-medium">Modo de Localização para Ponto</Label>
              <RadioGroup
                value={form.location_mode}
                onValueChange={(value) => setForm(prev => ({ ...prev, location_mode: value as LocationMode }))}
                className="space-y-2"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="disabled" id="loc_disabled" className="mt-0.5" />
                  <div>
                    <Label htmlFor="loc_disabled" className="font-medium cursor-pointer text-sm">Desativado</Label>
                    <p className="text-xs text-muted-foreground">
                      Não exigir localização (ideal para trabalho remoto)
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="log_only" id="loc_log_only" className="mt-0.5" />
                  <div>
                    <Label htmlFor="loc_log_only" className="font-medium cursor-pointer text-sm">Registrar sem bloquear</Label>
                    <p className="text-xs text-muted-foreground">
                      Registrar localização, mas permitir ponto de qualquer local
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="require_exact" id="loc_require_exact" className="mt-0.5" />
                  <div>
                    <Label htmlFor="loc_require_exact" className="font-medium cursor-pointer text-sm">Endereço exato</Label>
                    <p className="text-xs text-muted-foreground">
                      Exigir presença no endereço cadastrado (margem de 50m)
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="require_radius" id="loc_require_radius" className="mt-0.5" />
                  <div>
                    <Label htmlFor="loc_require_radius" className="font-medium cursor-pointer text-sm">Raio de distância</Label>
                    <p className="text-xs text-muted-foreground">
                      Permitir registro dentro de um raio do endereço
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {(form.location_mode === 'require_exact' || form.location_mode === 'require_radius' || form.location_mode === 'log_only') && (
              <div className="space-y-4 pt-2">
                <Label className="text-sm font-medium">Endereço de Trabalho</Label>
                
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="work_cep" className="text-xs">CEP</Label>
                    <div className="flex gap-2">
                      <Input
                        id="work_cep"
                        placeholder="00000-000"
                        value={form.work_address_cep}
                        onChange={(e) => setForm(prev => ({ ...prev, work_address_cep: e.target.value }))}
                        maxLength={9}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={searchWorkCep}
                        disabled={isSearchingWorkCep}
                      >
                        {isSearchingWorkCep ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="work_street" className="text-xs">Rua</Label>
                  <Input
                    id="work_street"
                    placeholder="Nome da rua"
                    value={form.work_address_street}
                    readOnly
                    className="bg-muted/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="work_number" className="text-xs">Número</Label>
                    <Input
                      id="work_number"
                      placeholder="123"
                      value={form.work_address_number}
                      onChange={(e) => setForm(prev => ({ ...prev, work_address_number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="work_complement" className="text-xs">Complemento</Label>
                    <Input
                      id="work_complement"
                      placeholder="Sala 101"
                      value={form.work_address_complement}
                      onChange={(e) => setForm(prev => ({ ...prev, work_address_complement: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="work_neighborhood" className="text-xs">Bairro</Label>
                    <Input
                      id="work_neighborhood"
                      value={form.work_address_neighborhood}
                      readOnly
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="work_city" className="text-xs">Cidade</Label>
                    <Input
                      id="work_city"
                      value={form.work_address_city}
                      readOnly
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="work_state" className="text-xs">Estado</Label>
                    <Input
                      id="work_state"
                      value={form.work_address_state}
                      readOnly
                      className="bg-muted/50"
                      maxLength={2}
                    />
                  </div>
                </div>

                {form.location_mode === 'require_radius' && (
                  <div className="space-y-2">
                    <Label htmlFor="radius" className="text-xs">Raio permitido (metros)</Label>
                    <Input
                      id="radius"
                      type="number"
                      placeholder="100"
                      value={form.allowed_radius_meters}
                      onChange={(e) => setForm(prev => ({ ...prev, allowed_radius_meters: parseInt(e.target.value) || 100 }))}
                      min={10}
                      max={5000}
                    />
                    <p className="text-xs text-muted-foreground">
                      Distância máxima do endereço (10 a 5000 metros)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cadastrando...
              </>
            ) : (
              'Cadastrar Colaborador'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeRegistration;
