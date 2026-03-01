-- Allow suporte users to update their own user_roles row (needed for org switching)
CREATE POLICY "Suporte can update own role"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'suporte'
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND role = 'suporte'
);