
-- Create storage bucket for signed timesheet documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('timesheet-documents', 'timesheet-documents', true);

-- Allow users to view their own documents
CREATE POLICY "Users can view own timesheet documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'timesheet-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to upload their own documents
CREATE POLICY "Users can upload own timesheet documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'timesheet-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to view all documents
CREATE POLICY "Admins can view all timesheet documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'timesheet-documents' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
