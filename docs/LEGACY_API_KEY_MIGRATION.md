# Legacy API Key Migration Guide

## Overview

This document describes the migration of legacy API keys from the `users.api_key` column to the `api_keys_new` table, which provides enhanced security features including encryption, key rotation, IP allowlisting, and domain restrictions.

## Problem Statement

### Issues Before Migration

1. **PGRST205 Errors**: The application was attempting to query the old `api_keys` table which no longer exists in the database
2. **Legacy Key Warnings**: Users with API keys in `users.api_key` column were generating warnings:
   ```
   WARNING:src.db.users:Legacy API key gw_live_wTfpLJ5VB28q... detected - should be migrated
   ```
3. **Dual System Maintenance**: The codebase had to maintain fallback logic for both new and legacy key systems
4. **Limited Security**: Legacy keys stored in `users.api_key` lacked advanced security features like:
   - Key rotation
   - IP allowlisting
   - Domain restrictions
   - Scope permissions
   - Request limits
   - Expiration dates

### Architecture

**Before Migration:**
```
┌─────────────────────────────────────────┐
│ users table                             │
│ ├── id (primary key)                    │
│ ├── api_key (VARCHAR) ← Legacy storage │
│ ├── credits                             │
│ └── ...                                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ api_keys_new table                      │
│ ├── id (primary key)                    │
│ ├── user_id (foreign key → users.id)   │
│ ├── api_key (VARCHAR)                   │
│ ├── key_name                            │
│ ├── is_primary (BOOLEAN)                │
│ ├── encrypted_key (TEXT)                │
│ ├── key_hash (VARCHAR)                  │
│ ├── scope_permissions (JSONB)           │
│ ├── ip_allowlist (TEXT[])               │
│ ├── domain_referrers (TEXT[])           │
│ ├── expiration_date (TIMESTAMP)         │
│ ├── max_requests (INT)                  │
│ └── ...                                 │
└─────────────────────────────────────────┘
```

**After Migration:**
- All API keys are stored in `api_keys_new` table
- `users.api_key` column is kept for backward compatibility during transition
- Application code checks `api_keys_new` first, with fallback to `users.api_key` (which will now always have a matching entry in `api_keys_new`)

## Migration Script

### File: `supabase/migrations/20251112000000_migrate_legacy_api_keys.sql`

The migration script performs the following operations:

1. **Migrates Legacy Keys**: Copies API keys from `users.api_key` to `api_keys_new` table
2. **Preserves Key Format**: Detects environment based on key prefix (gw_live_, gw_test_, etc.)
3. **Sets as Primary**: Marks migrated keys as primary keys
4. **Default Permissions**: Assigns full scope permissions (read/write/admin: ["*"])
5. **Conflict Handling**: Uses `ON CONFLICT (api_key) DO NOTHING` to avoid duplicates
6. **Indexing**: Creates performance indexes for faster lookups
7. **Verification**: Logs migration statistics

### Key Migration Logic

```sql
INSERT INTO public.api_keys_new (
    user_id,
    api_key,
    key_name,
    environment_tag,
    is_primary,
    is_active,
    scope_permissions,
    ...
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
    true as is_primary,
    ...
FROM public.users u
WHERE
    u.api_key IS NOT NULL
    AND u.api_key != ''
    AND NOT EXISTS (
        SELECT 1 FROM public.api_keys_new akn
        WHERE akn.api_key = u.api_key
    )
    AND u.api_key LIKE 'gw_%'
```

## Running the Migration

### Option 1: Using Supabase CLI (Recommended)

```bash
# Navigate to the project root
cd /root/repo

# Apply the migration
supabase db push

# Or apply this specific migration
supabase migration up --target 20251112000000
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20251112000000_migrate_legacy_api_keys.sql`
4. Paste and run the SQL script
5. Verify the results in the output

### Option 3: Using Direct Database Connection

```bash
# Connect to your database
psql "postgresql://[CONNECTION_STRING]"

# Run the migration file
\i supabase/migrations/20251112000000_migrate_legacy_api_keys.sql
```

## Verification

### 1. Check Migration Status

```sql
-- Count users with legacy API keys
SELECT COUNT(*) as legacy_key_count
FROM public.users
WHERE api_key IS NOT NULL
    AND api_key != ''
    AND api_key LIKE 'gw_%';

-- Count keys in api_keys_new
SELECT COUNT(*) as migrated_key_count
FROM public.api_keys_new;

-- Count primary keys per user
SELECT user_id, COUNT(*) as primary_key_count
FROM public.api_keys_new
WHERE is_primary = true
GROUP BY user_id
HAVING COUNT(*) > 1;  -- Should return 0 rows
```

### 2. Verify Key Matching

