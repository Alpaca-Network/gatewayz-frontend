-- =====================================================
-- Notifications System Migration
-- =====================================================
-- Creates the notifications table for tracking email and webhook notifications
-- =====================================================

-- Create notification types enum
CREATE TYPE notification_type AS ENUM (
    'low_balance',
    'trial_expiring',
    'trial_expired',
    'plan_expiring',
    'plan_expired',
    'subscription_expiring',
    'credit_added',
    'usage_alert',
    'welcome',
    'password_reset',
    'usage_report',
    'api_key_created',
    'plan_upgrade',
    'referral_signup',
    'referral_bonus'
);

-- Create notification channels enum
CREATE TYPE notification_channel AS ENUM (
    'email',
    'webhook',
    'sms'
);

-- Create notification status enum
CREATE TYPE notification_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed'
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    channel notification_channel NOT NULL DEFAULT 'email',
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status notification_status DEFAULT 'pending' NOT NULL,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON public.notifications(user_id, type);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true NOT NULL,
    low_balance_threshold NUMERIC(10,2) DEFAULT 10.0 NOT NULL,
    trial_expiry_reminder_days INTEGER DEFAULT 1 NOT NULL,
    plan_expiry_reminder_days INTEGER DEFAULT 7 NOT NULL,
    usage_alerts BOOLEAN DEFAULT true NOT NULL,
    webhook_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index on user_id for notification preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Service role can manage all notifications" ON public.notifications
    FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for notification preferences
CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own notification preferences" ON public.notification_preferences
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Service role can manage all notification preferences" ON public.notification_preferences
    FOR ALL USING (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE public.notifications IS 'Stores all notification records (email, webhook, etc.)';
COMMENT ON TABLE public.notification_preferences IS 'User preferences for notification settings';

COMMENT ON COLUMN public.notifications.type IS 'Type of notification (welcome, low_balance, etc.)';
COMMENT ON COLUMN public.notifications.channel IS 'Delivery channel (email, webhook, sms)';
COMMENT ON COLUMN public.notifications.status IS 'Delivery status (pending, sent, delivered, failed)';
COMMENT ON COLUMN public.notifications.metadata IS 'Additional data for the notification';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for notifications table
CREATE TRIGGER trigger_update_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Create trigger for notification_preferences table
CREATE TRIGGER trigger_update_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- =====================================================
-- Migration Complete
-- =====================================================

-- Verify tables were created
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
  ) AND EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'notification_preferences'
  ) THEN
    RAISE NOTICE '✓ Notifications system tables created successfully';
    RAISE NOTICE '✓ Tables: notifications, notification_preferences';
    RAISE NOTICE '✓ Enums: notification_type, notification_channel, notification_status';
    RAISE NOTICE '✓ RLS enabled with proper policies';
  ELSE
    RAISE EXCEPTION 'Failed to create notifications system tables';
  END IF;
END $$;
