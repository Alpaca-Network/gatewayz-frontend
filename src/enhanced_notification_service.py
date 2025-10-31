#!/usr/bin/.env python3
"""
Enhanced Notification Service with Professional Email Templates
Adds welcome emails, password reset, usage reports, and more
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import json
import resend
import secrets

from src.schemas.notification import (
    NotificationPreferences, NotificationType,
    NotificationChannel, NotificationStatus, SendNotificationRequest
)
from src.services.professional_email_templates import email_templates
import src.config.supabase_config as supabase_config

logger = logging.getLogger(__name__)

class EnhancedNotificationService:
    """Enhanced notification service with professional email templates"""
    
    def __init__(self):
        try:
            self.supabase = supabase_config.get_supabase_client()
        except Exception as exc:
            logger.warning(
                "Supabase client unavailable during notification service init: %s", exc
            )
            self.supabase = None
        self.resend_api_key = os.environ.get("RESEND_API_KEY")
        self.from_email = os.environ.get("FROM_EMAIL", "noreply@yourdomain.com")
        self.app_name = os.environ.get("APP_NAME", "AI Gateway")
        self.app_url = os.environ.get("APP_URL", "https://gatewayz.ai")
        
        # Initialize Resend client
        if self.resend_api_key:
            resend.api_key = self.resend_api_key
    
    def send_welcome_email(self, user_id: int, username: str, email: str, credits: int) -> bool:
        """Send welcome email to new users (API key not included for security)"""
        try:
            logger.info(f"Enhanced notification service - sending welcome email to: {email}")
            logger.info(f"Resend API key available: {bool(self.resend_api_key)}")
            logger.info(f"From email: {self.from_email}")
            logger.info(f"App name: {self.app_name}")
            
            # Use the simple welcome email template
            template = email_templates.simple_welcome_email(username, email, credits)
            logger.info(f"Email template generated successfully")
            
            success = self.send_email_notification(
                to_email=email,
                subject=template["subject"],
                html_content=template["html"],
                text_content=template["text"]
            )
            
            logger.info(f"Email notification result: {success}")
            
            if success:
                # Create notification record
                request = SendNotificationRequest(
                    user_id=user_id,
                    type=NotificationType.CREDIT_ADDED,  # Using closest type
                    channel=NotificationChannel.EMAIL,
                    subject=template["subject"],
                    content=template["html"],
                    metadata={
                        'email_type': 'welcome',
                        'api_key_provided': True,
                        'credits_provided': credits
                    }
                )
                self.create_notification(request)
                logger.info(f"Welcome email sent to {email}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending welcome email: {e}")
            logger.error(f"Error details: {str(e)}", exc_info=True)
            return False
    
    def send_welcome_email_if_needed(self, user_id: int, username: str, email: str, credits: int) -> bool:
        """Send welcome email only if the user hasn't received one yet"""
        try:
            # Check if user has already received a welcome email
            client = self.supabase or supabase_config.get_supabase_client()
            user_result = client.table('users').select('welcome_email_sent').eq('id', user_id).execute()
            
            if not user_result.data:
                logger.warning(f"User {user_id} not found, skipping welcome email")
                return False
            
            user_data = user_result.data[0]
            welcome_email_sent = user_data.get('welcome_email_sent', False)
            
            if welcome_email_sent:
                logger.info(f"User {user_id} has already received welcome email, skipping")
                return True
            
            # Send welcome email
            success = self.send_welcome_email(user_id, username, email, credits)
            
            if success:
                # Mark welcome email as sent
                from src.db.users import mark_welcome_email_sent
                mark_welcome_email_sent(user_id)
                logger.info(f"Welcome email sent and marked as sent for user {user_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error checking/sending welcome email: {e}")
            return False
    
    def send_password_reset_email(self, user_id: int, username: str, email: str) -> Optional[str]:
        """Send password reset email and return reset token"""
        try:
            # Generate reset token
            reset_token = secrets.token_urlsafe(32)
            
            # Store token in database with expiration
            expires_at = datetime.utcnow() + timedelta(hours=1)
            client = self.supabase or supabase_config.get_supabase_client()
            client.table('password_reset_tokens').insert({
                'user_id': user_id,
                'token': reset_token,
                'expires_at': expires_at.isoformat(),
                'used': False
            }).execute()
            
            # Send email
            template = email_templates.password_reset_email(username, email, reset_token)
            
            success = self.send_email_notification(
                to_email=email,
                subject=template["subject"],
                html_content=template["html"],
                text_content=template["text"]
            )
            
            if success:
                logger.info(f"Password reset email sent to {email}")
                return reset_token
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error sending password reset email: {e}")
            return None
    
    def send_monthly_usage_report(self, user_id: int, username: str, email: str, month: str, usage_stats: Dict[str, Any]) -> bool:
        """Send monthly usage report email"""
        try:
            template = email_templates.monthly_usage_report(username, email, month, usage_stats)
            
            success = self.send_email_notification(
                to_email=email,
                subject=template["subject"],
                html_content=template["html"],
                text_content=template["text"]
            )
            
            if success:
                # Create notification record
                request = SendNotificationRequest(
                    user_id=user_id,
                    type=NotificationType.USAGE_ALERT,
                    channel=NotificationChannel.EMAIL,
                    subject=template["subject"],
                    content=template["html"],
                    metadata={
                        'email_type': 'usage_report',
                        'month': month,
                        'usage_stats': usage_stats
                    }
                )
                self.create_notification(request)
                logger.info(f"Monthly usage report sent to {email}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending monthly usage report: {e}")
            return False
    
    def send_plan_upgrade_confirmation(self, user_id: int, username: str, email: str, old_plan: str, new_plan: str, effective_date: str) -> bool:
        """Send plan upgrade confirmation email"""
        try:
            content = f"""
                <h2>🎉 Plan Upgraded Successfully!</h2>
                <p>Hi <strong>{username}</strong>,</p>
                <p>Congratulations! Your plan has been successfully upgraded.</p>
                
                <div class="success-box">
                    <h3 style="margin-bottom: 12px; color: #065f46;">Upgrade Details</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="label">Previous Plan</div>
                            <div class="value">{old_plan}</div>
                        </div>
                        <div class="info-item">
                            <div class="label">New Plan</div>
                            <div class="value">{new_plan}</div>
                        </div>
                        <div class="info-item">
                            <div class="label">Effective Date</div>
                            <div class="value">{effective_date}</div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{self.app_url}/settings/credits" class="cta-button">📊 View Dashboard</a>
                    <a href="{self.app_url}/billing" class="cta-button secondary-button">💳 Billing Details</a>
                </div>
                
                <p>You now have access to all the features of your new plan. If you have any questions, contact our support team at <a href="mailto:{self.from_email}" style="color: #3b82f6;">{self.from_email}</a>.</p>
            """
            
            subject = f"Plan upgraded to {new_plan} - Welcome to your new features! 🚀"
            
            success = self.send_email_notification(
                to_email=email,
                subject=subject,
                html_content=email_templates.get_base_template().format(
                    subject="Plan Upgrade Confirmation",
                    header_subtitle="Welcome to your new plan",
                    content=content,
                    app_name=self.app_name,
                    app_url=self.app_url,
                    support_email=self.from_email,
                    email=email
                ),
                text_content=f"""Plan Upgraded Successfully - {self.app_name}

Hi {username},

Congratulations! Your plan has been successfully upgraded.

Previous Plan: {old_plan}
New Plan: {new_plan}
Effective Date: {effective_date}

You now have access to all the features of your new plan.

Questions? Contact us: {self.from_email}

Best regards,
The {self.app_name} Team
"""
            )
            
            if success:
                logger.info(f"Plan upgrade confirmation sent to {email}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending plan upgrade confirmation: {e}")
            return False
    
    def send_api_key_created_email(self, user_id: int, username: str, email: str, api_key: str, key_name: str) -> bool:
        """Send email when new API key is created"""
        try:
            content = f"""
                <h2>🔑 New API Key Created</h2>
                <p>Hi <strong>{username}</strong>,</p>
                <p>A new API key has been created for your account.</p>
                
                <div class="highlight-box">
                    <h3 style="margin-bottom: 12px;">API Key Details</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="label">Key Name</div>
                            <div class="value">{key_name}</div>
                        </div>
                        <div class="info-item">
                            <div class="label">Created</div>
                            <div class="value">{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</div>
                        </div>
                    </div>
                    <p style="margin-bottom: 12px; margin-top: 16px;">Your new API key:</p>
                    <div class="api-key-box">{api_key}</div>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 12px;">⚠️ Keep this key secure and never share it publicly.</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{self.app_url}/settings/credits" class="cta-button">📊 Manage API Keys</a>
                    <a href="{self.app_url}/docs" class="cta-button secondary-button">📚 API Documentation</a>
                </div>
                
                <p>If you didn't create this API key, please contact our support team immediately at <a href="mailto:{self.from_email}" style="color: #3b82f6;">{self.from_email}</a>.</p>
            """
            
            subject = f"New API key '{key_name}' created - {self.app_name}"
            
            success = self.send_email_notification(
                to_email=email,
                subject=subject,
                html_content=email_templates.get_base_template().format(
                    subject="New API Key Created",
                    header_subtitle="Secure your new key",
                    content=content,
                    app_name=self.app_name,
                    app_url=self.app_url,
                    support_email=self.from_email,
                    email=email
                ),
                text_content=f"""New API Key Created - {self.app_name}

Hi {username},

A new API key has been created for your account.

Key Name: {key_name}
Created: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}

API Key: {api_key}

Keep this key secure and never share it publicly.

If you didn't create this API key, please contact our support team immediately at {self.from_email}.

Best regards,
The {self.app_name} Team
"""
            )
            
            if success:
                logger.info(f"API key creation email sent to {email}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending API key creation email: {e}")
            return False
    
    def send_email_notification(self, to_email: str, subject: str, html_content: str, text_content: str = None) -> bool:
        """Send email notification using Resend SDK"""
        try:
            logger.info(f"Attempting to send email to: {to_email}")
            logger.info(f"Subject: {subject}")
            logger.info(f"Resend API key configured: {bool(self.resend_api_key)}")
            logger.info(f"From email: {self.from_email}")
            
            if not self.resend_api_key:
                logger.warning("❌ Resend API key not configured, skipping email notification")
                return False
            
            # Use Resend SDK
            logger.info("Sending email via Resend SDK...")
            response = resend.Emails.send({
                "from": self.from_email,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
                "text": text_content
            })
            
            logger.info(f"Resend response: {response}")
            
            if response.get('id'):
                logger.info(f"✅ Email sent successfully to {to_email}, ID: {response['id']}")
                return True
            else:
                logger.error(f"❌ Failed to send email to {to_email}: {response}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error sending email to {to_email}: {e}")
            logger.error(f"Error details: {str(e)}", exc_info=True)
            return False
    
    def create_notification(self, request: SendNotificationRequest) -> bool:
        """Create notification record in database"""
        try:
            notification_data = {
                'user_id': request.user_id,
                'type': request.type.value,
                'channel': request.channel.value,
                'subject': request.subject,
                'content': request.content,
                'status': NotificationStatus.PENDING.value,
                'metadata': json.dumps(request.metadata) if request.metadata else None
            }
            
            client = self.supabase or supabase_config.get_supabase_client()
            result = client.table('notifications').insert(notification_data).execute()
            return bool(result.data)
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            return False
    
    def get_user_preferences(self, user_id: int) -> Optional[NotificationPreferences]:
        """Get user notification preferences"""
        try:
            client = self.supabase or supabase_config.get_supabase_client()
            result = client.table('notification_preferences').select('*').eq('user_id', user_id).execute()
            
            if result.data:
                data = result.data[0]
                return NotificationPreferences(
                    user_id=data['user_id'],
                    email_notifications=data.get('email_notifications', True),
                    low_balance_threshold=data.get('low_balance_threshold', 10.0),
                    trial_expiry_reminder_days=data.get('trial_expiry_reminder_days', 1),
                    plan_expiry_reminder_days=data.get('plan_expiry_reminder_days', 7),
                    usage_alerts=data.get('usage_alerts', True),
                    webhook_url=data.get('webhook_url'),
                    created_at=data.get('created_at'),
                    updated_at=data.get('updated_at')
                )
            return None
        except Exception as e:
            logger.error(f"Error getting user preferences: {e}")
            return None

# Global enhanced notification service instance
enhanced_notification_service = EnhancedNotificationService()
