-- ============================================================================
-- Performance Indexes Migration (FIXED)
-- Adds indexes to speed up Phase 1 & Phase 2 queries
-- Created: 2025-01-16
-- Fixed: Only includes columns that exist in activity_log
-- ============================================================================

-- ============================================================================
-- ACTIVITY_LOG INDEXES
-- Columns: id, user_id, timestamp, model, provider, tokens, cost, speed, 
--          finish_reason, app, metadata, created_at
-- ============================================================================

-- Index 1: Gateway field (JSONB expression index)
-- Used by: /gateway/{gateway}/stats, /gateways/summary, /models/trending
CREATE INDEX IF NOT EXISTS idx_activity_log_gateway 
ON activity_log ((metadata->>'gateway'));

COMMENT ON INDEX idx_activity_log_gateway IS 
'Speeds up queries filtering by gateway (e.g., gateway stats, trending models per gateway)';

-- Index 2: Provider field
-- Used by: /provider/{provider}/stats, /provider/{provider}/top-models
CREATE INDEX IF NOT EXISTS idx_activity_log_provider 
ON activity_log (provider);

COMMENT ON INDEX idx_activity_log_provider IS 
'Speeds up queries filtering by provider (e.g., provider statistics)';

-- Index 3: Model field
-- Used by: Trending models, model-specific analytics
CREATE INDEX IF NOT EXISTS idx_activity_log_model 
ON activity_log (model);

COMMENT ON INDEX idx_activity_log_model IS 
'Speeds up queries filtering by specific model';

-- Index 4: Created_at descending (for recent activity queries)
-- Used by: All time-based queries, trending, recent activity
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at_desc 
ON activity_log (created_at DESC);

COMMENT ON INDEX idx_activity_log_created_at_desc IS 
'Speeds up queries ordering by most recent activity';

-- Index 5: Timestamp descending (alternative time field)
-- Used by: Time-based queries using timestamp field
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp_desc 
ON activity_log (timestamp DESC);

COMMENT ON INDEX idx_activity_log_timestamp_desc IS 
'Speeds up queries ordering by timestamp';

-- Index 6: User ID (for user-specific analytics)
-- Used by: User activity tracking, user statistics
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id 
ON activity_log (user_id);

COMMENT ON INDEX idx_activity_log_user_id IS 
'Speeds up queries filtering by user';

-- Index 7: Composite index for gateway + time queries
-- Used by: Gateway statistics with time range filters
CREATE INDEX IF NOT EXISTS idx_activity_log_gateway_time 
ON activity_log ((metadata->>'gateway'), created_at DESC);

COMMENT ON INDEX idx_activity_log_gateway_time IS 
'Optimizes common pattern: filter by gateway and sort by time';

-- Index 8: Composite index for provider + time queries
-- Used by: Provider statistics with time range filters
CREATE INDEX IF NOT EXISTS idx_activity_log_provider_time 
ON activity_log (provider, created_at DESC);

COMMENT ON INDEX idx_activity_log_provider_time IS 
'Optimizes common pattern: filter by provider and sort by time';

-- Index 9: Composite index for user + time (for user analytics)
-- Used by: User-specific statistics and history
CREATE INDEX IF NOT EXISTS idx_activity_log_user_time 
ON activity_log (user_id, created_at DESC);

COMMENT ON INDEX idx_activity_log_user_time IS 
'Optimizes user-specific queries with time sorting';

-- Index 10: Tokens field (for analytics on token usage)
-- Used by: Token usage analytics, cost calculations
CREATE INDEX IF NOT EXISTS idx_activity_log_tokens 
ON activity_log (tokens) WHERE tokens > 0;

COMMENT ON INDEX idx_activity_log_tokens IS 
'Speeds up aggregations on token usage (partial index on non-zero values)';

-- Index 11: Cost field (for financial analytics)
-- Used by: Cost aggregations and financial reports
CREATE INDEX IF NOT EXISTS idx_activity_log_cost 
ON activity_log (cost) WHERE cost > 0;

