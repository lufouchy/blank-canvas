-- Add work location fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN work_location_type text NOT NULL DEFAULT 'sede',
ADD COLUMN branch_id uuid REFERENCES public.company_branches(id) ON DELETE SET NULL;

-- Add constraint to ensure valid work location type
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_work_location_type CHECK (work_location_type IN ('sede', 'filial'));

-- Create index for branch lookups
CREATE INDEX idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX idx_profiles_work_location_type ON public.profiles(work_location_type);