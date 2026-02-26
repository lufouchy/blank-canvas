-- Add status and specification columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
ADD COLUMN IF NOT EXISTS specification text DEFAULT 'normal';

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_sector ON public.profiles(sector);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);