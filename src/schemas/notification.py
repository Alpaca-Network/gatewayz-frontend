#!/usr/bin/.env python3
"""
Notification Models
Pydantic models for notification system
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel


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
    plan_expiry_reminder_days: int = 7  # Days before plan expires to send reminder
    usage_alerts: bool = True
    webhook_url: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class NotificationTemplate(BaseModel):
    """Email notification template"""

    id: str
    type: NotificationType
    subject: str
    html_template: str
    text_template: str
    variables: list[str] = []  # Template variables like {username}, {credits}, etc.
    is_active: bool = True


class Notification(BaseModel):
    """Notification record"""

    id: int | None = None
    user_id: int
    type: NotificationType
    channel: NotificationChannel
    subject: str
    content: str
    status: NotificationStatus = NotificationStatus.PENDING
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    error_message: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime | None = None


class SendNotificationRequest(BaseModel):
    """Request to send notification"""

    user_id: int
    type: NotificationType
    channel: NotificationChannel = NotificationChannel.EMAIL
    subject: str
    content: str
    metadata: dict[str, Any] | None = None


class UpdateNotificationPreferencesRequest(BaseModel):
    """Request to update notification preferences"""

    email_notifications: bool | None = None
    low_balance_threshold: float | None = None
    trial_expiry_reminder_days: int | None = None
    plan_expiry_reminder_days: int | None = None
    usage_alerts: bool | None = None
    webhook_url: str | None = None


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
    trial_remaining_days: int | None = None
    plan_name: str | None = None


class TrialExpiryAlert(BaseModel):
    """Trial expiry alert details"""

    user_id: int
    trial_end_date: datetime
    remaining_days: int
    remaining_credits: float
    remaining_tokens: int
    remaining_requests: int
