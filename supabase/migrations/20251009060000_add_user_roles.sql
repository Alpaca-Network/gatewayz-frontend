-- =====================================================
-- User Roles System Migration
-- =====================================================
-- Adds role-based access control (RBAC) to the application
-- Roles: admin, developer, user
-- =====================================================

-- Create roles enum type
CREATE TYPE user_role AS ENUM ('user', 'developer', 'admin');

-- Add role column to users table with default 'user'
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user' NOT NULL;

-- Add role metadata for additional permissions
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role_metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Add comment
COMMENT ON COLUMN public.users.role IS 'User role: user (default), developer (api access), admin (full control)';
COMMENT ON COLUMN public.users.role_metadata IS 'Additional role-specific configuration and permissions';

-- =====================================================
-- Role Permissions Table
-- =====================================================
-- Stores granular permissions for each role

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role user_role NOT NULL,
    resource VARCHAR(100) NOT NULL, -- e.g., 'coupons', 'users', 'api_keys'
    action VARCHAR(50) NOT NULL,    -- e.g., 'create', 'read', 'update', 'delete'
    allowed BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_resource ON public.role_permissions(resource);

COMMENT ON TABLE public.role_permissions IS 'Granular permissions for each user role';

-- =====================================================
-- Default Role Permissions
-- =====================================================

-- Admin permissions (full access)
INSERT INTO public.role_permissions (role, resource, action, allowed) VALUES
    -- Users management
    ('admin', 'users', 'create', true),
    ('admin', 'users', 'read', true),
    ('admin', 'users', 'update', true),
    ('admin', 'users', 'delete', true),
    ('admin', 'users', 'list', true),

    -- Coupons management
    ('admin', 'coupons', 'create', true),
    ('admin', 'coupons', 'read', true),
    ('admin', 'coupons', 'update', true),
    ('admin', 'coupons', 'delete', true),
    ('admin', 'coupons', 'list', true),
    ('admin', 'coupons', 'analytics', true),

    -- API Keys management
    ('admin', 'api_keys', 'create', true),
    ('admin', 'api_keys', 'read', true),
    ('admin', 'api_keys', 'update', true),
    ('admin', 'api_keys', 'delete', true),
    ('admin', 'api_keys', 'list', true),

    -- Plans and subscriptions
    ('admin', 'plans', 'create', true),
    ('admin', 'plans', 'read', true),
    ('admin', 'plans', 'update', true),
    ('admin', 'plans', 'delete', true),

    -- Analytics and monitoring
    ('admin', 'analytics', 'read', true),
    ('admin', 'monitoring', 'read', true),
    ('admin', 'audit_logs', 'read', true)
ON CONFLICT (role, resource, action) DO NOTHING;

-- Developer permissions (extended API access)
INSERT INTO public.role_permissions (role, resource, action, allowed) VALUES
    -- Self management
    ('developer', 'users', 'read', true),  -- Own profile
    ('developer', 'users', 'update', true), -- Own profile

    -- Coupons (can redeem)
    ('developer', 'coupons', 'redeem', true),
    ('developer', 'coupons', 'list_available', true),
    ('developer', 'coupons', 'view_history', true),

    -- API Keys (full control over own keys)
    ('developer', 'api_keys', 'create', true),
    ('developer', 'api_keys', 'read', true),
    ('developer', 'api_keys', 'update', true),
    ('developer', 'api_keys', 'delete', true),
    ('developer', 'api_keys', 'list', true),  -- Own keys only

    -- Usage and analytics (own data)
    ('developer', 'analytics', 'read', true),  -- Own usage
    ('developer', 'usage', 'read', true)
ON CONFLICT (role, resource, action) DO NOTHING;

-- User permissions (basic access)
INSERT INTO public.role_permissions (role, resource, action, allowed) VALUES
    -- Self management
    ('user', 'users', 'read', true),   -- Own profile
    ('user', 'users', 'update', true), -- Own profile

    -- Coupons (can redeem)
    ('user', 'coupons', 'redeem', true),
    ('user', 'coupons', 'list_available', true),
    ('user', 'coupons', 'view_history', true),

    -- API Keys (limited)
    ('user', 'api_keys', 'read', true),  -- View own keys
    ('user', 'api_keys', 'list', true),  -- List own keys

    -- Usage (own data only)
    ('user', 'usage', 'read', true)
