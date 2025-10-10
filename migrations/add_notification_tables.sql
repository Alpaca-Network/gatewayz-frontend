-- Add notification system tables
-- This migration creates tables for notification preferences, notifications, and templates

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    low_balance_threshold DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    trial_expiry_reminder_days INTEGER NOT NULL DEFAULT 1,
    plan_expiry_reminder_days INTEGER NOT NULL DEFAULT 7,
    usage_alerts BOOLEAN NOT NULL DEFAULT true,
    webhook_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'low_balance', 'trial_expiring', 'trial_expired', etc.
    channel VARCHAR(20) NOT NULL, -- 'email', 'webhook', 'in_app'
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'delivered'
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html_template TEXT NOT NULL,
    text_template TEXT,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default notification templates (optimized for Resend)
INSERT INTO notification_templates (id, type, subject, html_template, text_template, variables) VALUES 
(
    'low_balance_trial',
    'low_balance',
    'Low Trial Credits - {app_name}',
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Low Trial Credits Alert</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"><h1 style="margin: 0; font-size: 24px;">Low Trial Credits Alert</h1></div><div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;"><p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>{username}</strong>,</p><p style="font-size: 16px; margin-bottom: 20px;">Your trial credits are running low!</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;"><ul style="margin: 0; padding-left: 20px;"><li style="margin-bottom: 8px;"><strong>Current Credits:</strong> ${current_credits}</li><li style="margin-bottom: 8px;"><strong>Alert Threshold:</strong> ${threshold}</li>{trial_days_html}</ul></div><div style="text-align: center; margin: 30px 0;"><a href="{upgrade_url}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Plans & Upgrade</a></div><p style="font-size: 14px; color: #666; margin-top: 30px;">Best regards,<br>The <strong>{app_name}</strong> Team</p></div></body></html>',
    'Low Trial Credits Alert\n\nHello {username},\n\nYour trial credits are running low!\n\nCurrent Credits: ${current_credits}\nAlert Threshold: ${threshold}\n{trial_days_text}\n\nTo continue using the API, please upgrade to a paid plan.\n\nView Plans: {upgrade_url}\n\nBest regards,\nThe {app_name} Team',
    ARRAY['username', 'current_credits', 'threshold', 'trial_days_html', 'trial_days_text', 'upgrade_url', 'app_name']
),
(
    'low_balance_paid',
    'low_balance',
    'Low Account Balance - {app_name}',
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Low Account Balance Alert</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"><h1 style="margin: 0; font-size: 24px;">Low Account Balance Alert</h1></div><div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;"><p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>{username}</strong>,</p><p style="font-size: 16px; margin-bottom: 20px;">Your account balance is running low!</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;"><ul style="margin: 0; padding-left: 20px;"><li style="margin-bottom: 8px;"><strong>Current Credits:</strong> ${current_credits}</li><li style="margin-bottom: 8px;"><strong>Alert Threshold:</strong> ${threshold}</li><li style="margin-bottom: 8px;"><strong>Current Plan:</strong> {plan_name}</li></ul></div><div style="text-align: center; margin: 30px 0;"><a href="{billing_url}" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Add Credits Now</a></div><p style="font-size: 14px; color: #666; margin-top: 30px;">Best regards,<br>The <strong>{app_name}</strong> Team</p></div></body></html>',
    'Low Account Balance Alert\n\nHello {username},\n\nYour account balance is running low!\n\nCurrent Credits: ${current_credits}\nAlert Threshold: ${threshold}\nCurrent Plan: {plan_name}\n\nPlease add credits to your account to continue using the API.\n\nAdd Credits: {billing_url}\n\nBest regards,\nThe {app_name} Team',
    ARRAY['username', 'current_credits', 'threshold', 'plan_name', 'billing_url', 'app_name']
),
(
    'trial_expiring',
    'trial_expiring',
    'Trial Expiring Soon - {app_name}',
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Trial Expiring Soon</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: #333; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"><h1 style="margin: 0; font-size: 24px;">Trial Expiring Soon</h1></div><div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;"><p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>{username}</strong>,</p><p style="font-size: 16px; margin-bottom: 20px;">Your free trial is expiring in <strong>{remaining_days} day(s)</strong>!</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;"><ul style="margin: 0; padding-left: 20px;"><li style="margin-bottom: 8px;"><strong>Trial End Date:</strong> {trial_end_date}</li><li style="margin-bottom: 8px;"><strong>Remaining Credits:</strong> ${remaining_credits}</li><li style="margin-bottom: 8px;"><strong>Remaining Tokens:</strong> {remaining_tokens:,}</li><li style="margin-bottom: 8px;"><strong>Remaining Requests:</strong> {remaining_requests:,}</li></ul></div><div style="text-align: center; margin: 30px 0;"><a href="{upgrade_url}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Upgrade Now</a></div><p style="font-size: 14px; color: #666; margin-top: 30px;">Best regards,<br>The <strong>{app_name}</strong> Team</p></div></body></html>',
    'Trial Expiring Soon\n\nHello {username},\n\nYour free trial is expiring in {remaining_days} day(s)!\n\nTrial End Date: {trial_end_date}\nRemaining Credits: ${remaining_credits}\nRemaining Tokens: {remaining_tokens}\nRemaining Requests: {remaining_requests}\n\nTo continue using the API after your trial expires, please upgrade to a paid plan.\n\nUpgrade Now: {upgrade_url}\n\nBest regards,\nThe {app_name} Team',
    ARRAY['username', 'remaining_days', 'trial_end_date', 'remaining_credits', 'remaining_tokens', 'remaining_requests', 'upgrade_url', 'app_name']
),
(
    'trial_expired',
    'trial_expired',
    'Trial Expired - {app_name}',
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Trial Expired</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #333; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"><h1 style="margin: 0; font-size: 24px;">Trial Expired</h1></div><div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;"><p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>{username}</strong>,</p><p style="font-size: 16px; margin-bottom: 20px;">Your free trial has expired.</p><p style="font-size: 16px; margin-bottom: 20px;">To continue using the API, please upgrade to a paid plan.</p><div style="text-align: center; margin: 30px 0;"><a href="{upgrade_url}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Upgrade Now</a></div><p style="font-size: 14px; color: #666; margin-top: 30px;">Best regards,<br>The <strong>{app_name}</strong> Team</p></div></body></html>',
    'Trial Expired\n\nHello {username},\n\nYour free trial has expired.\n\nTo continue using the API, please upgrade to a paid plan.\n\nUpgrade Now: {upgrade_url}\n\nBest regards,\nThe {app_name} Team',
    ARRAY['username', 'upgrade_url', 'app_name']
),
(
    'credit_added',
    'credit_added',
    'Credits Added - {app_name}',
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Credits Added</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"><h1 style="margin: 0; font-size: 24px;">Credits Added to Your Account</h1></div><div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;"><p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>{username}</strong>,</p><p style="font-size: 16px; margin-bottom: 20px;">${credits_added} credits have been added to your account.</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;"><p style="margin: 0; font-size: 18px;"><strong>New Balance: ${new_balance}</strong></p></div><p style="font-size: 16px; margin-bottom: 20px;">Thank you for using <strong>{app_name}</strong>!</p><p style="font-size: 14px; color: #666; margin-top: 30px;">Best regards,<br>The <strong>{app_name}</strong> Team</p></div></body></html>',
    'Credits Added to Your Account\n\nHello {username},\n\n${credits_added} credits have been added to your account.\n\nNew Balance: ${new_balance}\n\nThank you for using {app_name}!\n\nBest regards,\nThe {app_name} Team',
    ARRAY['username', 'credits_added', 'new_balance', 'app_name']
),
(
    'subscription_expiring',
    'subscription_expiring',
    'Subscription Expiring Soon - {app_name}',
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Subscription Expiring Soon</title></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #333; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"><h1 style="margin: 0; font-size: 24px;">Subscription Expiring Soon</h1></div><div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;"><p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>{username}</strong>,</p><p style="font-size: 16px; margin-bottom: 20px;">Your <strong>{plan_name}</strong> subscription is expiring in <strong>{remaining_days} day(s)</strong>!</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;"><ul style="margin: 0; padding-left: 20px;"><li style="margin-bottom: 8px;"><strong>Plan:</strong> {plan_name}</li><li style="margin-bottom: 8px;"><strong>Expiry Date:</strong> {end_date}</li><li style="margin-bottom: 8px;"><strong>Remaining Days:</strong> {remaining_days}</li></ul></div><div style="text-align: center; margin: 30px 0;"><a href="{upgrade_url}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Renew Subscription</a></div><p style="font-size: 14px; color: #666; margin-top: 30px;">Best regards,<br>The <strong>{app_name}</strong> Team</p></div></body></html>',
    'Subscription Expiring Soon\n\nHello {username},\n\nYour {plan_name} subscription is expiring in {remaining_days} day(s)!\n\nPlan: {plan_name}\nExpiry Date: {end_date}\nRemaining Days: {remaining_days}\n\nTo continue using the API, please renew your subscription.\n\nRenew Subscription: {upgrade_url}\n\nBest regards,\nThe {app_name} Team',
    ARRAY['username', 'plan_name', 'remaining_days', 'end_date', 'upgrade_url', 'app_name']
)
ON CONFLICT (id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active);

