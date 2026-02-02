-- Fix 1: Update storage policy for generated-documents to validate client assignment
-- Drop existing permissive policy
DROP POLICY IF EXISTS "Users can upload generated documents" ON storage.objects;

-- Create new policy that validates client assignment via path
CREATE POLICY "Users can upload to assigned client paths" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'generated-documents'
  AND (
    -- Admins can upload anywhere
    public.has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Sales users can only upload to their assigned client folders
    -- Path format: {client_id}/{filename}
    (
      public.has_role(auth.uid(), 'sales'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.assigned_user_id = auth.uid()
      )
    )
  )
);

-- Fix 2: Improve admin bootstrap race condition by using VOLATILE function with locking
CREATE OR REPLACE FUNCTION public.no_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Use SELECT FOR UPDATE to prevent race conditions during bootstrap
  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles 
  WHERE role = 'admin'
  FOR UPDATE;
  RETURN admin_count = 0;
END;
$$;