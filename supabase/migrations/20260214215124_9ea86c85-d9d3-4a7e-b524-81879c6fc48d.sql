
-- Add org_code column to organizations table
ALTER TABLE public.organizations ADD COLUMN org_code text UNIQUE;

-- Create index for fast uniqueness checks
CREATE INDEX idx_organizations_org_code ON public.organizations(org_code);
