-- Add encrypted storage columns for api_keys_new
ALTER TABLE public.api_keys_new
ADD COLUMN IF NOT EXISTS encrypted_key text,
ADD COLUMN IF NOT EXISTS key_version integer,
ADD COLUMN IF NOT EXISTS key_hash text,
ADD COLUMN IF NOT EXISTS last4 text;

-- Index for fast lookups by key_hash (unique if desired)
CREATE INDEX IF NOT EXISTS idx_api_keys_new_key_hash ON public.api_keys_new (key_hash);

-- Backfill last4 for existing rows (non-blocking, optional)
-- UPDATE public.api_keys_new SET last4 = RIGHT(api_key, 4) WHERE api_key IS NOT NULL AND (last4 IS NULL OR last4 = '');


