-- ============================================
-- Coupon System Migration
-- ============================================
-- Description: Implements a flexible coupon system with:
--   - User-specific coupons (one user, one-time use)
--   - Global coupons (multiple users, one-time per user)
--   - Full audit trail and redemption tracking
--
-- Author: System
-- Date: 2025-01-08
-- ============================================

-- Create enum types for coupon system
-- ============================================

-- Coupon scope: user_specific or global
CREATE TYPE coupon_scope_type AS ENUM ('user_specific', 'global');

-- Coupon type: categorizes the purpose
CREATE TYPE coupon_type_enum AS ENUM (
  'promotional',    -- Marketing campaigns
  'referral',       -- Referral rewards
  'compensation',   -- Service issue compensation
  'partnership'     -- Partner/co-marketing
);

-- Creator type: who created the coupon
CREATE TYPE creator_type_enum AS ENUM ('admin', 'system');


-- ============================================
-- Table: coupons
-- ============================================
CREATE TABLE IF NOT EXISTS public.coupons (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- Coupon identification
  code VARCHAR(50) NOT NULL UNIQUE,

  -- Coupon value and scope
  value_usd DECIMAL(10,2) NOT NULL CHECK (value_usd > 0 AND value_usd <= 1000),
  coupon_scope coupon_scope_type NOT NULL DEFAULT 'global',

  -- User assignment (for user-specific coupons) - BIGINT to match users.id
  assigned_to_user_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,

  -- Usage tracking
  max_uses INTEGER NOT NULL CHECK (max_uses > 0),
  times_used INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),

  -- Time validity
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Creation tracking - BIGINT to match users.id
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_type creator_type_enum NOT NULL DEFAULT 'admin',

  -- Metadata
  description TEXT,
  coupon_type coupon_type_enum NOT NULL DEFAULT 'promotional',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (valid_until > valid_from),
  CONSTRAINT user_specific_must_have_user CHECK (
    (coupon_scope = 'user_specific' AND assigned_to_user_id IS NOT NULL)
    OR
    (coupon_scope = 'global' AND assigned_to_user_id IS NULL)
  ),
  CONSTRAINT user_specific_max_uses CHECK (
    (coupon_scope = 'user_specific' AND max_uses = 1)
    OR
    (coupon_scope = 'global')
  ),
  CONSTRAINT times_used_within_limit CHECK (times_used <= max_uses)
);

-- Add comments
COMMENT ON TABLE public.coupons IS 'Stores all coupon definitions (user-specific and global)';
COMMENT ON COLUMN public.coupons.coupon_scope IS 'Determines if coupon is for one user or everyone';
COMMENT ON COLUMN public.coupons.assigned_to_user_id IS 'User who can redeem (null for global coupons)';
COMMENT ON COLUMN public.coupons.max_uses IS 'Total redemptions allowed (always 1 for user-specific)';
COMMENT ON COLUMN public.coupons.times_used IS 'Current number of redemptions';


-- ============================================
-- Table: coupon_redemptions
-- ============================================
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign keys - BIGINT to match parent tables
  coupon_id BIGINT NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Redemption details
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  value_applied DECIMAL(10,2) NOT NULL CHECK (value_applied > 0),

  -- Balance tracking
  user_balance_before DECIMAL(10,2) NOT NULL,
  user_balance_after DECIMAL(10,2) NOT NULL,

  -- Audit/fraud detection
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Unique constraint: ONE redemption per user per coupon
  CONSTRAINT uq_coupon_user UNIQUE (coupon_id, user_id),

  -- Ensure balance math is correct
  CONSTRAINT balance_change_matches_value CHECK (
    user_balance_after = user_balance_before + value_applied
  )
);

-- Add comments
COMMENT ON TABLE public.coupon_redemptions IS 'Tracks all coupon redemptions with full audit trail';
COMMENT ON CONSTRAINT uq_coupon_user ON public.coupon_redemptions IS 'Enforces one-time redemption per user per coupon';


-- ============================================
-- Indexes for Performance
-- ============================================

-- coupons table indexes
CREATE INDEX idx_coupons_code_upper ON public.coupons (UPPER(code));
CREATE INDEX idx_coupons_assigned_user ON public.coupons (assigned_to_user_id, is_active) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_coupons_active_global ON public.coupons (coupon_scope, is_active, valid_until) WHERE coupon_scope = 'global';
CREATE INDEX idx_coupons_created_by ON public.coupons (created_by, created_at);
CREATE INDEX idx_coupons_validity ON public.coupons (valid_from, valid_until, is_active) WHERE is_active = true;

-- coupon_redemptions table indexes
CREATE INDEX idx_redemptions_user ON public.coupon_redemptions (user_id, redeemed_at);
CREATE INDEX idx_redemptions_coupon ON public.coupon_redemptions (coupon_id, redeemed_at);
CREATE INDEX idx_redemptions_timestamp ON public.coupon_redemptions (redeemed_at DESC);
CREATE INDEX idx_redemptions_ip ON public.coupon_redemptions (ip_address) WHERE ip_address IS NOT NULL;


-- ============================================
-- Triggers for Auto-Update
-- ============================================

-- Auto-update updated_at timestamp on coupons
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on both tables
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Coupons policies
-- ----------------
-- Note: Since your app uses service_role key for backend operations,
-- these policies allow full access. Access control is handled in your application layer.

-- Allow service_role full access
CREATE POLICY "Service role has full access to coupons"
  ON public.coupons
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read active coupons (optional, for future frontend use)
CREATE POLICY "Authenticated users can view active coupons"
  ON public.coupons
  FOR SELECT
  USING (
    is_active = true
    AND CURRENT_TIMESTAMP BETWEEN valid_from AND valid_until
  );


