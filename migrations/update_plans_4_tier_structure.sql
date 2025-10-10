-- Update plans to 4-tier structure: Free, Dev, Team, Customize (pay-as-you-go)
-- This migration updates the existing plans table to support the new 4-tier structure

-- First, add new columns if they don't exist
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS price_per_token DECIMAL(10, 6) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_pay_as_you_go BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS yearly_price DECIMAL(10, 2) DEFAULT NULL;

-- Update existing plans to new structure
-- First, clear existing plans
DELETE FROM plans;

-- Insert new 4-tier plan structure
INSERT INTO plans (
    name, 
    description, 
    plan_type,
    daily_request_limit, 
    monthly_request_limit, 
    daily_token_limit, 
    monthly_token_limit, 
    price_per_month, 
    yearly_price,
    price_per_token,
    is_pay_as_you_go,
    features, 
    is_active,
    max_concurrent_requests
) VALUES 
-- Free Plan
(
    'Free',
    'Perfect for getting started with AI Gateway',
    'free',
    1000,      -- 1,000 requests per day
    10000,     -- 10,000 requests per month
    100000,    -- 100,000 tokens per day
    1000000,   -- 1M tokens per month
    0.00,      -- Free
    NULL,      -- No yearly pricing
    NULL,      -- No per-token pricing
    false,     -- Not pay-as-you-go
    '["1M tokens per month", "10K requests per month", "5 concurrent requests", "Community support", "Basic analytics", "API access"]'::jsonb,
    true,
    5
),
-- Dev Plan
(
    'Dev',
    'Ideal for developers and small projects',
    'dev',
    10000,     -- 10,000 requests per day
    300000,    -- 300,000 requests per month
    1000000,   -- 1M tokens per day
    10000000,  -- 10M tokens per month
    29.00,     -- $29/month
    290.00,    -- $290/year (2 months free)
    NULL,      -- No per-token pricing
    false,     -- Not pay-as-you-go
    '["10M tokens per month", "300K requests per month", "15 concurrent requests", "Email support", "Advanced analytics", "Rate limiting controls", "Webhooks"]'::jsonb,
    true,
    15
),
-- Team Plan
(
    'Team',
    'Perfect for growing teams and production apps',
    'team',
    50000,     -- 50,000 requests per day
    1500000,   -- 1.5M requests per month
    5000000,   -- 5M tokens per day
    50000000,  -- 50M tokens per month
    99.00,     -- $99/month
    990.00,    -- $990/year (2 months free)
    NULL,      -- No per-token pricing
    false,     -- Not pay-as-you-go
    '["50M tokens per month", "1.5M requests per month", "50 concurrent requests", "Priority support", "Real-time analytics", "Advanced rate limiting", "Custom domains", "Team management", "SSO integration"]'::jsonb,
    true,
    50
),
-- Customize Plan (Pay-as-you-go)
(
    'Customize',
    'Pay-as-you-go pricing for maximum flexibility',
    'customize',
    1000000,   -- 1M requests per day (effectively unlimited)
    30000000,  -- 30M requests per month (effectively unlimited)
    100000000, -- 100M tokens per day (effectively unlimited)
    1000000000, -- 1B tokens per month (effectively unlimited)
    0.00,      -- No monthly fee
    NULL,      -- No yearly pricing
    0.000020,  -- $0.00002 per token
    true,      -- Pay-as-you-go
    '["Pay only for what you use", "Unlimited requests", "Unlimited tokens", "100 concurrent requests", "24/7 support", "Custom analytics", "White-label solution", "Custom integrations", "SLA guarantee", "Dedicated account manager"]'::jsonb,
    true,
    100
)
ON CONFLICT (name) DO NOTHING;

-- Update trial configuration to work with Free plan
UPDATE trial_config SET 
    trial_days = 3,
    trial_credits = 10.00,
    trial_tokens = 1000000,  -- 1M tokens for trial
    trial_requests = 10000,  -- 10K requests for trial
    trial_max_concurrent_requests = 5
WHERE id = 1;

-- Create plan features table for better feature management
CREATE TABLE IF NOT EXISTS plan_features (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    feature_value VARCHAR(255),
    is_boolean BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(plan_id, feature_name)
);

-- Insert plan features
INSERT INTO plan_features (plan_id, feature_name, feature_value, is_boolean) 
SELECT p.id, 'tokens_per_month', p.monthly_token_limit::text, false
FROM plans p WHERE p.plan_type = 'free';

INSERT INTO plan_features (plan_id, feature_name, feature_value, is_boolean) 
SELECT p.id, 'requests_per_month', p.monthly_request_limit::text, false
FROM plans p WHERE p.plan_type = 'dev';

INSERT INTO plan_features (plan_id, feature_name, feature_value, is_boolean) 
SELECT p.id, 'tokens_per_month', p.monthly_token_limit::text, false
FROM plans p WHERE p.plan_type = 'dev';

INSERT INTO plan_features (plan_id, feature_name, feature_value, is_boolean) 
SELECT p.id, 'requests_per_month', p.monthly_request_limit::text, false
FROM plans p WHERE p.plan_type = 'team';

INSERT INTO plan_features (plan_id, feature_name, feature_value, is_boolean) 
SELECT p.id, 'tokens_per_month', p.monthly_token_limit::text, false
FROM plans p WHERE p.plan_type = 'team';

INSERT INTO plan_features (plan_id, feature_name, feature_value, is_boolean) 
SELECT p.id, 'pay_as_you_go', 'true', true
FROM plans p WHERE p.plan_type = 'customize';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_plans_plan_type ON plans(plan_type);
CREATE INDEX IF NOT EXISTS idx_plans_is_pay_as_you_go ON plans(is_pay_as_you_go);
CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON plan_features(plan_id);

-- Update user_plans table to support new plan structure
ALTER TABLE user_plans 
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS is_pay_as_you_go BOOLEAN DEFAULT FALSE;

-- Update existing user plans to have correct plan_type
UPDATE user_plans 
SET plan_type = p.plan_type, is_pay_as_you_go = p.is_pay_as_you_go
FROM plans p 
WHERE user_plans.plan_id = p.id;
