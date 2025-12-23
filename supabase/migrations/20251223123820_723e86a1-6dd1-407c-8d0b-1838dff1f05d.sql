-- Create a function to check if any admin exists
CREATE OR REPLACE FUNCTION public.no_admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  )
$$;

-- Add policy to allow first admin bootstrap
CREATE POLICY "Allow first admin bootstrap"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.no_admin_exists() AND role = 'admin' AND user_id = auth.uid()
);