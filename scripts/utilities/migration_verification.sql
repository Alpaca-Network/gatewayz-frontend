-- API Key Migration Verification SQL Queries
-- Run these queries to verify the migration was successful
-- Usage: psql "your_connection_string" < migration_verification.sql

\echo '================================================================================'
\echo 'API KEY MIGRATION VERIFICATION QUERIES'
\echo '================================================================================'
\echo ''

-- =============================================================================
-- TEST 1: Count Legacy Keys vs Migrated Keys
-- =============================================================================
\echo '📊 TEST 1: Legacy Keys vs Migrated Keys'
\echo '--------------------------------------------------------------------------------'

-- Count users with API keys in users table
SELECT
    'Users with legacy API keys' as metric,
    COUNT(*) as count
FROM public.users
WHERE api_key IS NOT NULL
    AND api_key != ''
    AND api_key LIKE 'gw_%';

-- Count keys in api_keys_new
SELECT
    'Keys in api_keys_new table' as metric,
    COUNT(*) as count
FROM public.api_keys_new;

-- Count migrated legacy keys (by key_name)
SELECT
    'Migrated legacy keys' as metric,
    COUNT(*) as count
FROM public.api_keys_new
WHERE key_name = 'Legacy Primary Key';

\echo ''

-- =============================================================================
-- TEST 2: Check for Unmigrated Legacy Keys
-- =============================================================================
\echo '🔍 TEST 2: Unmigrated Legacy Keys (should return 0 rows)'
\echo '--------------------------------------------------------------------------------'

SELECT
    u.id as user_id,
    u.username,
    u.email,
    LEFT(u.api_key, 20) || '...' as api_key_preview,
    u.created_at
FROM public.users u
WHERE u.api_key IS NOT NULL
    AND u.api_key != ''
    AND u.api_key LIKE 'gw_%'
    AND NOT EXISTS (
        SELECT 1
        FROM public.api_keys_new akn
        WHERE akn.api_key = u.api_key
    )
ORDER BY u.id
LIMIT 10;

-- Count unmigrated
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ PASS: All legacy keys migrated'
        ELSE '❌ FAIL: ' || COUNT(*) || ' unmigrated keys found'
    END as result
FROM public.users u
WHERE u.api_key IS NOT NULL
    AND u.api_key != ''
    AND u.api_key LIKE 'gw_%'
    AND NOT EXISTS (
        SELECT 1
        FROM public.api_keys_new akn
        WHERE akn.api_key = u.api_key
    );

\echo ''

-- =============================================================================
-- TEST 3: Check for Duplicate API Keys
-- =============================================================================
\echo '🔍 TEST 3: Duplicate API Keys (should return 0 rows)'
\echo '--------------------------------------------------------------------------------'

SELECT
    api_key,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id) as key_ids
FROM public.api_keys_new
GROUP BY api_key
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- Count duplicates
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ PASS: No duplicate keys'
        ELSE '❌ FAIL: ' || COUNT(*) || ' duplicate keys found'
    END as result
FROM (
    SELECT api_key
    FROM public.api_keys_new
    GROUP BY api_key
    HAVING COUNT(*) > 1
) duplicates;

\echo ''

-- =============================================================================
-- TEST 4: Check for Orphaned Keys
-- =============================================================================
\echo '🔍 TEST 4: Orphaned Keys (keys without users - should return 0 rows)'
\echo '--------------------------------------------------------------------------------'

SELECT
    akn.id as key_id,
    akn.user_id,
    akn.key_name,
    LEFT(akn.api_key, 20) || '...' as api_key_preview,
    akn.created_at
FROM public.api_keys_new akn
WHERE NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = akn.user_id
)
ORDER BY akn.id
LIMIT 10;

-- Count orphaned
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✅ PASS: No orphaned keys'
        ELSE '❌ FAIL: ' || COUNT(*) || ' orphaned keys found'
    END as result
FROM public.api_keys_new akn
WHERE NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = akn.user_id
);

