# API Key Migration Verification Checklist

## Overview

This checklist provides step-by-step verification procedures to ensure the legacy API key migration was successful. Use this after running the migration script.

---

## Quick Start

After running the migration, execute these commands in order:

```bash
# 1. Run automated Python verification script
python scripts/utilities/verify_api_key_migration.py

# 2. Run SQL verification queries
psql "YOUR_DATABASE_CONNECTION_STRING" < scripts/utilities/migration_verification.sql

# 3. Check application logs for errors
tail -f logs/app.log | grep -i "legacy\|api_key\|PGRST205"
```

---

## Pre-Migration Checklist

Before running the migration, complete these checks:

- [ ] **Backup Database**: Take a full database backup
  ```bash
  # Using Supabase CLI
  supabase db dump -f backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Note Current Counts**:
  ```sql
  -- Record these numbers for comparison
  SELECT COUNT(*) FROM users WHERE api_key IS NOT NULL AND api_key != '';
  SELECT COUNT(*) FROM api_keys_new;
  ```

- [ ] **Check Active Users**: Identify users who are actively using the system
  ```sql
  SELECT COUNT(*) FROM activity_log WHERE timestamp > NOW() - INTERVAL '24 hours';
  ```

- [ ] **Verify Application Status**: Ensure application is running normally

- [ ] **Schedule Maintenance Window**: If possible, run during low-traffic period

---

## Migration Execution

- [ ] **Run Migration Script**:
  ```bash
  # Using Supabase CLI
  supabase db push

  # Or specific migration
  supabase migration up --target 20251112000000
  ```

- [ ] **Check Migration Output**: Look for success messages and any errors

- [ ] **Record Migration Timestamp**: Note when migration completed

---

## Post-Migration Verification

### Phase 1: Automated Verification (5 minutes)

#### 1.1 Run Python Verification Script

```bash
cd /root/repo
python scripts/utilities/verify_api_key_migration.py
```

**Expected Output**: All checks should show ✅ PASSED

**Check for**:
- [ ] Database connection successful
- [ ] All tables exist
- [ ] No unmigrated legacy keys
- [ ] No duplicate keys
- [ ] No orphaned keys
- [ ] Primary keys correctly assigned
- [ ] Sample authentication tests pass

**If ANY checks fail**: Stop and investigate before proceeding.

#### 1.2 Run SQL Verification Queries

```bash
psql "YOUR_DATABASE_CONNECTION_STRING" < scripts/utilities/migration_verification.sql
```

**Review Output**:
- [ ] All TEST results show ✅ PASS or 0 rows
- [ ] SUMMARY shows "✅ MIGRATION SUCCESSFUL"
- [ ] Unmigrated keys count = 0
- [ ] Duplicate keys count = 0
- [ ] Orphaned keys count = 0

---

### Phase 2: Manual Database Checks (10 minutes)

#### 2.1 Count Verification

```sql
-- All these counts should match
SELECT
    (SELECT COUNT(*) FROM users WHERE api_key IS NOT NULL AND api_key != '' AND api_key LIKE 'gw_%') as legacy_keys,
    (SELECT COUNT(DISTINCT user_id) FROM api_keys_new) as users_with_new_keys,
    (SELECT COUNT(*) FROM api_keys_new WHERE is_primary = true) as primary_keys;
```

**Expected**: All three numbers should be equal

- [ ] legacy_keys = users_with_new_keys ✓
- [ ] users_with_new_keys = primary_keys ✓

#### 2.2 Sample Key Verification

Pick 5 random users and verify their keys:

```sql
-- Get 5 random users with keys
SELECT
    u.id,
    u.username,
    u.email,
    LEFT(u.api_key, 20) || '...' as user_table_key,
    LEFT(akn.api_key, 20) || '...' as new_table_key,
    akn.is_primary,
    akn.key_name
FROM users u
JOIN api_keys_new akn ON u.id = akn.user_id
WHERE u.api_key IS NOT NULL
ORDER BY RANDOM()
LIMIT 5;
```

**Verify for each row**:
- [ ] user_table_key matches new_table_key ✓
- [ ] is_primary = true ✓
- [ ] key_name = 'Legacy Primary Key' ✓

#### 2.3 Key Format Validation

```sql
-- Should return 0 rows
SELECT id, api_key, environment_tag
FROM api_keys_new
WHERE api_key NOT LIKE 'gw_%'
   OR (api_key LIKE 'gw_live_%' AND environment_tag != 'live')
   OR (api_key LIKE 'gw_test_%' AND environment_tag != 'test')
   OR (api_key LIKE 'gw_staging_%' AND environment_tag != 'staging')
   OR (api_key LIKE 'gw_dev_%' AND environment_tag != 'development');
