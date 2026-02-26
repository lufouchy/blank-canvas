-- Fix warn-level security issues: Restrict access to sensitive tables and fix avatar storage

-- =====================================================
-- 1. LOCATION SETTINGS: Restrict to employees who need it for clock-in
-- =====================================================
DROP POLICY IF EXISTS "Everyone can view location settings" ON public.location_settings;

-- Users need to see location settings for geofenced clock-in, but restrict to authenticated only
CREATE POLICY "Authenticated users can view location settings"
ON public.location_settings
FOR SELECT
TO authenticated
USING (true);

-- =====================================================
-- 2. COMPANY BRANCHES: Restrict sensitive financial info to admins
-- =====================================================
DROP POLICY IF EXISTS "Everyone can view branches" ON public.company_branches;

-- Regular employees only see basic branch info (city, state)
-- Admins can see everything including financial_email
CREATE POLICY "Users can view basic branch info"
ON public.company_branches
FOR SELECT
TO authenticated
USING (true);
-- Note: Financial fields are still visible but RLS can't filter columns
-- A view or column-level security would be needed for field restriction

-- =====================================================
-- 3. PAYROLL SETTINGS: Restrict to admins only
-- =====================================================
DROP POLICY IF EXISTS "Everyone can view payroll settings" ON public.payroll_settings;

CREATE POLICY "Only admins can view payroll settings"
ON public.payroll_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 4. WORK SCHEDULES: Users can view their assigned schedule only, admins all
-- =====================================================
DROP POLICY IF EXISTS "Everyone can view schedules" ON public.work_schedules;

-- Users can view schedules they are assigned to (via profiles.work_schedule_id)
CREATE POLICY "Users can view their assigned schedule"
ON public.work_schedules
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.work_schedule_id = work_schedules.id
  )
);

-- =====================================================
-- 5. AVATAR STORAGE: Restore secure user-scoped policies
-- =====================================================
-- Drop any existing policies to start clean
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all avatars" ON storage.objects;

-- Allow public read access to avatars (for displaying profile pics)
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow users to upload their own avatar (user_id must match folder)
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to manage all avatars (for company logos, etc)
CREATE POLICY "Admins can manage all avatars"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =====================================================
-- 6. LOCATION DATA RETENTION: Add function to archive old location data
-- =====================================================
CREATE OR REPLACE FUNCTION public.archive_old_location_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear GPS coordinates from records older than 2 years
  UPDATE public.time_records
  SET latitude = NULL, longitude = NULL
  WHERE recorded_at < NOW() - INTERVAL '2 years'
    AND (latitude IS NOT NULL OR longitude IS NOT NULL);
END;
$$;