-- Create function to automatically create notification preferences for new users
CREATE OR REPLACE FUNCTION create_user_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id, email_notifications, low_balance_threshold, trial_expiry_reminder_days, plan_expiry_reminder_days, usage_alerts, created_at, updated_at)
    VALUES (NEW.id, true, 10.00, 1, 7, true, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create notification preferences for new users
DROP TRIGGER IF EXISTS trigger_create_user_notification_preferences ON users;
CREATE TRIGGER trigger_create_user_notification_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_notification_preferences();

-- Create function to update notification preferences updated_at
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update notification_preferences updated_at
DROP TRIGGER IF EXISTS trigger_update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER trigger_update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Create function to update notification_templates updated_at
CREATE OR REPLACE FUNCTION update_notification_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update notification_templates updated_at
DROP TRIGGER IF EXISTS trigger_update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER trigger_update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_templates_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT ON notification_templates TO authenticated;

-- Add RLS policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- RLS policy for notification_preferences (users can only access their own)
CREATE POLICY "Users can access their own notification preferences" ON notification_preferences
    FOR ALL USING (user_id::text = auth.uid()::text);

-- RLS policy for notifications (users can only access their own)
CREATE POLICY "Users can access their own notifications" ON notifications
    FOR ALL USING (user_id::text = auth.uid()::text);

-- RLS policy for notification_templates (public read access)
CREATE POLICY "Notification templates are publicly readable" ON notification_templates
    FOR SELECT USING (true);

