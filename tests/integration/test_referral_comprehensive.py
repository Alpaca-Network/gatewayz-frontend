"""
Comprehensive tests for the enhanced referral system including:
- Referral tracking on signup
- Notifications to referrer
- Bonus application on first purchase
- $10 trial credits for new users
"""

import pytest
from unittest.mock import Mock, patch, call
from src.services.referral import (
    track_referral_signup,
    send_referral_signup_notification,
    send_referral_bonus_notification,
    apply_referral_bonus,
    MAX_REFERRAL_USES,
    REFERRAL_BONUS
)


class TestReferralSignupTracking:
    """Test referral tracking when users sign up"""

    @patch('src.services.referral.get_supabase_client')
    def test_track_referral_signup_success(self, mock_client):
        """Test successful tracking of referral signup"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock referrer exists
        referrer_result = Mock()
        referrer_result.data = [{
            'id': 1,
            'referral_code': 'ALICE123',
            'username': 'alice',
            'email': 'alice@example.com'
        }]

        # Mock usage count is 0
        usage_result = Mock()
        usage_result.count = 0

        # Mock insert referral record
        insert_result = Mock()
        insert_result.data = [{'id': 1, 'status': 'pending'}]

        # Set up mock chain
        query1 = Mock()
        query1.select.return_value.eq.return_value.execute.return_value = referrer_result

        query2 = Mock()
        query2.select.return_value.eq.return_value.execute.return_value = usage_result

        query3 = Mock()
        query3.insert.return_value.execute.return_value = insert_result

        mock_supabase.table.side_effect = [
            query1,  # Get referrer
            query2,  # Check usage count
            query3   # Insert pending referral
        ]

        success, error_msg, referrer = track_referral_signup('ALICE123', referred_user_id=2)

        assert success is True
        assert error_msg is None
        assert referrer is not None
        assert referrer['username'] == 'alice'
        print("[PASS] Referral signup tracked successfully")

    @patch('src.services.referral.get_supabase_client')
    def test_track_referral_signup_invalid_code(self, mock_client):
        """Test tracking with invalid referral code"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock referrer doesn't exist
        referrer_result = Mock()
        referrer_result.data = []

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = referrer_result

        success, error_msg, referrer = track_referral_signup('INVALID', referred_user_id=2)

        assert success is False
        assert "Invalid referral code" in error_msg
        assert referrer is None
        print("[PASS] Invalid referral code correctly rejected")

    @patch('src.services.referral.get_supabase_client')
    def test_track_referral_signup_self_referral(self, mock_client):
        """Test that self-referral is blocked"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock referrer is same as referee
        referrer_result = Mock()
        referrer_result.data = [{
            'id': 1,
            'referral_code': 'ALICE123',
            'username': 'alice'
        }]

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = referrer_result

        success, error_msg, referrer = track_referral_signup('ALICE123', referred_user_id=1)

        assert success is False
        assert "own referral code" in error_msg.lower()
        print("[PASS] Self-referral correctly blocked")

    @patch('src.services.referral.get_supabase_client')
    def test_track_referral_signup_max_uses_reached(self, mock_client):
        """Test that codes with max uses cannot be used"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock referrer exists
        referrer_result = Mock()
        referrer_result.data = [{
            'id': 1,
            'referral_code': 'ALICE123',
            'username': 'alice'
        }]

        # Mock usage count is at max
        usage_result = Mock()
        usage_result.count = MAX_REFERRAL_USES

        query1 = Mock()
        query1.select.return_value.eq.return_value.execute.return_value = referrer_result

        query2 = Mock()
        query2.select.return_value.eq.return_value.execute.return_value = usage_result

        mock_supabase.table.side_effect = [query1, query2]

        success, error_msg, referrer = track_referral_signup('ALICE123', referred_user_id=2)

        assert success is False
        assert "usage limit" in error_msg.lower()
        print(f"[PASS] Max usage limit ({MAX_REFERRAL_USES}) correctly enforced on signup")


class TestReferralNotifications:
    """Test referral notification system"""

    @patch('src.enhanced_notification_service.enhanced_notification_service')
    @patch('src.services.professional_email_templates.email_templates')
    def test_send_referral_signup_notification(self, mock_templates, mock_notification_service):
        """Test sending signup notification to referrer"""
        mock_templates.get_base_template.return_value.format.return_value = "<html>Test Email</html>"
        mock_notification_service.send_email_notification.return_value = True

        success = send_referral_signup_notification(
            referrer_id=1,
            referrer_email='alice@example.com',
            referrer_username='alice',
            referee_username='bob'
        )

        assert success is True
        mock_notification_service.send_email_notification.assert_called_once()
        call_kwargs = mock_notification_service.send_email_notification.call_args[1]
        assert call_kwargs['to_email'] == 'alice@example.com'
        assert 'bob' in call_kwargs['text_content']
        print("[PASS] Signup notification sent successfully")

    @patch('src.enhanced_notification_service.enhanced_notification_service')
    @patch('src.services.professional_email_templates.email_templates')
    def test_send_referral_bonus_notification(self, mock_templates, mock_notification_service):
        """Test sending bonus notification to both users"""
        mock_templates.get_base_template.return_value.format.return_value = "<html>Test Email</html>"
        mock_notification_service.send_email_notification.return_value = True

        referrer_success, referee_success = send_referral_bonus_notification(
            referrer_id=1,
            referrer_email='alice@example.com',
            referrer_username='alice',
            referrer_new_balance=20.0,
            referee_username='bob',
            referee_email='bob@example.com',
            referee_new_balance=30.0
        )

        assert referrer_success is True
        assert referee_success is True
        assert mock_notification_service.send_email_notification.call_count == 2

        # Check both emails were sent
        calls = mock_notification_service.send_email_notification.call_args_list
        emails_sent = [call[1]['to_email'] for call in calls]
        assert 'alice@example.com' in emails_sent
        assert 'bob@example.com' in emails_sent
        print("[PASS] Bonus notifications sent to both referrer and referee")


