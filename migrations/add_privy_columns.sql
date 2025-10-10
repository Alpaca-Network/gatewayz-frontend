-- Migration: Add Privy Authentication Columns to Users Table
-- Description: Add columns needed for Privy authentication integration

-- Add display_name column for user's display name from Privy
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- Add privy_user_id column to store Privy's unique user identifier
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privy_user_id VARCHAR(255);

-- Add privy_access_token column to store Privy access token
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privy_access_token TEXT;

-- Add refresh_token column to store Privy refresh token
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS refresh_token TEXT;

-- Add last_login column to track last login time
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Create index on privy_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON users(privy_user_id);

-- Create unique constraint on privy_user_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_privy_user_id_unique ON users(privy_user_id) 
WHERE privy_user_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.display_name IS 'User display name from Privy authentication';
COMMENT ON COLUMN users.privy_user_id IS 'Unique Privy user identifier (did:privy:...)';
COMMENT ON COLUMN users.privy_access_token IS 'Privy access token for API calls';
COMMENT ON COLUMN users.refresh_token IS 'Privy refresh token for token renewal';
COMMENT ON COLUMN users.last_login IS 'Timestamp of last user login';

-- Update existing users to have default values for new columns
UPDATE users 
SET 
    display_name = username,
    last_login = registration_date
WHERE display_name IS NULL;

-- Add RLS policy for Privy users (if not already exists)
-- Users can only see their own data based on privy_user_id
DO $$
BEGIN
    -- Check if RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'users' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Create policy for Privy users if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = 'Users can view their own data by privy_user_id'
    ) THEN
        CREATE POLICY "Users can view their own data by privy_user_id" ON users
            FOR ALL USING (
                privy_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
                OR privy_user_id = current_setting('request.jwt.claims', true)::json->>'privy_user_id'
            );
    END IF;
END $$;
