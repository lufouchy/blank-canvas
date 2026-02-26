-- Add schedule flexibility settings to payroll_settings (global config)
ALTER TABLE public.payroll_settings
ADD COLUMN IF NOT EXISTS schedule_flexibility_mode text NOT NULL DEFAULT 'tolerance',
ADD COLUMN IF NOT EXISTS tolerance_entry_minutes integer NOT NULL DEFAULT 10;

-- Create table for temporary schedule adjustments
CREATE TABLE public.schedule_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  adjustment_type text NOT NULL DEFAULT 'temporary_change', -- 'temporary_change' or 'overtime_authorization'
  start_date date NOT NULL,
  end_date date NOT NULL,
  custom_start_time time without time zone,
  custom_end_time time without time zone,
  custom_break_start time without time zone,
  custom_break_end time without time zone,
  overtime_authorized boolean NOT NULL DEFAULT false,
  overtime_max_minutes integer,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org schedule adjustments"
ON public.schedule_adjustments FOR ALL
USING (
  (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Suporte full access schedule adjustments"
ON public.schedule_adjustments FOR ALL
USING (is_suporte(auth.uid()));

CREATE POLICY "Users can view own schedule adjustments"
ON public.schedule_adjustments FOR SELECT
USING (
  auth.uid() = user_id OR
  (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR
  is_suporte(auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_schedule_adjustments_updated_at
BEFORE UPDATE ON public.schedule_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.payroll_settings.schedule_flexibility_mode IS 'tolerance = Option 1, fixed = Option 2, hours_only = Option 3';
COMMENT ON COLUMN public.payroll_settings.tolerance_entry_minutes IS 'Minutes of tolerance for early/late arrival (Option 1 only, max 60)';