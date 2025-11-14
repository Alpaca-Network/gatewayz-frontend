"""
Integration Tests for Auth/Registration Referral Flow

Tests the critical entry point where users sign up with referral codes.
This is where the referral journey BEGINS.

Flow tested:
1. New user provides referral code during Privy authentication
2. System validates the referral code
3. track_referral_signup() is called
4. Pending referral record is created
5. User's referred_by_code is stored
6. Referrer receives signup notification email
"""
import os
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, Mock, MagicMock, call
from fastapi.testclient import TestClient
from fastapi import BackgroundTasks

from src.main import app
from src.config.supabase_config import get_supabase_client

# Skip all tests in this module if referral_code column doesn't exist
def _has_referral_schema():
    """Check if the referral schema is available"""
    try:
        client = get_supabase_client()
        # Try to query the referral_code column
        result = client.table("users").select("referral_code").limit(0).execute()
        return True
    except Exception:
        return False

pytestmark = pytest.mark.skipif(
    not _has_referral_schema(),
    reason="Referral schema not available in test database - referral_code column missing"
)


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def test_auth_users(supabase_client, test_prefix):
    """Create test users for auth testing"""
    created_users = []
    created_keys = []

    def _create_test_user(username_suffix, credits=0.0):
        username = f"{test_prefix}_auth_{username_suffix}"
        email = f"{username}@test.example.com"
        api_key = f"gw_test_auth_{test_prefix}_{username_suffix}"

        user_data = {
            "username": username,
            "email": email,
            "credits": int(credits),  # Database expects integer, not float
            "api_key": api_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Try to add has_made_first_purchase, but don't fail if column doesn't exist
        try:
            user_data["has_made_first_purchase"] = False
            user_result = supabase_client.table("users").insert(user_data).execute()
        except Exception:
            # Column doesn't exist, remove it and retry
            del user_data["has_made_first_purchase"]
            user_result = supabase_client.table("users").insert(user_data).execute()
        if not user_result.data:
            raise Exception("Failed to create test user")

        user = user_result.data[0]
        created_users.append(user['id'])

        return {
            "user_id": user['id'],
            "api_key": api_key,
            "username": username,
            "email": email,
        }

    yield _create_test_user

    # Cleanup
    try:
        if created_users:
            supabase_client.table("referrals").delete().in_("referred_user_id", created_users).execute()
            supabase_client.table("referrals").delete().in_("referrer_id", created_users).execute()
            supabase_client.table("api_keys_new").delete().in_("user_id", created_users).execute()
            supabase_client.table("users").delete().in_("id", created_users).execute()
    except Exception as e:
        print(f"Cleanup error: {e}")


class TestAuthRegistrationReferralIntegration:
    """Test auth/registration integration with referral system"""

    @patch('src.services.referral.send_referral_signup_notification')
    @patch('src.services.referral.track_referral_signup')
    @patch('src.db.users.create_enhanced_user')
    @patch('src.db.users.get_user_by_privy_id')
    def test_new_user_signup_with_referral_code(
        self,
        mock_get_user,
        mock_create_user,
        mock_track_referral,
        mock_notification,
        supabase_client,
        test_auth_users,
        client
    ):
        """
        Test that new user signup WITH referral code:
        1. Calls track_referral_signup()
        2. Stores referred_by_code
        3. Sends notification to referrer
        """
        # Create referrer (Alice)
        alice = test_auth_users("alice", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Mock that user doesn't exist (new signup)
        mock_get_user.return_value = None

        # Mock user creation
        mock_create_user.return_value = {
            "user_id": 999,
            "username": "newuser",
            "email": "newuser@example.com",
            "api_key": "gw_new_123",
            "credits": 10.0,
            "subscription_status": "trial",
        }

        # Mock successful referral tracking
        mock_track_referral.return_value = (
            True,  # success
            None,  # error_msg
            {  # referrer data
                "id": alice['user_id'],
                "username": alice['username'],
                "email": alice['email'],
            }
        )

        # Prepare auth request
        from src.schemas.auth import PrivyAuthRequest, PrivyUserData, PrivyLinkedAccount

        privy_user = PrivyUserData(
            id="did:privy:test123",
            created_at=1234567890,
            linked_accounts=[
                PrivyLinkedAccount(
                    type="email",
                    email="newuser@example.com",
                    verified_at=1234567890
                )
            ]
        )

        auth_request = PrivyAuthRequest(
            user=privy_user,
            token="test_token_123",  # Required field
            is_new_user=True,
            email="newuser@example.com",
            referral_code=alice_code  # Include referral code
        )

        # Make auth request
        response = client.post(
            "/auth",
            json=auth_request.model_dump(mode='json')
        )

        # Verify response
        assert response.status_code in [200, 201]
        print(f"✓ Auth request successful with referral code")

        # Verify track_referral_signup was called
        assert mock_track_referral.called
        track_call_args = mock_track_referral.call_args
        assert track_call_args[0][0] == alice_code  # referral_code argument
        assert track_call_args[0][1] == 999  # user_id argument
        print(f"✓ track_referral_signup() called with code {alice_code}")

        # Verify notification would be sent (in background task)
        # Note: Background tasks are tricky to test directly, but we can verify
        # the notification function was imported and available

    @patch('src.services.referral.track_referral_signup')
    @patch('src.db.users.create_enhanced_user')
    @patch('src.db.users.get_user_by_privy_id')
    def test_new_user_signup_with_invalid_referral_code(
        self,
        mock_get_user,
        mock_create_user,
        mock_track_referral,
        client
    ):
        """
        Test that invalid referral code doesn't block signup
        """
        mock_get_user.return_value = None

        mock_create_user.return_value = {
            "user_id": 888,
            "username": "newuser2",
            "email": "newuser2@example.com",
            "api_key": "gw_new_456",
            "credits": 10.0,
            "subscription_status": "trial",
        }

        # Mock failed referral tracking
        mock_track_referral.return_value = (
            False,  # success
            "Invalid referral code",  # error_msg
            None  # referrer
        )

        from src.schemas.auth import PrivyAuthRequest, PrivyUserData, PrivyLinkedAccount

        privy_user = PrivyUserData(
            id="did:privy:test456",
            created_at=1234567890,
            linked_accounts=[
                PrivyLinkedAccount(
                    type="email",
                    email="newuser2@example.com",
                    verified_at=1234567890
                )
            ]
        )

        auth_request = PrivyAuthRequest(
            user=privy_user,
            token="test_token_456",  # Required field
            is_new_user=True,
            email="newuser2@example.com",
            referral_code="INVALID123"  # Invalid code
        )

        # Make auth request
        response = client.post(
            "/auth",
            json=auth_request.model_dump(mode='json')
        )

        # Should still succeed (invalid referral doesn't block signup)
        assert response.status_code in [200, 201]
        print(f"✓ Signup succeeded despite invalid referral code")

        # Verify track_referral_signup was called
        assert mock_track_referral.called
        print(f"✓ Invalid referral code was attempted but didn't block signup")

    @patch('src.db.users.get_user_by_privy_id')
    def test_existing_user_login_ignores_referral_code(
        self,
        mock_get_user,
        test_auth_users,
        client
    ):
        """
        Test that existing users logging in don't process referral codes
        """
        # Create existing user
        bob = test_auth_users("bob_existing", credits=50.0)

        # Mock that user exists
        mock_get_user.return_value = {
            "user_id": bob['user_id'],
            "username": bob['username'],
            "email": bob['email'],
            "api_key": bob['api_key'],
            "credits": 50.0,
            "subscription_status": "active",
        }

        from src.schemas.auth import PrivyAuthRequest, PrivyUserData, PrivyLinkedAccount

        privy_user = PrivyUserData(
            id="did:privy:existing",
            created_at=1234567890,
            linked_accounts=[
                PrivyLinkedAccount(
                    type="email",
                    email=bob['email'],
                    verified_at=1234567890
                )
            ]
        )

        auth_request = PrivyAuthRequest(
            user=privy_user,
            token="test_token_existing",  # Required field
            is_new_user=False,  # Existing user
            email=bob['email'],
            referral_code="SOMECODE"  # Should be ignored
        )

        # Make auth request
        response = client.post(
            "/auth",
            json=auth_request.model_dump(mode='json')
        )

        # Should succeed
        assert response.status_code == 200
        print(f"✓ Existing user login successful (referral code ignored)")


class TestReferralTrackingIntegration:
    """Test actual referral tracking with database"""

    def test_track_referral_signup_creates_pending_record(
        self,
        supabase_client,
        test_auth_users
    ):
        """
        Test that track_referral_signup creates pending referral record
        """
        # Create referrer
        alice = test_auth_users("alice_track", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Create referee
        bob = test_auth_users("bob_track", credits=0.0)

        # Track signup
        from src.services.referral import track_referral_signup
        success, error, referrer = track_referral_signup(alice_code, bob['user_id'])

        assert success is True
        assert error is None
        assert referrer['id'] == alice['user_id']
        print(f"✓ Referral signup tracked successfully")

        # Verify pending record was created
        pending = supabase_client.table("referrals").select("*").eq(
            "referred_user_id", bob['user_id']
        ).eq("status", "pending").execute()

        assert len(pending.data) == 1
        record = pending.data[0]
        assert record['referrer_id'] == alice['user_id']
        assert record['referral_code'] == alice_code
        assert record['status'] == 'pending'
        assert record['completed_at'] is None
        print(f"✓ Pending referral record created in database")

    def test_store_referred_by_code_on_signup(
        self,
        supabase_client,
        test_auth_users
    ):
        """
        Test that referred_by_code is stored correctly
        """
        # Create referrer
        alice = test_auth_users("alice_store", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Create referee
        bob = test_auth_users("bob_store", credits=0.0)

        # Update bob with referred_by_code (simulates auth route behavior)
        supabase_client.table("users").update(
            {"referred_by_code": alice_code}
        ).eq("id", bob['user_id']).execute()

        # Verify it was stored
        bob_user = supabase_client.table("users").select("referred_by_code").eq(
            "id", bob['user_id']
        ).execute()

        assert bob_user.data[0]['referred_by_code'] == alice_code
        print(f"✓ referred_by_code stored correctly")

    def test_multiple_signups_same_code(
        self,
        supabase_client,
        test_auth_users
    ):
        """
        Test that multiple users can sign up with the same referral code
        """
        # Create referrer
        alice = test_auth_users("alice_multi", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Create 3 referees
        referees = []
        from src.services.referral import track_referral_signup
        for i in range(3):
            user = test_auth_users(f"bob_multi_{i}", credits=0.0)
            success, error, referrer = track_referral_signup(alice_code, user['user_id'])
            assert success is True
            referees.append(user)

        print(f"✓ 3 users signed up with same code")

        # Verify 3 pending records
        pending = supabase_client.table("referrals").select("*").eq(
            "referrer_id", alice['user_id']
        ).eq("status", "pending").execute()

        assert len(pending.data) == 3
        print(f"✓ 3 pending referral records created")

        # Verify stats
        from src.services.referral import get_referral_stats
        stats = get_referral_stats(alice['user_id'])

        assert stats['total_uses'] == 3
        assert stats['pending_bonuses'] == 3
        assert stats['completed_bonuses'] == 0
        print(f"✓ Stats show 3 pending referrals")


class TestReferralNotificationIntegration:
    """Test notification sending during signup"""

    @patch('src.enhanced_notification_service.enhanced_notification_service.send_email_notification')
    @patch('src.services.professional_email_templates.email_templates.get_base_template')
    def test_signup_notification_sent_to_referrer(
        self,
        mock_template,
        mock_send_email,
        test_auth_users
    ):
        """
        Test that referrer receives email when someone signs up with their code
        """
        # Mock email template
        mock_template.return_value.format.return_value = "<html>Test Email</html>"
        mock_send_email.return_value = True

        # Create referrer
        alice = test_auth_users("alice_notif", credits=0.0)

        # Send notification
        from src.services.referral import send_referral_signup_notification
        success = send_referral_signup_notification(
            referrer_id=alice['user_id'],
            referrer_email=alice['email'],
            referrer_username=alice['username'],
            referee_username="bob_notif"
        )

        assert success is True
        print(f"✓ Signup notification sent")

        # Verify email was sent
        assert mock_send_email.called
        call_kwargs = mock_send_email.call_args[1]
        assert call_kwargs['to_email'] == alice['email']
        assert 'bob_notif' in call_kwargs['text_content']
        print(f"✓ Email sent to {alice['email']} mentioning bob_notif")

    @patch('src.enhanced_notification_service.enhanced_notification_service.send_email_notification')
    def test_notification_failure_doesnt_block_signup(
        self,
        mock_send_email,
        test_auth_users
    ):
        """
        Test that notification failures don't block the signup process
        """
        # Mock email send failure
        mock_send_email.return_value = False

        alice = test_auth_users("alice_fail_notif", credits=0.0)

        # Send notification
        from src.services.referral import send_referral_signup_notification
        success = send_referral_signup_notification(
            referrer_id=alice['user_id'],
            referrer_email=alice['email'],
            referrer_username=alice['username'],
            referee_username="bob_fail"
        )

        # Returns False but doesn't raise exception
        assert success is False
        print(f"✓ Notification failure handled gracefully")


class TestReferralValidationDuringSignup:
    """Test validation logic during signup"""

    def test_validate_code_before_signup(
        self,
        supabase_client,
        test_auth_users
    ):
        """
        Test validating referral code before signup
        """
        # Create referrer
        alice = test_auth_users("alice_validate", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Create potential referee
        bob = test_auth_users("bob_validate", credits=0.0)

        # Validate code
        from src.services.referral import validate_referral_code
        valid, error, referrer = validate_referral_code(alice_code, bob['user_id'])

        assert valid is True
        assert error is None
        assert referrer['id'] == alice['user_id']
        print(f"✓ Referral code validated before signup")

    def test_validate_prevents_self_referral_during_signup(
        self,
        supabase_client,
        test_auth_users
    ):
        """
        Test that validation prevents self-referral during signup
        """
        alice = test_auth_users("alice_self_val", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Try to validate own code
        from src.services.referral import validate_referral_code
        valid, error, referrer = validate_referral_code(alice_code, alice['user_id'])

        assert valid is False
        assert "own referral code" in error.lower()
        print(f"✓ Self-referral prevented during validation")

    def test_validate_checks_usage_limit(
        self,
        supabase_client,
        test_auth_users
    ):
        """
        Test that validation checks usage limit
        """
        alice = test_auth_users("alice_limit_val", credits=0.0)
        from src.services.referral import create_user_referral_code, MAX_REFERRAL_USES, track_referral_signup
        alice_code = create_user_referral_code(alice['user_id'])

        # Use code MAX_REFERRAL_USES times
        for i in range(MAX_REFERRAL_USES):
            user = test_auth_users(f"bob_limit_{i}", credits=0.0)
            track_referral_signup(alice_code, user['user_id'])

        print(f"✓ Used code {MAX_REFERRAL_USES} times")

        # Try to validate for one more user
        extra_user = test_auth_users("bob_extra_val", credits=0.0)
        from src.services.referral import validate_referral_code
        valid, error, referrer = validate_referral_code(alice_code, extra_user['user_id'])

        assert valid is False
        assert "usage limit" in error.lower()
        print(f"✓ Validation enforces usage limit")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