```sql
-- Check for users with keys not in api_keys_new
SELECT u.id, u.username, u.email, u.api_key
FROM public.users u
WHERE u.api_key IS NOT NULL
    AND u.api_key != ''
    AND u.api_key LIKE 'gw_%'
    AND NOT EXISTS (
        SELECT 1 FROM public.api_keys_new akn
        WHERE akn.api_key = u.api_key
    );
-- Should return 0 rows
```

### 3. Test API Key Authentication

```bash
# Test with a migrated API key
curl -X GET https://your-api-domain.com/v1/models \
  -H "Authorization: Bearer gw_live_YOUR_KEY_HERE"

# Should return 200 OK with model catalog
```

### 4. Check Application Logs

After migration, the following warnings should disappear:
- ❌ `ERROR:src.security.security:Error checking api_keys: {'code': 'PGRST205', ...}`
- ❌ `WARNING:src.db.users:Legacy API key gw_live_... detected - should be migrated`

## Post-Migration Cleanup (Optional)

### Remove Legacy Fallback Code

After confirming all keys are migrated and the system is stable, you can optionally remove the legacy fallback code:

#### Files to Update:

1. **`src/db/users.py`** (lines 112-119):
   ```python
   # Remove this fallback block after migration is complete and verified
   # Fallback: Check if this is a legacy key
   legacy_result = client.table("users").select("*").eq("api_key", api_key).execute()
   if legacy_result.data:
       logger.warning("Legacy API key %s detected...", ...)
       return legacy_result.data[0]
   ```

2. **`src/security/security.py`** (lines 251-256):
   ```python
   # Remove legacy validation fallback
   logger.debug("Attempting legacy user validation")
   user = get_user(api_key)
   if user:
       logger.info("Using legacy API key validation")
       return api_key
   ```

### Deprecate users.api_key Column (Future)

In a future migration, the `users.api_key` column can be deprecated:

```sql
-- Option 1: Make it nullable (safer, allows rollback)
ALTER TABLE public.users
ALTER COLUMN api_key DROP NOT NULL;

-- Option 2: Remove the column entirely (not reversible)
-- ALTER TABLE public.users DROP COLUMN api_key;
```

⚠️ **Warning**: Do not remove the `users.api_key` column immediately. Keep it for at least 30-90 days to ensure smooth transition and allow for rollback if needed.

## Rollback Procedure

If issues arise, you can rollback the migration:

```sql
-- Rollback: Delete migrated legacy keys
DELETE FROM public.api_keys_new
WHERE key_name = 'Legacy Primary Key'
    AND created_at >= '2025-11-12'::date;

-- The users.api_key column still contains the original keys,
-- so the application will fall back to legacy authentication
```

## Benefits After Migration

### Security Enhancements
- ✅ **Key Rotation**: Can create multiple keys per user and rotate them
- ✅ **IP Allowlisting**: Restrict API keys to specific IP addresses
- ✅ **Domain Restrictions**: Limit keys to specific domains/referrers
- ✅ **Scope Permissions**: Granular read/write/admin permissions
- ✅ **Request Limits**: Set maximum request counts per key
- ✅ **Expiration Dates**: Keys can have expiration dates
- ✅ **Encryption**: Keys can be encrypted at rest

### Operational Improvements
- ✅ **No More Warnings**: Eliminates legacy key detection warnings
- ✅ **No More Errors**: Fixes PGRST205 errors from querying non-existent table
- ✅ **Better Tracking**: Enhanced audit logging and last used timestamps
- ✅ **Key Management**: Users can manage multiple keys via API/dashboard

### Performance
- ✅ **Indexed Lookups**: Fast key lookups with proper indexes
- ✅ **Single Code Path**: No fallback logic needed
- ✅ **Cached Queries**: Better query plan caching

## Timeline

- **2025-10-12**: API key encryption support added (`api_keys_new` table)
- **2025-11-05**: Logs show legacy key warnings and PGRST205 errors
- **2025-11-12**: Migration script created to complete the transition
- **Next 30 days**: Monitor system, verify migration success
- **Future**: Remove legacy fallback code, deprecate `users.api_key` column

## Support

If you encounter issues during migration:

1. Check the application logs for detailed error messages
2. Verify database connection and permissions
3. Review the verification queries above
4. Contact the development team with:
   - Migration timestamp
   - Error messages
   - Affected user IDs
   - Database query results

## References

- Migration file: `supabase/migrations/20251112000000_migrate_legacy_api_keys.sql`
- API Keys module: `src/db/api_keys.py`
- Security module: `src/security/security.py`
- Users module: `src/db/users.py`
- Backfill script: `src/backfill_legacy_keys.py`

---

**Last Updated**: 2025-11-12
**Version**: 1.0
**Status**: Ready for Production
