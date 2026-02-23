
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
DROP POLICY IF EXISTS "Sales can view assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Sales can update assigned clients" ON public.clients;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all clients"
ON public.clients FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales can view assigned clients"
ON public.clients FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'sales'::app_role) AND assigned_user_id = auth.uid());

CREATE POLICY "Sales can update assigned clients"
ON public.clients FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'sales'::app_role) AND assigned_user_id = auth.uid());
