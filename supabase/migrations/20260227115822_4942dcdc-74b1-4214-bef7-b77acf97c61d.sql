
-- Fix: restrict organizations INSERT to authenticated only (WITH CHECK true is acceptable for signup)
-- Fix: restrict user_roles INSERT to own user_id
DROP POLICY "Users can insert own role" ON public.user_roles;
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
