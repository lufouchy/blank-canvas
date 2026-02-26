
-- Add attachment_url column to adjustment_requests
ALTER TABLE public.adjustment_requests ADD COLUMN attachment_url text;

-- Create storage bucket for request attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('request-attachments', 'request-attachments', false);

-- RLS policies for request-attachments bucket
-- Users can upload their own attachments
CREATE POLICY "Users can upload own request attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'request-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own attachments
CREATE POLICY "Users can view own request attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'request-attachments' AND (
  auth.uid()::text = (storage.foldername(name))[1]
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_suporte(auth.uid())
));

-- Admins can view all attachments in their org (handled via folder structure)
CREATE POLICY "Users can delete own request attachments"
ON storage.objects
FOR DELETE
USING (bucket_id = 'request-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
