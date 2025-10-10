-- ============================================
-- SIMPLE MIGRATION: Add Missing Columns (No Constraints)
-- Run this if the other migrations fail
-- ============================================

-- ============================================
-- 1. ADD MISSING COLUMNS TO USERS TABLE
-- ============================================

-- Add referral-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(8),
ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(8),
ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS has_made_first_purchase BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- ============================================
-- 2. GENERATE REFERRAL CODES FOR EXISTING USERS
-- ============================================

-- Function to generate random referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    characters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update existing users with referral codes (only if they don't have one)
UPDATE users 
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- ============================================
-- 3. CREATE ESSENTIAL MISSING TABLES
-- ============================================

-- Role permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    allowed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, resource, action)
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(8) NOT NULL,
    bonus_amount DECIMAL(10,2) DEFAULT 10.00,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    description TEXT,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    payment_id INTEGER,
    reference_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. INSERT BASIC ROLE PERMISSIONS
-- ============================================

-- Insert basic role permissions
INSERT INTO role_permissions (role, resource, action, allowed) VALUES
-- User permissions
('user', 'models', 'read', true),
('user', 'usage', 'read', true),
('user', 'profile', 'read', true),
('user', 'profile', 'update', true),
('user', 'chat', 'write', true),
('user', 'completions', 'write', true),
('user', 'api_keys', 'read', true),
('user', 'api_keys', 'create', true),
('user', 'api_keys', 'update', true),
('user', 'api_keys', 'delete', true),
('user', 'coupons', 'read', true),
('user', 'coupons', 'redeem', true),
('user', 'referrals', 'read', true),
('user', 'referrals', 'create', true),

-- Developer permissions
('developer', 'models', 'read', true),
('developer', 'usage', 'read', true),
('developer', 'profile', 'read', true),
('developer', 'profile', 'update', true),
('developer', 'chat', 'write', true),
('developer', 'completions', 'write', true),
('developer', 'api_keys', 'read', true),
('developer', 'api_keys', 'create', true),
('developer', 'api_keys', 'update', true),
('developer', 'api_keys', 'delete', true),
('developer', 'coupons', 'read', true),
('developer', 'coupons', 'redeem', true),
('developer', 'referrals', 'read', true),
('developer', 'referrals', 'create', true),
('developer', 'analytics', 'read', true),
('developer', 'debug', 'read', true),

-- Admin permissions
('admin', 'models', 'read', true),
('admin', 'models', 'write', true),
('admin', 'usage', 'read', true),
('admin', 'usage', 'write', true),
('admin', 'profile', 'read', true),
('admin', 'profile', 'update', true),
('admin', 'chat', 'write', true),
('admin', 'completions', 'write', true),
('admin', 'api_keys', 'read', true),
('admin', 'api_keys', 'create', true),
('admin', 'api_keys', 'update', true),
('admin', 'api_keys', 'delete', true),
('admin', 'coupons', 'read', true),
('admin', 'coupons', 'create', true),
('admin', 'coupons', 'update', true),
('admin', 'coupons', 'delete', true),
('admin', 'coupons', 'redeem', true),
('admin', 'referrals', 'read', true),
('admin', 'referrals', 'create', true),
('admin', 'referrals', 'update', true),
('admin', 'referrals', 'delete', true),
('admin', 'analytics', 'read', true),
('admin', 'analytics', 'write', true),
('admin', 'debug', 'read', true),
('admin', 'debug', 'write', true),
('admin', 'users', 'read', true),
('admin', 'users', 'create', true),
('admin', 'users', 'update', true),
('admin', 'users', 'delete', true),
('admin', 'roles', 'read', true),
('admin', 'roles', 'update', true),
('admin', 'payments', 'read', true),
('admin', 'payments', 'create', true),
('admin', 'payments', 'update', true),
('admin', 'payments', 'refund', true),
('admin', 'notifications', 'read', true),
('admin', 'notifications', 'create', true),
('admin', 'notifications', 'send', true),
('admin', 'rate_limits', 'read', true),
('admin', 'rate_limits', 'update', true),
('admin', 'system', 'monitor', true),
('admin', 'system', 'configure', true)
ON CONFLICT (role, resource, action) DO NOTHING;

-- ============================================
-- 5. ADD BASIC INDEXES
-- ============================================

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by_code ON users(referred_by_code);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Referral indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- ============================================
-- 6. VERIFICATION
-- ============================================

-- Check if columns were added successfully
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('referral_code', 'referred_by_code', 'balance', 'has_made_first_purchase', 'role')
ORDER BY column_name;

-- Check if tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('role_permissions', 'referrals', 'credit_transactions')
ORDER BY table_name;

-- Check role permissions
SELECT role, COUNT(*) as permission_count
FROM role_permissions 
GROUP BY role 
ORDER BY role;
