-- Add break time columns to work_schedules (optional fields)
ALTER TABLE public.work_schedules 
ADD COLUMN break_start_time time without time zone DEFAULT NULL,
ADD COLUMN break_end_time time without time zone DEFAULT NULL;

-- Drop the lunch_duration_minutes column as it will be replaced by break times
ALTER TABLE public.work_schedules 
DROP COLUMN lunch_duration_minutes;