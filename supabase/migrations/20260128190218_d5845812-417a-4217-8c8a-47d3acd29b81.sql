-- Create enum for business sectors
CREATE TYPE public.business_sector AS ENUM (
  'tecnologia',
  'varejo',
  'industria',
  'servicos',
  'saude',
  'educacao',
  'financeiro',
  'construcao',
  'agronegocio',
  'logistica',
  'alimentacao',
  'outro'
);

-- Create enum for admin positions
CREATE TYPE public.admin_position AS ENUM (
  'rh',
  'dono',
  'gerente',
  'diretor',
  'coordenador'
);

-- Create company_info table for institutional data
CREATE TABLE public.company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  business_sector public.business_sector NOT NULL DEFAULT 'outro',
  
  -- Address
  address_cep TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  
  -- Contact
  phone TEXT,
  whatsapp TEXT,
  financial_email TEXT,
  
  has_branches BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company_branches table for branch offices
CREATE TABLE public.company_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company_info(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  
  -- Address
  address_cep TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  
  -- Contact
  phone TEXT,
  whatsapp TEXT,
  financial_email TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company_admins table for legal representatives (max 4)
CREATE TABLE public.company_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company_info(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  email TEXT NOT NULL,
  position public.admin_position NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_admins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_info
CREATE POLICY "Admins can manage company info"
ON public.company_info
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view company info"
ON public.company_info
FOR SELECT
USING (true);

-- RLS Policies for company_branches
CREATE POLICY "Admins can manage branches"
ON public.company_branches
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view branches"
ON public.company_branches
FOR SELECT
USING (true);

-- RLS Policies for company_admins
CREATE POLICY "Admins can manage company admins"
ON public.company_admins
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view company admins"
ON public.company_admins
FOR SELECT
USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_company_info_updated_at
BEFORE UPDATE ON public.company_info
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_branches_updated_at
BEFORE UPDATE ON public.company_branches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_admins_updated_at
BEFORE UPDATE ON public.company_admins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();