-- Migration: Add Free Trial & Subscription Management
-- This migration adds trial-related fields and tables for subscription management

-- Add trial-related columns to api_keys table
ALTER TABLE api_keys 
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

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    plan_name VARCHAR(50) UNIQUE NOT NULL,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('trial', 'free', 'paid')),
    monthly_price DECIMAL(10,2) DEFAULT 0.00,
    yearly_price DECIMAL(10,2) DEFAULT 0.00,
    max_requests_per_month INTEGER DEFAULT 1000,
    max_tokens_per_month INTEGER DEFAULT 100000,
    max_requests_per_day INTEGER DEFAULT 100,
    max_tokens_per_day INTEGER DEFAULT 10000,
    max_concurrent_requests INTEGER DEFAULT 5,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trial usage tracking table
CREATE TABLE IF NOT EXISTS trial_usage_tracking (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    requests_used INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(api_key_id, usage_date)
);

-- Create subscription history table
CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    price_paid DECIMAL(10,2) DEFAULT 0.00,
    payment_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trial conversion tracking table
CREATE TABLE IF NOT EXISTS trial_conversions (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
    trial_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    conversion_date TIMESTAMP WITH TIME ZONE,
    converted_plan VARCHAR(50),
    conversion_revenue DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default subscription plans
INSERT INTO subscription_plans (plan_name, plan_type, monthly_price, yearly_price, max_requests_per_month, max_tokens_per_month, max_requests_per_day, max_tokens_per_day, max_concurrent_requests, features) VALUES
('free_trial', 'trial', 0.00, 0.00, 1000, 100000, 100, 10000, 5, '{"trial_days": 3, "trial_credits": 10.00, "features": ["basic_api_access", "rate_limiting", "usage_tracking"]}'),
('free', 'free', 0.00, 0.00, 500, 50000, 50, 5000, 2, '{"features": ["basic_api_access", "rate_limiting"]}'),
('starter', 'paid', 9.99, 99.99, 10000, 1000000, 500, 50000, 10, '{"features": ["basic_api_access", "rate_limiting", "usage_tracking", "priority_support"]}'),
('pro', 'paid', 29.99, 299.99, 50000, 5000000, 2000, 200000, 25, '{"features": ["basic_api_access", "rate_limiting", "usage_tracking", "priority_support", "advanced_analytics", "webhooks"]}'),
('enterprise', 'paid', 99.99, 999.99, 200000, 20000000, 10000, 1000000, 100, '{"features": ["basic_api_access", "rate_limiting", "usage_tracking", "priority_support", "advanced_analytics", "webhooks", "custom_integrations", "dedicated_support"]}')
ON CONFLICT (plan_name) DO NOTHING;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_trial_status ON api_keys(is_trial, trial_end_date);
CREATE INDEX IF NOT EXISTS idx_api_keys_subscription_status ON api_keys(subscription_status, subscription_end_date);
CREATE INDEX IF NOT EXISTS idx_trial_usage_tracking_api_key_date ON trial_usage_tracking(api_key_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_subscription_history_api_key ON subscription_history(api_key_id);
CREATE INDEX IF NOT EXISTS idx_trial_conversions_api_key ON trial_conversions(api_key_id);

-- Add RLS policies for trial_usage_tracking
ALTER TABLE trial_usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trial usage" ON trial_usage_tracking
    FOR SELECT USING (
        api_key_id IN (
            SELECT id FROM api_keys WHERE user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own trial usage" ON trial_usage_tracking
    FOR INSERT WITH CHECK (
        api_key_id IN (
            SELECT id FROM api_keys WHERE user_id::text = auth.uid()::text
        )
    );

-- Add RLS policies for subscription_history
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription history" ON subscription_history
    FOR SELECT USING (
        api_key_id IN (
            SELECT id FROM api_keys WHERE user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own subscription history" ON subscription_history
    FOR INSERT WITH CHECK (
        api_key_id IN (
            SELECT id FROM api_keys WHERE user_id::text = auth.uid()::text
        )
    );

-- Add RLS policies for trial_conversions
ALTER TABLE trial_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trial conversions" ON trial_conversions
    FOR SELECT USING (
        api_key_id IN (
            SELECT id FROM api_keys WHERE user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own trial conversions" ON trial_conversions
    FOR INSERT WITH CHECK (
        api_key_id IN (
            SELECT id FROM api_keys WHERE user_id::text = auth.uid()::text
        )
    );

-- Create function to check trial status
CREATE OR REPLACE FUNCTION check_trial_status(api_key_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    key_record RECORD;
    result JSONB;
BEGIN
    SELECT 
        is_trial,
        trial_start_date,
        trial_end_date,
        trial_used_tokens,
        trial_used_requests,
        trial_max_tokens,
        trial_max_requests,
        trial_converted,
        subscription_status,
        subscription_plan
    INTO key_record
    FROM api_keys 
    WHERE id = api_key_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "API key not found"}'::JSONB;
    END IF;
    
    result := jsonb_build_object(
        'is_trial', key_record.is_trial,
        'trial_start_date', key_record.trial_start_date,
        'trial_end_date', key_record.trial_end_date,
        'trial_used_tokens', key_record.trial_used_tokens,
        'trial_used_requests', key_record.trial_used_requests,
        'trial_max_tokens', key_record.trial_max_tokens,
        'trial_max_requests', key_record.trial_max_requests,
        'trial_converted', key_record.trial_converted,
        'subscription_status', key_record.subscription_status,
        'subscription_plan', key_record.subscription_plan,
        'trial_active', key_record.is_trial AND key_record.trial_end_date > NOW(),
        'trial_expired', key_record.is_trial AND key_record.trial_end_date <= NOW(),
        'trial_remaining_tokens', GREATEST(0, key_record.trial_max_tokens - key_record.trial_used_tokens),
        'trial_remaining_requests', GREATEST(0, key_record.trial_max_requests - key_record.trial_used_requests)
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to start trial
CREATE OR REPLACE FUNCTION start_trial(api_key_id INTEGER, trial_days INTEGER DEFAULT 3)
RETURNS JSONB AS $$
DECLARE
    key_record RECORD;
    trial_start TIMESTAMP WITH TIME ZONE;
    trial_end TIMESTAMP WITH TIME ZONE;
    result JSONB;
BEGIN
    -- Get current key info
    SELECT * INTO key_record FROM api_keys WHERE id = api_key_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "API key not found"}'::JSONB;
    END IF;
    
    -- Check if already has trial or subscription
    IF key_record.is_trial OR key_record.subscription_status != 'trial' THEN
        RETURN '{"error": "Trial already started or subscription active"}'::JSONB;
    END IF;
    
    -- Set trial dates
    trial_start := NOW();
    trial_end := trial_start + INTERVAL '1 day' * trial_days;
    
    -- Update api_keys table
    UPDATE api_keys SET
        is_trial = true,
        trial_start_date = trial_start,
        trial_end_date = trial_end,
        trial_used_tokens = 0,
        trial_used_requests = 0,
        trial_used_credits = 0.00,
        trial_max_tokens = 100000,
        trial_max_requests = 1000,
        trial_credits = 10.00,
        subscription_status = 'trial',
        subscription_plan = 'free_trial'
    WHERE id = api_key_id;
    
    -- Insert into trial conversions tracking
    INSERT INTO trial_conversions (api_key_id, trial_start_date, trial_end_date)
    VALUES (api_key_id, trial_start, trial_end);
    
    result := jsonb_build_object(
        'success', true,
        'trial_start_date', trial_start,
        'trial_end_date', trial_end,
        'trial_days', trial_days,
        'max_tokens', 100000,
        'max_requests', 1000,
        'trial_credits', 10.00
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to convert trial to paid
CREATE OR REPLACE FUNCTION convert_trial_to_paid(api_key_id INTEGER, plan_name VARCHAR(50))
RETURNS JSONB AS $$
DECLARE
    key_record RECORD;
    plan_record RECORD;
    conversion_date TIMESTAMP WITH TIME ZONE;
    result JSONB;
BEGIN
    -- Get current key info
    SELECT * INTO key_record FROM api_keys WHERE id = api_key_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "API key not found"}'::JSONB;
    END IF;
    
    -- Check if key is in trial
    IF NOT key_record.is_trial THEN
        RETURN '{"error": "API key is not in trial"}'::JSONB;
    END IF;
    
    -- Get plan details
    SELECT * INTO plan_record FROM subscription_plans WHERE plan_name = $2 AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN '{"error": "Subscription plan not found"}'::JSONB;
    END IF;
    
    conversion_date := NOW();
    
    -- Update api_keys table
    UPDATE api_keys SET
        is_trial = false,
        trial_converted = true,
        subscription_status = 'active',
        subscription_plan = plan_name,
        subscription_start_date = conversion_date,
        subscription_end_date = conversion_date + INTERVAL '1 month',
        auto_renew = true
    WHERE id = api_key_id;
    
    -- Update trial conversions
    UPDATE trial_conversions SET
        conversion_date = conversion_date,
        converted_plan = plan_name,
        conversion_revenue = plan_record.monthly_price
    WHERE api_key_id = api_key_id AND conversion_date IS NULL;
    
    -- Insert into subscription history
    INSERT INTO subscription_history (api_key_id, plan_name, status, start_date, end_date, price_paid)
    VALUES (api_key_id, plan_name, 'active', conversion_date, conversion_date + INTERVAL '1 month', plan_record.monthly_price);
    
    result := jsonb_build_object(
        'success', true,
        'converted_plan', plan_name,
        'conversion_date', conversion_date,
        'monthly_price', plan_record.monthly_price,
        'subscription_end_date', conversion_date + INTERVAL '1 month'
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to track trial usage
CREATE OR REPLACE FUNCTION track_trial_usage(api_key_id INTEGER, tokens_used INTEGER, requests_used INTEGER DEFAULT 1, credits_used DECIMAL(10,2) DEFAULT 0.00)
RETURNS JSONB AS $$
DECLARE
    key_record RECORD;
    today DATE;
    usage_record RECORD;
    result JSONB;
BEGIN
    today := CURRENT_DATE;
    
    -- Get current key info
    SELECT * INTO key_record FROM api_keys WHERE id = api_key_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "API key not found"}'::JSONB;
    END IF;
    
    -- Check if key is in trial
    IF NOT key_record.is_trial THEN
        RETURN '{"error": "API key is not in trial"}'::JSONB;
    END IF;
    
    -- Update daily usage tracking
    INSERT INTO trial_usage_tracking (api_key_id, usage_date, requests_used, tokens_used)
    VALUES (api_key_id, today, requests_used, tokens_used)
    ON CONFLICT (api_key_id, usage_date)
    DO UPDATE SET
        requests_used = trial_usage_tracking.requests_used + requests_used,
        tokens_used = trial_usage_tracking.tokens_used + tokens_used;
    
    -- Update total trial usage
    UPDATE api_keys SET
        trial_used_tokens = trial_used_tokens + tokens_used,
        trial_used_requests = trial_used_requests + requests_used,
        trial_used_credits = trial_used_credits + credits_used
    WHERE id = api_key_id;
    
    -- Get updated usage info
    SELECT * INTO usage_record FROM trial_usage_tracking WHERE api_key_id = api_key_id AND usage_date = today;
    
    result := jsonb_build_object(
        'success', true,
        'daily_requests_used', usage_record.requests_used,
        'daily_tokens_used', usage_record.tokens_used,
        'total_trial_requests', key_record.trial_used_requests + requests_used,
        'total_trial_tokens', key_record.trial_used_tokens + tokens_used,
        'total_trial_credits_used', key_record.trial_used_credits + credits_used,
        'remaining_tokens', GREATEST(0, key_record.trial_max_tokens - (key_record.trial_used_tokens + tokens_used)),
        'remaining_requests', GREATEST(0, key_record.trial_max_requests - (key_record.trial_used_requests + requests_used)),
        'remaining_credits', GREATEST(0, key_record.trial_credits - (key_record.trial_used_credits + credits_used))
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE subscription_plans IS 'Available subscription plans and their limits';
COMMENT ON TABLE trial_usage_tracking IS 'Daily usage tracking for trial users';
COMMENT ON TABLE subscription_history IS 'History of subscription changes and payments';
COMMENT ON TABLE trial_conversions IS 'Trial conversion tracking and analytics';

COMMENT ON FUNCTION check_trial_status(INTEGER) IS 'Check current trial status and limits for an API key';
COMMENT ON FUNCTION start_trial(INTEGER, INTEGER) IS 'Start a free trial for an API key';
COMMENT ON FUNCTION convert_trial_to_paid(INTEGER, VARCHAR) IS 'Convert trial to paid subscription';
COMMENT ON FUNCTION track_trial_usage(INTEGER, INTEGER, INTEGER, DECIMAL) IS 'Track usage for trial users with credit tracking';

-- Add additional constraints and indexes for better performance and data integrity

-- Add check constraints for trial credits
ALTER TABLE api_keys ADD CONSTRAINT check_trial_credits_positive 
    CHECK (trial_credits >= 0 AND trial_used_credits >= 0);

-- Add check constraint for trial dates
ALTER TABLE api_keys ADD CONSTRAINT check_trial_dates_valid 
    CHECK (trial_start_date IS NULL OR trial_end_date IS NULL OR trial_end_date > trial_start_date);

-- Add check constraint for subscription status
ALTER TABLE api_keys ADD CONSTRAINT check_subscription_status_valid 
    CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled', 'suspended'));

-- Add check constraint for plan type
ALTER TABLE subscription_plans ADD CONSTRAINT check_plan_type_valid 
    CHECK (plan_type IN ('trial', 'free', 'paid'));

-- Add check constraint for positive prices
ALTER TABLE subscription_plans ADD CONSTRAINT check_prices_positive 
    CHECK (monthly_price >= 0 AND yearly_price >= 0);

-- Add check constraint for positive limits
ALTER TABLE subscription_plans ADD CONSTRAINT check_limits_positive 
    CHECK (max_requests_per_month > 0 AND max_tokens_per_month > 0 AND 
           max_requests_per_day > 0 AND max_tokens_per_day > 0 AND 
           max_concurrent_requests > 0);

-- Add additional indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_api_keys_trial_dates ON api_keys(trial_start_date, trial_end_date) 
    WHERE is_trial = true;

CREATE INDEX IF NOT EXISTS idx_api_keys_subscription_dates ON api_keys(subscription_start_date, subscription_end_date) 
    WHERE subscription_status = 'active';

CREATE INDEX IF NOT EXISTS idx_trial_usage_tracking_date_range ON trial_usage_tracking(usage_date, api_key_id);

CREATE INDEX IF NOT EXISTS idx_subscription_history_dates ON subscription_history(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_trial_conversions_dates ON trial_conversions(trial_start_date, conversion_date);

-- Add function to get trial analytics
CREATE OR REPLACE FUNCTION get_trial_analytics()
RETURNS JSONB AS $$
DECLARE
    total_trials INTEGER;
    active_trials INTEGER;
    expired_trials INTEGER;
    converted_trials INTEGER;
    conversion_rate DECIMAL(5,2);
    avg_trial_duration DECIMAL(10,2);
    total_revenue DECIMAL(10,2);
    result JSONB;
BEGIN
    -- Get basic trial statistics
    SELECT 
        COUNT(*) FILTER (WHERE is_trial = true),
        COUNT(*) FILTER (WHERE is_trial = true AND trial_end_date > NOW()),
        COUNT(*) FILTER (WHERE is_trial = true AND trial_end_date <= NOW()),
        COUNT(*) FILTER (WHERE trial_converted = true)
    INTO total_trials, active_trials, expired_trials, converted_trials
    FROM api_keys;
    
    -- Calculate conversion rate
    conversion_rate := CASE 
        WHEN total_trials > 0 THEN (converted_trials::DECIMAL / total_trials * 100)
        ELSE 0 
    END;
    
    -- Calculate average trial duration (for completed trials)
    SELECT AVG(EXTRACT(EPOCH FROM (trial_end_date - trial_start_date)) / 86400)
    INTO avg_trial_duration
    FROM api_keys 
    WHERE is_trial = true AND trial_end_date IS NOT NULL AND trial_start_date IS NOT NULL;
    
    -- Calculate total revenue from conversions
    SELECT COALESCE(SUM(conversion_revenue), 0)
    INTO total_revenue
    FROM trial_conversions 
    WHERE conversion_date IS NOT NULL;
    
    result := jsonb_build_object(
        'total_trials', total_trials,
        'active_trials', active_trials,
        'expired_trials', expired_trials,
        'converted_trials', converted_trials,
        'conversion_rate', ROUND(conversion_rate, 2),
        'average_trial_duration_days', ROUND(COALESCE(avg_trial_duration, 0), 2),
        'total_revenue', total_revenue,
        'generated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to clean up expired trials
CREATE OR REPLACE FUNCTION cleanup_expired_trials()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Mark expired trials as expired
    UPDATE api_keys 
    SET subscription_status = 'expired'
    WHERE is_trial = true 
      AND trial_end_date <= NOW() 
      AND subscription_status = 'trial';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get trial usage summary
CREATE OR REPLACE FUNCTION get_trial_usage_summary(api_key_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    key_record RECORD;
    usage_summary JSONB;
BEGIN
    SELECT 
        trial_used_tokens,
        trial_used_requests,
        trial_used_credits,
        trial_max_tokens,
        trial_max_requests,
        trial_credits,
        trial_start_date,
        trial_end_date,
        is_trial,
        trial_converted
    INTO key_record
    FROM api_keys 
    WHERE id = api_key_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "API key not found"}'::JSONB;
    END IF;
    
    usage_summary := jsonb_build_object(
        'api_key_id', api_key_id,
        'is_trial', key_record.is_trial,
        'trial_converted', key_record.trial_converted,
        'trial_period', jsonb_build_object(
            'start_date', key_record.trial_start_date,
            'end_date', key_record.trial_end_date,
            'days_remaining', CASE 
                WHEN key_record.trial_end_date > NOW() THEN 
                    EXTRACT(EPOCH FROM (key_record.trial_end_date - NOW())) / 86400
                ELSE 0 
            END
        ),
        'usage', jsonb_build_object(
            'tokens_used', key_record.trial_used_tokens,
            'requests_used', key_record.trial_used_requests,
            'credits_used', key_record.trial_used_credits,
            'tokens_remaining', GREATEST(0, key_record.trial_max_tokens - key_record.trial_used_tokens),
            'requests_remaining', GREATEST(0, key_record.trial_max_requests - key_record.trial_used_requests),
            'credits_remaining', GREATEST(0, key_record.trial_credits - key_record.trial_used_credits)
        ),
        'limits', jsonb_build_object(
            'max_tokens', key_record.trial_max_tokens,
            'max_requests', key_record.trial_max_requests,
            'max_credits', key_record.trial_credits
        )
    );
    
    RETURN usage_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for new functions
COMMENT ON FUNCTION get_trial_analytics() IS 'Get comprehensive trial analytics and conversion metrics';
COMMENT ON FUNCTION cleanup_expired_trials() IS 'Mark expired trials as expired and return count of updated records';
COMMENT ON FUNCTION get_trial_usage_summary(INTEGER) IS 'Get detailed usage summary for a specific trial API key';

-- Create a view for easy trial monitoring
CREATE OR REPLACE VIEW trial_monitoring AS
SELECT 
    ak.id as api_key_id,
    ak.api_key,
    u.username,
    u.email,
    ak.is_trial,
    ak.trial_start_date,
    ak.trial_end_date,
    ak.trial_used_tokens,
    ak.trial_used_requests,
    ak.trial_used_credits,
    ak.trial_max_tokens,
    ak.trial_max_requests,
    ak.trial_credits,
    ak.trial_converted,
    ak.subscription_status,
    ak.subscription_plan,
    CASE 
        WHEN ak.trial_end_date > NOW() THEN 'active'
        WHEN ak.trial_end_date <= NOW() AND ak.is_trial = true THEN 'expired'
        WHEN ak.trial_converted = true THEN 'converted'
        ELSE 'inactive'
    END as trial_status,
    ROUND(
        (ak.trial_used_credits / NULLIF(ak.trial_credits, 0) * 100)::DECIMAL, 2
    ) as credit_usage_percentage,
    ROUND(
        (ak.trial_used_tokens / NULLIF(ak.trial_max_tokens, 0) * 100)::DECIMAL, 2
    ) as token_usage_percentage
FROM api_keys ak
JOIN users u ON ak.user_id::text = u.id::text
WHERE ak.is_trial = true OR ak.trial_converted = true;

COMMENT ON VIEW trial_monitoring IS 'Comprehensive view for monitoring trial users and their usage patterns';

-- Grant necessary permissions
GRANT SELECT ON trial_monitoring TO authenticated;
GRANT EXECUTE ON FUNCTION get_trial_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_trials() TO authenticated;
GRANT EXECUTE ON FUNCTION get_trial_usage_summary(INTEGER) TO authenticated;
