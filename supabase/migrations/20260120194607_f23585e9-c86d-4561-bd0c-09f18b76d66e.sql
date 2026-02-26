-- Create location_settings table
CREATE TABLE public.location_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_mode text NOT NULL DEFAULT 'disabled' CHECK (location_mode IN ('disabled', 'log_only', 'require_exact', 'require_radius')),
  address_cep text DEFAULT NULL,
  address_street text DEFAULT NULL,
  address_number text DEFAULT NULL,
  address_complement text DEFAULT NULL,
  address_neighborhood text DEFAULT NULL,
  address_city text DEFAULT NULL,
  address_state text DEFAULT NULL,
  allowed_radius_meters integer DEFAULT 100,
  company_latitude numeric DEFAULT NULL,
  company_longitude numeric DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.location_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage location settings
CREATE POLICY "Admins can manage location settings"
ON public.location_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can view location settings (needed for validation)
CREATE POLICY "Everyone can view location settings"
ON public.location_settings
FOR SELECT
USING (true);

-- Insert default row
INSERT INTO public.location_settings (location_mode) VALUES ('disabled');

-- Create trigger for updated_at
CREATE TRIGGER update_location_settings_updated_at
BEFORE UPDATE ON public.location_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();