-- Create payments table for Stripe payment tracking
-- Migration: 001_create_payments_table
-- Created: 2025-10-05

CREATE TABLE IF NOT EXISTS public.payments (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,

    -- User relationship
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Payment amounts
    amount_usd DECIMAL(10, 2) NOT NULL,  -- Amount in USD dollars (e.g., 29.99)
    amount_cents INTEGER NOT NULL,       -- Amount in cents (e.g., 2999)

    -- Credits
    credits_purchased INTEGER NOT NULL DEFAULT 0,  -- Credits purchased with this payment
    bonus_credits INTEGER NOT NULL DEFAULT 0,      -- Bonus credits awarded

    -- Payment details
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'stripe',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed, refunded, canceled

    -- Stripe identifiers
    stripe_payment_intent_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),

    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    -- Constraints
    CHECK (amount_usd >= 0),
    CHECK (amount_cents >= 0),
    CHECK (credits_purchased >= 0),
    CHECK (bonus_credits >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON public.payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own payments
CREATE POLICY "Users can view their own payments"
    ON public.payments
    FOR SELECT
    USING (auth.uid()::text = (SELECT privy_user_id FROM public.users WHERE id = user_id));

-- Users can insert their own payments (for checkout initiation)
CREATE POLICY "Users can insert their own payments"
    ON public.payments
    FOR INSERT
    WITH CHECK (auth.uid()::text = (SELECT privy_user_id FROM public.users WHERE id = user_id));

-- Only service role can update payments (for webhook processing)
-- This will be handled by the service role key in the backend

-- Grant permissions
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
GRANT USAGE, SELECT ON SEQUENCE payments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE payments_id_seq TO service_role;

-- Add comment
COMMENT ON TABLE public.payments IS 'Payment records for Stripe transactions and credit purchases';
