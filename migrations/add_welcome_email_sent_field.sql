-- Add welcome_email_sent field to users table
-- This field tracks whether a welcome email has been sent to the user

ALTER TABLE users 
ADD COLUMN welcome_email_sent BOOLEAN DEFAULT FALSE;

-- Update existing users to have welcome_email_sent = true
-- since they've already been created and likely received welcome emails
UPDATE users 
SET welcome_email_sent = TRUE 
WHERE welcome_email_sent IS NULL;

-- Add index for better query performance
CREATE INDEX idx_users_welcome_email_sent ON users(welcome_email_sent);

-- Add comment to document the field
COMMENT ON COLUMN users.welcome_email_sent IS 'Tracks whether a welcome email has been sent to this user';
