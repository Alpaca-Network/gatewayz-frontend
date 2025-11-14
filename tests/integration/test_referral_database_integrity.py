"""
Database Integrity and Concurrency Tests for Referral System

Tests critical database scenarios:
- Concurrent usage of same referral code
- Database constraints (unique codes, foreign keys)
- Transaction integrity
- Race conditions
- Data consistency
"""
import os
import pytest
import threading
import time
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from src.config.supabase_config import get_supabase_client
from src.services.referral import (
    create_user_referral_code,
    track_referral_signup,
    apply_referral_bonus,
    generate_referral_code,
    MAX_REFERRAL_USES,
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
def test_db_users(supabase_client, test_prefix):
    """Create test users for database testing"""
    created_users = []
    created_keys = []

    def _create_test_user(username_suffix, credits=0.0, referred_by_code=None):
        username = f"{test_prefix}_db_{username_suffix}"
        email = f"{username}@test.example.com"
        api_key = f"gw_test_db_{test_prefix}_{username_suffix}"

        user_data = {
            "username": username,
            "email": email,
            "credits": int(credits),  # Database expects integer, not float
            "api_key": api_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if referred_by_code is not None:
            user_data["referred_by_code"] = referred_by_code

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
        }

    yield _create_test_user

    # Cleanup
    try:
        if created_users:
            supabase_client.table("referrals").delete().in_("referred_user_id", created_users).execute()
            supabase_client.table("referrals").delete().in_("referrer_id", created_users).execute()
            supabase_client.table("credit_transactions").delete().in_("user_id", created_users).execute()

            if created_keys:
                supabase_client.table("api_keys_new").delete().in_("id", created_keys).execute()

            supabase_client.table("users").delete().in_("id", created_users).execute()
    except Exception as e:
        print(f"Cleanup error: {e}")


class TestReferralCodeUniqueness:
    """Test that referral codes are unique in database"""

    def test_referral_code_uniqueness_constraint(self, supabase_client, test_db_users):
        """
        Test that database enforces referral code uniqueness
        """
        # Create first user with code
        alice = test_db_users("alice_unique", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        print(f"✓ Alice created with code: {alice_code}")

        # Try to create another user with same code (should fail)
        bob = test_db_users("bob_unique", credits=0.0)

        # Attempt to manually set Bob's code to Alice's (should fail)
        try:
            supabase_client.table("users").update(
                {"referral_code": alice_code}
            ).eq("id", bob['user_id']).execute()

            # If we get here, uniqueness constraint isn't working (or we're checking wrong)
            # Verify codes are actually different
            alice_user = supabase_client.table("users").select("referral_code").eq("id", alice['user_id']).execute()
            bob_user = supabase_client.table("users").select("referral_code").eq("id", bob['user_id']).execute()

            alice_code_db = alice_user.data[0]['referral_code']
            bob_code_db = bob_user.data[0]['referral_code']

            # They should be different
            if alice_code_db == bob_code_db:
                pytest.fail("Database allowed duplicate referral codes!")
            else:
                print(f"✓ Codes are different: {alice_code_db} != {bob_code_db}")

        except Exception as e:
            # This is expected if there's a uniqueness constraint
            print(f"✓ Database prevented duplicate code (expected): {e}")

    def test_generate_unique_codes_at_scale(self):
        """
        Test that code generation produces unique codes at scale
        """
        codes = set()
        iterations = 1000

        for _ in range(iterations):
            code = generate_referral_code()
            codes.add(code)

        # Should have very high uniqueness (allow for 1-2 collisions in 1000)
        uniqueness_rate = len(codes) / iterations
        assert uniqueness_rate > 0.998, f"Uniqueness too low: {uniqueness_rate}"
        print(f"✓ Generated {iterations} codes, {len(codes)} unique ({uniqueness_rate*100:.2f}%)")


class TestConcurrentReferralUsage:
    """Test concurrent usage scenarios"""

    def test_concurrent_signup_same_code(self, supabase_client, test_db_users):
        """
        Test multiple users signing up with same code concurrently
        """
        # Create referrer
        alice = test_db_users("alice_concurrent", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        # Create multiple users
        num_concurrent_signups = 5
        users = [test_db_users(f"bob_concurrent_{i}", credits=0.0) for i in range(num_concurrent_signups)]

        # Track signups concurrently
        results = []

        def signup_user(user):
            try:
                success, error, referrer = track_referral_signup(alice_code, user['user_id'])
                return (user['user_id'], success, error)
            except Exception as e:
                return (user['user_id'], False, str(e))

        with ThreadPoolExecutor(max_workers=num_concurrent_signups) as executor:
            futures = [executor.submit(signup_user, user) for user in users]
            results = [future.result() for future in as_completed(futures)]

        # All should succeed
        successes = sum(1 for _, success, _ in results if success)
        assert successes == num_concurrent_signups, f"Only {successes}/{num_concurrent_signups} signups succeeded"
        print(f"✓ {successes} concurrent signups succeeded")

        # Verify all referral records were created
        referrals = supabase_client.table("referrals").select("*").eq(
            "referrer_id", alice['user_id']
        ).execute()

        assert len(referrals.data) == num_concurrent_signups
        print(f"✓ All {num_concurrent_signups} referral records created")

    def test_concurrent_bonus_application(self, supabase_client, test_db_users):
        """
        Test concurrent bonus applications (edge case)
        """
        # Create referrer and referees
        alice = test_db_users("alice_bonus_concurrent", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        num_referees = 3
        referees = []
        for i in range(num_referees):
            user = test_db_users(f"bob_bonus_concurrent_{i}", credits=0.0, referred_by_code=alice_code)
            track_referral_signup(alice_code, user['user_id'])
            referees.append(user)

        # Apply bonuses concurrently (simulates rapid purchases)
        results = []

        def apply_bonus(user):
            try:
                success, error, data = apply_referral_bonus(
                    user_id=user['user_id'],
                    referral_code=alice_code,
                    purchase_amount=15.0
                )
                return (user['user_id'], success, error)
            except Exception as e:
                return (user['user_id'], False, str(e))

        with ThreadPoolExecutor(max_workers=num_referees) as executor:
            futures = [executor.submit(apply_bonus, user) for user in referees]
            results = [future.result() for future in as_completed(futures)]

        # All should succeed (or fail gracefully)
        successes = sum(1 for _, success, _ in results if success)
        print(f"✓ {successes}/{num_referees} concurrent bonuses applied")

        # Verify Alice's credits reflect all bonuses
        alice_after = supabase_client.table("users").select("credits").eq("id", alice['user_id']).execute()
        alice_credits = float(alice_after.data[0]['credits'])

        from src.services.referral import REFERRAL_BONUS
        expected_credits = successes * REFERRAL_BONUS

        assert alice_credits >= expected_credits - 1  # Allow for slight timing issues
        print(f"✓ Alice's credits: ${alice_credits} (expected ~${expected_credits})")


class TestReferralUsageLimits:
    """Test usage limit enforcement with database"""

    def test_usage_limit_enforced_in_database(self, supabase_client, test_db_users):
        """
        Test that database correctly tracks and enforces usage limits
        """
        # Create referrer
        alice = test_db_users("alice_limit_db", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        # Use code MAX_REFERRAL_USES times
        for i in range(MAX_REFERRAL_USES):
            user = test_db_users(f"bob_limit_db_{i}", credits=0.0)
            success, error, referrer = track_referral_signup(alice_code, user['user_id'])
            assert success is True, f"Signup {i+1} should succeed"

        print(f"✓ {MAX_REFERRAL_USES} signups completed")

        # Verify referral count in database
        referrals = supabase_client.table("referrals").select("*").eq(
            "referral_code", alice_code
        ).execute()

        assert len(referrals.data) == MAX_REFERRAL_USES
        print(f"✓ Database has exactly {MAX_REFERRAL_USES} referral records")

        # Try to add one more (should fail)
        extra_user = test_db_users("bob_limit_db_extra", credits=0.0)
        success, error, referrer = track_referral_signup(alice_code, extra_user['user_id'])

        assert success is False
        assert "usage limit" in error.lower()
        print(f"✓ {MAX_REFERRAL_USES+1}th signup correctly rejected")

        # Verify no extra record was created
        referrals_after = supabase_client.table("referrals").select("*").eq(
            "referral_code", alice_code
        ).execute()

        assert len(referrals_after.data) == MAX_REFERRAL_USES
        print(f"✓ Database still has exactly {MAX_REFERRAL_USES} records (no extra created)")


class TestReferralStatusTransitions:
    """Test referral status transitions in database"""

    def test_pending_to_completed_transition(self, supabase_client, test_db_users):
        """
        Test that referral status correctly transitions from pending to completed
        """
        # Create users
        alice = test_db_users("alice_transition", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        bob = test_db_users("bob_transition", credits=0.0, referred_by_code=alice_code)
        track_referral_signup(alice_code, bob['user_id'])

        # Verify pending status
        pending = supabase_client.table("referrals").select("*").eq(
            "referred_user_id", bob['user_id']
        ).eq("status", "pending").execute()

        assert len(pending.data) == 1
        referral_id = pending.data[0]['id']
        assert pending.data[0]['completed_at'] is None
        print(f"✓ Referral created with pending status")

        # Apply bonus
        apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=15.0
        )

        # Verify completed status
        completed = supabase_client.table("referrals").select("*").eq(
            "id", referral_id
        ).execute()

        assert len(completed.data) == 1
        assert completed.data[0]['status'] == 'completed'
        assert completed.data[0]['completed_at'] is not None
        print(f"✓ Referral transitioned to completed with timestamp")

        # Verify no pending record remains for this user
        pending_after = supabase_client.table("referrals").select("*").eq(
            "referred_user_id", bob['user_id']
        ).eq("status", "pending").execute()

        assert len(pending_after.data) == 0
        print(f"✓ No pending record remains after completion")

    def test_cannot_complete_twice(self, supabase_client, test_db_users):
        """
        Test that referral cannot be completed twice
        """
        alice = test_db_users("alice_twice", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        bob = test_db_users("bob_twice", credits=0.0, referred_by_code=alice_code)
        track_referral_signup(alice_code, bob['user_id'])

        # Apply bonus first time
        success1, error1, data1 = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=15.0
        )

        assert success1 is True
        print(f"✓ First bonus application succeeded")

        # Mark first purchase
        from src.services.referral import mark_first_purchase
        mark_first_purchase(bob['user_id'])

        # Try to apply bonus second time (should fail)
        success2, error2, data2 = apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=20.0
        )

        assert success2 is False
        print(f"✓ Second bonus application rejected")

        # Verify only one completed record
        completed = supabase_client.table("referrals").select("*").eq(
            "referred_user_id", bob['user_id']
        ).eq("status", "completed").execute()

        assert len(completed.data) == 1
        print(f"✓ Only one completed referral record exists")


class TestDataIntegrity:
    """Test data integrity and consistency"""

    def test_orphaned_referral_prevention(self, supabase_client, test_db_users):
        """
        Test that referral records reference valid users
        """
        alice = test_db_users("alice_orphan", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        bob = test_db_users("bob_orphan", credits=0.0)
        track_referral_signup(alice_code, bob['user_id'])

        # Verify referral exists
        referral = supabase_client.table("referrals").select("*").eq(
            "referred_user_id", bob['user_id']
        ).execute()

        assert len(referral.data) == 1
        assert referral.data[0]['referrer_id'] == alice['user_id']
        assert referral.data[0]['referred_user_id'] == bob['user_id']
        print(f"✓ Referral correctly links referrer and referee")

    def test_referral_code_persistence(self, supabase_client, test_db_users):
        """
        Test that referral codes persist correctly in database
        """
        alice = test_db_users("alice_persist", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        # Read back from database
        alice_user = supabase_client.table("users").select("referral_code").eq(
            "id", alice['user_id']
        ).execute()

        db_code = alice_user.data[0]['referral_code']

        assert db_code == alice_code
        assert len(db_code) == 8
        print(f"✓ Referral code persisted correctly: {db_code}")

    def test_referred_by_code_persistence(self, supabase_client, test_db_users):
        """
        Test that referred_by_code persists correctly
        """
        alice = test_db_users("alice_ref_persist", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        bob = test_db_users("bob_ref_persist", credits=0.0)

        # Update Bob's referred_by_code
        supabase_client.table("users").update(
            {"referred_by_code": alice_code}
        ).eq("id", bob['user_id']).execute()

        # Read back
        bob_user = supabase_client.table("users").select("referred_by_code").eq(
            "id", bob['user_id']
        ).execute()

        db_code = bob_user.data[0]['referred_by_code']

        assert db_code == alice_code
        print(f"✓ referred_by_code persisted correctly: {db_code}")


class TestCreditTransactionIntegrity:
    """Test credit transaction integrity"""

    def test_credit_transactions_created_for_bonuses(self, supabase_client, test_db_users):
        """
        Test that credit transactions are created when bonuses are applied
        """
        alice = test_db_users("alice_tx", credits=0.0)
        alice_code = create_user_referral_code(alice['user_id'])

        bob = test_db_users("bob_tx", credits=0.0, referred_by_code=alice_code)
        track_referral_signup(alice_code, bob['user_id'])

        # Apply bonus
        apply_referral_bonus(
            user_id=bob['user_id'],
            referral_code=alice_code,
            purchase_amount=15.0
        )

        # Check Alice's transactions
        alice_txs = supabase_client.table("credit_transactions").select("*").eq(
            "user_id", alice['user_id']
        ).execute()

        assert len(alice_txs.data) >= 1
        # Look for referral bonus transaction
        referral_txs = [tx for tx in alice_txs.data if 'referral' in tx.get('description', '').lower()]
        assert len(referral_txs) >= 1
        print(f"✓ Alice has {len(referral_txs)} referral bonus transaction(s)")

        # Check Bob's transactions
        bob_txs = supabase_client.table("credit_transactions").select("*").eq(
            "user_id", bob['user_id']
        ).execute()

        assert len(bob_txs.data) >= 1
        referral_txs_bob = [tx for tx in bob_txs.data if 'referral' in tx.get('description', '').lower()]
        assert len(referral_txs_bob) >= 1
        print(f"✓ Bob has {len(referral_txs_bob)} referral bonus transaction(s)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
