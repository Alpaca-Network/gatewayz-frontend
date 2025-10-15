# Deploy Database Migrations to Production

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   brew install supabase/tap/supabase
   ```

2. **Production credentials**
   - Project Reference ID (from Supabase dashboard)
   - Database password
   - Access to Supabase SQL Editor

## Method 1: Using Supabase CLI (Recommended)

### Step 1: Link to Production Project

```bash
cd /path/to/your/project

# Link to your production Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# You'll be prompted for:
# - Database password (from your Supabase project settings)
```

**Finding your Project Ref:**
1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings → General
4. Copy the "Reference ID"

### Step 2: Check Current Migration Status

```bash
# See which migrations haven't been applied to production yet
supabase db remote changes

# This will show you the diff between local and remote
```

### Step 3: Push Migrations

```bash
# Push all pending migrations to production
supabase db push

# Or push with dry-run first to see what will happen
supabase db push --dry-run
```

### Step 4: Verify

```bash
# Check that migrations were applied successfully
supabase db remote changes

# Should show "No schema changes detected"
```

## Method 2: Manual SQL Execution

If the CLI method doesn't work, you can manually run the SQL:

### Step 1: Open Supabase SQL Editor

1. Go to https://app.supabase.com
2. Select your production project
3. Navigate to SQL Editor

### Step 2: Run Migration Files in Order

Copy and paste each migration file content in order:

#### Migration 1: Fix Permissions (if needed)
```sql
-- File: 20251011_fix_permissions.sql

-- Grant all permissions to service_role for production
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Create RLS policy for service_role to bypass all restrictions
CREATE POLICY IF NOT EXISTS "Service role has full access" ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role has full access" ON referrals
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role has full access" ON api_keys_new
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role has full access" ON credit_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

#### Migration 2: Consolidate Balance to Credits
```sql
-- File: 20251012_consolidate_balance_to_credits.sql

-- Step 1: Ensure credits column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'credits'
    ) THEN
        ALTER TABLE users ADD COLUMN credits NUMERIC(10, 2) DEFAULT 0.0 NOT NULL;
    END IF;
END $$;

-- Step 2: Migrate data from balance to credits
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'balance'
    ) THEN
        UPDATE users
        SET credits = GREATEST(
            COALESCE(credits, 0),
            COALESCE(balance, 0)
        )
        WHERE balance IS NOT NULL OR credits IS NOT NULL;

        RAISE NOTICE 'Migrated balance data to credits column';
    END IF;
END $$;

-- Step 3: Drop the balance column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'balance'
    ) THEN
        ALTER TABLE users DROP COLUMN balance;
        RAISE NOTICE 'Dropped balance column from users table';
    END IF;
END $$;

-- Step 4: Ensure credits column has proper constraints
ALTER TABLE users ALTER COLUMN credits SET NOT NULL;
ALTER TABLE users ALTER COLUMN credits SET DEFAULT 0.0;

-- Step 5: Add index on credits
CREATE INDEX IF NOT EXISTS idx_users_credits ON users(credits);

-- Step 6: Add check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_credits_non_negative'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_credits_non_negative CHECK (credits >= 0);
    END IF;
END $$;

-- Step 7: Add comment
COMMENT ON COLUMN users.credits IS 'User credit balance in dollars (consolidated from balance column)';
```

### Step 3: Verify Execution

After running each migration, check for errors in the SQL Editor output.

## Method 3: Using Supabase Dashboard Migration Tool

### Step 1: Access Migration Tool

1. Go to your Supabase project dashboard
2. Navigate to Database → Migrations
3. Click "Create new migration"

### Step 2: Paste Migration Content

Copy the content from your local migration files:
- `supabase/migrations/20251011_fix_permissions.sql`
- `supabase/migrations/20251012_consolidate_balance_to_credits.sql`

### Step 3: Run Migration

Click "Run now" to execute the migration on production.

## Verification Checklist

After applying migrations, verify:

### 1. Check Table Structure
```sql
-- Verify balance column is removed and credits column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('credits', 'balance');

-- Should only show 'credits', not 'balance'
```

### 2. Check Constraints
```sql
-- Verify credits constraint exists
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND conname = 'users_credits_non_negative';
```

### 3. Check Indexes
```sql
-- Verify credits index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users'
AND indexname = 'idx_users_credits';
```

