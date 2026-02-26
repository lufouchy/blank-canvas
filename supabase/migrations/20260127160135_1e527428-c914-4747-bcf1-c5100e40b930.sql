-- Function to update employee status based on approved vacation requests
CREATE OR REPLACE FUNCTION public.update_profile_status_on_vacation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Check if current date is within vacation period
    IF CURRENT_DATE >= NEW.start_date AND CURRENT_DATE <= NEW.end_date THEN
      UPDATE public.profiles
      SET 
        status = 'ativo',
        specification = 'férias'
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to update employee status based on approved adjustment requests (medical leaves, etc.)
CREATE OR REPLACE FUNCTION public.update_profile_status_on_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Check if it's a medical leave type
    IF NEW.absence_type IS NOT NULL THEN
      CASE NEW.absence_type
        WHEN 'medical_leave' THEN
          UPDATE public.profiles
          SET 
            status = 'afastado',
            specification = 'licença médica - atestado'
          WHERE user_id = NEW.user_id;
        WHEN 'medical_consultation' THEN
          -- For consultations, don't change status (it's usually just a few hours)
          NULL;
        WHEN 'vacation' THEN
          UPDATE public.profiles
          SET 
            status = 'ativo',
            specification = 'férias'
          WHERE user_id = NEW.user_id;
        WHEN 'justified_absence' THEN
          UPDATE public.profiles
          SET 
            status = 'afastado',
            specification = 'folga'
          WHERE user_id = NEW.user_id;
        ELSE
          NULL;
      END CASE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to check and reset status when vacation/leave periods end
CREATE OR REPLACE FUNCTION public.check_and_reset_employee_status(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_vacation RECORD;
  active_adjustment RECORD;
  has_active_leave boolean := false;
BEGIN
  -- Check for active approved vacations
  SELECT * INTO active_vacation
  FROM public.vacation_requests
  WHERE user_id = p_user_id
    AND status = 'approved'
    AND CURRENT_DATE >= start_date
    AND CURRENT_DATE <= end_date
  LIMIT 1;
  
  IF FOUND THEN
    UPDATE public.profiles
    SET status = 'ativo', specification = 'férias'
    WHERE user_id = p_user_id;
    RETURN;
  END IF;
  
  -- Check for active approved medical leaves (using absence_dates array)
  SELECT * INTO active_adjustment
  FROM public.adjustment_requests
  WHERE user_id = p_user_id
    AND status = 'approved'
    AND absence_type IN ('medical_leave', 'justified_absence')
    AND (
      CURRENT_DATE = ANY(absence_dates)
      OR (start_time IS NOT NULL AND requested_time::date = CURRENT_DATE)
    )
  LIMIT 1;
  
  IF FOUND THEN
    IF active_adjustment.absence_type = 'medical_leave' THEN
      UPDATE public.profiles
      SET status = 'afastado', specification = 'licença médica - atestado'
      WHERE user_id = p_user_id;
    ELSE
      UPDATE public.profiles
      SET status = 'afastado', specification = 'folga'
      WHERE user_id = p_user_id;
    END IF;
    RETURN;
  END IF;
  
  -- No active leaves, check if status should be reset to normal
  -- Only reset if current status is related to vacation/leave
  UPDATE public.profiles
  SET status = 'ativo', specification = 'normal'
  WHERE user_id = p_user_id
    AND specification IN ('férias', 'licença médica - atestado', 'folga', 'licença médica - INSS', 'licença maternidade', 'licença paternidade');
END;
$$;

-- Create trigger for vacation_requests
DROP TRIGGER IF EXISTS trigger_update_status_on_vacation ON public.vacation_requests;
CREATE TRIGGER trigger_update_status_on_vacation
  AFTER UPDATE ON public.vacation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_status_on_vacation();

-- Create trigger for adjustment_requests
DROP TRIGGER IF EXISTS trigger_update_status_on_adjustment ON public.adjustment_requests;
CREATE TRIGGER trigger_update_status_on_adjustment
  AFTER UPDATE ON public.adjustment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_status_on_adjustment();