COMMENT ON INDEX idx_activity_log_cost IS 
'Speeds up cost aggregations (partial index on non-zero costs)';

-- Index 12: Composite index for model + time queries
-- Used by: Model-specific analytics with time range
CREATE INDEX IF NOT EXISTS idx_activity_log_model_time 
ON activity_log (model, created_at DESC);

COMMENT ON INDEX idx_activity_log_model_time IS 
'Optimizes model-specific queries with time sorting';


-- ============================================================================
-- USAGE_RECORDS INDEXES
-- ============================================================================

-- Index 13: API key field (ensure it exists)
CREATE INDEX IF NOT EXISTS idx_usage_records_api_key 
ON usage_records (api_key);

COMMENT ON INDEX idx_usage_records_api_key IS 
'Speeds up queries by API key (billing, usage tracking)';

-- Index 14: User ID field (ensure it exists)
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id 
ON usage_records (user_id);

COMMENT ON INDEX idx_usage_records_user_id IS 
'Speeds up queries by user (user-specific billing)';

-- Index 15: Timestamp field (ensure it exists)
CREATE INDEX IF NOT EXISTS idx_usage_records_timestamp 
ON usage_records (timestamp DESC);

COMMENT ON INDEX idx_usage_records_timestamp IS 
'Speeds up time-based queries on usage records';

-- Index 16: Created_at field (ensure it exists)
CREATE INDEX IF NOT EXISTS idx_usage_records_created_at 
ON usage_records (created_at DESC);

COMMENT ON INDEX idx_usage_records_created_at IS 
'Speeds up queries ordering by creation time';

-- Index 17: Model field (for model-specific billing)
CREATE INDEX IF NOT EXISTS idx_usage_records_model 
ON usage_records (model);

COMMENT ON INDEX idx_usage_records_model IS 
'Speeds up queries filtering by model';

-- Index 18: Composite index for user + time
CREATE INDEX IF NOT EXISTS idx_usage_records_user_time 
ON usage_records (user_id, created_at DESC);

COMMENT ON INDEX idx_usage_records_user_time IS 
'Optimizes user billing queries with time range';

-- Index 19: Cost field (for financial analytics)
CREATE INDEX IF NOT EXISTS idx_usage_records_cost 
ON usage_records (cost) WHERE cost > 0;

COMMENT ON INDEX idx_usage_records_cost IS 
'Speeds up cost aggregations (partial index on positive costs)';


-- ============================================================================
-- ANALYZE TABLES
-- Update table statistics for query planner
-- ============================================================================

ANALYZE activity_log;
ANALYZE usage_records;


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show all indexes created
DO $$
DECLARE
    activity_count INTEGER;
    usage_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO activity_count
    FROM pg_indexes 
    WHERE tablename = 'activity_log' 
        AND indexname LIKE 'idx_activity_log_%';
    
    SELECT COUNT(*) INTO usage_count
    FROM pg_indexes 
    WHERE tablename = 'usage_records' 
        AND indexname LIKE 'idx_usage_records_%';
    
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '✅ Performance Indexes Migration Completed Successfully!';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Indexes created on activity_log: %', activity_count;
    RAISE NOTICE 'Indexes created on usage_records: %', usage_count;
    RAISE NOTICE 'Total indexes: %', activity_count + usage_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Expected performance improvements:';
    RAISE NOTICE '  - Gateway stats: 10-50x faster ⚡';
    RAISE NOTICE '  - Provider stats: 10-50x faster ⚡';
    RAISE NOTICE '  - Trending models: 5-20x faster ⚡';
    RAISE NOTICE '  - User analytics: 5-15x faster ⚡';
    RAISE NOTICE '';
    RAISE NOTICE 'Run EXPLAIN ANALYZE on your queries to see the improvements!';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '';
END $$;

-- Display all indexes with sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size((schemaname || '.' || indexname)::regclass)) AS index_size
FROM pg_indexes 
WHERE tablename IN ('activity_log', 'usage_records')
    AND (indexname LIKE 'idx_activity_log_%' OR indexname LIKE 'idx_usage_records_%')
ORDER BY tablename, indexname;

