-- Migration: Consolidate balance column into credits column
-- Purpose: Remove duplicate balance tracking - use only 'credits' column
-- Date: 2025-10-12

-- Step 1: Ensure credits column exists with proper type
-- (It should already exist, but this ensures it's there)
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
-- If balance column exists and has values, consolidate them into credits
DO $$
BEGIN
    -- Check if balance column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'balance'
    ) THEN
        -- Update credits to be the maximum of credits or balance
        -- This ensures we don't lose any credit value
        UPDATE users
        SET credits = GREATEST(
            COALESCE(credits, 0),
            COALESCE(balance, 0)
        )
        WHERE balance IS NOT NULL OR credits IS NOT NULL;

        -- Log the migration
        RAISE NOTICE 'Migrated balance data to credits column';
    END IF;
END $$;

-- Step 3: Drop the balance column if it exists
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

-- Step 5: Add index on credits for faster queries
CREATE INDEX IF NOT EXISTS idx_users_credits ON users(credits);

-- Step 6: Add check constraint to ensure credits never goes negative
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_credits_non_negative'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_credits_non_negative CHECK (credits >= 0);
    END IF;
END $$;

-- Step 7: Update any views or functions that reference balance column
-- (If you have any database views or functions using 'balance', update them here)

-- Migration complete
COMMENT ON COLUMN users.credits IS 'User credit balance in dollars (consolidated from balance column)';
