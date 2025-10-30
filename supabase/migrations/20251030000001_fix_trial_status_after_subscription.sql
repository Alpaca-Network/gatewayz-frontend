-- Fix trial status for users who have active subscriptions but API keys still showing as trial
-- This migration clears the is_trial flag for users with active paid subscriptions

-- Update API keys for users with active subscriptions
UPDATE api_keys_new
SET
    is_trial = FALSE,
    trial_converted = TRUE,
    subscription_status = 'active',
    subscription_plan = u.tier
FROM users u
WHERE api_keys_new.user_id = u.id
    AND u.subscription_status = 'active'
    AND u.stripe_subscription_id IS NOT NULL
    AND api_keys_new.is_trial = TRUE;

-- Log the fix
DO $$
DECLARE
    affected_count INTEGER;
BEGIN
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RAISE NOTICE 'Fixed trial status for % API keys belonging to users with active subscriptions', affected_count;
END $$;
