-- Add trial-related columns to api_keys_new table
-- This ensures both api_keys and api_keys_new have the same trial columns

ALTER TABLE api_keys_new 
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_used_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_used_requests INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_max_tokens INTEGER DEFAULT 100000,
ADD COLUMN IF NOT EXISTS trial_max_requests INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS trial_credits DECIMAL(10,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS trial_used_credits DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_converted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free_trial',
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_new_trial_dates ON api_keys_new(trial_start_date, trial_end_date);
CREATE INDEX IF NOT EXISTS idx_api_keys_new_is_trial ON api_keys_new(is_trial);
CREATE INDEX IF NOT EXISTS idx_api_keys_new_subscription_status ON api_keys_new(subscription_status);

-- Add comments for documentation
COMMENT ON COLUMN api_keys_new.trial_start_date IS 'When the trial period started';
COMMENT ON COLUMN api_keys_new.trial_end_date IS 'When the trial period ends';
COMMENT ON COLUMN api_keys_new.trial_used_tokens IS 'Number of tokens used during trial';
COMMENT ON COLUMN api_keys_new.trial_used_requests IS 'Number of requests made during trial';
COMMENT ON COLUMN api_keys_new.trial_max_tokens IS 'Maximum tokens allowed during trial';
COMMENT ON COLUMN api_keys_new.trial_max_requests IS 'Maximum requests allowed during trial';
COMMENT ON COLUMN api_keys_new.trial_credits IS 'Total credits allocated for trial';
COMMENT ON COLUMN api_keys_new.trial_used_credits IS 'Credits used during trial';
COMMENT ON COLUMN api_keys_new.is_trial IS 'Whether this is a trial API key';
COMMENT ON COLUMN api_keys_new.trial_converted IS 'Whether trial was converted to paid';
COMMENT ON COLUMN api_keys_new.subscription_status IS 'Current subscription status';
COMMENT ON COLUMN api_keys_new.subscription_plan IS 'Current subscription plan name';
