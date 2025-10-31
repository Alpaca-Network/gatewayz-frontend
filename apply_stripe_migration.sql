-- =====================================================================
-- Stripe Subscription Columns Migration
-- =====================================================================
-- This migration adds required Stripe subscription columns to the users table
-- to fix the error: "Could not find the 'stripe_customer_id' column"
--
-- Run this in Supabase SQL Editor or via psql:
--   psql "$DATABASE_URL" -f apply_stripe_migration.sql
-- =====================================================================

-- Add subscription-related fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS subscription_end_date BIGINT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Add comments to document the columns
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for subscription management';
COMMENT ON COLUMN users.stripe_subscription_id IS 'Stripe subscription ID for active subscription';
COMMENT ON COLUMN users.stripe_product_id IS 'Stripe product ID (e.g., prod_TKOqQPhVRxNp4Q for Pro)';
COMMENT ON COLUMN users.tier IS 'Subscription tier: basic, pro, max';
COMMENT ON COLUMN users.subscription_end_date IS 'Unix timestamp for subscription end date (current_period_end)';

-- Verification queries (optional - run after migration to verify)
-- Uncomment to run:

-- SELECT 'Migration completed successfully!' as status;
--
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'users'
-- AND column_name IN (
--     'stripe_customer_id',
--     'stripe_subscription_id',
--     'stripe_product_id',
--     'tier',
--     'subscription_end_date'
-- )
-- ORDER BY column_name;
