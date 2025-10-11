-- Add latency_ms column to usage_records table
-- This allows tracking inference latency for performance monitoring and analytics

ALTER TABLE usage_records
ADD COLUMN IF NOT EXISTS latency_ms INTEGER;

-- Add index for efficient latency-based queries
CREATE INDEX IF NOT EXISTS idx_usage_records_latency_ms
ON usage_records(latency_ms)
WHERE latency_ms IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN usage_records.latency_ms IS 'Inference latency in milliseconds for the API request';