```

- [ ] Query returns 0 rows ✓

#### 2.4 Permissions Check

```sql
-- All keys should have scope_permissions
SELECT COUNT(*)
FROM api_keys_new
WHERE scope_permissions IS NULL
   OR scope_permissions = '{}'::jsonb;
```

- [ ] Count = 0 ✓

---

### Phase 3: Application Testing (15 minutes)

#### 3.1 API Authentication Tests

**Test 1: Get user profile with legacy key**

```bash
# Get a test API key from database
export TEST_KEY="gw_live_YOUR_KEY_HERE"

# Test authentication
curl -X GET "https://your-api-domain.com/users/profile" \
  -H "Authorization: Bearer $TEST_KEY" \
  -H "Content-Type: application/json"
```

- [ ] Returns 200 OK ✓
- [ ] Returns correct user data ✓
- [ ] No authentication errors ✓

**Test 2: Make API call (chat completion)**

```bash
curl -X POST "https://your-api-domain.com/v1/chat/completions" \
  -H "Authorization: Bearer $TEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }'
```

- [ ] Returns 200 OK ✓
- [ ] Returns valid response ✓
- [ ] Credits deducted correctly ✓

**Test 3: Test with 3 different users**

Repeat tests above with keys from:
- [ ] User who registered recently (< 7 days) ✓
- [ ] User who registered long ago (> 30 days) ✓
- [ ] User with high usage ✓

#### 3.2 Check Application Logs

```bash
# Check for errors in the last hour
grep -i "error\|warning\|legacy\|PGRST205" logs/app.log | tail -100
```

**Verify**:
- [ ] No "PGRST205" errors ✓
- [ ] No "Legacy API key detected" warnings ✓
- [ ] No "Error checking api_keys" errors ✓
- [ ] No authentication failures ✓

#### 3.3 Monitor Real-Time Logs

```bash
# Watch logs in real-time for 5 minutes
tail -f logs/app.log
```

While monitoring, make several API calls and verify:
- [ ] No legacy key warnings appear ✓
- [ ] Authentication works normally ✓
- [ ] No unexpected errors ✓

---

### Phase 4: Edge Case Testing (10 minutes)

#### 4.1 Test Non-Existent Key

```bash
curl -X GET "https://your-api-domain.com/users/profile" \
  -H "Authorization: Bearer gw_live_INVALID_KEY_12345" \
  -H "Content-Type: application/json"
```

- [ ] Returns 401 Unauthorized ✓
- [ ] Returns proper error message ✓

#### 4.2 Test Inactive Key

```sql
-- Temporarily deactivate a key
UPDATE api_keys_new SET is_active = false WHERE id = (SELECT id FROM api_keys_new LIMIT 1) RETURNING id, api_key;
```

Test with the deactivated key:
```bash
curl -X GET "https://your-api-domain.com/users/profile" \
  -H "Authorization: Bearer DEACTIVATED_KEY_HERE" \
  -H "Content-Type: application/json"
```

- [ ] Returns 401 or 403 error ✓
- [ ] Error message indicates inactive key ✓

Reactivate the key:
```sql
UPDATE api_keys_new SET is_active = true WHERE id = THE_ID_FROM_ABOVE;
```

#### 4.3 Test User Without Key

```sql
-- Find user without any API keys
SELECT id, username, email
FROM users
WHERE id NOT IN (SELECT DISTINCT user_id FROM api_keys_new)
LIMIT 1;
```

- [ ] User exists but has no keys in either table ✓
- [ ] This is expected for new users who haven't generated keys ✓

---

### Phase 5: Performance Verification (5 minutes)

#### 5.1 Check Query Performance

```sql
-- Should use index and be fast (< 10ms)
EXPLAIN ANALYZE
SELECT * FROM api_keys_new WHERE api_key = 'gw_live_SAMPLE_KEY';

-- Should use index
EXPLAIN ANALYZE
SELECT * FROM api_keys_new WHERE user_id = 123;
```

**Verify**:
- [ ] Queries use indexes (Index Scan, not Seq Scan) ✓
- [ ] Execution time < 10ms ✓

#### 5.2 Load Test (Optional)

If you have a load testing tool:

```bash
# Example with Apache Bench
ab -n 100 -c 10 -H "Authorization: Bearer $TEST_KEY" \
  "https://your-api-domain.com/users/profile"
```

- [ ] No errors or timeouts ✓
- [ ] Consistent response times ✓

---

### Phase 6: Production Monitoring (24-48 hours)

After migration, monitor these metrics:

#### Day 1 Checks

- [ ] **Hour 1**: Check logs every 15 minutes for errors
- [ ] **Hour 2-6**: Check logs hourly
- [ ] **Hour 6-24**: Check logs every 4 hours

#### Metrics to Monitor

```sql
-- API usage (should remain consistent)
SELECT COUNT(*) as requests_last_hour
FROM activity_log
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Authentication failures (should be minimal)
SELECT COUNT(*) as auth_failures
FROM audit_log
WHERE event_type = 'AUTH_FAILURE'
  AND timestamp > NOW() - INTERVAL '1 hour';

