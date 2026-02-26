-- Update the profile status trigger to handle new absence types
CREATE OR REPLACE FUNCTION public.update_profile_status_on_adjustment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    IF NEW.absence_type IS NOT NULL THEN
      CASE NEW.absence_type
        WHEN 'medical_leave' THEN
          UPDATE public.profiles SET status = 'afastado', specification = 'licença médica - atestado' WHERE user_id = NEW.user_id;
        WHEN 'medical_consultation' THEN
          NULL;
        WHEN 'vacation' THEN
          UPDATE public.profiles SET status = 'ativo', specification = 'férias' WHERE user_id = NEW.user_id;
        WHEN 'justified_absence' THEN
          UPDATE public.profiles SET status = 'afastado', specification = 'folga' WHERE user_id = NEW.user_id;
        WHEN 'maternity_leave' THEN
          UPDATE public.profiles SET status = 'afastado', specification = 'licença maternidade' WHERE user_id = NEW.user_id;
        WHEN 'paternity_leave' THEN
          UPDATE public.profiles SET status = 'afastado', specification = 'licença paternidade' WHERE user_id = NEW.user_id;
        WHEN 'unjustified_absence' THEN
          UPDATE public.profiles SET status = 'ativo', specification = 'falta' WHERE user_id = NEW.user_id;
        WHEN 'work_accident' THEN
          UPDATE public.profiles SET status = 'afastado', specification = 'acidente de trabalho' WHERE user_id = NEW.user_id;
        WHEN 'punitive_suspension' THEN
          UPDATE public.profiles SET status = 'afastado', specification = 'suspensão' WHERE user_id = NEW.user_id;
        WHEN 'day_off' THEN
          UPDATE public.profiles SET status = 'afastado', specification = 'folga' WHERE user_id = NEW.user_id;
        WHEN 'bereavement_leave' THEN
          UPDATE public.profiles SET status = 'afastado', specification = 'falecimento familiar' WHERE user_id = NEW.user_id;
        ELSE
          NULL;
      END CASE;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update check_and_reset to handle new types
CREATE OR REPLACE FUNCTION public.check_and_reset_employee_status(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  active_vacation RECORD;
  active_adjustment RECORD;
BEGIN
  SELECT * INTO active_vacation
  FROM public.vacation_requests
  WHERE user_id = p_user_id AND status = 'approved'
    AND CURRENT_DATE >= start_date AND CURRENT_DATE <= end_date
  LIMIT 1;
  
  IF FOUND THEN
    UPDATE public.profiles SET status = 'ativo', specification = 'férias' WHERE user_id = p_user_id;
    RETURN;
  END IF;
  
  SELECT * INTO active_adjustment
  FROM public.adjustment_requests
  WHERE user_id = p_user_id AND status = 'approved'
    AND absence_type IN ('medical_leave', 'justified_absence', 'maternity_leave', 'paternity_leave', 'work_accident', 'punitive_suspension', 'day_off', 'bereavement_leave', 'unjustified_absence')
    AND (CURRENT_DATE = ANY(absence_dates) OR (start_time IS NOT NULL AND requested_time::date = CURRENT_DATE))
  LIMIT 1;
  
  IF FOUND THEN
    CASE active_adjustment.absence_type
      WHEN 'medical_leave' THEN UPDATE public.profiles SET status = 'afastado', specification = 'licença médica - atestado' WHERE user_id = p_user_id;
      WHEN 'justified_absence' THEN UPDATE public.profiles SET status = 'afastado', specification = 'folga' WHERE user_id = p_user_id;
      WHEN 'maternity_leave' THEN UPDATE public.profiles SET status = 'afastado', specification = 'licença maternidade' WHERE user_id = p_user_id;
      WHEN 'paternity_leave' THEN UPDATE public.profiles SET status = 'afastado', specification = 'licença paternidade' WHERE user_id = p_user_id;
      WHEN 'work_accident' THEN UPDATE public.profiles SET status = 'afastado', specification = 'acidente de trabalho' WHERE user_id = p_user_id;
      WHEN 'punitive_suspension' THEN UPDATE public.profiles SET status = 'afastado', specification = 'suspensão' WHERE user_id = p_user_id;
      WHEN 'day_off' THEN UPDATE public.profiles SET status = 'afastado', specification = 'folga' WHERE user_id = p_user_id;
      WHEN 'bereavement_leave' THEN UPDATE public.profiles SET status = 'afastado', specification = 'falecimento familiar' WHERE user_id = p_user_id;
      WHEN 'unjustified_absence' THEN UPDATE public.profiles SET status = 'ativo', specification = 'falta' WHERE user_id = p_user_id;
      ELSE NULL;
    END CASE;
    RETURN;
  END IF;
  
  UPDATE public.profiles SET status = 'ativo', specification = 'normal'
  WHERE user_id = p_user_id
    AND specification IN ('férias', 'licença médica - atestado', 'folga', 'licença médica - INSS', 'licença maternidade', 'licença paternidade', 'acidente de trabalho', 'suspensão', 'falta', 'falecimento familiar');
END;
$function$;
