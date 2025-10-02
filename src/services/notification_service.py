#!/usr/bin/env python3
"""
Notification Service
Handles low balance notifications, trial expiry alerts, and user communication
"""

import logging
import datetime
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import requests
import resend

from src.services.notification_models import (
    NotificationPreferences, NotificationType,
    NotificationChannel, NotificationStatus, SendNotificationRequest,
    LowBalanceAlert, TrialExpiryAlert
)
from src.db.plans import get_user_plan
from src.supabase_config import get_supabase_client
from src.trials.trial_validation import validate_trial_access

logger = logging.getLogger(__name__)

class NotificationService:
    """Service for managing notifications and alerts"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
        self.resend_api_key = os.environ.get("RESEND_API_KEY")
        self.from_email = os.environ.get("FROM_EMAIL", "noreply@yourdomain.com")
        self.app_name = os.environ.get("APP_NAME", "AI Gateway")
        
        # Initialize Resend client
        if self.resend_api_key:
            resend.api_key = self.resend_api_key
        
    def get_user_preferences(self, user_id: int) -> Optional[NotificationPreferences]:
        """Get user notification preferences"""
        try:
            result = self.supabase.table('notification_preferences').select('*').eq('user_id', user_id).execute()
            
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
                    created_at=datetime.fromisoformat(data['created_at'].replace('Z', '+00:00')) if data.get('created_at') else None,
                    updated_at=datetime.fromisoformat(data['updated_at'].replace('Z', '+00:00')) if data.get('updated_at') else None
                )
            return None
        except Exception as e:
            logger.error(f"Error getting user preferences: {e}")
            return None
    
    def create_user_preferences(self, user_id: int) -> NotificationPreferences:
        """Create default notification preferences for user"""
        try:
            preferences = NotificationPreferences(
                user_id=user_id,
                email_notifications=True,
                low_balance_threshold=10.0,
                trial_expiry_reminder_days=1,
                plan_expiry_reminder_days=7,
                usage_alerts=True
            )
            
            result = self.supabase.table('notification_preferences').insert({
                'user_id': user_id,
                'email_notifications': preferences.email_notifications,
                'low_balance_threshold': preferences.low_balance_threshold,
                'trial_expiry_reminder_days': preferences.trial_expiry_reminder_days,
                'plan_expiry_reminder_days': preferences.plan_expiry_reminder_days,
                'usage_alerts': preferences.usage_alerts,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).execute()
            
            if result.data:
                preferences.created_at = datetime.now(timezone.utc)
                preferences.updated_at = datetime.now(timezone.utc)
            
            return preferences
        except Exception as e:
            logger.error(f"Error creating user preferences: {e}")
            raise
    
    def update_user_preferences(self, user_id: int, updates: Dict[str, Any]) -> bool:
        """Update user notification preferences"""
        try:
            updates['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            result = self.supabase.table('notification_preferences').update(updates).eq('user_id', user_id).execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Error updating user preferences: {e}")
            return False
    
    def check_low_balance_alert(self, user_id: int) -> Optional[LowBalanceAlert]:
        """Check if user needs low balance alert - all users get notified when credits < $5"""
        try:
            user = self.supabase.table('users').select('*').eq('id', user_id).execute()
            if not user.data:
                return None
            
            user_data = user.data[0]
            preferences = self.get_user_preferences(user_id)
            
            if not preferences or not preferences.email_notifications:
                return None
            
            current_credits = user_data.get('credits', 0)
            
            # All users get notified when credits fall below $5
            low_balance_threshold = 5.0
            
            # Check if credits are below $5 threshold
            if current_credits <= low_balance_threshold:
                # Check if we already sent a notification recently (within 24 hours)
                if self._has_recent_notification(user_id, 'low_balance', hours=24):
                    return None
                # Check if this is a trial user
                trial_validation = validate_trial_access(user_data.get('api_key', ''))
                is_trial = trial_validation.get('is_trial', False)
                
                alert = LowBalanceAlert(
                    user_id=user_id,
                    current_credits=current_credits,
                    threshold=low_balance_threshold,  # Use $5 threshold
                    is_trial=is_trial
                )
                
                if is_trial:
                    trial_end = trial_validation.get('trial_end_date')
                    if trial_end:
                        try:
                            trial_end_date = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                            remaining_days = (trial_end_date - datetime.now(timezone.utc)).days
                            alert.trial_remaining_days = max(0, remaining_days)
                        except:
                            pass
                else:
                    # Get plan info for paid users
                    user_plan = get_user_plan(user_id)
                    if user_plan:
                        alert.plan_name = user_plan.get('plan_name', 'Unknown Plan')
                
                return alert
            
            return None
        except Exception as e:
            logger.error(f"Error checking low balance alert: {e}")
            return None
    
    def _has_recent_notification(self, user_id: int, notification_type: str, hours: int = 24) -> bool:
        """Check if user has received a notification of this type recently"""
        try:
            since = datetime.now(timezone.utc) - timedelta(hours=hours)
            result = self.supabase.table('notifications').select('id').eq('user_id', user_id).eq('type', notification_type).gte('created_at', since.isoformat()).execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Error checking recent notifications: {e}")
            return False

    def check_trial_expiry_alert(self, user_id: int) -> Optional[TrialExpiryAlert]:
        """Check if user needs trial expiry alert - 1 day before expiry"""
        try:
            user = self.supabase.table('users').select('*').eq('id', user_id).execute()
            if not user.data:
                return None
            
            user_data = user.data[0]
            preferences = self.get_user_preferences(user_id)
            
            if not preferences or not preferences.email_notifications:
                return None
            
            # Check if user is on trial
            trial_validation = validate_trial_access(user_data.get('api_key', ''))
            if not trial_validation.get('is_trial', False):
                return None
            
            trial_end_date_str = trial_validation.get('trial_end_date')
            if not trial_end_date_str:
                return None
            
            try:
                trial_end_date = datetime.fromisoformat(trial_end_date_str.replace('Z', '+00:00'))
                remaining_days = (trial_end_date - datetime.now(timezone.utc)).days
                
                # Send reminder exactly 1 day before expiry
                if remaining_days == 1:
                    # Check if we already sent this notification
                    if self._has_recent_notification(user_id, 'trial_expiring', hours=24):
                        return None
                    return TrialExpiryAlert(
                        user_id=user_id,
                        trial_end_date=trial_end_date,
                        remaining_days=remaining_days,
                        remaining_credits=trial_validation.get('remaining_credits', 0.0),
                        remaining_tokens=trial_validation.get('remaining_tokens', 0),
                        remaining_requests=trial_validation.get('remaining_requests', 0)
                    )
            except Exception as e:
                logger.error(f"Error parsing trial end date: {e}")
            
            return None
        except Exception as e:
            logger.error(f"Error checking trial expiry alert: {e}")
            return None

    def check_subscription_expiry_alert(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Check if paid user needs subscription expiry alert - daily starting 5 days before expiry"""
        try:
            user = self.supabase.table('users').select('*').eq('id', user_id).execute()
            if not user.data:
                return None
            
            preferences = self.get_user_preferences(user_id)
            
            if not preferences or not preferences.email_notifications:
                return None
            
            # Check if user has an active paid plan (Dev, Team, or Customize)
            user_plan = get_user_plan(user_id)
            if not user_plan or not user_plan.get('is_active', False):
                return None
            
            # Only send subscription expiry alerts for paid plans (not Free)
            plan_type = user_plan.get('plan_type', 'free')
            if plan_type == 'free':
                return None
            
            # Check if plan is expiring soon
            end_date_str = user_plan.get('end_date')
            if not end_date_str:
                return None
            
            try:
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                remaining_days = (end_date - datetime.now(timezone.utc)).days
                
                # Send daily alerts starting 5 days before expiry
                if 1 <= remaining_days <= 5:
                    # Check if we already sent this notification today
                    if self._has_recent_notification(user_id, 'subscription_expiring', hours=24):
                        return None
                    
                    return {
                        'user_id': user_id,
                        'plan_name': user_plan.get('plan_name', 'Unknown Plan'),
                        'end_date': end_date,
                        'remaining_days': remaining_days,
                        'plan_id': user_plan.get('plan_id')
                    }
            except Exception as e:
                logger.error(f"Error parsing subscription end date: {e}")
            
            return None
        except Exception as e:
            logger.error(f"Error checking subscription expiry alert: {e}")
            return None
    
    def send_email_notification(self, to_email: str, subject: str, html_content: str, text_content: str = None) -> bool:
        """Send email notification using Resend SDK"""
        try:
            if not self.resend_api_key:
                logger.warning("Resend API key not configured, skipping email notification")
                return False
            
            # Prepare email data for Resend
            email_params = {
                "from": self.from_email,
                "to": [to_email],
                "subject": subject,
                "html": html_content
            }
            
            # Add text content if provided
            if text_content:
                email_params["text"] = text_content
            
            # Send email via Resend SDK
            response = resend.Emails.send(email_params)
            
            if response and response.get('id'):
                logger.info(f"Email sent successfully via Resend. ID: {response['id']}")
                return True
            else:
                logger.error(f"Resend API error: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending email notification via Resend: {e}")
            return False
    
    def send_webhook_notification(self, webhook_url: str, data: Dict[str, Any]) -> bool:
        """Send webhook notification"""
        try:
            response = requests.post(
                webhook_url,
                json=data,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error sending webhook notification: {e}")
            return False
    
    def create_notification(self, request: SendNotificationRequest) -> bool:
        """Create and send notification"""
        try:
            # Get user email
            user = self.supabase.table('users').select('email').eq('id', request.user_id).execute()
            if not user.data:
                logger.error(f"User {request.user_id} not found")
                return False
            
            user_email = user.data[0]['email']
            
            # Send notification based on channel
            success = False
            if request.channel == NotificationChannel.EMAIL:
                success = self.send_email_notification(
                    user_email, 
                    request.subject, 
                    request.content
                )
            elif request.channel == NotificationChannel.WEBHOOK:
                preferences = self.get_user_preferences(request.user_id)
                if preferences and preferences.webhook_url:
                    success = self.send_webhook_notification(
                        preferences.webhook_url,
                        {
                            'type': request.type,
                            'subject': request.subject,
                            'content': request.content,
                            'metadata': request.metadata
                        }
                    )
            
            # Record notification
            notification_data = {
                'user_id': request.user_id,
                'type': request.type,
                'channel': request.channel,
                'subject': request.subject,
                'content': request.content,
                'status': NotificationStatus.SENT if success else NotificationStatus.FAILED,
                'sent_at': datetime.now(timezone.utc).isoformat() if success else None,
                'metadata': request.metadata,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            
            if not success:
                notification_data['error_message'] = 'Failed to send notification'
            
            self.supabase.table('notifications').insert(notification_data).execute()
            
            return success
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            return False
    
    def send_low_balance_alert(self, alert: LowBalanceAlert) -> bool:
        """Send low balance alert"""
        try:
            user = self.supabase.table('users').select('email, username').eq('id', alert.user_id).execute()
            if not user.data:
                return False
            
            user_data = user.data[0]
            username = user_data.get('username', 'User')

            if alert.is_trial:
                subject = f"Low Trial Credits - {self.app_name}"
                html_content = f"""
                <html>
                <body>
                    <h2>Low Trial Credits Alert</h2>
                    <p>Hello {username},</p>
                    <p>Your trial credits are running low!</p>
                    <ul>
                        <li>Current Credits: ${alert.current_credits:.2f}</li>
                        <li>Alert Threshold: ${alert.threshold:.2f}</li>
                        {f'<li>Trial Days Remaining: {alert.trial_remaining_days}</li>' if alert.trial_remaining_days is not None else ''}
                    </ul>
                    <p>To continue using the API, please upgrade to a paid plan.</p>
                    <p><a href="https://yourdomain.com/pricing">View Plans</a></p>
                    <p>Best regards,<br>The {self.app_name} Team</p>
                </body>
                </html>
                """
            else:
                subject = f"Low Account Balance - {self.app_name}"
                html_content = f"""
                <html>
                <body>
                    <h2>Low Account Balance Alert</h2>
                    <p>Hello {username},</p>
                    <p>Your account balance is running low!</p>
                    <ul>
                        <li>Current Credits: ${alert.current_credits:.2f}</li>
                        <li>Alert Threshold: ${alert.threshold:.2f}</li>
                        <li>Current Plan: {alert.plan_name or 'Unknown'}</li>
                    </ul>
                    <p>Please add credits to your account to continue using the API.</p>
                    <p><a href="https://yourdomain.com/billing">Add Credits</a></p>
                    <p>Best regards,<br>The {self.app_name} Team</p>
                </body>
                </html>
                """
            
            request = SendNotificationRequest(
                user_id=alert.user_id,
                type=NotificationType.LOW_BALANCE,
                channel=NotificationChannel.EMAIL,
                subject=subject,
                content=html_content,
                metadata={
                    'current_credits': alert.current_credits,
                    'threshold': alert.threshold,
                    'is_trial': alert.is_trial
                }
            )
            
            return self.create_notification(request)
        except Exception as e:
            logger.error(f"Error sending low balance alert: {e}")
            return False
    
    def send_trial_expiry_alert(self, alert: TrialExpiryAlert) -> bool:
        """Send trial expiry alert"""
        try:
            user = self.supabase.table('users').select('email, username').eq('id', alert.user_id).execute()
            if not user.data:
                return False
            
            user_data = user.data[0]
            username = user_data.get('username', 'User')
            
            subject = f"Trial Expiring Soon - {self.app_name}"
            html_content = f"""
            <html>
            <body>
                <h2>Trial Expiring Soon</h2>
                <p>Hello {username},</p>
                <p>Your free trial is expiring in {alert.remaining_days} day(s)!</p>
                <ul>
                    <li>Trial End Date: {alert.trial_end_date.strftime('%Y-%m-%d')}</li>
                    <li>Remaining Credits: ${alert.remaining_credits:.2f}</li>
                    <li>Remaining Tokens: {alert.remaining_tokens:,}</li>
                    <li>Remaining Requests: {alert.remaining_requests:,}</li>
                </ul>
                <p>To continue using the API after your trial expires, please upgrade to a paid plan.</p>
                <p><a href="https://yourdomain.com/pricing">Upgrade Now</a></p>
                <p>Best regards,<br>The {self.app_name} Team</p>
            </body>
            </html>
            """
            
            request = SendNotificationRequest(
                user_id=alert.user_id,
                type=NotificationType.TRIAL_EXPIRING,
                channel=NotificationChannel.EMAIL,
                subject=subject,
                content=html_content,
                metadata={
                    'trial_end_date': alert.trial_end_date.isoformat(),
                    'remaining_days': alert.remaining_days,
                    'remaining_credits': alert.remaining_credits
                }
            )
            
            return self.create_notification(request)
        except Exception as e:
            logger.error(f"Error sending trial expiry alert: {e}")
            return False

    def send_subscription_expiry_alert(self, alert_data: Dict[str, Any]) -> bool:
        """Send subscription expiry alert to paid user"""
        try:
            user = self.supabase.table('users').select('*').eq('id', alert_data['user_id']).execute()
            if not user.data:
                return False
            
            user_data = user.data[0]
            user_email = user_data.get('email')
            if not user_email:
                logger.warning(f"No email found for user {alert_data['user_id']}")
                return False
            
            # Get template for subscription expiry
            template_result = self.supabase.table('notification_templates').select('*').eq('type', 'subscription_expiring').eq('is_active', True).execute()
            
            if not template_result.data:
                logger.warning("No subscription expiry template found")
                return False
            
            template = template_result.data[0]
            
            # Prepare template variables
            remaining_days = alert_data['remaining_days']
            end_date = alert_data['end_date']
            
            variables = {
                'username': user_data.get('username', 'User'),
                'plan_name': alert_data['plan_name'],
                'remaining_days': remaining_days,
                'end_date': end_date.strftime('%Y-%m-%d'),
                'upgrade_url': f"https://gatewayz.ai/plans",  # Update with actual URL
                'app_name': self.app_name
            }
            
            # Replace template variables
            subject = template['subject'].format(**variables)
            html_content = template['html_template'].format(**variables)
            text_content = template['text_template'].format(**variables) if template.get('text_template') else None
            
            # Send email
            if self.send_email_notification(user_email, subject, html_content, text_content):
                # Create notification record
                request = SendNotificationRequest(
                    user_id=alert_data['user_id'],
                    type=NotificationType.SUBSCRIPTION_EXPIRING,
                    channel=NotificationChannel.EMAIL,
                    subject=subject,
                    content=html_content,
                    metadata={
                        'plan_name': alert_data['plan_name'],
                        'remaining_days': remaining_days,
                        'end_date': end_date.isoformat()
                    }
                )
                
                return self.create_notification(request)
            
            return False
        except Exception as e:
            logger.error(f"Error sending subscription expiry alert: {e}")
            return False
    
    def process_notifications(self) -> Dict[str, Any]:
        """Process all pending notifications"""
        try:
            stats = {
                'low_balance_alerts_sent': 0,
                'trial_expiry_alerts_sent': 0,
                'subscription_expiry_alerts_sent': 0,
                'errors': 0
            }
            
            # Get all users
            users = self.supabase.table('users').select('id').execute()
            
            for user in users.data:
                user_id = user['id']
                
                try:
                    # Check low balance alerts (all users when credits < $5)
                    low_balance_alert = self.check_low_balance_alert(user_id)
                    if low_balance_alert:
                        if self.send_low_balance_alert(low_balance_alert):
                            stats['low_balance_alerts_sent'] += 1
                    
                    # Check trial expiry alerts (1 day before expiry)
                    trial_expiry_alert = self.check_trial_expiry_alert(user_id)
                    if trial_expiry_alert:
                        if self.send_trial_expiry_alert(trial_expiry_alert):
                            stats['trial_expiry_alerts_sent'] += 1
                    
                    # Check subscription expiry alerts (daily starting 5 days before expiry)
                    subscription_expiry_alert = self.check_subscription_expiry_alert(user_id)
                    if subscription_expiry_alert:
                        if self.send_subscription_expiry_alert(subscription_expiry_alert):
                            stats['subscription_expiry_alerts_sent'] += 1
                            
                except Exception as e:
                    logger.error(f"Error processing notifications for user {user_id}: {e}")
                    stats['errors'] += 1
            
            return stats
        except Exception as e:
            logger.error(f"Error processing notifications: {e}")
            return {'error': str(e)}

# Global notification service instance
notification_service = NotificationService()

