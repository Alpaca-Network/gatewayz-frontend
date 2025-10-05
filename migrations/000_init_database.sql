-- Complete Database Schema for Gatewayz Backend
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ynleroehyrmaafkgjgmr/sql/new

-- ==================== USERS TABLE ====================

CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    api_key VARCHAR(255) UNIQUE,
    credits DECIMAL(10, 2) DEFAULT 10.00,
    is_active BOOLEAN DEFAULT true,
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    auth_method VARCHAR(50) DEFAULT 'email',
    subscription_status VARCHAR(50) DEFAULT 'trial',
    trial_expires_at TIMESTAMPTZ,
    welcome_email_sent BOOLEAN DEFAULT false,
    privy_user_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_api_key ON public.users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON public.users(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscription_status);

-- Enable RLS on users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view their own data"
    ON public.users
    FOR SELECT
    USING (auth.uid()::text = privy_user_id);

CREATE POLICY "Service role has full access to users"
    ON public.users
    FOR ALL
    USING (true);

-- ==================== API KEYS TABLE ====================

CREATE TABLE IF NOT EXISTS public.api_keys_new (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_name VARCHAR(255) NOT NULL,
    environment_tag VARCHAR(50) DEFAULT 'live',
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    scope_permissions JSONB DEFAULT '{}'::jsonb,
    ip_allowlist TEXT[] DEFAULT ARRAY[]::TEXT[],
    domain_referrers TEXT[] DEFAULT ARRAY[]::TEXT[],
    expiration_date TIMESTAMPTZ,
    max_requests INTEGER,
    requests_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for api_keys_new
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys_new(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON public.api_keys_new(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys_new(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_environment ON public.api_keys_new(environment_tag);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON public.api_keys_new(is_active);

-- Enable RLS on api_keys_new
ALTER TABLE public.api_keys_new ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys_new
CREATE POLICY "Users can view their own API keys"
    ON public.api_keys_new
    FOR SELECT
    USING (user_id IN (SELECT id FROM public.users WHERE privy_user_id = auth.uid()::text));

CREATE POLICY "Service role has full access to api_keys"
    ON public.api_keys_new
    FOR ALL
    USING (true);

-- ==================== PAYMENTS TABLE ====================

CREATE TABLE IF NOT EXISTS public.payments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount_usd DECIMAL(10, 2) NOT NULL,
    amount_cents INTEGER NOT NULL,
    credits_purchased INTEGER NOT NULL DEFAULT 0,
    bonus_credits INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'stripe',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    stripe_payment_intent_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    CHECK (amount_usd >= 0),
    CHECK (amount_cents >= 0),
    CHECK (credits_purchased >= 0),
    CHECK (bonus_credits >= 0)
);

-- Create indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON public.payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Users can view their own payments"
    ON public.payments
    FOR SELECT
    USING (user_id IN (SELECT id FROM public.users WHERE privy_user_id = auth.uid()::text));

CREATE POLICY "Service role has full access to payments"
    ON public.payments
    FOR ALL
    USING (true);

-- ==================== UPDATE TRIGGERS ====================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys_new;
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys_new
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== GRANT PERMISSIONS ====================

-- Grant permissions to authenticated users
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.api_keys_new TO authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- Grant all permissions to service_role
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.api_keys_new TO service_role;
GRANT ALL ON public.payments TO service_role;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ==================== COMMENTS ====================

COMMENT ON TABLE public.users IS 'User accounts and authentication';
COMMENT ON TABLE public.api_keys_new IS 'API keys for user authentication with advanced security features';
COMMENT ON TABLE public.payments IS 'Payment records for Stripe transactions and credit purchases';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database initialization complete!';
    RAISE NOTICE 'Created tables: users, api_keys_new, payments';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify tables in Supabase Table Editor';
    RAISE NOTICE '2. Test connection from backend';
    RAISE NOTICE '3. Create first user via /auth/register';
END $$;
