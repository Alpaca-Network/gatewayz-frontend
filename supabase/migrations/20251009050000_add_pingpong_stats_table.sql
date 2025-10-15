-- Create ping_stats table in Supabase
CREATE TABLE IF NOT EXISTS ping_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    count INTEGER NOT NULL DEFAULT 0,
    last_ping_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ping_stats_single_row CHECK (id = 1)
);

-- Insert initial row
INSERT INTO ping_stats (id, count, last_ping_at)
VALUES (1, 0, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;


-- Create function to atomically increment ping count
CREATE OR REPLACE FUNCTION increment_ping_count()
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    -- Ensure row exists
    INSERT INTO ping_stats (id, count, last_ping_at)
    VALUES (1, 0, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING;

    -- Update and return new count
    UPDATE ping_stats
    SET count = count + 1,
        last_ping_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    RETURNING count INTO new_count;

    RETURN new_count;
END;
$$ LANGUAGE plpgsql;