\echo ''

-- =============================================================================
-- TEST 5: Check Primary Key Assignment
-- =============================================================================
\echo '🔍 TEST 5: Primary Key Assignment'
\echo '--------------------------------------------------------------------------------'

-- Users with multiple primary keys (should be 0)
\echo 'Users with multiple primary keys (should return 0 rows):'
SELECT
    user_id,
    COUNT(*) as primary_key_count,
    ARRAY_AGG(id) as key_ids
FROM public.api_keys_new
WHERE is_primary = true
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- Users with keys but no primary key (should be 0)
\echo ''
\echo 'Users with keys but no primary key (should return 0 rows):'
SELECT
    akn.user_id,
    COUNT(*) as total_keys,
    ARRAY_AGG(akn.id) as key_ids
FROM public.api_keys_new akn
WHERE NOT EXISTS (
    SELECT 1
    FROM public.api_keys_new akn2
    WHERE akn2.user_id = akn.user_id
        AND akn2.is_primary = true
)
GROUP BY akn.user_id
ORDER BY akn.user_id
LIMIT 10;

-- Primary key statistics
\echo ''
\echo 'Primary key statistics:'
SELECT
    COUNT(DISTINCT user_id) as users_with_keys,
    COUNT(*) FILTER (WHERE is_primary = true) as primary_keys,
    CASE
        WHEN COUNT(DISTINCT user_id) = COUNT(*) FILTER (WHERE is_primary = true)
        THEN '✅ PASS: Each user has exactly one primary key'
        ELSE '❌ FAIL: Primary key count mismatch'
    END as result
FROM public.api_keys_new;

\echo ''

-- =============================================================================
-- TEST 6: Validate Key Formats
-- =============================================================================
\echo '🔍 TEST 6: Key Format Validation'
\echo '--------------------------------------------------------------------------------'

-- Keys without proper prefix (should be 0)
\echo 'Keys without proper gw_ prefix (should return 0 rows):'
SELECT
    id,
    api_key,
    key_name,
    created_at
FROM public.api_keys_new
WHERE api_key NOT LIKE 'gw_%'
ORDER BY id
LIMIT 10;

-- Environment tag mismatches
\echo ''
\echo 'Environment tag mismatches (should return 0 rows):'
SELECT
    id,
    LEFT(api_key, 25) || '...' as api_key_preview,
    environment_tag,
    CASE
        WHEN api_key LIKE 'gw_test_%' THEN 'test'
        WHEN api_key LIKE 'gw_staging_%' THEN 'staging'
        WHEN api_key LIKE 'gw_dev_%' THEN 'development'
        ELSE 'live'
    END as expected_env
FROM public.api_keys_new
WHERE environment_tag != CASE
    WHEN api_key LIKE 'gw_test_%' THEN 'test'
    WHEN api_key LIKE 'gw_staging_%' THEN 'staging'
    WHEN api_key LIKE 'gw_dev_%' THEN 'development'
    ELSE 'live'
END
ORDER BY id
LIMIT 10;

-- Format validation summary
SELECT
    COUNT(*) as total_keys,
    COUNT(*) FILTER (WHERE api_key LIKE 'gw_%') as valid_prefix,
    COUNT(*) FILTER (WHERE api_key NOT LIKE 'gw_%') as invalid_prefix,
    CASE
        WHEN COUNT(*) FILTER (WHERE api_key NOT LIKE 'gw_%') = 0
        THEN '✅ PASS: All keys have valid format'
        ELSE '❌ FAIL: ' || COUNT(*) FILTER (WHERE api_key NOT LIKE 'gw_%') || ' invalid keys'
    END as result
FROM public.api_keys_new;

\echo ''

-- =============================================================================
-- TEST 7: Migration Metadata
-- =============================================================================
\echo '🔍 TEST 7: Migration Metadata'
\echo '--------------------------------------------------------------------------------'

