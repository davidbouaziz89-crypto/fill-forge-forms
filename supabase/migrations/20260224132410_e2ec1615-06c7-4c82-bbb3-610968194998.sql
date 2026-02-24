
-- Drop existing restrictive sales policies on clients
DROP POLICY IF EXISTS "Sales can view assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Sales can update assigned clients" ON public.clients;

-- Create permissive policies for sales to access ALL clients
CREATE POLICY "Sales can view all clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'sales'::app_role));

CREATE POLICY "Sales can update assigned clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'sales'::app_role) AND assigned_user_id = auth.uid());
