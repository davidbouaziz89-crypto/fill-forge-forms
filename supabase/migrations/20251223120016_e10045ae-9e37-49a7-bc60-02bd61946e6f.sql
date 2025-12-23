-- Add missing columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS siret TEXT,
ADD COLUMN IF NOT EXISTS code_naf TEXT,
ADD COLUMN IF NOT EXISTS type_client TEXT DEFAULT 'entreprise';

-- Add comment for type_client values
COMMENT ON COLUMN public.clients.type_client IS 'Values: particulier, entreprise';