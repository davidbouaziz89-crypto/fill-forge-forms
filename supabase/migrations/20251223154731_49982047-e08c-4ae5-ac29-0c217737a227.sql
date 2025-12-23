-- Allow Sales to delete documents for their assigned clients
CREATE POLICY "Sales can delete documents for assigned clients"
ON public.generated_documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = generated_documents.client_id
    AND clients.assigned_user_id = auth.uid()
  )
);

-- Add storage policy for deleting files from generated-documents bucket
CREATE POLICY "Users can delete their own generated documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'generated-documents' 
  AND (
    -- Admins can delete any file
    has_role(auth.uid(), 'admin')
    OR
    -- Sales can delete files for their assigned clients (based on path pattern)
    EXISTS (
      SELECT 1 FROM generated_documents gd
      JOIN clients c ON c.id = gd.client_id
      WHERE gd.generated_pdf_storage_path = name
      AND c.assigned_user_id = auth.uid()
    )
  )
);