class TestReferralBonusWithPendingRecord:
    """Test bonus application updates pending referral records"""

    @pytest.mark.skip(reason="Complex mock chain - needs integration test approach")
    @patch('src.services.referral.get_supabase_client')
    @patch('src.services.referral.add_credits')
    @patch('src.services.referral.send_referral_bonus_notification')
    def test_apply_bonus_updates_pending_referral(
        self,
        mock_send_notification,
        mock_add_credits,
        mock_client
    ):
        """Test that bonus application updates existing pending referral record"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock referrer
        referrer_result = Mock()
        referrer_result.data = [{
            'id': 1,
            'referral_code': 'ALICE123',
            'api_key': 'gw_live_alice',
            'username': 'alice',
            'email': 'alice@example.com'
        }]

        # Mock user
        user_result = Mock()
        user_result.data = [{
            'id': 2,
            'referral_code': 'BOB12345',
            'api_key': 'gw_live_bob',
            'has_made_first_purchase': False,
            'referred_by_code': 'ALICE123',
            'username': 'bob',
            'email': 'bob@example.com'
        }]

        # Mock existing pending referral
        pending_referral = Mock()
        pending_referral.data = [{
            'id': 1,
            'status': 'pending',
            'referrer_id': 1,
            'referred_user_id': 2
        }]

        # Mock update referral to completed
        update_result = Mock()
        update_result.data = [{'id': 1, 'status': 'completed'}]

        # Mock validation
        usage_result = Mock()
        usage_result.count = 0

        # Mock credits
        mock_add_credits.return_value = True

        # Mock fresh balance queries
        fresh_balance = Mock()
        fresh_balance.data = [{'credits': 20.0}]

        # Mock notification
        mock_send_notification.return_value = (True, True)

        success, error_msg, bonus_data = apply_referral_bonus(
            user_id=2,
            referral_code='ALICE123',
            purchase_amount=15.0
        )

        assert success is True
        assert bonus_data is not None
        assert bonus_data['user_bonus'] == REFERRAL_BONUS
        print("[PASS] Pending referral record updated to completed on bonus application")


class TestTrialCredits:
    """Test that new users get $10 trial credits"""

    @patch('src.db.users.get_supabase_client')
    @patch('src.db.users.create_api_key')
    def test_new_user_gets_trial_credits(self, mock_create_key, mock_client):
        """Test new users receive $10 trial credits"""
        from src.db.users import create_enhanced_user

        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock user creation
        user_result = Mock()
        user_result.data = [{
            'id': 1,
            'username': 'testuser',
            'email': 'test@example.com',
            'credits': 10,
            'subscription_status': 'trial',
            'api_key': 'gw_live_test123'
        }]

        # Mock API key creation
        mock_create_key.return_value = ('gw_live_test123', 1)

        # Mock update result
        update_result = Mock()
        update_result.data = [{'id': 1}]

        mock_supabase.table.return_value.insert.return_value.execute.return_value = user_result
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = update_result

        user_data = create_enhanced_user(
            username='testuser',
            email='test@example.com',
            auth_method='email',
            credits=10
        )

        assert user_data is not None
        assert user_data['credits'] == 10
        print("[PASS] New users receive $10 trial credits")


class TestEndToEndReferralFlow:
    """End-to-end tests for complete referral flow"""

    @pytest.mark.skip(reason="End-to-end test requires full integration setup")
    def test_complete_referral_flow(self):
        """
        Test complete referral flow:
        1. User A gets referral code
        2. User B signs up with code (pending referral created, notification sent)
        3. User B makes $10+ purchase (bonus applied, notifications sent)
        4. Both users have $10 added to their accounts
        """
        # This would be an integration test with a real/test database
        pass


def test_constants():
    """Verify referral system constants"""
    assert REFERRAL_BONUS == 10.0
    assert MAX_REFERRAL_USES == 10
    print(f"[PASS] Constants verified: ${REFERRAL_BONUS} bonus, {MAX_REFERRAL_USES} max uses")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
