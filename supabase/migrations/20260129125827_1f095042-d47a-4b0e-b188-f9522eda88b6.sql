-- Remove the public SELECT policy that exposes sensitive data
DROP POLICY IF EXISTS "Everyone can view company admins" ON public.company_admins;

-- Create a new policy that restricts SELECT to authenticated users only
CREATE POLICY "Authenticated users can view company admins" 
ON public.company_admins 
FOR SELECT 
TO authenticated
USING (true);