-- Add subscription-related fields to users table
-- This migration adds fields needed for Stripe subscription management

-- Add columns if they don't exist
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
