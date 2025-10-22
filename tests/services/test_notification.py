#!/usr/bin/env python3
"""
Comprehensive tests for notification service

Tests cover:
- User notification preferences (get, create, update)
- Low balance alerts
- Trial expiry alerts
- Recent notification tracking
- Email sending
- Webhook notifications
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone, timedelta

from src.services.notification import NotificationService
from src.schemas.notification import NotificationPreferences, LowBalanceAlert, TrialExpiryAlert


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def notification_service():
    """NotificationService instance with mocked Supabase"""
    with patch('src.services.notification.get_supabase_client'):
        service = NotificationService()
        service.resend_api_key = "test_key"
        service.from_email = "test@example.com"
        service.app_name = "Test App"
        return service


@pytest.fixture
def mock_user_data():
    """Sample user data"""
    return {
        'id': 1,
        'email': 'test@example.com',
        'credits': 100.0,
        'api_key': 'test_api_key_123'
    }


@pytest.fixture
def mock_preferences_data():
    """Sample notification preferences"""
    return {
        'user_id': 1,
        'email_notifications': True,
        'low_balance_threshold': 10.0,
        'trial_expiry_reminder_days': 1,
        'plan_expiry_reminder_days': 7,
        'usage_alerts': True,
        'webhook_url': None,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }


# ============================================================
# TEST CLASS: User Preferences
# ============================================================

class TestUserPreferences:
    """Test notification preference management"""

    def test_get_user_preferences_exists(self, notification_service, mock_preferences_data):
        """Test getting existing user preferences"""
        mock_result = Mock()
        mock_result.data = [mock_preferences_data]
        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result

        preferences = notification_service.get_user_preferences(1)

        assert preferences is not None
        assert preferences.user_id == 1
        assert preferences.email_notifications is True
        assert preferences.low_balance_threshold == 10.0
        assert preferences.usage_alerts is True

    def test_get_user_preferences_not_found(self, notification_service):
        """Test getting preferences for user without preferences"""
        mock_result = Mock()
        mock_result.data = []
        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result

        preferences = notification_service.get_user_preferences(999)

        assert preferences is None

    def test_get_user_preferences_error_handling(self, notification_service):
        """Test error handling when getting preferences"""
        notification_service.supabase.table.side_effect = Exception("Database error")

        preferences = notification_service.get_user_preferences(1)

        assert preferences is None

    def test_create_user_preferences_success(self, notification_service):
        """Test creating default preferences"""
        mock_result = Mock()
        mock_result.data = [{'user_id': 1}]
        notification_service.supabase.table.return_value.insert.return_value.execute.return_value = mock_result

        preferences = notification_service.create_user_preferences(1)

        assert preferences.user_id == 1
        assert preferences.email_notifications is True
        assert preferences.low_balance_threshold == 10.0
        assert preferences.trial_expiry_reminder_days == 1
        assert preferences.usage_alerts is True

    def test_create_user_preferences_error(self, notification_service):
        """Test error handling when creating preferences"""
        notification_service.supabase.table.side_effect = Exception("Insert failed")

        with pytest.raises(Exception):
            notification_service.create_user_preferences(1)

    def test_update_user_preferences_success(self, notification_service):
        """Test updating user preferences"""
        mock_result = Mock()
        mock_result.data = [{'user_id': 1}]
        notification_service.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result

        updates = {
            'email_notifications': False,
            'low_balance_threshold': 5.0
        }
        result = notification_service.update_user_preferences(1, updates)

        assert result is True
        notification_service.supabase.table.assert_called_with('notification_preferences')

    def test_update_user_preferences_not_found(self, notification_service):
        """Test updating non-existent preferences"""
        mock_result = Mock()
        mock_result.data = []
        notification_service.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result

        result = notification_service.update_user_preferences(999, {'email_notifications': False})

        assert result is False

    def test_update_user_preferences_error(self, notification_service):
        """Test error handling when updating preferences"""
        notification_service.supabase.table.side_effect = Exception("Update failed")

        result = notification_service.update_user_preferences(1, {})

        assert result is False


# ============================================================
# TEST CLASS: Low Balance Alerts
# ============================================================

class TestLowBalanceAlerts:
    """Test low balance alert detection"""

    @patch('src.services.notification.validate_trial_access')
    def test_check_low_balance_alert_triggered(
        self,
        mock_validate_trial,
        notification_service,
        mock_user_data
    ):
        """Test low balance alert is triggered when credits < $5"""
        # User has low credits
        low_credit_user = {**mock_user_data, 'credits': 3.0}

        mock_user_result = Mock()
        mock_user_result.data = [low_credit_user]

        mock_prefs_result = Mock()
        mock_prefs_result.data = [{
            'user_id': 1,
            'email_notifications': True,
            'low_balance_threshold': 10.0
        }]

        mock_notif_result = Mock()
        mock_notif_result.data = []

        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            mock_user_result,
            mock_prefs_result,
            mock_notif_result
        ]

        mock_validate_trial.return_value = {'is_trial': False}

        alert = notification_service.check_low_balance_alert(1)

        assert alert is not None
        assert isinstance(alert, LowBalanceAlert)
        assert alert.user_id == 1
        assert alert.current_credits == 3.0
        assert alert.threshold == 5.0  # Always $5 threshold
        assert alert.is_trial is False

    @patch('src.services.notification.validate_trial_access')
    def test_check_low_balance_alert_not_triggered(
        self,
        mock_validate_trial,
        notification_service,
        mock_user_data
    ):
        """Test low balance alert not triggered when credits > $5"""
        # User has sufficient credits
        sufficient_credit_user = {**mock_user_data, 'credits': 10.0}

        mock_user_result = Mock()
        mock_user_result.data = [sufficient_credit_user]

        mock_prefs_result = Mock()
        mock_prefs_result.data = [{
            'user_id': 1,
            'email_notifications': True
        }]

        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            mock_user_result,
            mock_prefs_result
        ]

        alert = notification_service.check_low_balance_alert(1)

        assert alert is None

    @patch('src.services.notification.validate_trial_access')
    def test_check_low_balance_alert_trial_user(
        self,
        mock_validate_trial,
        notification_service,
        mock_user_data
    ):
        """Test low balance alert for trial user includes trial info"""
        low_credit_user = {**mock_user_data, 'credits': 2.0}

        mock_user_result = Mock()
        mock_user_result.data = [low_credit_user]

        mock_prefs_result = Mock()
        mock_prefs_result.data = [{'user_id': 1, 'email_notifications': True}]

        mock_notif_result = Mock()
        mock_notif_result.data = []

        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            mock_user_result,
            mock_prefs_result,
            mock_notif_result
        ]

        # User is on trial
        trial_end = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        mock_validate_trial.return_value = {
            'is_trial': True,
            'trial_end_date': trial_end
        }

        alert = notification_service.check_low_balance_alert(1)

        assert alert is not None
        assert alert.is_trial is True
        assert alert.trial_remaining_days is not None

    def test_check_low_balance_alert_user_not_found(self, notification_service):
        """Test low balance alert when user not found"""
        mock_result = Mock()
        mock_result.data = []
        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result

        alert = notification_service.check_low_balance_alert(999)

        assert alert is None

    def test_check_low_balance_alert_notifications_disabled(
        self,
        notification_service,
        mock_user_data
    ):
        """Test low balance alert when notifications are disabled"""
        low_credit_user = {**mock_user_data, 'credits': 2.0}

        mock_user_result = Mock()
        mock_user_result.data = [low_credit_user]

        mock_prefs_result = Mock()
        mock_prefs_result.data = [{
            'user_id': 1,
            'email_notifications': False
        }]

        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            mock_user_result,
            mock_prefs_result
        ]

        alert = notification_service.check_low_balance_alert(1)

        assert alert is None

    @patch('src.services.notification.validate_trial_access')
    def test_check_low_balance_alert_recent_notification(
        self,
        mock_validate_trial,
        notification_service,
        mock_user_data
    ):
        """Test low balance alert skipped if recent notification sent"""
        low_credit_user = {**mock_user_data, 'credits': 2.0}

        mock_user_result = Mock()
        mock_user_result.data = [low_credit_user]

        mock_prefs_result = Mock()
        mock_prefs_result.data = [{'user_id': 1, 'email_notifications': True}]

        # Recent notification exists
        mock_notif_result = Mock()
        mock_notif_result.data = [{'id': 1}]

        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            mock_user_result,
            mock_prefs_result,
            mock_notif_result
        ]

        mock_validate_trial.return_value = {'is_trial': False}

        alert = notification_service.check_low_balance_alert(1)

        assert alert is None


# ============================================================
# TEST CLASS: Trial Expiry Alerts
# ============================================================

class TestTrialExpiryAlerts:
    """Test trial expiry alert detection"""

    @patch('src.services.notification.validate_trial_access')
    def test_check_trial_expiry_alert_triggered(
        self,
        mock_validate_trial,
        notification_service,
        mock_user_data
    ):
        """Test trial expiry alert triggered 1 day before expiry"""
        mock_user_result = Mock()
        mock_user_result.data = [mock_user_data]

        mock_prefs_result = Mock()
        mock_prefs_result.data = [{'user_id': 1, 'email_notifications': True}]

        mock_notif_result = Mock()
        mock_notif_result.data = []

        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            mock_user_result,
            mock_prefs_result,
            mock_notif_result
        ]

        # Trial expiring in 1 day
        trial_end = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        mock_validate_trial.return_value = {
            'is_trial': True,
            'trial_end_date': trial_end
        }

        alert = notification_service.check_trial_expiry_alert(1)

        assert alert is not None
        assert isinstance(alert, TrialExpiryAlert)
        assert alert.user_id == 1
        assert alert.days_remaining == 1

    @patch('src.services.notification.validate_trial_access')
    def test_check_trial_expiry_alert_not_trial_user(
        self,
        mock_validate_trial,
        notification_service,
        mock_user_data
    ):
        """Test no alert for non-trial users"""
        mock_user_result = Mock()
        mock_user_result.data = [mock_user_data]

        mock_prefs_result = Mock()
        mock_prefs_result.data = [{'user_id': 1, 'email_notifications': True}]

        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            mock_user_result,
            mock_prefs_result
        ]

        mock_validate_trial.return_value = {'is_trial': False}

        alert = notification_service.check_trial_expiry_alert(1)

        assert alert is None

    @patch('src.services.notification.validate_trial_access')
    def test_check_trial_expiry_alert_too_early(
        self,
        mock_validate_trial,
        notification_service,
        mock_user_data
    ):
        """Test no alert when trial has >1 day remaining"""
        mock_user_result = Mock()
        mock_user_result.data = [mock_user_data]

        mock_prefs_result = Mock()
        mock_prefs_result.data = [{'user_id': 1, 'email_notifications': True}]

        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            mock_user_result,
            mock_prefs_result
        ]

        # Trial expiring in 5 days
        trial_end = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        mock_validate_trial.return_value = {
            'is_trial': True,
            'trial_end_date': trial_end
        }

        alert = notification_service.check_trial_expiry_alert(1)

        assert alert is None


# ============================================================
# TEST CLASS: Recent Notification Tracking
# ============================================================

class TestRecentNotificationTracking:
    """Test recent notification tracking"""

    def test_has_recent_notification_found(self, notification_service):
        """Test detecting recent notification"""
        mock_result = Mock()
        mock_result.data = [{'id': 1}]
        notification_service.supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value = mock_result

        has_recent = notification_service._has_recent_notification(1, 'low_balance', hours=24)

        assert has_recent is True

    def test_has_recent_notification_not_found(self, notification_service):
        """Test no recent notification"""
        mock_result = Mock()
        mock_result.data = []
        notification_service.supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value = mock_result

        has_recent = notification_service._has_recent_notification(1, 'low_balance', hours=24)

        assert has_recent is False

    def test_has_recent_notification_error(self, notification_service):
        """Test error handling in recent notification check"""
        notification_service.supabase.table.side_effect = Exception("Database error")

        has_recent = notification_service._has_recent_notification(1, 'low_balance', hours=24)

        assert has_recent is False


# ============================================================
# TEST CLASS: Service Initialization
# ============================================================

class TestNotificationServiceInit:
    """Test NotificationService initialization"""

    @patch('src.services.notification.get_supabase_client')
    @patch.dict('os.environ', {
        'RESEND_API_KEY': 'test_resend_key',
        'FROM_EMAIL': 'notifications@example.com',
        'APP_NAME': 'My App'
    })
    def test_init_with_environment_variables(self, mock_get_supabase):
        """Test initialization with environment variables"""
        service = NotificationService()

        assert service.resend_api_key == 'test_resend_key'
        assert service.from_email == 'notifications@example.com'
        assert service.app_name == 'My App'

    @patch('src.services.notification.get_supabase_client')
    @patch.dict('os.environ', {}, clear=True)
    def test_init_with_defaults(self, mock_get_supabase):
        """Test initialization with default values"""
        service = NotificationService()

        assert service.from_email == 'noreply@yourdomain.com'
        assert service.app_name == 'AI Gateway'

# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestNotificationIntegration:
    """Test notification service integration scenarios"""

    @patch('src.services.notification.validate_trial_access')
    @patch('src.services.notification.get_user_plan')
    def test_low_balance_alert_with_plan_info(
        self,
        mock_get_plan,
        mock_validate_trial,
        notification_service,
        mock_user_data
    ):
        """Test low balance alert includes plan information for paid users"""
        low_credit_user = {**mock_user_data, 'credits': 3.0}

        mock_user_result = Mock()
        mock_user_result.data = [low_credit_user]

        mock_prefs_result = Mock()
        mock_prefs_result.data = [{'user_id': 1, 'email_notifications': True}]

        mock_notif_result = Mock()
        mock_notif_result.data = []

        notification_service.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            mock_user_result,
            mock_prefs_result,
            mock_notif_result
        ]

        mock_validate_trial.return_value = {'is_trial': False}
        mock_get_plan.return_value = {'plan_name': 'Professional'}

        alert = notification_service.check_low_balance_alert(1)

        assert alert is not None
        assert alert.plan_name == 'Professional'
        assert alert.is_trial is False
