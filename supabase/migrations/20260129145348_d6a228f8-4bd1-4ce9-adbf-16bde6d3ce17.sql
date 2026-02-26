-- Drop the unsafe public access policy
DROP POLICY IF EXISTS "Everyone can view company info" ON public.company_info;

-- Create new policy restricting access to authenticated users only
CREATE POLICY "Authenticated users can view company info" 
ON public.company_info 
FOR SELECT 
TO authenticated 
USING (true);