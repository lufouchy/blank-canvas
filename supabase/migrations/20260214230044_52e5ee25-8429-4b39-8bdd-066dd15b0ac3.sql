-- Allow anyone to check if an org_code exists (needed for login validation)
CREATE POLICY "Anyone can select org by org_code"
ON public.organizations
FOR SELECT
USING (true);
