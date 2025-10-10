-- Add sample subscription plans
-- This migration adds comprehensive pricing plans to the plans table

-- First, add the missing column to plans table
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS max_concurrent_requests INTEGER DEFAULT 5;

-- Insert sample plans if they don't exist
INSERT INTO plans (
    name, 
    description, 
    daily_request_limit, 
    monthly_request_limit, 
    daily_token_limit, 
    monthly_token_limit, 
    price_per_month, 
    features, 
    is_active,
    max_concurrent_requests
) VALUES 
-- Free Trial Plan
(
    'Free Trial',
    '3-day free trial with 500,000 tokens ($10 credits)',
    1000,  -- 1000 requests per day
    3000,  -- 3000 requests per month
    500000, -- 500,000 tokens per day
    500000, -- 500,000 tokens per month
    0.00,  -- Free
    '["3-day free trial", "500,000 tokens ($10 credits)", "1,000 requests per day", "3,000 requests per month", "5 concurrent requests", "Basic support"]'::jsonb,
    true,
    5
),
-- Starter Plan
(
    'Starter',
    'Perfect for small projects and testing',
    5000,   -- 5,000 requests per day
    150000, -- 150,000 requests per month
    1000000, -- 1M tokens per day
    1000000, -- 1M tokens per month
    20.00,  -- $20/month
    '["1M tokens per month", "150K requests per month", "10 concurrent requests", "Email support", "Basic analytics", "API access"]'::jsonb,
    true,
    10
),
-- Professional Plan
(
    'Professional',
    'Ideal for growing applications',
    20000,  -- 20,000 requests per day
    600000, -- 600,000 requests per month
    5000000, -- 5M tokens per day
    5000000, -- 5M tokens per month
    50.00,  -- $50/month
    '["5M tokens per month", "600K requests per month", "25 concurrent requests", "Priority support", "Advanced analytics", "Rate limiting controls", "Custom domains"]'::jsonb,
    true,
    25
),
-- Business Plan
(
    'Business',
    'For high-volume production applications',
    100000, -- 100,000 requests per day
    3000000, -- 3M requests per month
    25000000, -- 25M tokens per day
    25000000, -- 25M tokens per month
    100.00, -- $100/month
    '["25M tokens per month", "3M requests per month", "50 concurrent requests", "24/7 support", "Real-time analytics", "Advanced rate limiting", "Custom integrations", "SLA guarantee"]'::jsonb,
    true,
    50
),
-- Enterprise Plan
(
    'Enterprise',
    'Custom solutions for large organizations',
    500000, -- 500,000 requests per day
    15000000, -- 15M requests per month
    100000000, -- 100M tokens per day
    100000000, -- 100M tokens per month
    200.00, -- $200/month
    '["100M tokens per month", "15M requests per month", "100 concurrent requests", "Dedicated support", "Custom analytics", "White-label solution", "Custom integrations", "SLA guarantee", "On-premise option"]'::jsonb,
    true,
    100
)
ON CONFLICT (name) DO NOTHING;

-- Update existing plans if they exist
UPDATE plans SET 
    daily_request_limit = 1000,
    monthly_request_limit = 3000,
    daily_token_limit = 500000,
    monthly_token_limit = 500000,
    price_per_month = 0.00,
    features = '["3-day free trial", "500,000 tokens ($10 credits)", "1,000 requests per day", "3,000 requests per month", "5 concurrent requests", "Basic support"]'::jsonb,
    max_concurrent_requests = 5
WHERE name = 'Free Trial';

-- Add pricing tiers information
CREATE TABLE IF NOT EXISTS pricing_tiers (
    id SERIAL PRIMARY KEY,
    tier_name VARCHAR(50) UNIQUE NOT NULL,
    price_per_token DECIMAL(10, 6) NOT NULL DEFAULT 0.000020, -- $0.00002 per token
    price_per_1k_tokens DECIMAL(10, 4) NOT NULL DEFAULT 0.0200, -- $0.02 per 1K tokens
    price_per_1m_tokens DECIMAL(10, 2) NOT NULL DEFAULT 20.00, -- $20 per 1M tokens
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert standard pricing tier
INSERT INTO pricing_tiers (tier_name, price_per_token, price_per_1k_tokens, price_per_1m_tokens)
VALUES ('Standard', 0.000020, 0.0200, 20.00)
ON CONFLICT (tier_name) DO NOTHING;

-- Add trial configuration table
CREATE TABLE IF NOT EXISTS trial_config (
    id SERIAL PRIMARY KEY,
    trial_days INTEGER NOT NULL DEFAULT 3,
    trial_credits DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
    trial_tokens INTEGER NOT NULL DEFAULT 500000,
    trial_requests INTEGER NOT NULL DEFAULT 1000,
    trial_max_concurrent_requests INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert trial configuration
INSERT INTO trial_config (trial_days, trial_credits, trial_tokens, trial_requests, trial_max_concurrent_requests)
VALUES (3, 10.00, 500000, 1000, 5)
ON CONFLICT DO NOTHING;
