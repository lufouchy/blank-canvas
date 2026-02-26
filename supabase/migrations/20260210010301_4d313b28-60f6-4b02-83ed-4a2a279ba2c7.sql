
-- Step 1: Only add the new enum value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'suporte';
