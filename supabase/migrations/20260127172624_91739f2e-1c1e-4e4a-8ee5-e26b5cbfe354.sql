-- Create table for status history
CREATE TABLE public.status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  previous_specification TEXT,
  new_specification TEXT,
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view all status history"
ON public.status_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert status history"
ON public.status_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own status history"
ON public.status_history
FOR SELECT
USING (auth.uid() = user_id);

-- Create trigger function to log status changes
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if status or specification changed
  IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.specification IS DISTINCT FROM NEW.specification) THEN
    INSERT INTO public.status_history (
      user_id,
      previous_status,
      new_status,
      previous_specification,
      new_specification,
      changed_by
    ) VALUES (
      NEW.user_id,
      OLD.status,
      NEW.status,
      OLD.specification,
      NEW.specification,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
CREATE TRIGGER on_profile_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();