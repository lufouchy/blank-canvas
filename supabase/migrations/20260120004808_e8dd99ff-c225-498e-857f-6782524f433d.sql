-- Fix RLS policies to allow users to insert their own data on signup

-- Allow users to insert their own role during signup
CREATE POLICY "Users can insert own role on signup"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own hours balance on signup
CREATE POLICY "Users can insert own balance on signup"
ON public.hours_balance
FOR INSERT
WITH CHECK (auth.uid() = user_id);