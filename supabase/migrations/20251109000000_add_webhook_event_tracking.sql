-- Add webhook event tracking for idempotency
-- This prevents duplicate processing of Stripe webhook events

-- Create table to track processed webhook events
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON stripe_webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON stripe_webhook_events(created_at);

-- Add comments to document the table
COMMENT ON TABLE stripe_webhook_events IS 'Tracks processed Stripe webhook events for idempotency';
COMMENT ON COLUMN stripe_webhook_events.event_id IS 'Stripe event ID (evt_xxx)';
COMMENT ON COLUMN stripe_webhook_events.event_type IS 'Stripe event type (e.g., invoice.paid)';
COMMENT ON COLUMN stripe_webhook_events.processed_at IS 'Timestamp when event was processed';
COMMENT ON COLUMN stripe_webhook_events.user_id IS 'User ID associated with the event (if applicable)';
COMMENT ON COLUMN stripe_webhook_events.metadata IS 'Additional event metadata for debugging';

-- Create cleanup function to remove old events (older than 90 days)
-- This prevents the table from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events() RETURNS void AS $$
BEGIN
    DELETE FROM stripe_webhook_events
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
