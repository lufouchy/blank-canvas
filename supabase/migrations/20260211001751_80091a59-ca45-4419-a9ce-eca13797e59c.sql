
-- =============================================
-- MULTI-TENANT MIGRATION - Part 2
-- =============================================

-- 1. Create organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Create a default organization for existing data
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Organização Padrão', 'default');

-- 3. Add organization_id to ALL tables
ALTER TABLE public.profiles ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.time_records ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.adjustment_requests ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.vacation_requests ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.documents ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.holidays ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.work_schedules ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.hours_balance ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.company_info ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.company_branches ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.company_admins ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.payroll_settings ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.location_settings ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.monthly_overtime_decisions ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.status_history ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.user_roles ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- 4. Assign existing data to default organization
UPDATE public.profiles SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.time_records SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.adjustment_requests SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.vacation_requests SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.documents SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.holidays SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.work_schedules SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.hours_balance SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.company_info SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.company_branches SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.company_admins SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.payroll_settings SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.location_settings SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.monthly_overtime_decisions SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.status_history SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.user_roles SET organization_id = '00000000-0000-0000-0000-000000000001';

-- 5. Make organization_id NOT NULL
ALTER TABLE public.profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.time_records ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.adjustment_requests ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.vacation_requests ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.holidays ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.work_schedules ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.hours_balance ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.company_info ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.company_branches ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.company_admins ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.payroll_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.location_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.monthly_overtime_decisions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.status_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN organization_id SET NOT NULL;

-- 6. Helper functions
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_suporte(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'suporte'
  )
$$;

-- 7. Indexes
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX idx_time_records_org ON public.time_records(organization_id);
CREATE INDEX idx_adjustment_requests_org ON public.adjustment_requests(organization_id);
CREATE INDEX idx_vacation_requests_org ON public.vacation_requests(organization_id);
CREATE INDEX idx_documents_org ON public.documents(organization_id);
CREATE INDEX idx_holidays_org ON public.holidays(organization_id);
CREATE INDEX idx_work_schedules_org ON public.work_schedules(organization_id);
CREATE INDEX idx_hours_balance_org ON public.hours_balance(organization_id);
CREATE INDEX idx_company_info_org ON public.company_info(organization_id);
CREATE INDEX idx_company_branches_org ON public.company_branches(organization_id);
CREATE INDEX idx_company_admins_org ON public.company_admins(organization_id);
CREATE INDEX idx_payroll_settings_org ON public.payroll_settings(organization_id);
CREATE INDEX idx_location_settings_org ON public.location_settings(organization_id);
CREATE INDEX idx_monthly_overtime_org ON public.monthly_overtime_decisions(organization_id);
CREATE INDEX idx_status_history_org ON public.status_history(organization_id);
CREATE INDEX idx_user_roles_org ON public.user_roles(organization_id);

-- =============================================
-- 8. DROP ALL EXISTING RLS POLICIES & RECREATE
-- =============================================

-- === ORGANIZATIONS ===
CREATE POLICY "Users can view own organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_user_org_id(auth.uid()) OR public.is_suporte(auth.uid()));

CREATE POLICY "Suporte can manage all organizations"
  ON public.organizations FOR ALL
  USING (public.is_suporte(auth.uid()));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- === PROFILES ===
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can view org profiles"
  ON public.profiles FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update org profiles"
  ON public.profiles FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow insert for authenticated users"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete org profiles"
  ON public.profiles FOR DELETE
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access profiles"
  ON public.profiles FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === USER_ROLES ===
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view org roles"
  ON public.user_roles FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_suporte(auth.uid()));

CREATE POLICY "Users can insert own role on signup"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage org roles"
  ON public.user_roles FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access roles"
  ON public.user_roles FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === TIME_RECORDS ===
DROP POLICY IF EXISTS "Users can insert own records" ON public.time_records;
DROP POLICY IF EXISTS "Users can view own records" ON public.time_records;

