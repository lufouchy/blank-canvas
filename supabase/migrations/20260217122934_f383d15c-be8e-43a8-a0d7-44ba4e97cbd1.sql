-- Update password for admin@empresa.com directly using Supabase auth admin
-- We'll use a temporary function to update the password
SELECT auth.uid(); -- just checking
