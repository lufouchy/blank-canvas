
-- ========== Enums ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'employee', 'suporte');
CREATE TYPE public.absence_type AS ENUM ('vacation','medical_consultation','medical_leave','justified_absence','bereavement_leave','maternity_leave','paternity_leave','unjustified_absence','work_accident','punitive_suspension','day_off');
CREATE TYPE public.adjustment_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.admin_position AS ENUM ('rh','dono','gerente','diretor','coordenador','socio','outro');
CREATE TYPE public.bank_validity AS ENUM ('3_months','6_months','1_year','custom');
CREATE TYPE public.business_sector AS ENUM ('tecnologia','varejo','industria','servicos','saude','educacao','financeiro','construcao','agronegocio','logistica','alimentacao','outro');
CREATE TYPE public.document_status AS ENUM ('pending_signature','signed','expired');
CREATE TYPE public.mixed_rule_type AS ENUM ('hours_threshold','day_type');
CREATE TYPE public.overtime_strategy AS ENUM ('bank','payment','mixed');
CREATE TYPE public.time_record_type AS ENUM ('entry','lunch_out','lunch_in','exit');
CREATE TYPE public.vacation_type AS ENUM ('individual','collective');

-- ========== Organizações ==========
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  org_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Jornadas de Trabalho ==========
CREATE TABLE public.work_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'weekly',
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  break_start_time TIME,
  break_end_time TIME,
  break_duration_minutes INTEGER DEFAULT 60,
  monday_hours NUMERIC DEFAULT 8,
  tuesday_hours NUMERIC DEFAULT 8,
  wednesday_hours NUMERIC DEFAULT 8,
  thursday_hours NUMERIC DEFAULT 8,
  friday_hours NUMERIC DEFAULT 8,
  saturday_hours NUMERIC DEFAULT 0,
  sunday_hours NUMERIC DEFAULT 0,
  shift_work_hours INTEGER,
  shift_rest_hours INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Informações da Empresa ==========
CREATE TABLE public.company_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  business_sector business_sector NOT NULL DEFAULT 'outro',
  has_branches BOOLEAN NOT NULL DEFAULT false,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  logo_url TEXT,
  phone TEXT,
  whatsapp TEXT,
  financial_email TEXT,
  address_cep TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Filiais ==========
CREATE TABLE public.company_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company_info(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  cnpj TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  financial_email TEXT,
  address_cep TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Colaboradores (Profiles) ==========
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  avatar_url TEXT,
  birth_date DATE,
  hire_date DATE,
  termination_date DATE,
  sector TEXT,
  position TEXT,
  status TEXT DEFAULT 'ativo',
  specification TEXT DEFAULT 'normal',
  branch_id UUID REFERENCES public.company_branches(id),
  work_schedule_id UUID REFERENCES public.work_schedules(id),
  location_mode TEXT NOT NULL DEFAULT 'disabled',
  work_location_type TEXT NOT NULL DEFAULT 'sede',
  allowed_radius_meters INTEGER DEFAULT 100,
  work_latitude NUMERIC,
  work_longitude NUMERIC,
  work_address_cep TEXT,
  work_address_street TEXT,
  work_address_number TEXT,
  work_address_complement TEXT,
  work_address_neighborhood TEXT,
  work_address_city TEXT,
  work_address_state TEXT,
  address_cep TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Papéis de Usuário ==========
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  organization_id UUID NOT NULL REFERENCES public.organizations(id)
);

