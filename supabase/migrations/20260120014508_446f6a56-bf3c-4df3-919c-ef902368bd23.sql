
-- Allow admins to delete documents
CREATE POLICY "Admins can delete documents"
ON public.documents FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