-- Migration timestamp
SELECT
    'Latest migration timestamp' as metric,
    MAX(created_at) as value
FROM public.api_keys_new
WHERE key_name = 'Legacy Primary Key';

-- Migration by environment
SELECT
    environment_tag,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE key_name = 'Legacy Primary Key') as migrated_count
FROM public.api_keys_new
GROUP BY environment_tag
ORDER BY count DESC;

\echo ''

-- =============================================================================
-- TEST 8: User Coverage
-- =============================================================================
\echo '🔍 TEST 8: User Coverage'
\echo '--------------------------------------------------------------------------------'

SELECT
    'Total users' as metric,
    COUNT(*) as count
FROM public.users;

SELECT
    'Users with keys in api_keys_new' as metric,
    COUNT(DISTINCT user_id) as count
FROM public.api_keys_new;

SELECT
    'Users with legacy keys (users.api_key)' as metric,
    COUNT(*) as count
FROM public.users
WHERE api_key IS NOT NULL
    AND api_key != ''
    AND api_key LIKE 'gw_%';

\echo ''

-- =============================================================================
-- TEST 9: Scope Permissions
-- =============================================================================
\echo '🔍 TEST 9: Scope Permissions'
\echo '--------------------------------------------------------------------------------'

-- Keys with null or empty scope_permissions
SELECT
    COUNT(*) as keys_with_null_permissions,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ PASS: All keys have scope permissions'
        ELSE '⚠️  WARNING: ' || COUNT(*) || ' keys missing scope permissions'
    END as result
FROM public.api_keys_new
WHERE scope_permissions IS NULL
    OR scope_permissions = '{}'::jsonb;

-- Sample permissions
\echo ''
\echo 'Sample scope permissions:'
SELECT
    key_name,
    scope_permissions
FROM public.api_keys_new
WHERE key_name = 'Legacy Primary Key'
LIMIT 3;

\echo ''

-- =============================================================================
-- TEST 10: Index Performance Check
-- =============================================================================
\echo '🔍 TEST 10: Index Check'
\echo '--------------------------------------------------------------------------------'

-- Check for indexes on api_keys_new
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'api_keys_new'
ORDER BY indexname;

\echo ''

-- =============================================================================
-- SUMMARY
-- =============================================================================
\echo '================================================================================'
\echo 'VERIFICATION SUMMARY'
\echo '================================================================================'

WITH summary AS (
    SELECT
        COUNT(DISTINCT u.id) FILTER (WHERE u.api_key IS NOT NULL AND u.api_key != '' AND u.api_key LIKE 'gw_%') as users_with_legacy_keys,
        COUNT(DISTINCT akn.user_id) as users_with_new_keys,
        COUNT(akn.id) as total_keys_in_new,
        COUNT(akn.id) FILTER (WHERE akn.key_name = 'Legacy Primary Key') as migrated_keys,
        COUNT(*) FILTER (WHERE u.api_key IS NOT NULL AND u.api_key != '' AND u.api_key LIKE 'gw_%' AND NOT EXISTS (
            SELECT 1 FROM public.api_keys_new akn2 WHERE akn2.api_key = u.api_key
        )) as unmigrated_keys
    FROM public.users u
    FULL OUTER JOIN public.api_keys_new akn ON u.id = akn.user_id
)
SELECT
    users_with_legacy_keys,
    users_with_new_keys,
    total_keys_in_new,
    migrated_keys,
    unmigrated_keys,
    CASE
        WHEN unmigrated_keys = 0
            AND users_with_legacy_keys = users_with_new_keys
        THEN '✅ MIGRATION SUCCESSFUL'
        WHEN unmigrated_keys > 0
        THEN '❌ MIGRATION INCOMPLETE - ' || unmigrated_keys || ' keys not migrated'
        ELSE '⚠️  NEEDS REVIEW'
    END as overall_status
FROM summary;

\echo ''
\echo '================================================================================'
\echo 'END OF VERIFICATION'
\echo '================================================================================'