-- Key lookup performance
SELECT
    AVG(duration_ms) as avg_duration,
    MAX(duration_ms) as max_duration
FROM performance_log
WHERE operation = 'get_user'
  AND timestamp > NOW() - INTERVAL '1 hour';
```

**Daily Checklist**:
- [ ] Day 1: Full verification ✓
- [ ] Day 2: Spot check key metrics ✓
- [ ] Day 3: Final verification ✓

---

## Success Criteria

The migration is considered successful if ALL of the following are true:

### Critical (Must Pass)

- [x] ✅ Zero unmigrated legacy keys
- [x] ✅ Zero duplicate API keys
- [x] ✅ Zero orphaned keys (keys without users)
- [x] ✅ Each user has exactly one primary key
- [x] ✅ All keys have valid gw_ prefix
- [x] ✅ Authentication works for sample keys
- [x] ✅ No PGRST205 errors in logs
- [x] ✅ No "Legacy API key detected" warnings

### Important (Should Pass)

- [x] ✅ All keys have scope_permissions set
- [x] ✅ Environment tags match key prefixes
- [x] ✅ Indexes exist and are being used
- [x] ✅ Query performance is acceptable

### Nice to Have

- [ ] 🟢 Zero authentication errors in 24 hours
- [ ] 🟢 API usage remains consistent
- [ ] 🟢 No customer complaints about authentication

---

## Rollback Procedure

If critical checks fail, rollback immediately:

```sql
-- 1. Delete migrated keys
DELETE FROM api_keys_new
WHERE key_name = 'Legacy Primary Key'
  AND created_at >= '2025-11-12'::date;

-- 2. Verify rollback
SELECT COUNT(*) as remaining_migrated_keys
FROM api_keys_new
WHERE key_name = 'Legacy Primary Key';
-- Should return 0

-- 3. Restore from backup if needed
-- psql "YOUR_CONNECTION" < backup_pre_migration_TIMESTAMP.sql
```

**After rollback**:
- [ ] Application reverts to legacy key handling ✓
- [ ] No data loss ✓
- [ ] Document what went wrong ✓
- [ ] Fix issues before re-attempting ✓

---

## Troubleshooting

### Issue: Unmigrated Keys Found

**Symptoms**: Verification shows users with keys not in api_keys_new

**Fix**:
```sql
-- Manually migrate specific keys
INSERT INTO public.api_keys_new (user_id, api_key, key_name, environment_tag, is_primary, is_active, scope_permissions, created_at, updated_at)
SELECT id, api_key, 'Legacy Primary Key', 'live', true, true, '{"read": ["*"], "write": ["*"], "admin": ["*"]}'::jsonb, NOW(), NOW()
FROM users
WHERE id IN (LIST_OF_USER_IDS)
ON CONFLICT (api_key) DO NOTHING;
```

### Issue: Duplicate Keys

**Symptoms**: Same API key appears multiple times in api_keys_new

**Fix**:
```sql
-- Keep only the first occurrence, delete duplicates
DELETE FROM api_keys_new a
USING api_keys_new b
WHERE a.api_key = b.api_key
  AND a.id > b.id;
```

### Issue: Multiple Primary Keys

**Symptoms**: User has more than one primary key

**Fix**:
```sql
-- Set only the oldest key as primary
WITH ranked_keys AS (
    SELECT id, user_id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
    FROM api_keys_new
    WHERE is_primary = true
)
UPDATE api_keys_new
SET is_primary = false
WHERE id IN (
    SELECT id FROM ranked_keys WHERE rn > 1
);
```

### Issue: Authentication Failures

**Symptoms**: API calls return 401 after migration

**Checks**:
1. Verify key exists in api_keys_new
2. Check is_active = true
3. Verify user_id matches
4. Check application is reading from api_keys_new table

---

## Sign-Off

Migration completed and verified by:

- **Executed by**: _________________
- **Date**: _________________
- **Verified by**: _________________
- **Date**: _________________

**Notes**:
```
[Add any observations, issues encountered, or special notes here]
```

---

## References

- Migration script: `supabase/migrations/20251112000000_migrate_legacy_api_keys.sql`
- Verification script: `scripts/utilities/verify_api_key_migration.py`
- SQL checks: `scripts/utilities/migration_verification.sql`
- Documentation: `docs/LEGACY_API_KEY_MIGRATION.md`

---

**Version**: 1.0
**Last Updated**: 2025-11-12
**Status**: Production Ready
