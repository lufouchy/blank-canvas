-- Add location settings columns to profiles table (per-employee location configuration)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS location_mode text NOT NULL DEFAULT 'disabled',
ADD COLUMN IF NOT EXISTS work_address_cep text NULL,
ADD COLUMN IF NOT EXISTS work_address_street text NULL,
ADD COLUMN IF NOT EXISTS work_address_number text NULL,
ADD COLUMN IF NOT EXISTS work_address_complement text NULL,
ADD COLUMN IF NOT EXISTS work_address_neighborhood text NULL,
ADD COLUMN IF NOT EXISTS work_address_city text NULL,
ADD COLUMN IF NOT EXISTS work_address_state text NULL,
ADD COLUMN IF NOT EXISTS allowed_radius_meters integer NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS work_latitude numeric NULL,
ADD COLUMN IF NOT EXISTS work_longitude numeric NULL;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.profiles.location_mode IS 'Location validation mode: disabled, log_only, require_exact, require_radius';
COMMENT ON COLUMN public.profiles.work_address_cep IS 'Work location ZIP code for this employee';
COMMENT ON COLUMN public.profiles.allowed_radius_meters IS 'Allowed radius in meters from work address';