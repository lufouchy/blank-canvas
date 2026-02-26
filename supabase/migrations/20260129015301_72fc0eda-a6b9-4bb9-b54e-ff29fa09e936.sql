-- Create enum for overtime strategy
CREATE TYPE public.overtime_strategy AS ENUM ('bank', 'payment', 'mixed');

-- Create enum for bank validity period
CREATE TYPE public.bank_validity AS ENUM ('3_months', '6_months', '1_year', 'custom');

-- Create enum for mixed strategy rule type
CREATE TYPE public.mixed_rule_type AS ENUM ('hours_threshold', 'day_type');

-- Create table for payroll settings
CREATE TABLE public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_start_day integer NOT NULL DEFAULT 1 CHECK (cycle_start_day >= 1 AND cycle_start_day <= 31),
  tolerance_minutes integer NOT NULL DEFAULT 10 CHECK (tolerance_minutes >= 0 AND tolerance_minutes <= 30),
  overtime_strategy overtime_strategy NOT NULL DEFAULT 'bank',
  -- Bank of hours settings
  bank_validity bank_validity DEFAULT '6_months',
  bank_custom_months integer DEFAULT NULL,
  bank_daily_limit_hours numeric(4,2) DEFAULT 2,
  bank_compensation_ratio numeric(4,2) DEFAULT 1.0,
  bank_sunday_multiplier numeric(4,2) DEFAULT 2.0,
  bank_holiday_multiplier numeric(4,2) DEFAULT 2.0,
  -- Payment settings (percentages)
  payment_weekday_percent integer DEFAULT 50 CHECK (payment_weekday_percent >= 0),
  payment_saturday_percent integer DEFAULT 50 CHECK (payment_saturday_percent >= 0),
  payment_sunday_percent integer DEFAULT 100 CHECK (payment_sunday_percent >= 0),
  payment_holiday_percent integer DEFAULT 100 CHECK (payment_holiday_percent >= 0),
  -- Mixed settings
  mixed_rule_type mixed_rule_type DEFAULT 'hours_threshold',
  mixed_hours_threshold integer DEFAULT 20,
  mixed_bank_days text[] DEFAULT ARRAY['weekday', 'saturday'],
  mixed_payment_days text[] DEFAULT ARRAY['sunday', 'holiday'],
  -- Auto decision trigger
  auto_decision_enabled boolean DEFAULT false,
  auto_decision_threshold_hours integer DEFAULT 20,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for monthly overtime decisions
CREATE TABLE public.monthly_overtime_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  overtime_minutes integer NOT NULL DEFAULT 0,
  destination text NOT NULL DEFAULT 'bank' CHECK (destination IN ('bank', 'payment', 'mixed')),
  bank_minutes integer DEFAULT 0,
  payment_minutes integer DEFAULT 0,
  payment_amount numeric(10,2) DEFAULT 0,
  is_edited boolean DEFAULT false,
  finalized boolean DEFAULT false,
  finalized_at timestamp with time zone DEFAULT NULL,
  finalized_by uuid DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, reference_month)
);

-- Enable RLS
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_overtime_decisions ENABLE ROW LEVEL SECURITY;

-- RLS policies for payroll_settings
CREATE POLICY "Admins can manage payroll settings"
  ON public.payroll_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view payroll settings"
  ON public.payroll_settings FOR SELECT
  USING (true);

-- RLS policies for monthly_overtime_decisions
CREATE POLICY "Admins can manage overtime decisions"
  ON public.monthly_overtime_decisions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own overtime decisions"
  ON public.monthly_overtime_decisions FOR SELECT
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_overtime_decisions_updated_at
  BEFORE UPDATE ON public.monthly_overtime_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.payroll_settings (cycle_start_day, tolerance_minutes, overtime_strategy)
VALUES (1, 10, 'bank');