### 4. Check RLS Policies
```sql
-- Verify service_role policies exist
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('users', 'referrals', 'api_keys_new', 'credit_transactions')
AND policyname = 'Service role has full access';
```

### 5. Test Data Integrity
```sql
-- Check that all users have valid credits
SELECT COUNT(*) as total_users,
       COUNT(*) FILTER (WHERE credits >= 0) as users_with_valid_credits,
       MIN(credits) as min_credits,
       MAX(credits) as max_credits,
       AVG(credits) as avg_credits
FROM users;
```

## Rollback Plan (Emergency)

If something goes wrong, you can rollback:

### Rollback: Restore Balance Column

```sql
-- Only if you need to rollback the consolidation migration

-- Step 1: Add balance column back
ALTER TABLE users ADD COLUMN balance NUMERIC(10, 2) DEFAULT 0.0;

-- Step 2: Copy credits to balance
UPDATE users SET balance = credits;

-- Step 3: Remove credits constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_credits_non_negative;

-- Step 4: Remove credits index
DROP INDEX IF EXISTS idx_users_credits;
```

**⚠️ WARNING**: Only use rollback if absolutely necessary. Make a database backup first!

## Best Practices

### 1. Backup Before Migration

```bash
# Create a backup of production database
supabase db dump -f backup_before_migration.sql --db-url "postgresql://..."
```

Or use Supabase Dashboard:
1. Go to Database → Backups
2. Click "Create backup"
3. Download the backup file

### 2. Test in Staging First

If you have a staging environment:

```bash
# Link to staging
supabase link --project-ref STAGING_PROJECT_REF

# Push to staging
supabase db push

# Test thoroughly

# Then push to production
supabase link --project-ref PRODUCTION_PROJECT_REF
supabase db push
```

### 3. Run During Low Traffic

- Schedule migrations during off-peak hours
- Notify users if downtime is expected
- Have a rollback plan ready

### 4. Monitor After Migration

After applying migrations:

1. Check application logs for errors
2. Monitor API response times
3. Verify user-facing features work
4. Check that credits are being added/deducted correctly

## Troubleshooting

### Error: "relation already exists"

Some policies or indexes might already exist. The migrations use `IF NOT EXISTS` to handle this, but if you get errors:

```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Drop and recreate if needed
DROP POLICY IF EXISTS "Service role has full access" ON users;
CREATE POLICY "Service role has full access" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Error: "cannot drop column ... because other objects depend on it"

If balance column has dependencies:

```sql
-- Find dependencies
SELECT dependent_ns.nspname as dependent_schema,
       dependent_view.relname as dependent_view
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
WHERE pg_depend.refobjid = 'users'::regclass;

-- Drop dependent views first
DROP VIEW IF EXISTS view_name CASCADE;

-- Then run migration
```

### Error: "permission denied"

Make sure you're using the correct database credentials and have admin access.

## Environment-Specific Configuration

Update your `.env` file for production:

```bash
# Production Supabase credentials
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_KEY=eyJhbGc...  # Your service_role key
STRIPE_SECRET_KEY=sk_live_...  # Production Stripe key
STRIPE_WEBHOOK_SECRET=whsec_...  # Production webhook secret
```

## Post-Migration Steps

After successful migration:

1. **Update Application Code** (if not already done)
   - Verify all code references use `credits` instead of `balance`
   - Deploy latest application code

2. **Test Referral Flow**
   ```bash
   # Test with real production data
   # 1. Register test user
   # 2. Get referral code
   # 3. Register second user with code
   # 4. Make test payment
   # 5. Verify bonuses applied correctly
   ```

3. **Monitor Logs**
   ```bash
   # Watch application logs
   tail -f /var/log/app.log

   # Or in Supabase dashboard:
   # Navigate to Logs → Database Logs
   ```

4. **Update Documentation**
   - Update API documentation if endpoints changed
   - Notify frontend team of any changes
   - Update internal documentation

## Quick Reference Commands

```bash
# Check which migrations need to be applied
supabase db remote changes

# Push migrations to production
supabase db push

# Verify migrations
supabase db remote changes

# Create backup before migration
supabase db dump -f backup.sql

# View migration history
supabase migration list
```

## Support

If you encounter issues:
1. Check Supabase status: https://status.supabase.com
2. Review Supabase docs: https://supabase.com/docs/guides/cli/managing-environments
3. Contact support: https://supabase.com/support
