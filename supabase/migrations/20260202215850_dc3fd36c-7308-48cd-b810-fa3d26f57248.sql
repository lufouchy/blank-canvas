-- Allow employees to view basic company info for PDF generation
CREATE POLICY "Employees can view basic company info for documents"
ON public.company_info
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);