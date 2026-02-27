
-- Allow anon/public users to look up organizations by org_code (needed for login flow)
CREATE POLICY "Anyone can lookup org by code"
  ON public.organizations
  FOR SELECT
  TO anon, authenticated
  USING (true);
