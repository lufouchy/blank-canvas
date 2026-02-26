-- Fix security issues: Restrict access to sensitive tables

-- 1. Fix company_admins: Remove public SELECT access, restrict to admins only
DROP POLICY IF EXISTS "Authenticated users can view company admins" ON public.company_admins;

-- 2. Fix company_info: Remove public SELECT access, restrict to admins only  
DROP POLICY IF EXISTS "Authenticated users can view company info" ON public.company_info;

-- 3. Create restricted SELECT policies for company_admins (admins only)
CREATE POLICY "Only admins can view company admins"
ON public.company_admins
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create restricted SELECT policies for company_info (admins only)
CREATE POLICY "Only admins can view company info"
ON public.company_info
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Note: profiles table already has proper RLS policies:
-- - Users can only view their own profile (auth.uid() = user_id)
-- - Admins can view all profiles (has_role check)
-- This is the correct pattern for an HR system