CREATE POLICY "Users can insert own records"
  ON public.time_records FOR INSERT
  WITH CHECK (auth.uid() = user_id AND organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view own records"
  ON public.time_records FOR SELECT
  USING (auth.uid() = user_id OR (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin')) OR public.is_suporte(auth.uid()));

-- === ADJUSTMENT_REQUESTS ===
DROP POLICY IF EXISTS "Users can create own requests" ON public.adjustment_requests;
DROP POLICY IF EXISTS "Users can view own requests or admins all" ON public.adjustment_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.adjustment_requests;

CREATE POLICY "Users can create own requests"
  ON public.adjustment_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view own or admins org requests"
  ON public.adjustment_requests FOR SELECT
  USING (auth.uid() = user_id OR (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin')) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can update org requests"
  ON public.adjustment_requests FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access adjustment"
  ON public.adjustment_requests FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === VACATION_REQUESTS ===
DROP POLICY IF EXISTS "Users can insert own vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Users can view own vacation requests or admins all" ON public.vacation_requests;
DROP POLICY IF EXISTS "Admins can update vacation requests" ON public.vacation_requests;

CREATE POLICY "Users can insert own vacation requests"
  ON public.vacation_requests FOR INSERT
  WITH CHECK ((auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')) AND organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can view own or admins org vacations"
  ON public.vacation_requests FOR SELECT
  USING (auth.uid() = user_id OR (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin')) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can update org vacations"
  ON public.vacation_requests FOR UPDATE
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access vacations"
  ON public.vacation_requests FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === DOCUMENTS ===
DROP POLICY IF EXISTS "Users can view own documents or admins all" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;

CREATE POLICY "Users can view own or admins org documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id OR (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin')) OR public.is_suporte(auth.uid()));

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id AND organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage org documents"
  ON public.documents FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access documents"
  ON public.documents FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === HOURS_BALANCE ===
DROP POLICY IF EXISTS "Users can view own balance or admins all" ON public.hours_balance;
DROP POLICY IF EXISTS "Users can insert own balance on signup" ON public.hours_balance;
DROP POLICY IF EXISTS "System can manage balances" ON public.hours_balance;

CREATE POLICY "Users can view own or admins org balance"
  ON public.hours_balance FOR SELECT
  USING (auth.uid() = user_id OR (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin')) OR public.is_suporte(auth.uid()));

CREATE POLICY "Users can insert own balance on signup"
  ON public.hours_balance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage org balances"
  ON public.hours_balance FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access balances"
  ON public.hours_balance FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === WORK_SCHEDULES ===
DROP POLICY IF EXISTS "Users can view their assigned schedule" ON public.work_schedules;
DROP POLICY IF EXISTS "Admins can manage schedules" ON public.work_schedules;

CREATE POLICY "Users can view org schedules"
  ON public.work_schedules FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can manage org schedules"
  ON public.work_schedules FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access schedules"
  ON public.work_schedules FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === HOLIDAYS ===
DROP POLICY IF EXISTS "Everyone can view holidays" ON public.holidays;
DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;

CREATE POLICY "Users can view org holidays"
  ON public.holidays FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can manage org holidays"
  ON public.holidays FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access holidays"
  ON public.holidays FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === COMPANY_INFO ===
DROP POLICY IF EXISTS "Only admins can view company info" ON public.company_info;
DROP POLICY IF EXISTS "Admins can manage company info" ON public.company_info;
DROP POLICY IF EXISTS "Employees can view basic company info for documents" ON public.company_info;

CREATE POLICY "Users can view org company info"
  ON public.company_info FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can manage org company info"
  ON public.company_info FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access company info"
  ON public.company_info FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === COMPANY_BRANCHES ===
DROP POLICY IF EXISTS "Users can view basic branch info" ON public.company_branches;
DROP POLICY IF EXISTS "Admins can manage branches" ON public.company_branches;

CREATE POLICY "Users can view org branches"
  ON public.company_branches FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can manage org branches"
  ON public.company_branches FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access branches"
  ON public.company_branches FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === COMPANY_ADMINS ===
DROP POLICY IF EXISTS "Only admins can view company admins" ON public.company_admins;
DROP POLICY IF EXISTS "Admins can manage company admins" ON public.company_admins;

CREATE POLICY "Admins can view org company admins"
  ON public.company_admins FOR SELECT
  USING ((organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin')) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can manage org company admins"
  ON public.company_admins FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access company admins"
  ON public.company_admins FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === PAYROLL_SETTINGS ===
DROP POLICY IF EXISTS "Only admins can view payroll settings" ON public.payroll_settings;
DROP POLICY IF EXISTS "Admins can manage payroll settings" ON public.payroll_settings;

CREATE POLICY "Admins can view org payroll"
  ON public.payroll_settings FOR SELECT
  USING ((organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin')) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can manage org payroll"
  ON public.payroll_settings FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access payroll"
  ON public.payroll_settings FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === LOCATION_SETTINGS ===
DROP POLICY IF EXISTS "Authenticated users can view location settings" ON public.location_settings;
DROP POLICY IF EXISTS "Admins can manage location settings" ON public.location_settings;

CREATE POLICY "Users can view org location settings"
  ON public.location_settings FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can manage org location settings"
  ON public.location_settings FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access location"
  ON public.location_settings FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === MONTHLY_OVERTIME_DECISIONS ===
DROP POLICY IF EXISTS "Users can view own overtime decisions" ON public.monthly_overtime_decisions;
DROP POLICY IF EXISTS "Admins can manage overtime decisions" ON public.monthly_overtime_decisions;

CREATE POLICY "Users can view own or admins org overtime"
  ON public.monthly_overtime_decisions FOR SELECT
  USING (auth.uid() = user_id OR (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin')) OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can manage org overtime"
  ON public.monthly_overtime_decisions FOR ALL
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access overtime"
  ON public.monthly_overtime_decisions FOR ALL
  USING (public.is_suporte(auth.uid()));

-- === STATUS_HISTORY ===
DROP POLICY IF EXISTS "Users can view own status history" ON public.status_history;
DROP POLICY IF EXISTS "Admins can view all status history" ON public.status_history;
DROP POLICY IF EXISTS "Admins can insert status history" ON public.status_history;

CREATE POLICY "Users can view own status history"
  ON public.status_history FOR SELECT
  USING (auth.uid() = user_id OR public.is_suporte(auth.uid()));

CREATE POLICY "Admins can view org status history"
  ON public.status_history FOR SELECT
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert org status history"
  ON public.status_history FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Suporte full access status history"
  ON public.status_history FOR ALL
  USING (public.is_suporte(auth.uid()));

-- 9. Add updated_at trigger for organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
