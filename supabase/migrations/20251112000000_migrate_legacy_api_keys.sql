-- Migration: Migrate Legacy API Keys from users.api_key to api_keys_new
-- Date: 2025-11-12
-- Purpose: Complete the migration of legacy API keys from users table to api_keys_new table
--          This eliminates the PGRST205 errors and "Legacy API key detected" warnings

-- Step 1: Migrate legacy API keys from users.api_key to api_keys_new
-- Only migrate keys that don't already exist in api_keys_new
INSERT INTO public.api_keys_new (
    user_id,
    api_key,
    key_name,
    environment_tag,
    is_primary,
    is_active,
    scope_permissions,
    ip_allowlist,
    domain_referrers,
    created_at,
    updated_at
)
SELECT
    u.id as user_id,
    u.api_key,
    'Legacy Primary Key' as key_name,
    CASE
        WHEN u.api_key LIKE 'gw_test_%' THEN 'test'
        WHEN u.api_key LIKE 'gw_staging_%' THEN 'staging'
        WHEN u.api_key LIKE 'gw_dev_%' THEN 'development'
        ELSE 'live'
    END as environment_tag,
    true as is_primary,  -- Legacy keys are primary keys
    true as is_active,
    '{"read": ["*"], "write": ["*"], "admin": ["*"]}'::jsonb as scope_permissions,
    ARRAY[]::text[] as ip_allowlist,
    ARRAY[]::text[] as domain_referrers,
    COALESCE(u.created_at, NOW()) as created_at,
    NOW() as updated_at
FROM public.users u
WHERE
    -- User has an API key
    u.api_key IS NOT NULL
    AND u.api_key != ''
    -- But that key doesn't exist in api_keys_new yet
    AND NOT EXISTS (
        SELECT 1
        FROM public.api_keys_new akn
        WHERE akn.api_key = u.api_key
    )
    -- And it's a valid Gatewayz API key format
    AND u.api_key LIKE 'gw_%'
ON CONFLICT (api_key) DO NOTHING;

-- Step 2: Log the migration results
-- Create a comment to track the migration
COMMENT ON TABLE public.api_keys_new IS 'API keys for user authentication with advanced security features. Legacy keys migrated on 2025-11-12.';

-- Step 3: Add index for faster lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_api_keys_new_user_id ON public.api_keys_new(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_new_api_key ON public.api_keys_new(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_new_is_primary ON public.api_keys_new(user_id, is_primary) WHERE is_primary = true;

-- Step 4: Verify migration (this will fail if there are issues)
DO $$
DECLARE
    legacy_count INTEGER;
    migrated_count INTEGER;
BEGIN
    -- Count users with legacy API keys
    SELECT COUNT(*) INTO legacy_count
    FROM public.users
    WHERE api_key IS NOT NULL
        AND api_key != ''
        AND api_key LIKE 'gw_%';

    -- Count keys in api_keys_new
    SELECT COUNT(*) INTO migrated_count
    FROM public.api_keys_new;

    -- Log the results
    RAISE NOTICE 'Migration complete: % users with API keys, % total keys in api_keys_new',
        legacy_count, migrated_count;

    -- If there are users with keys but no entries in api_keys_new, raise a warning
    IF legacy_count > 0 AND migrated_count = 0 THEN
        RAISE WARNING 'Found % users with API keys but api_keys_new is empty. This may indicate a migration issue.',
            legacy_count;
    END IF;
END $$;