ON CONFLICT (role, resource, action) DO NOTHING;

-- =====================================================
-- Role Audit Log
-- =====================================================
-- Track role changes for security

CREATE TABLE IF NOT EXISTS public.role_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    previous_role user_role,
    new_role user_role NOT NULL,
    changed_by BIGINT REFERENCES public.users(id), -- Admin who made the change
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_audit_user_id ON public.role_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_created_at ON public.role_audit_log(created_at DESC);

COMMENT ON TABLE public.role_audit_log IS 'Audit trail for role changes';

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
    p_user_id BIGINT,
    p_resource VARCHAR,
    p_action VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_role user_role;
    v_has_permission BOOLEAN;
BEGIN
    -- Get user role
    SELECT role INTO v_user_role
    FROM public.users
    WHERE id = p_user_id;

    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check permission
    SELECT COALESCE(allowed, false) INTO v_has_permission
    FROM public.role_permissions
    WHERE role = v_user_role
      AND resource = p_resource
      AND action = p_action;

    RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id BIGINT)
RETURNS TABLE(resource VARCHAR, action VARCHAR, allowed BOOLEAN) AS $$
DECLARE
    v_user_role user_role;
BEGIN
    -- Get user role
    SELECT users.role INTO v_user_role
    FROM public.users
    WHERE id = p_user_id;

    IF v_user_role IS NULL THEN
        RETURN;
    END IF;

    -- Return all permissions for this role
    RETURN QUERY
    SELECT rp.resource, rp.action, rp.allowed
    FROM public.role_permissions rp
    WHERE rp.role = v_user_role
      AND rp.allowed = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        INSERT INTO public.role_audit_log (user_id, previous_role, new_role, metadata)
        VALUES (NEW.id, OLD.role, NEW.role, jsonb_build_object(
            'changed_at', NOW(),
            'old_role_metadata', OLD.role_metadata,
            'new_role_metadata', NEW.role_metadata
        ));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_role_change
    AFTER UPDATE ON public.users
    FOR EACH ROW
    WHEN (OLD.role IS DISTINCT FROM NEW.role)
    EXECUTE FUNCTION public.log_role_change();

-- =====================================================
-- Row Level Security Policies
-- =====================================================
-- NOTE: These RLS policies are disabled because this app uses
-- custom API key authentication, not Supabase Auth.
-- Security is handled at the application level via FastAPI dependencies.

-- Enable RLS on role tables (but policies managed at app level)
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for API operations)
CREATE POLICY "Service role has full access to role_permissions"
    ON public.role_permissions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to role_audit_log"
    ON public.role_audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated reads (application handles authorization)
CREATE POLICY "Authenticated users can read role_permissions"
    ON public.role_permissions
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read role_audit_log"
    ON public.role_audit_log
    FOR SELECT
    TO authenticated
    USING (true);

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT SELECT ON public.role_permissions TO authenticated, anon, service_role;
GRANT SELECT ON public.role_audit_log TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_permission TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_permissions TO authenticated, anon, service_role;

-- =====================================================
-- Create First Admin User (Optional - Update with your user ID)
-- =====================================================

-- IMPORTANT: Update this with your actual user ID or email
-- Example: UPDATE public.users SET role = 'admin' WHERE email = 'your-admin@email.com';

-- Uncomment and update one of these:
-- UPDATE public.users SET role = 'admin' WHERE id = 1;
-- UPDATE public.users SET role = 'admin' WHERE email = 'admin@gatewayz.com';

-- =====================================================
-- Verification Queries
-- =====================================================

-- View all role permissions:
-- SELECT * FROM public.role_permissions ORDER BY role, resource, action;

-- Check user's role:
-- SELECT id, username, email, role FROM public.users WHERE email = 'your@email.com';

-- Check user's permissions:
-- SELECT * FROM public.get_user_permissions(1);

-- View role audit log:
-- SELECT * FROM public.role_audit_log ORDER BY created_at DESC;