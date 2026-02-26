
-- Add sell_days column to vacation_requests for abono pecuniário
ALTER TABLE public.vacation_requests 
ADD COLUMN sell_days integer DEFAULT 0;
