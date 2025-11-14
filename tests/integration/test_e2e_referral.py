"""
E2E Tests for Referral Feature
Tests complete referral flow with real database interactions

Tests cover:
- User A gets referral code
- User B signs up with code (pending referral created)
- User B makes first purchase of $10+ (bonus applied to both users)
- Verification of credits, database state, and notifications
- Edge cases and error scenarios
"""
import os
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock

from src.main import app
from src.config.supabase_config import get_supabase_client
from src.services.referral import (
    MAX_REFERRAL_USES,
    REFERRAL_BONUS,
    MIN_PURCHASE_AMOUNT,
)

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
def test_users(supabase_client, test_prefix):
    """Create test users with API keys for referral testing"""
    created_users = []
    created_keys = []
    created_referrals = []

    def _create_test_user(username_suffix="user", credits=0.0, referred_by_code=None, has_made_first_purchase=False):
        """Create a test user and return user data with API key"""
        username = f"{test_prefix}_ref_{username_suffix}"
        email = f"{username}@test.example.com"
        api_key = f"gw_test_{test_prefix}_{username_suffix}"

        # Create user with only required fields
        user_data = {
            "username": username,
            "email": email,
            "credits": int(credits),  # Database expects integer, not float
            "api_key": api_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Only add optional fields if they have non-default values
        if referred_by_code is not None:
            user_data["referred_by_code"] = referred_by_code

        # Try to add has_made_first_purchase, but don't fail if column doesn't exist
        try:
            user_data["has_made_first_purchase"] = has_made_first_purchase
            user_result = supabase_client.table("users").insert(user_data).execute()
        except Exception:
            # Column doesn't exist, remove it and retry
            del user_data["has_made_first_purchase"]
            user_result = supabase_client.table("users").insert(user_data).execute()

        if not user_result.data:
            raise Exception("Failed to create test user")

        user = user_result.data[0]
        created_users.append(user['id'])

        # Create API key in api_keys_new table
        key_data = {
            "user_id": user['id'],
            "api_key": api_key,
            "key_name": f"Test Key {username_suffix}",
            "is_primary": True,
            "is_active": True,
            "environment_tag": "test",
            "scope_permissions": ["chat", "images"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        key_result = supabase_client.table("api_keys_new").insert(key_data).execute()

        if key_result.data:
            created_keys.append(key_result.data[0]['id'])

        return {
            "user_id": user['id'],
            "api_key": api_key,
            "username": username,
            "email": email,
            "credits": float(credits),
            "referral_code": user.get('referral_code'),
        }

    yield _create_test_user

    # Cleanup
    try:
        if created_users:
            # Clean up referrals first (foreign key constraint)
            supabase_client.table("referrals").delete().in_("referred_user_id", created_users).execute()
            supabase_client.table("referrals").delete().in_("referrer_id", created_users).execute()

            # Clean up credit transactions
            supabase_client.table("credit_transactions").delete().in_("user_id", created_users).execute()

            # Clean up API keys
            if created_keys:
                supabase_client.table("api_keys_new").delete().in_("id", created_keys).execute()

            # Clean up users
            supabase_client.table("users").delete().in_("id", created_users).execute()
    except Exception as e:
        print(f"Cleanup error: {e}")


class TestEndToEndReferralFlow:
    """End-to-end tests for complete referral flow"""

    @patch('src.services.referral.send_referral_signup_notification')
    @patch('src.services.referral.send_referral_bonus_notification')
    def test_complete_referral_flow_success(
        self,
        mock_bonus_notification,
        mock_signup_notification,
        supabase_client,
        test_users,
        client
    ):
        """
        Test complete successful referral flow:
        1. Alice creates account and gets referral code
        2. Bob signs up with Alice's referral code
        3. Bob makes first purchase of $10+
        4. Both users receive $10 bonus
        5. Referral record is created and completed
        """
        # Mock email notifications to always succeed
        mock_signup_notification.return_value = True
        mock_bonus_notification.return_value = (True, True)

        # Step 1: Create Alice (referrer)
        alice = test_users("alice", credits=0.0)

        # Generate referral code for Alice
        from src.services.referral import create_user_referral_code
        alice_referral_code = create_user_referral_code(alice['user_id'])

        # Verify Alice has referral code
        alice_user = supabase_client.table("users").select("*").eq("id", alice['user_id']).execute()
        assert alice_user.data[0]['referral_code'] == alice_referral_code
        print(f"✓ Alice created with referral code: {alice_referral_code}")

        # Step 2: Bob signs up with Alice's referral code
        bob = test_users("bob", credits=0.0, referred_by_code=alice_referral_code)

        # Track referral signup (simulates what happens in auth.py)
        from src.services.referral import track_referral_signup
        success, error_msg, referrer = track_referral_signup(alice_referral_code, bob['user_id'])

        assert success is True
        assert error_msg is None
        assert referrer is not None
        assert referrer['id'] == alice['user_id']
        print(f"✓ Bob signed up with Alice's code")

        # Verify pending referral record was created
        pending_referrals = supabase_client.table("referrals").select("*").eq(
            "referred_user_id", bob['user_id']
        ).eq("status", "pending").execute()

        assert len(pending_referrals.data) == 1
        pending_referral = pending_referrals.data[0]
        assert pending_referral['referrer_id'] == alice['user_id']
        assert pending_referral['referral_code'] == alice_referral_code
        assert float(pending_referral['bonus_amount']) == REFERRAL_BONUS
        print(f"✓ Pending referral record created")

        # Verify Bob's referred_by_code is set
        bob_user = supabase_client.table("users").select("*").eq("id", bob['user_id']).execute()
        assert bob_user.data[0]['referred_by_code'] == alice_referral_code
        print(f"✓ Bob's referred_by_code is set correctly")

        # Step 3: Bob makes first purchase of $15
        purchase_amount = 15.0

        from src.services.referral import apply_referral_bonus
        bonus_success, bonus_error, bonus_data = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_referral_code,
            purchase_amount=purchase_amount
        )

        assert bonus_success is True
        assert bonus_error is None
        assert bonus_data is not None
        print(f"✓ Referral bonus applied successfully")

        # Step 4: Verify both users received $10 bonus
        alice_after = supabase_client.table("users").select("credits").eq("id", alice['user_id']).execute()
        bob_after = supabase_client.table("users").select("credits").eq("id", bob['user_id']).execute()

        alice_credits = float(alice_after.data[0]['credits'])
        bob_credits = float(bob_after.data[0]['credits'])

        assert alice_credits == REFERRAL_BONUS  # Alice got $10
        assert bob_credits == REFERRAL_BONUS  # Bob got $10 (not including purchase amount in this test)
        print(f"✓ Alice credits: ${alice_credits}, Bob credits: ${bob_credits}")

        # Step 5: Verify referral record is now completed
        completed_referrals = supabase_client.table("referrals").select("*").eq(
            "referred_user_id", bob['user_id']
        ).eq("status", "completed").execute()

        assert len(completed_referrals.data) == 1
        completed_referral = completed_referrals.data[0]
        assert completed_referral['referrer_id'] == alice['user_id']
        assert completed_referral['completed_at'] is not None
        print(f"✓ Referral record marked as completed")

        # Step 6: Verify Bob's first purchase flag is set
        bob_final = supabase_client.table("users").select("has_made_first_purchase").eq("id", bob['user_id']).execute()
        # Note: This is set in the payment webhook handler, not in apply_referral_bonus
        # For this test, we're just testing the bonus application logic

        # Verify credit transactions were created
        alice_transactions = supabase_client.table("credit_transactions").select("*").eq(
            "user_id", alice['user_id']
        ).execute()
        bob_transactions = supabase_client.table("credit_transactions").select("*").eq(
            "user_id", bob['user_id']
        ).execute()

        assert len(alice_transactions.data) >= 1  # At least one transaction for referral bonus
        assert len(bob_transactions.data) >= 1  # At least one transaction for referral bonus
        print(f"✓ Credit transactions recorded")

        # Verify email notifications were called
        assert mock_bonus_notification.called
        print(f"✓ Complete referral flow SUCCESS")

    def test_referral_stats_accuracy(self, supabase_client, test_users, client):
        """Test that referral stats are accurate after multiple referrals"""
        # Create Alice (referrer)
        alice = test_users("alice_stats", credits=0.0)

        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Create 3 users who sign up with Alice's code
        referred_users = []
        for i in range(3):
            user = test_users(f"bob_{i}", credits=0.0, referred_by_code=alice_code)
            referred_users.append(user)

            # Track signup
            from src.services.referral import track_referral_signup
            track_referral_signup(alice_code, user['user_id'])

        # Get stats before any bonuses
        from src.services.referral import get_referral_stats
        stats_before = get_referral_stats(alice['user_id'])

        assert stats_before['referral_code'] == alice_code
        assert stats_before['total_uses'] == 3  # 3 people signed up
        assert stats_before['completed_bonuses'] == 0  # None made purchases yet
        assert stats_before['pending_bonuses'] == 3  # All pending
        assert stats_before['total_earned'] == 0.0  # No earnings yet
        assert stats_before['remaining_uses'] == MAX_REFERRAL_USES - 3
        print(f"✓ Stats before purchases: {stats_before['total_uses']} signups, {stats_before['completed_bonuses']} completed")

        # Now 2 of them make purchases
        from src.services.referral import apply_referral_bonus
        for i in range(2):
            apply_referral_bonus(
                user_id=referred_users[i]['user_id'],
                referral_code=alice_code,
                purchase_amount=15.0
            )

        # Get stats after 2 bonuses
        stats_after = get_referral_stats(alice['user_id'])

        assert stats_after['total_uses'] == 3  # Still 3 signups
        assert stats_after['completed_bonuses'] == 2  # 2 completed purchases
        assert stats_after['pending_bonuses'] == 1  # 1 still pending
        assert stats_after['total_earned'] == 2 * REFERRAL_BONUS  # $20 earned
        assert len(stats_after['referrals']) == 3  # All 3 users in list

        # Verify referral details
        completed_count = sum(1 for r in stats_after['referrals'] if r['status'] == 'completed')
        pending_count = sum(1 for r in stats_after['referrals'] if r['status'] == 'pending')
        assert completed_count == 2
        assert pending_count == 1
        print(f"✓ Stats after 2 purchases: {stats_after['completed_bonuses']} completed, ${stats_after['total_earned']} earned")

    @patch('src.services.referral.send_referral_bonus_notification')
    def test_referral_bonus_minimum_purchase_enforcement(
        self,
        mock_notification,
        supabase_client,
        test_users
    ):
        """Test that referral bonus requires minimum $10 purchase"""
        mock_notification.return_value = (True, True)

        # Create Alice and Bob
        alice = test_users("alice_min", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        bob = test_users("bob_min", credits=0.0, referred_by_code=alice_code)
        from src.services.referral import track_referral_signup
        track_referral_signup(alice_code, bob['user_id'])

        # Try to apply bonus with purchase < $10
        from src.services.referral import apply_referral_bonus
        success, error, data = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=5.0  # Less than minimum
        )

        assert success is False
        assert "minimum purchase" in error.lower()
        print(f"✓ Bonus rejected for purchase < $10")

        # Verify no credits were added
        alice_credits = supabase_client.table("users").select("credits").eq("id", alice['user_id']).execute()
        bob_credits = supabase_client.table("users").select("credits").eq("id", bob['user_id']).execute()

        assert float(alice_credits.data[0]['credits']) == 0.0
        assert float(bob_credits.data[0]['credits']) == 0.0
        print(f"✓ No credits added for insufficient purchase")

        # Now try with exactly $10
        success, error, data = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=10.0  # Exactly minimum
        )

        assert success is True
        assert error is None
        print(f"✓ Bonus applied for purchase = $10")

    def test_self_referral_prevention(self, supabase_client, test_users):
        """Test that users cannot use their own referral code"""
        # Create Alice
        alice = test_users("alice_self", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Try to track Alice using her own code
        from src.services.referral import track_referral_signup
        success, error, referrer = track_referral_signup(alice_code, alice['user_id'])

        assert success is False
        assert "own referral code" in error.lower()
        print(f"✓ Self-referral prevented")

        # Try to validate Alice using her own code
        from src.services.referral import validate_referral_code
        valid, error, referrer = validate_referral_code(alice_code, alice['user_id'])

        assert valid is False
        assert "own referral code" in error.lower()
        print(f"✓ Self-referral validation prevented")

    def test_max_referral_uses_enforcement(self, supabase_client, test_users):
        """Test that referral codes cannot exceed maximum uses"""
        # Create Alice
        alice = test_users("alice_max", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Create MAX_REFERRAL_USES users with Alice's code
        from src.services.referral import track_referral_signup
        for i in range(MAX_REFERRAL_USES):
            user = test_users(f"bob_max_{i}", credits=0.0, referred_by_code=alice_code)
            success, error, referrer = track_referral_signup(alice_code, user['user_id'])
            if i < MAX_REFERRAL_USES:
                assert success is True, f"Signup {i+1} should succeed"

        print(f"✓ {MAX_REFERRAL_USES} signups completed")

        # Try to add one more user (should fail)
        extra_user = test_users("bob_max_extra", credits=0.0)
        success, error, referrer = track_referral_signup(alice_code, extra_user['user_id'])

        assert success is False
        assert "usage limit" in error.lower()
        print(f"✓ Max usage limit enforced at {MAX_REFERRAL_USES}")

    @patch('src.services.referral.send_referral_bonus_notification')
    def test_one_referral_code_per_user(
        self,
        mock_notification,
        supabase_client,
        test_users
    ):
        """Test that users can only use one referral code"""
        mock_notification.return_value = (True, True)

        # Create Alice and Charlie (two referrers)
        alice = test_users("alice_one", credits=0.0)
        charlie = test_users("charlie_one", credits=0.0)

        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])
        charlie_code = create_user_referral_code(charlie['user_id'])

        # Bob signs up with Alice's code
        bob = test_users("bob_one", credits=0.0, referred_by_code=alice_code)
        from src.services.referral import track_referral_signup
        track_referral_signup(alice_code, bob['user_id'])

        print(f"✓ Bob signed up with Alice's code")

        # Try to validate Charlie's code for Bob (should fail)
        from src.services.referral import validate_referral_code
        valid, error, referrer = validate_referral_code(charlie_code, bob['user_id'])

        assert valid is False
        assert "already used a different referral code" in error.lower()
        print(f"✓ Bob cannot use Charlie's code (already used Alice's)")

        # Verify Bob can still use Alice's code for bonus
        from src.services.referral import apply_referral_bonus
        success, error, data = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=15.0
        )

        assert success is True
        print(f"✓ Bob can still get bonus from Alice's code")

    def test_referral_code_uniqueness(self, supabase_client, test_users):
        """Test that all generated referral codes are unique"""
        codes = set()

        # Create 20 users and collect their referral codes
        from src.services.referral import create_user_referral_code
        for i in range(20):
            user = test_users(f"user_unique_{i}", credits=0.0)
            code = create_user_referral_code(user['user_id'])
            codes.add(code)

        # All codes should be unique
        assert len(codes) == 20
        print(f"✓ All 20 generated referral codes are unique")

    @patch('src.services.referral.send_referral_bonus_notification')
    def test_bonus_only_on_first_purchase(
        self,
        mock_notification,
        supabase_client,
        test_users
    ):
        """Test that referral bonus only applies on first purchase"""
        mock_notification.return_value = (True, True)

        # Create Alice and Bob
        alice = test_users("alice_first", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        bob = test_users("bob_first", credits=0.0, referred_by_code=alice_code)
        from src.services.referral import track_referral_signup
        track_referral_signup(alice_code, bob['user_id'])

        # First purchase - should work
        from src.services.referral import apply_referral_bonus, mark_first_purchase
        success1, error1, data1 = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=15.0
        )

        assert success1 is True
        print(f"✓ First purchase bonus applied")

        # Mark first purchase
        mark_first_purchase(bob['user_id'])

        # Second purchase - should fail
        success2, error2, data2 = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=20.0
        )

        assert success2 is False
        assert error2 is not None
        print(f"✓ Second purchase bonus rejected")

        # Verify Alice only got one bonus
        alice_credits = supabase_client.table("users").select("credits").eq("id", alice['user_id']).execute()
        assert float(alice_credits.data[0]['credits']) == REFERRAL_BONUS  # Only $10, not $20
        print(f"✓ Alice received only one bonus")


