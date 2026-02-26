
-- Allow admins to update their own organization (needed for setting org_code)
CREATE POLICY "Admins can update own organization"
ON public.organizations
FOR UPDATE
USING (id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
