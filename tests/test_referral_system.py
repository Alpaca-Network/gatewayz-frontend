"""
Comprehensive tests for the referral system
Tests the FastAPI + Supabase implementation
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from src.services.referral import (
    generate_referral_code,
    validate_referral_code,
    apply_referral_bonus,
    get_referral_stats,
    create_user_referral_code,
    mark_first_purchase,
    MAX_REFERRAL_USES,
    MIN_PURCHASE_AMOUNT,
    REFERRAL_BONUS
)


class TestReferralCodeGeneration:
    """Test referral code generation"""

    def test_generate_referral_code_format(self):
        """Test that referral codes are 8 characters uppercase + digits"""
        code = generate_referral_code()
        assert len(code) == 8
        assert code.isupper()
        assert code.isalnum()
        print(f"✅ Generated valid referral code: {code}")

    def test_generate_unique_codes(self):
        """Test that we can generate multiple unique codes"""
        codes = [generate_referral_code() for _ in range(100)]
        unique_codes = set(codes)
        # With 36^8 possibilities, 100 codes should all be unique
        assert len(unique_codes) == 100
        print(f"✅ Generated 100 unique codes")

    @patch('src.services.referral.get_supabase_client')
    def test_create_user_referral_code(self, mock_client):
        """Test creating a referral code for a user"""
        # Mock Supabase client
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock the select query (code doesn't exist)
        mock_select_result = Mock()
        mock_select_result.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_select_result

        # Mock the update query
        mock_update_result = Mock()
        mock_update_result.data = [{'id': 1, 'referral_code': 'ABC12345'}]
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_result

        code = create_user_referral_code(user_id=1)

        assert len(code) == 8
        assert code.isupper()
        print(f"✅ Created referral code for user: {code}")


class TestReferralValidation:
    """Test referral code validation logic"""

    @patch('src.services.referral.get_supabase_client')
    def test_validate_referral_code_success(self, mock_client):
        """Test successful referral code validation"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock referrer exists
        referrer_result = Mock()
        referrer_result.data = [{'id': 1, 'referral_code': 'ALICE123', 'username': 'alice'}]

        # Mock user exists and hasn't made first purchase
        user_result = Mock()
        user_result.data = [{
            'id': 2,
            'referral_code': 'BOB12345',
            'has_made_first_purchase': False,
            'referred_by_code': None
        }]

        # Mock usage count is 0
        usage_result = Mock()
        usage_result.count = 0

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            referrer_result,  # Get referrer
            user_result,      # Get user
            usage_result      # Get usage count
        ]

        is_valid, error_msg, referrer = validate_referral_code('ALICE123', user_id=2)

        assert is_valid is True
        assert error_msg is None
        assert referrer is not None
        assert referrer['username'] == 'alice'
        print("✅ Referral code validation passed")

    @patch('src.services.referral.get_supabase_client')
    def test_validate_own_code_fails(self, mock_client):
        """Test that users cannot use their own referral code"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        referrer_result = Mock()
        referrer_result.data = [{'id': 1, 'referral_code': 'ALICE123'}]

        user_result = Mock()
        user_result.data = [{
            'id': 1,
            'referral_code': 'ALICE123',  # Same code
            'has_made_first_purchase': False,
            'referred_by_code': None
        }]

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            referrer_result,
            user_result
        ]

        is_valid, error_msg, referrer = validate_referral_code('ALICE123', user_id=1)

        assert is_valid is False
        assert "own referral code" in error_msg.lower()
        print("✅ Self-referral correctly blocked")

    @patch('src.services.referral.get_supabase_client')
    def test_validate_already_made_purchase_fails(self, mock_client):
        """Test that users who already made a purchase can't use referral codes"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        referrer_result = Mock()
        referrer_result.data = [{'id': 1, 'referral_code': 'ALICE123'}]

        user_result = Mock()
        user_result.data = [{
            'id': 2,
            'referral_code': 'BOB12345',
            'has_made_first_purchase': True,  # Already purchased
            'referred_by_code': None
        }]

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            referrer_result,
            user_result
        ]

        is_valid, error_msg, referrer = validate_referral_code('ALICE123', user_id=2)

        assert is_valid is False
        assert "first purchase" in error_msg.lower()
        print("✅ Repeat purchase correctly blocked from using referral")

    @patch('src.services.referral.get_supabase_client')
    def test_validate_max_uses_reached_fails(self, mock_client):
        """Test that referral codes with 10 uses can't be used again"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        referrer_result = Mock()
        referrer_result.data = [{'id': 1, 'referral_code': 'ALICE123'}]

        user_result = Mock()
        user_result.data = [{
            'id': 2,
            'referral_code': 'BOB12345',
            'has_made_first_purchase': False,
            'referred_by_code': None
        }]

        # Mock usage count is MAX (10)
        usage_result = Mock()
        usage_result.count = MAX_REFERRAL_USES

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            referrer_result,
            user_result,
            usage_result
        ]

        is_valid, error_msg, referrer = validate_referral_code('ALICE123', user_id=2)

        assert is_valid is False
        assert "usage limit" in error_msg.lower()
        assert str(MAX_REFERRAL_USES) in error_msg
        print(f"✅ Max usage limit ({MAX_REFERRAL_USES}) correctly enforced")


class TestReferralBonus:
    """Test referral bonus application"""

    @patch('src.services.referral.get_supabase_client')
    @patch('src.services.referral.add_credits')
    def test_apply_referral_bonus_success(self, mock_add_credits, mock_client):
        """Test successful application of referral bonus"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock validation (all checks pass)
        referrer_result = Mock()
        referrer_result.data = [{
            'id': 1,
            'referral_code': 'ALICE123',
            'api_key': 'gw_live_alice',
            'balance': 0.0
        }]

        user_result = Mock()
        user_result.data = [{
            'id': 2,
            'referral_code': 'BOB12345',
            'api_key': 'gw_live_bob',
            'has_made_first_purchase': False,
            'referred_by_code': None,
            'balance': 0.0
        }]

        usage_result = Mock()
        usage_result.count = 0

        # Mock insert referral record
        insert_result = Mock()
        insert_result.data = [{'id': 1}]

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            referrer_result,  # validate: get referrer
            user_result,       # validate: get user
            usage_result,      # validate: check usage count
            user_result        # apply_bonus: get user again
        ]

        mock_supabase.table.return_value.insert.return_value.execute.return_value = insert_result
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock(data=[{}])

        success, error_msg, bonus_data = apply_referral_bonus(
            user_id=2,
            referral_code='ALICE123',
            purchase_amount=15.0
        )

        assert success is True
        assert error_msg is None
        assert bonus_data is not None
        assert bonus_data['user_bonus'] == REFERRAL_BONUS
        assert bonus_data['referrer_bonus'] == REFERRAL_BONUS

        # Verify add_credits was called twice (once for each user)
        assert mock_add_credits.call_count == 2
        print(f"✅ Referral bonus ${REFERRAL_BONUS} applied to both users")

    @patch('src.services.referral.get_supabase_client')
    def test_apply_referral_bonus_min_purchase_fails(self, mock_client):
        """Test that purchases under $10 don't get referral bonus"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        success, error_msg, bonus_data = apply_referral_bonus(
            user_id=2,
            referral_code='ALICE123',
            purchase_amount=5.0  # Under $10
        )

        assert success is False
        assert f"${MIN_PURCHASE_AMOUNT}" in error_msg
        print(f"✅ Purchases under ${MIN_PURCHASE_AMOUNT} correctly rejected")


class TestReferralStats:
    """Test referral statistics"""

    @patch('src.services.referral.get_supabase_client')
    def test_get_referral_stats(self, mock_client):
        """Test getting referral statistics for a user"""
        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock user with referral code
        user_result = Mock()
        user_result.data = [{
            'id': 1,
            'referral_code': 'ALICE123',
            'balance': 30.0,
            'referred_by_code': None
        }]

        # Mock 3 successful referrals
        referrals_result = Mock()
        referrals_result.data = [
            {'referred_user_id': 2, 'bonus_amount': 10.0, 'completed_at': '2025-01-01'},
            {'referred_user_id': 3, 'bonus_amount': 10.0, 'completed_at': '2025-01-02'},
            {'referred_user_id': 4, 'bonus_amount': 10.0, 'completed_at': '2025-01-03'}
        ]

        # Mock referred user details
        ref_user_result = Mock()
        ref_user_result.data = [{'username': 'test_user', 'email': 'test@example.com'}]

        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            user_result,
            referrals_result,
            ref_user_result,
            ref_user_result,
            ref_user_result
        ]

        stats = get_referral_stats(user_id=1)

        assert stats is not None
        assert stats['referral_code'] == 'ALICE123'
        assert stats['total_uses'] == 3
        assert stats['remaining_uses'] == MAX_REFERRAL_USES - 3
        assert stats['max_uses'] == MAX_REFERRAL_USES
        assert stats['total_earned'] == 30.0
        assert len(stats['referrals']) == 3
        print(f"✅ Referral stats: 3/{MAX_REFERRAL_USES} uses, $30 earned")


class TestPaymentWebhookIntegration:
    """Test Stripe webhook integration with referral system"""

    @patch('src.services.payments.get_supabase_client')
    @patch('src.services.payments.add_credits_to_user')
    @patch('src.services.payments.update_payment_status')
    @patch('src.services.referral.apply_referral_bonus')
    @patch('src.services.referral.mark_first_purchase')
    def test_webhook_applies_referral_bonus(
        self,
        mock_mark_purchase,
        mock_apply_bonus,
        mock_update_payment,
        mock_add_credits,
        mock_client
    ):
        """Test that webhook correctly applies referral bonus on first purchase"""
        from src.services.payments import StripeService

        mock_supabase = Mock()
        mock_client.return_value = mock_supabase

        # Mock user with referral code
        user_result = Mock()
        user_result.data = [{
            'id': 1,
            'has_made_first_purchase': False,
            'referred_by_code': 'ALICE123'
        }]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = user_result

        # Mock successful bonus application
        mock_apply_bonus.return_value = (True, None, {
            'user_bonus': 10.0,
            'referrer_bonus': 10.0
        })

        # Create Stripe service and simulate checkout session
        stripe_service = StripeService()

        mock_session = Mock()
        mock_session.metadata = {
            'user_id': '1',
            'credits': '1000',  # $10 in cents
            'payment_id': '123'
        }
        mock_session.id = 'cs_test_123'
        mock_session.payment_intent = 'pi_test_123'

        # Call the checkout completed handler
        stripe_service._handle_checkout_completed(mock_session)

        # Verify referral bonus was applied
        mock_apply_bonus.assert_called_once_with(
            user_id=1,
            referral_code='ALICE123',
            purchase_amount=10.0
        )
        mock_mark_purchase.assert_called_once_with(1)
        print("✅ Webhook correctly triggers referral bonus on first purchase")


def test_constants():
    """Test that constants are set correctly"""
    assert MAX_REFERRAL_USES == 10, f"Expected MAX_REFERRAL_USES to be 10, got {MAX_REFERRAL_USES}"
    assert MIN_PURCHASE_AMOUNT == 10.0, f"Expected MIN_PURCHASE_AMOUNT to be 10.0, got {MIN_PURCHASE_AMOUNT}"
    assert REFERRAL_BONUS == 10.0, f"Expected REFERRAL_BONUS to be 10.0, got {REFERRAL_BONUS}"
    print("✅ All constants are correctly set:")
    print(f"   - Max uses per code: {MAX_REFERRAL_USES}")
    print(f"   - Min purchase: ${MIN_PURCHASE_AMOUNT}")
    print(f"   - Bonus amount: ${REFERRAL_BONUS}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