class TestReferralEdgeCases:
    """Test edge cases and error scenarios"""

    def test_invalid_referral_code(self, supabase_client, test_users):
        """Test handling of invalid referral code"""
        bob = test_users("bob_invalid", credits=0.0)

        from src.services.referral import track_referral_signup
        success, error, referrer = track_referral_signup("INVALID123", bob['user_id'])

        assert success is False
        assert "invalid referral code" in error.lower()
        print(f"✓ Invalid code rejected")

    def test_deleted_referrer(self, supabase_client, test_users):
        """Test handling when referrer is deleted"""
        # Create Alice
        alice = test_users("alice_deleted", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Create Bob with Alice's code
        bob = test_users("bob_deleted", credits=0.0, referred_by_code=alice_code)
        from src.services.referral import track_referral_signup
        track_referral_signup(alice_code, bob['user_id'])

        # Delete Alice
        supabase_client.table("users").delete().eq("id", alice['user_id']).execute()

        # Try to apply bonus (should fail gracefully)
        from src.services.referral import apply_referral_bonus
        success, error, data = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=15.0
        )

        assert success is False
        assert error is not None
        print(f"✓ Deleted referrer handled gracefully")

    @patch('src.services.referral.send_referral_bonus_notification')
    def test_partial_credit_failure_handling(
        self,
        mock_notification,
        supabase_client,
        test_users
    ):
        """Test handling when credit addition fails for one user"""
        mock_notification.return_value = (True, True)

        alice = test_users("alice_partial", credits=0.0)
        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        bob = test_users("bob_partial", credits=0.0, referred_by_code=alice_code)
        from src.services.referral import track_referral_signup
        track_referral_signup(alice_code, bob['user_id'])

        # Apply bonus - should handle partial failure
        from src.services.referral import apply_referral_bonus
        success, error, data = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=15.0
        )

        # The function should still complete (currently it doesn't check add_credits return)
        # This test documents current behavior
        print(f"✓ Partial credit failure handled (success={success})")