-- ========== Administradores ==========
CREATE TABLE public.company_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company_info(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  email TEXT NOT NULL,
  position admin_position NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Registros de Ponto ==========
CREATE TABLE public.time_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  record_type time_record_type NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Ajustes de Jornada ==========
CREATE TABLE public.schedule_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  adjustment_type TEXT NOT NULL DEFAULT 'temporary_change',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  custom_start_time TIME,
  custom_end_time TIME,
  custom_break_start TIME,
  custom_break_end TIME,
  overtime_authorized BOOLEAN NOT NULL DEFAULT false,
  overtime_max_minutes INTEGER,
  reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Solicitações de Ajuste ==========
CREATE TABLE public.adjustment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  request_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  record_type time_record_type NOT NULL,
  requested_time TIMESTAMPTZ NOT NULL,
  status adjustment_status NOT NULL DEFAULT 'pending',
  absence_type absence_type,
  absence_reason TEXT,
  absence_dates TEXT[],
  start_time TIME,
  end_time TIME,
  attachment_url TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Solicitações de Férias ==========
CREATE TABLE public.vacation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  vacation_type vacation_type NOT NULL DEFAULT 'individual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  sell_days INTEGER DEFAULT 0,
  reason TEXT,
  status adjustment_status NOT NULL DEFAULT 'pending',
  is_admin_created BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Banco de Horas ==========
CREATE TABLE public.hours_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  balance_minutes INTEGER NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Decisões de Horas Extras ==========
CREATE TABLE public.monthly_overtime_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  reference_month DATE NOT NULL,
  destination TEXT NOT NULL DEFAULT 'bank',
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  bank_minutes INTEGER DEFAULT 0,
  payment_minutes INTEGER DEFAULT 0,
  payment_amount NUMERIC DEFAULT 0,
  is_edited BOOLEAN DEFAULT false,
  finalized BOOLEAN DEFAULT false,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Documentos ==========
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'timesheet',
  reference_month DATE NOT NULL,
  status document_status NOT NULL DEFAULT 'pending_signature',
  file_url TEXT,
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Feriados ==========
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  state_code TEXT,
  city_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Configurações de Folha ==========
CREATE TABLE public.payroll_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  cycle_start_day INTEGER NOT NULL DEFAULT 1,
  tolerance_minutes INTEGER NOT NULL DEFAULT 10,
  tolerance_entry_minutes INTEGER NOT NULL DEFAULT 10,
  schedule_flexibility_mode TEXT NOT NULL DEFAULT 'tolerance',
  overtime_strategy overtime_strategy NOT NULL DEFAULT 'bank',
  bank_validity bank_validity DEFAULT '6_months',
  bank_custom_months INTEGER,
  bank_daily_limit_hours NUMERIC DEFAULT 2,
  bank_compensation_ratio NUMERIC DEFAULT 1.0,
  bank_sunday_multiplier NUMERIC DEFAULT 2.0,
  bank_holiday_multiplier NUMERIC DEFAULT 2.0,
  payment_weekday_percent INTEGER DEFAULT 50,
  payment_saturday_percent INTEGER DEFAULT 50,
  payment_sunday_percent INTEGER DEFAULT 100,
  payment_holiday_percent INTEGER DEFAULT 100,
  mixed_rule_type mixed_rule_type DEFAULT 'hours_threshold',
  mixed_hours_threshold INTEGER DEFAULT 20,
  mixed_bank_days TEXT[] DEFAULT ARRAY['weekday','saturday'],
  mixed_payment_days TEXT[] DEFAULT ARRAY['sunday','holiday'],
  auto_decision_enabled BOOLEAN DEFAULT false,
  auto_decision_threshold_hours INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Configurações de Localização ==========
CREATE TABLE public.location_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  location_mode TEXT NOT NULL DEFAULT 'disabled',
  allowed_radius_meters INTEGER DEFAULT 100,
  company_latitude NUMERIC,
  company_longitude NUMERIC,
  address_cep TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== Histórico de Status ==========
CREATE TABLE public.status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  previous_status TEXT,
  new_status TEXT,
  previous_specification TEXT,
  new_specification TEXT,
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== RLS ==========
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hours_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_overtime_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- ========== Security Definer Function ==========
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get user's organization_id from profiles
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- ========== RLS Policies ==========

-- organizations
CREATE POLICY "Users can view own org" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert org" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Admins can update org" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can update any profile in org" ON public.profiles FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can view roles in org" ON public.user_roles FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (true);

-- company_info
CREATE POLICY "Org members can view" ON public.company_info FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can insert" ON public.company_info FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update" ON public.company_info FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- company_branches
CREATE POLICY "Org members can view branches" ON public.company_branches FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can manage branches" ON public.company_branches FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- company_admins
CREATE POLICY "Org members can view admins" ON public.company_admins FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can manage company_admins" ON public.company_admins FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- time_records
CREATE POLICY "Users can view own records" ON public.time_records FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can view org records" ON public.time_records FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own records" ON public.time_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- work_schedules
CREATE POLICY "Org members can view schedules" ON public.work_schedules FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can manage schedules" ON public.work_schedules FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- schedule_adjustments
CREATE POLICY "Org members can view adjustments" ON public.schedule_adjustments FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can manage adjustments" ON public.schedule_adjustments FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- adjustment_requests
CREATE POLICY "Users can view own requests" ON public.adjustment_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own requests" ON public.adjustment_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view org requests" ON public.adjustment_requests FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update org requests" ON public.adjustment_requests FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- vacation_requests
CREATE POLICY "Users can view own vacations" ON public.vacation_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own vacations" ON public.vacation_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view org vacations" ON public.vacation_requests FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage org vacations" ON public.vacation_requests FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- hours_balance
CREATE POLICY "Users can view own balance" ON public.hours_balance FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own balance" ON public.hours_balance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view org balances" ON public.hours_balance FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage org balances" ON public.hours_balance FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- monthly_overtime_decisions
CREATE POLICY "Users can view own decisions" ON public.monthly_overtime_decisions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can manage org decisions" ON public.monthly_overtime_decisions FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- documents
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can manage org documents" ON public.documents FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- holidays
CREATE POLICY "Org members can view holidays" ON public.holidays FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can manage holidays" ON public.holidays FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- payroll_settings
CREATE POLICY "Org members can view payroll" ON public.payroll_settings FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can manage payroll" ON public.payroll_settings FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- location_settings
CREATE POLICY "Org members can view location" ON public.location_settings FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admins can manage location" ON public.location_settings FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- status_history
CREATE POLICY "Admins can view org history" ON public.status_history FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert history" ON public.status_history FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- ========== Storage bucket for avatars ==========
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');