-- Coupon redemptions policies
-- ---------------------------

-- Allow service_role full access
CREATE POLICY "Service role has full access to redemptions"
  ON public.coupon_redemptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read their own redemptions (optional)
CREATE POLICY "Users can view redemptions"
  ON public.coupon_redemptions
  FOR SELECT
  USING (true);


-- ============================================
-- Helper Functions
-- ============================================

-- Function to check if a coupon is valid for redemption
CREATE OR REPLACE FUNCTION public.is_coupon_redeemable(
  p_coupon_code VARCHAR(50),
  p_user_id BIGINT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_code VARCHAR(50),
  error_message TEXT,
  coupon_id BIGINT,
  coupon_value DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon RECORD;
  v_already_redeemed BOOLEAN;
BEGIN
  -- Find the coupon (case-insensitive)
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE UPPER(code) = UPPER(p_coupon_code);

  -- Check if coupon exists
  IF v_coupon IS NULL THEN
    RETURN QUERY SELECT false, 'COUPON_NOT_FOUND', 'Invalid coupon code', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check if active
  IF v_coupon.is_active = false THEN
    RETURN QUERY SELECT false, 'COUPON_INACTIVE', 'Coupon is no longer available', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check time validity
  IF CURRENT_TIMESTAMP < v_coupon.valid_from THEN
    RETURN QUERY SELECT false, 'COUPON_NOT_YET_ACTIVE', 'Coupon is not yet active', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  IF CURRENT_TIMESTAMP > v_coupon.valid_until THEN
    RETURN QUERY SELECT false, 'COUPON_EXPIRED', 'Coupon has expired', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check if user-specific and assigned to this user
  IF v_coupon.coupon_scope = 'user_specific' AND v_coupon.assigned_to_user_id != p_user_id THEN
    RETURN QUERY SELECT false, 'COUPON_NOT_ASSIGNED', 'This coupon is not valid for your account', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check max uses (for global coupons)
  IF v_coupon.coupon_scope = 'global' AND v_coupon.times_used >= v_coupon.max_uses THEN
    RETURN QUERY SELECT false, 'MAX_USES_EXCEEDED', 'Coupon has reached maximum usage limit', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- Check if user already redeemed this coupon
  SELECT EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id
  ) INTO v_already_redeemed;

  IF v_already_redeemed THEN
    RETURN QUERY SELECT false, 'ALREADY_REDEEMED', 'You have already redeemed this coupon', NULL::BIGINT, NULL::DECIMAL(10,2);
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, NULL::VARCHAR(50), NULL::TEXT, v_coupon.id, v_coupon.value_usd;
END;
$$;

COMMENT ON FUNCTION public.is_coupon_redeemable IS 'Validates if a coupon can be redeemed by a user';


-- Function to get available coupons for a user
CREATE OR REPLACE FUNCTION public.get_available_coupons(p_user_id BIGINT)
RETURNS TABLE (
  coupon_id BIGINT,
  code VARCHAR(50),
  value_usd DECIMAL(10,2),
  coupon_scope coupon_scope_type,
  coupon_type coupon_type_enum,
  description TEXT,
  valid_until TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  times_used INTEGER,
  remaining_uses INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.code,
    c.value_usd,
    c.coupon_scope,
    c.coupon_type,
    c.description,
    c.valid_until,
    c.max_uses,
    c.times_used,
    (c.max_uses - c.times_used) AS remaining_uses
  FROM public.coupons c
  WHERE c.is_active = true
    AND CURRENT_TIMESTAMP BETWEEN c.valid_from AND c.valid_until
    AND (
      -- User-specific coupons for this user
      (c.coupon_scope = 'user_specific' AND c.assigned_to_user_id = p_user_id)
      OR
      -- Global coupons not yet redeemed by this user
      (c.coupon_scope = 'global'
       AND c.times_used < c.max_uses
       AND NOT EXISTS (
         SELECT 1 FROM public.coupon_redemptions r
         WHERE r.coupon_id = c.id AND r.user_id = p_user_id
       ))
    )
  ORDER BY c.value_usd DESC, c.valid_until ASC;
END;
$$;

COMMENT ON FUNCTION public.get_available_coupons IS 'Returns all coupons available for a specific user';


-- ============================================
-- Sample Data (Optional - for testing)
-- ============================================

-- Uncomment to insert sample data for testing
/*
-- Insert a test global coupon
INSERT INTO public.coupons (
  code,
  value_usd,
  coupon_scope,
  max_uses,
  valid_from,
  valid_until,
  description,
  coupon_type,
  created_by_type
) VALUES (
  'WELCOME2024',
  10.00,
  'global',
  1000,
  NOW(),
  NOW() + INTERVAL '30 days',
  'Welcome promotion for new users',
  'promotional',
  'admin'
);

-- Note: User-specific coupons should be created by application logic
-- when you have actual user IDs to assign them to
*/


-- ============================================
-- Migration Complete
-- ============================================

-- Verify tables were created
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'coupons'
  ) AND EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'coupon_redemptions'
  ) THEN
    RAISE NOTICE '✓ Coupon system tables created successfully';
    RAISE NOTICE '✓ Tables: coupons, coupon_redemptions';
    RAISE NOTICE '✓ Functions: is_coupon_redeemable, get_available_coupons';
    RAISE NOTICE '✓ RLS enabled with service_role access';
  ELSE
    RAISE EXCEPTION 'Failed to create coupon system tables';
  END IF;
END $$;