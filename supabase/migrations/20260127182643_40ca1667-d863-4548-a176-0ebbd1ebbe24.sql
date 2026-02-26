-- Add schedule configuration fields to work_schedules
ALTER TABLE public.work_schedules 
ADD COLUMN schedule_type text NOT NULL DEFAULT 'weekly',
ADD COLUMN monday_hours numeric DEFAULT 8,
ADD COLUMN tuesday_hours numeric DEFAULT 8,
ADD COLUMN wednesday_hours numeric DEFAULT 8,
ADD COLUMN thursday_hours numeric DEFAULT 8,
ADD COLUMN friday_hours numeric DEFAULT 8,
ADD COLUMN saturday_hours numeric DEFAULT 0,
ADD COLUMN sunday_hours numeric DEFAULT 0,
ADD COLUMN shift_work_hours integer DEFAULT NULL,
ADD COLUMN shift_rest_hours integer DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.work_schedules.schedule_type IS 'Type of schedule: weekly (fixed days) or shift (rotating like 12x36)';
COMMENT ON COLUMN public.work_schedules.monday_hours IS 'Hours worked on Monday (0 = day off, null for shift schedules)';
COMMENT ON COLUMN public.work_schedules.shift_work_hours IS 'Hours of work in shift schedules (e.g., 12 for 12x36)';
COMMENT ON COLUMN public.work_schedules.shift_rest_hours IS 'Hours of rest in shift schedules (e.g., 36 for 12x36)';