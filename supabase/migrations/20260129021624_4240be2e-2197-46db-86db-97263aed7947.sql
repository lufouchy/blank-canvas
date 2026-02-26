-- Create holidays table
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('national', 'state', 'municipal', 'custom')),
  state_code TEXT,
  city_name TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (date, name, type, state_code, city_name)
);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view holidays" 
ON public.holidays 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage holidays" 
ON public.holidays 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_holidays_updated_at
BEFORE UPDATE ON public.holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert Brazilian national holidays (fixed dates)
INSERT INTO public.holidays (name, date, type, is_custom) VALUES
  ('Confraternização Universal', '2026-01-01', 'national', false),
  ('Tiradentes', '2026-04-21', 'national', false),
  ('Dia do Trabalho', '2026-05-01', 'national', false),
  ('Independência do Brasil', '2026-09-07', 'national', false),
  ('Nossa Senhora Aparecida', '2026-10-12', 'national', false),
  ('Finados', '2026-11-02', 'national', false),
  ('Proclamação da República', '2026-11-15', 'national', false),
  ('Natal', '2026-12-25', 'national', false),
  -- 2026 movable holidays
  ('Carnaval', '2026-02-17', 'national', false),
  ('Quarta-feira de Cinzas', '2026-02-18', 'national', false),
  ('Sexta-feira Santa', '2026-04-03', 'national', false),
  ('Corpus Christi', '2026-06-04', 'national', false);