-- FIX 1: Restrict profile visibility to protect email addresses
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Create a secure function to get assignable users (only id and name, no email)
CREATE OR REPLACE FUNCTION public.get_assignable_users()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name
  FROM public.profiles p
  WHERE p.is_active = true
$$;

-- FIX 2: Add INSERT policy for sales users on client_custom_values
CREATE POLICY "Sales can insert custom values for assigned clients"
ON public.client_custom_values
FOR INSERT
WITH CHECK (
  -- Sales user must have the sales role
  has_role(auth.uid(), 'sales')
  AND
  -- Client must be assigned to this sales user
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_custom_values.client_id
    AND clients.assigned_user_id = auth.uid()
  )
  AND
  -- Custom field must be editable (not admin_only)
  EXISTS (
    SELECT 1 FROM public.custom_fields
    WHERE custom_fields.id = client_custom_values.custom_field_id
    AND custom_fields.visibility IN ('editable', 'read_only')
  )
);

-- Add DELETE policy for sales users on client_custom_values
CREATE POLICY "Sales can delete custom values for assigned clients"
ON public.client_custom_values
FOR DELETE
USING (
  has_role(auth.uid(), 'sales')
  AND EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_custom_values.client_id
    AND clients.assigned_user_id = auth.uid()
  )
);