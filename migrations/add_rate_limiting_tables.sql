-- Migration: Add Advanced Rate Limiting Tables
-- Description: Add tables for advanced rate limiting, caching, and monitoring

-- Add rate_limit_config column to existing api_keys table
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS rate_limit_config JSONB DEFAULT '{
    "requests_per_minute": 60,
    "requests_per_hour": 1000,
    "requests_per_day": 10000,
    "tokens_per_minute": 10000,
    "tokens_per_hour": 100000,
    "tokens_per_day": 1000000,
    "burst_limit": 10,
    "concurrency_limit": 5,
    "window_size_seconds": 60
}'::jsonb;

-- Create rate limit alerts table
CREATE TABLE IF NOT EXISTS rate_limit_alerts (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255)
);

-- Create index for rate limit alerts
CREATE INDEX IF NOT EXISTS idx_rate_limit_alerts_api_key ON rate_limit_alerts(api_key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_alerts_created_at ON rate_limit_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_alerts_resolved ON rate_limit_alerts(resolved);

-- Create rate limit cache table for distributed caching
CREATE TABLE IF NOT EXISTS rate_limit_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for rate limit cache expiration
CREATE INDEX IF NOT EXISTS idx_rate_limit_cache_expires_at ON rate_limit_cache(expires_at);

-- Create rate limit usage tracking table
CREATE TABLE IF NOT EXISTS rate_limit_usage (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) NOT NULL,
    time_window VARCHAR(20) NOT NULL, -- 'minute', 'hour', 'day'
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for rate limit usage
CREATE INDEX IF NOT EXISTS idx_rate_limit_usage_api_key ON rate_limit_usage(api_key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_usage_time_window ON rate_limit_usage(time_window);
CREATE INDEX IF NOT EXISTS idx_rate_limit_usage_window_start ON rate_limit_usage(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_usage_window_end ON rate_limit_usage(window_end);

-- Create concurrent request tracking table
CREATE TABLE IF NOT EXISTS concurrent_requests (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) NOT NULL,
    request_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    request_type VARCHAR(50) DEFAULT 'api'
);

-- Create indexes for concurrent requests
CREATE INDEX IF NOT EXISTS idx_concurrent_requests_api_key ON concurrent_requests(api_key);
CREATE INDEX IF NOT EXISTS idx_concurrent_requests_expires_at ON concurrent_requests(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_concurrent_requests_request_id ON concurrent_requests(request_id);

-- Create burst token tracking table
CREATE TABLE IF NOT EXISTS burst_tokens (
    api_key VARCHAR(255) PRIMARY KEY,
    tokens_remaining INTEGER NOT NULL DEFAULT 0,
    last_refill TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    refill_rate DECIMAL(10,4) DEFAULT 0.1667, -- tokens per second (10 tokens per minute)
    max_tokens INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for burst tokens
CREATE INDEX IF NOT EXISTS idx_burst_tokens_last_refill ON burst_tokens(last_refill);

-- Add RLS policies for security
ALTER TABLE rate_limit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurrent_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE burst_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy for rate_limit_alerts (users can only see their own alerts)
CREATE POLICY "Users can view their own rate limit alerts" ON rate_limit_alerts
    FOR SELECT USING (
        api_key IN (
            SELECT api_key FROM api_keys WHERE user_id = auth.uid()
        )
    );

-- RLS Policy for rate_limit_usage (users can only see their own usage)
CREATE POLICY "Users can view their own rate limit usage" ON rate_limit_usage
    FOR SELECT USING (
        api_key IN (
            SELECT api_key FROM api_keys WHERE user_id = auth.uid()
        )
    );

-- RLS Policy for concurrent_requests (users can only see their own concurrent requests)
CREATE POLICY "Users can view their own concurrent requests" ON concurrent_requests
    FOR SELECT USING (
        api_key IN (
            SELECT api_key FROM api_keys WHERE user_id = auth.uid()
        )
    );

-- RLS Policy for burst_tokens (users can only see their own burst tokens)
CREATE POLICY "Users can view their own burst tokens" ON burst_tokens
    FOR SELECT USING (
        api_key IN (
            SELECT api_key FROM api_keys WHERE user_id = auth.uid()
        )
    );

-- Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limit_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_cache WHERE expires_at < NOW();
    DELETE FROM concurrent_requests WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old usage records (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_usage()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_usage WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create function to update burst tokens
CREATE OR REPLACE FUNCTION update_burst_tokens(p_api_key VARCHAR(255), p_tokens_used INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_tokens INTEGER;
    refill_rate DECIMAL(10,4);
    max_tokens INTEGER;
    time_passed DECIMAL(10,4);
    tokens_to_add INTEGER;
    new_tokens INTEGER;
BEGIN
    -- Get current token state
    SELECT tokens_remaining, burst_tokens.refill_rate, burst_tokens.max_tokens
    INTO current_tokens, refill_rate, max_tokens
    FROM burst_tokens
    WHERE api_key = p_api_key;
    
    -- If no record exists, create one
    IF NOT FOUND THEN
        INSERT INTO burst_tokens (api_key, tokens_remaining, max_tokens, refill_rate)
        VALUES (p_api_key, 10, 10, 0.1667)
        ON CONFLICT (api_key) DO NOTHING;
        
        SELECT tokens_remaining, burst_tokens.refill_rate, burst_tokens.max_tokens
        INTO current_tokens, refill_rate, max_tokens
        FROM burst_tokens
        WHERE api_key = p_api_key;
    END IF;
    
    -- Calculate time passed and tokens to add
    time_passed := EXTRACT(EPOCH FROM (NOW() - last_refill)) FROM burst_tokens WHERE api_key = p_api_key;
    tokens_to_add := LEAST(max_tokens, FLOOR(time_passed * refill_rate));
    new_tokens := LEAST(max_tokens, current_tokens + tokens_to_add);
    
    -- Update tokens
    UPDATE burst_tokens
    SET 
        tokens_remaining = new_tokens - p_tokens_used,
        last_refill = NOW(),
        updated_at = NOW()
    WHERE api_key = p_api_key;
    
    -- Return remaining tokens
    RETURN GREATEST(0, new_tokens - p_tokens_used);
END;
$$ LANGUAGE plpgsql;

-- Create function to track concurrent requests
CREATE OR REPLACE FUNCTION track_concurrent_request(p_api_key VARCHAR(255), p_request_id VARCHAR(255), p_request_type VARCHAR(50) DEFAULT 'api')
RETURNS BOOLEAN AS $$
DECLARE
    concurrency_limit INTEGER;
    current_count INTEGER;
BEGIN
    -- Get concurrency limit for this API key
    SELECT (rate_limit_config->>'concurrency_limit')::INTEGER
    INTO concurrency_limit
    FROM api_keys
    WHERE api_key = p_api_key;
    
    -- Default concurrency limit if not set
    IF concurrency_limit IS NULL THEN
        concurrency_limit := 5;
    END IF;
    
    -- Count current concurrent requests
    SELECT COUNT(*)
    INTO current_count
    FROM concurrent_requests
    WHERE api_key = p_api_key AND expires_at > NOW();
    
    -- Check if we can add another request
    IF current_count >= concurrency_limit THEN
        RETURN FALSE;
    END IF;
    
    -- Add the request
    INSERT INTO concurrent_requests (api_key, request_id, expires_at, request_type)
    VALUES (p_api_key, p_request_id, NOW() + INTERVAL '5 minutes', p_request_type);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to remove concurrent request
CREATE OR REPLACE FUNCTION remove_concurrent_request(p_request_id VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM concurrent_requests WHERE request_id = p_request_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_keys_rate_limit_config ON api_keys USING GIN (rate_limit_config);
CREATE INDEX IF NOT EXISTS idx_usage_records_api_key_created_at ON usage_records(api_key, created_at);

-- Add comments for documentation
COMMENT ON TABLE rate_limit_alerts IS 'Rate limit violation alerts and monitoring';
COMMENT ON TABLE rate_limit_cache IS 'Distributed rate limit cache for Redis fallback';
COMMENT ON TABLE rate_limit_usage IS 'Detailed rate limit usage tracking by time window';
COMMENT ON TABLE concurrent_requests IS 'Active concurrent request tracking';
COMMENT ON TABLE burst_tokens IS 'Burst token bucket tracking for rate limiting';

COMMENT ON COLUMN api_keys.rate_limit_config IS 'JSON configuration for advanced rate limiting per API key';
COMMENT ON COLUMN rate_limit_alerts.alert_type IS 'Type of rate limit alert (rate_limit_exceeded, burst_exceeded, etc.)';
COMMENT ON COLUMN rate_limit_alerts.details IS 'Additional details about the rate limit violation';
COMMENT ON COLUMN rate_limit_usage.time_window IS 'Time window for usage tracking (minute, hour, day)';
COMMENT ON COLUMN concurrent_requests.request_id IS 'Unique identifier for the concurrent request';
COMMENT ON COLUMN burst_tokens.refill_rate IS 'Tokens refilled per second for burst limiting';
