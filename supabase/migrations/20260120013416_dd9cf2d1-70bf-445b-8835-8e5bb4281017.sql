
-- Create enum for document status
CREATE TYPE document_status AS ENUM ('pending_signature', 'signed', 'expired');

-- Create enum for vacation type
CREATE TYPE vacation_type AS ENUM ('individual', 'collective');

-- Create enum for absence type  
CREATE TYPE absence_type AS ENUM ('vacation', 'medical_consultation', 'medical_leave', 'justified_absence');

-- Create documents table for storing signed timesheets
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'timesheet',
  title TEXT NOT NULL,
  reference_month DATE NOT NULL,
  file_url TEXT,
  signature_data TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  status document_status NOT NULL DEFAULT 'pending_signature',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vacation_requests table
CREATE TABLE public.vacation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vacation_type vacation_type NOT NULL DEFAULT 'individual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  reason TEXT,
  status adjustment_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  is_admin_created BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Alter adjustment_requests to add new fields for different absence types
ALTER TABLE public.adjustment_requests 
ADD COLUMN IF NOT EXISTS absence_type absence_type,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS absence_dates DATE[],
ADD COLUMN IF NOT EXISTS absence_reason TEXT;

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Enable RLS on vacation_requests
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- Policies for documents
CREATE POLICY "Users can view own documents or admins all"
ON public.documents FOR SELECT
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own documents"
ON public.documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
ON public.documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all documents"
ON public.documents FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for vacation_requests
CREATE POLICY "Users can view own vacation requests or admins all"
ON public.vacation_requests FOR SELECT
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own vacation requests"
ON public.vacation_requests FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update vacation requests"
ON public.vacation_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vacation_requests_updated_at
BEFORE UPDATE ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
