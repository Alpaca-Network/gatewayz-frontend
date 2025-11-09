-- Add subscription products configuration table
-- This replaces hardcoded tier mapping with database-driven configuration

-- Create subscription products table
CREATE TABLE IF NOT EXISTS subscription_products (
    product_id VARCHAR(255) PRIMARY KEY,
    tier VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    credits_per_month DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_subscription_products_tier ON subscription_products(tier);
CREATE INDEX IF NOT EXISTS idx_subscription_products_is_active ON subscription_products(is_active);

-- Add comments
COMMENT ON TABLE subscription_products IS 'Configuration for Stripe subscription products and tier mapping';
COMMENT ON COLUMN subscription_products.product_id IS 'Stripe product ID (e.g., prod_TKOqQPhVRxNp4Q)';
COMMENT ON COLUMN subscription_products.tier IS 'Subscription tier: basic, pro, max, enterprise, etc.';
COMMENT ON COLUMN subscription_products.display_name IS 'Display-friendly tier name (e.g., "Pro", "MAX")';
COMMENT ON COLUMN subscription_products.credits_per_month IS 'Monthly credit allocation in USD';
COMMENT ON COLUMN subscription_products.is_active IS 'Whether this product is currently active/available';

-- Insert existing product configurations
INSERT INTO subscription_products (product_id, tier, display_name, credits_per_month, description, is_active)
VALUES
    ('prod_TKOqQPhVRxNp4Q', 'pro', 'Pro', 20.00, 'Professional tier with $20 monthly credits', TRUE),
    ('prod_TKOqRE2L6qXu7s', 'max', 'MAX', 150.00, 'Maximum tier with $150 monthly credits', TRUE)
ON CONFLICT (product_id) DO NOTHING;

-- Create function to get tier from product_id
CREATE OR REPLACE FUNCTION get_tier_from_product(p_product_id VARCHAR(255))
RETURNS VARCHAR(50) AS $$
DECLARE
    v_tier VARCHAR(50);
BEGIN
    SELECT tier INTO v_tier
    FROM subscription_products
    WHERE product_id = p_product_id AND is_active = TRUE;

    -- Return 'basic' as default if product not found
    RETURN COALESCE(v_tier, 'basic');
END;
$$ LANGUAGE plpgsql;

-- Create function to get credits from tier
CREATE OR REPLACE FUNCTION get_credits_from_tier(p_tier VARCHAR(50))
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_credits DECIMAL(10,2);
BEGIN
    SELECT credits_per_month INTO v_credits
    FROM subscription_products
    WHERE tier = p_tier AND is_active = TRUE
    LIMIT 1;

    -- Return 0 as default if tier not found
    RETURN COALESCE(v_credits, 0);
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_subscription_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_products_updated_at
    BEFORE UPDATE ON subscription_products
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_products_updated_at();