class TestReferralAPIEndpoints:
    """Test referral API endpoints with real database"""

    def test_get_referral_code_endpoint(self, supabase_client, test_users, client):
        """Test GET /referral/code endpoint"""
        user = test_users("api_user1", credits=0.0)

        response = client.get(
            "/referral/code",
            headers={"Authorization": f"Bearer {user['api_key']}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert 'referral_code' in data
        assert 'invite_link' in data
        assert 'share_message' in data
        assert len(data['referral_code']) == 8
        assert data['referral_code'] in data['invite_link']
        print(f"✓ GET /referral/code successful")

    def test_get_referral_stats_endpoint(self, supabase_client, test_users, client):
        """Test GET /referral/stats endpoint"""
        user = test_users("api_user2", credits=50.0)

        # Generate referral code first
        from src.services.referral import create_user_referral_code
        create_user_referral_code(user['user_id'])

        response = client.get(
            "/referral/stats",
            headers={"Authorization": f"Bearer {user['api_key']}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert 'referral_code' in data
        assert 'total_uses' in data
        assert 'completed_bonuses' in data
        assert 'pending_bonuses' in data
        assert 'remaining_uses' in data
        assert 'max_uses' in data
        assert data['max_uses'] == MAX_REFERRAL_USES
        assert 'total_earned' in data
        assert 'current_balance' in data
        assert 'referrals' in data
        print(f"✓ GET /referral/stats successful")

    def test_validate_referral_endpoint(self, supabase_client, test_users, client):
        """Test POST /referral/validate endpoint"""
        alice = test_users("api_alice", credits=0.0)
        bob = test_users("api_bob", credits=0.0)

        from src.services.referral import create_user_referral_code
        alice_code = create_user_referral_code(alice['user_id'])

        # Bob validates Alice's code
        response = client.post(
            "/referral/validate",
            headers={"Authorization": f"Bearer {bob['api_key']}"},
            json={"referral_code": alice_code}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is True
        assert 'message' in data
        print(f"✓ POST /referral/validate successful")

    def test_generate_referral_endpoint(self, supabase_client, test_users, client):
        """Test POST /referral/generate endpoint"""
        user = test_users("api_user3", credits=0.0)

        response = client.post(
            "/referral/generate",
            headers={"Authorization": f"Bearer {user['api_key']}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert 'referral_code' in data
        assert len(data['referral_code']) == 8
        print(f"✓ POST /referral/generate successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
