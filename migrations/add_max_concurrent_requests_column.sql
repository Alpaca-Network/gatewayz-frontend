-- Add missing max_concurrent_requests column to plans table
-- Run this first before running add_sample_plans.sql

ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS max_concurrent_requests INTEGER DEFAULT 5;

-- Update existing plans to have a default value
UPDATE plans SET 
    max_concurrent_requests = 5
WHERE max_concurrent_requests IS NULL;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'plans' 
AND column_name = 'max_concurrent_requests';

