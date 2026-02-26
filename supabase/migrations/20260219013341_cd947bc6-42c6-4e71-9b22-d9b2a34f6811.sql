-- Add new absence types to the enum
ALTER TYPE public.absence_type ADD VALUE IF NOT EXISTS 'maternity_leave';
ALTER TYPE public.absence_type ADD VALUE IF NOT EXISTS 'paternity_leave';
ALTER TYPE public.absence_type ADD VALUE IF NOT EXISTS 'unjustified_absence';
ALTER TYPE public.absence_type ADD VALUE IF NOT EXISTS 'work_accident';
ALTER TYPE public.absence_type ADD VALUE IF NOT EXISTS 'punitive_suspension';
ALTER TYPE public.absence_type ADD VALUE IF NOT EXISTS 'day_off';
