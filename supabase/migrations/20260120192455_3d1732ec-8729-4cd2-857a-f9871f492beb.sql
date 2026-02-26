-- Add sector and position columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sector TEXT,
ADD COLUMN IF NOT EXISTS position TEXT;