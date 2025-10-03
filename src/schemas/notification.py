#!/usr/bin/.env python3
"""
Notification Models
Pydantic models for notification system
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class NotificationType(str, Enum):
    """Notification type enumeration"""
    LOW_BALANCE = "low_balance"
    TRIAL_EXPIRING = "trial_expiring"
    TRIAL_EXPIRED = "trial_expired"
    PLAN_EXPIRING = "plan_expiring"
    PLAN_EXPIRED = "plan_expired"
    SUBSCRIPTION_EXPIRING = "subscription_expiring"
    CREDIT_ADDED = "credit_added"
    USAGE_ALERT = "usage_alert"
    WELCOME = "welcome"
    PASSWORD_RESET = "password_reset"
    USAGE_REPORT = "usage_report"
    API_KEY_CREATED = "api_key_created"
    PLAN_UPGRADE = "plan_upgrade"

class NotificationChannel(str, Enum):
    """Notification channel enumeration"""
    EMAIL = "email"
    WEBHOOK = "webhook"
    IN_APP = "in_app"

class NotificationStatus(str, Enum):
    """Notification status enumeration"""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    DELIVERED = "delivered"

class NotificationPreferences(BaseModel):
    """User notification preferences"""
    user_id: int
    email_notifications: bool = True
    low_balance_threshold: float = 10.0  # Alert when credits below this amount
    trial_expiry_reminder_days: int = 1  # Days before trial expires to send reminder
    plan_expiry_reminder_days: int = 7   # Days before plan expires to send reminder
    usage_alerts: bool = True
    webhook_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class NotificationTemplate(BaseModel):
    """Email notification template"""
    id: str
    type: NotificationType
    subject: str
    html_template: str
    text_template: str
    variables: List[str] = []  # Template variables like {username}, {credits}, etc.
    is_active: bool = True

class Notification(BaseModel):
    """Notification record"""
    id: Optional[int] = None
    user_id: int
    type: NotificationType
    channel: NotificationChannel
    subject: str
    content: str
    status: NotificationStatus = NotificationStatus.PENDING
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

class SendNotificationRequest(BaseModel):
    """Request to send notification"""
    user_id: int
    type: NotificationType
    channel: NotificationChannel = NotificationChannel.EMAIL
    subject: str
    content: str
    metadata: Optional[Dict[str, Any]] = None

class UpdateNotificationPreferencesRequest(BaseModel):
    """Request to update notification preferences"""
    email_notifications: Optional[bool] = None
    low_balance_threshold: Optional[float] = None
    trial_expiry_reminder_days: Optional[int] = None
    plan_expiry_reminder_days: Optional[int] = None
    usage_alerts: Optional[bool] = None
    webhook_url: Optional[str] = None

class NotificationStats(BaseModel):
    """Notification statistics"""
    total_notifications: int
    sent_notifications: int
    failed_notifications: int
    pending_notifications: int
    delivery_rate: float
    last_24h_notifications: int

class LowBalanceAlert(BaseModel):
    """Low balance alert details"""
    user_id: int
    current_credits: float
    threshold: float
    is_trial: bool
    trial_remaining_days: Optional[int] = None
    plan_name: Optional[str] = None

class TrialExpiryAlert(BaseModel):
    """Trial expiry alert details"""
    user_id: int
    trial_end_date: datetime
    remaining_days: int
    remaining_credits: float
    remaining_tokens: int
    remaining_requests: int

