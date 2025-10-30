"""
Test subscription usage credits allocation
Ensures users receive correct credits when subscribing to PRO ($20) or MAX ($150) plans
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone

from src.services.payments import StripeService


@pytest.fixture
def stripe_service():
    """Create StripeService instance with test environment"""
    with patch.dict('os.environ', {
        'STRIPE_SECRET_KEY': 'sk_test_123',
        'STRIPE_WEBHOOK_SECRET': 'whsec_test_123',
        'STRIPE_PUBLISHABLE_KEY': 'pk_test_123',
        'FRONTEND_URL': 'https://test.gatewayz.ai'
    }):
        return StripeService()


@pytest.fixture
def mock_pro_subscription():
    """Mock PRO tier subscription"""
    return Mock(
        id='sub_pro_123',
        customer='cus_123',
        metadata={'user_id': '1', 'tier': 'pro', 'product_id': 'prod_TKOqQPhVRxNp4Q'},
        current_period_end=1735689600,  # Future timestamp
        status='active'
    )


@pytest.fixture
def mock_max_subscription():
    """Mock MAX tier subscription"""
    return Mock(
        id='sub_max_456',
        customer='cus_456',
        metadata={'user_id': '2', 'tier': 'max', 'product_id': 'prod_TKOqRE2L6qXu7s'},
        current_period_end=1735689600,  # Future timestamp
        status='active'
    )


@pytest.fixture
def mock_pro_invoice():
    """Mock invoice for PRO subscription"""
    invoice = Mock(
        id='in_pro_123',
        subscription='sub_pro_123',
        amount_paid=2000,  # $20.00 in cents
        currency='usd'
    )
    return invoice


@pytest.fixture
def mock_max_invoice():
    """Mock invoice for MAX subscription"""
    invoice = Mock(
        id='in_max_456',
        subscription='sub_max_456',
        amount_paid=15000,  # $150.00 in cents
        currency='usd'
    )
    return invoice


class TestSubscriptionUsageCreditsAllocation:
    """Test that users receive correct usage credits when subscribing"""

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_pro_subscription_receives_20_dollar_credits(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service,
        mock_pro_invoice,
        mock_pro_subscription
    ):
        """Test that PRO subscription gets $20 credits per month"""
        # Setup
        mock_retrieve_subscription.return_value = mock_pro_subscription

        # Execute
        stripe_service._handle_invoice_paid(mock_pro_invoice)

        # Verify credits were added
        mock_add_credits.assert_called_once()
        call_args = mock_add_credits.call_args

        # Check the credits amount
        assert call_args.kwargs['user_id'] == 1
        assert call_args.kwargs['credits'] == 20.0, "PRO tier should receive $20 credits"
        assert call_args.kwargs['transaction_type'] == 'subscription_renewal'
        assert 'PRO' in call_args.kwargs['description']

        # Check metadata
        metadata = call_args.kwargs['metadata']
        assert metadata['stripe_invoice_id'] == 'in_pro_123'
        assert metadata['stripe_subscription_id'] == 'sub_pro_123'
        assert metadata['tier'] == 'pro'

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_max_subscription_receives_150_dollar_credits(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service,
        mock_max_invoice,
        mock_max_subscription
    ):
        """Test that MAX subscription gets $150 credits per month"""
        # Setup
        mock_retrieve_subscription.return_value = mock_max_subscription

        # Execute
        stripe_service._handle_invoice_paid(mock_max_invoice)

        # Verify credits were added
        mock_add_credits.assert_called_once()
        call_args = mock_add_credits.call_args

        # Check the credits amount
        assert call_args.kwargs['user_id'] == 2
        assert call_args.kwargs['credits'] == 150.0, "MAX tier should receive $150 credits"
        assert call_args.kwargs['transaction_type'] == 'subscription_renewal'
        assert 'MAX' in call_args.kwargs['description']

        # Check metadata
        metadata = call_args.kwargs['metadata']
        assert metadata['stripe_invoice_id'] == 'in_max_456'
        assert metadata['stripe_subscription_id'] == 'sub_max_456'
        assert metadata['tier'] == 'max'

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_pro_subscription_initial_payment(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service,
        mock_pro_invoice,
        mock_pro_subscription
    ):
        """Test PRO subscription initial payment adds credits immediately"""
        # Setup - first invoice for new subscription
        mock_retrieve_subscription.return_value = mock_pro_subscription

        # Execute
        stripe_service._handle_invoice_paid(mock_pro_invoice)

        # Verify
        assert mock_add_credits.called, "Credits should be added on initial subscription payment"
        call_args = mock_add_credits.call_args
        assert call_args.kwargs['credits'] == 20.0

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_max_subscription_initial_payment(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service,
        mock_max_invoice,
        mock_max_subscription
    ):
        """Test MAX subscription initial payment adds credits immediately"""
        # Setup - first invoice for new subscription
        mock_retrieve_subscription.return_value = mock_max_subscription

        # Execute
        stripe_service._handle_invoice_paid(mock_max_invoice)

        # Verify
        assert mock_add_credits.called, "Credits should be added on initial subscription payment"
        call_args = mock_add_credits.call_args
        assert call_args.kwargs['credits'] == 150.0

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_pro_subscription_monthly_renewal(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service,
        mock_pro_invoice,
        mock_pro_subscription
    ):
        """Test PRO subscription renewal adds $20 credits each month"""
        # Setup
        mock_retrieve_subscription.return_value = mock_pro_subscription

        # Simulate 3 monthly renewals
        for month in range(3):
            mock_add_credits.reset_mock()

            # Execute
            stripe_service._handle_invoice_paid(mock_pro_invoice)

            # Verify each renewal adds $20
            assert mock_add_credits.called
            call_args = mock_add_credits.call_args
            assert call_args.kwargs['credits'] == 20.0, f"Month {month + 1} should add $20 credits"

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_max_subscription_monthly_renewal(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service,
        mock_max_invoice,
        mock_max_subscription
    ):
        """Test MAX subscription renewal adds $150 credits each month"""
        # Setup
        mock_retrieve_subscription.return_value = mock_max_subscription

        # Simulate 3 monthly renewals
        for month in range(3):
            mock_add_credits.reset_mock()

            # Execute
            stripe_service._handle_invoice_paid(mock_max_invoice)

            # Verify each renewal adds $150
            assert mock_add_credits.called
            call_args = mock_add_credits.call_args
            assert call_args.kwargs['credits'] == 150.0, f"Month {month + 1} should add $150 credits"

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_non_subscription_invoice_skipped(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service
    ):
        """Test that non-subscription invoices don't add credits"""
        # Setup - invoice without subscription
        non_sub_invoice = Mock(
            id='in_one_time_789',
            subscription=None,  # No subscription
            amount_paid=1000
        )

        # Execute
        stripe_service._handle_invoice_paid(non_sub_invoice)

        # Verify no credits were added
        mock_add_credits.assert_not_called()

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_unknown_tier_no_credits(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service
    ):
        """Test that unknown tiers don't receive credits"""
        # Setup - subscription with unknown tier
        unknown_tier_sub = Mock(
            id='sub_unknown_999',
            customer='cus_999',
            metadata={'user_id': '999', 'tier': 'enterprise'},  # Unknown tier
            current_period_end=1735689600,
            status='active'
        )
        unknown_invoice = Mock(
            id='in_unknown_999',
            subscription='sub_unknown_999'
        )
        mock_retrieve_subscription.return_value = unknown_tier_sub

        # Execute
        stripe_service._handle_invoice_paid(unknown_invoice)

        # Verify no credits were added (0 credits for unknown tier)
        mock_add_credits.assert_not_called()


class TestSubscriptionCreditsIntegration:
    """Integration tests for complete subscription flow with credits"""

    @patch('src.services.payments.add_credits_to_user')
    @patch('src.config.supabase_config.get_supabase_client')
    @patch('stripe.Subscription.retrieve')
    def test_pro_subscription_created_then_first_invoice_paid(
        self,
        mock_retrieve_subscription,
        mock_get_supabase,
        mock_add_credits,
        stripe_service,
        mock_pro_subscription,
        mock_pro_invoice
    ):
        """Test complete flow: subscription created -> first invoice paid -> credits added"""
        # Setup Supabase mock
        mock_client = MagicMock()
        mock_get_supabase.return_value = mock_client
        mock_retrieve_subscription.return_value = mock_pro_subscription

        # Step 1: Subscription created
        stripe_service._handle_subscription_created(mock_pro_subscription)

        # Verify subscription status updated
        assert mock_client.table.called
        table_call = mock_client.table.call_args[0][0]
        assert table_call == 'users'

        # Step 2: First invoice paid
        stripe_service._handle_invoice_paid(mock_pro_invoice)

        # Verify credits added
        assert mock_add_credits.called
        call_args = mock_add_credits.call_args
        assert call_args.kwargs['credits'] == 20.0
        assert call_args.kwargs['user_id'] == 1

    @patch('src.services.payments.add_credits_to_user')
    @patch('src.config.supabase_config.get_supabase_client')
    @patch('stripe.Subscription.retrieve')
    def test_max_subscription_created_then_first_invoice_paid(
        self,
        mock_retrieve_subscription,
        mock_get_supabase,
        mock_add_credits,
        stripe_service,
        mock_max_subscription,
        mock_max_invoice
    ):
        """Test complete flow: MAX subscription created -> first invoice paid -> credits added"""
        # Setup Supabase mock
        mock_client = MagicMock()
        mock_get_supabase.return_value = mock_client
        mock_retrieve_subscription.return_value = mock_max_subscription

        # Step 1: Subscription created
        stripe_service._handle_subscription_created(mock_max_subscription)

        # Verify subscription status updated
        assert mock_client.table.called

        # Step 2: First invoice paid
        stripe_service._handle_invoice_paid(mock_max_invoice)

        # Verify credits added
        assert mock_add_credits.called
        call_args = mock_add_credits.call_args
        assert call_args.kwargs['credits'] == 150.0
        assert call_args.kwargs['user_id'] == 2

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_multiple_users_different_tiers(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service
    ):
        """Test multiple users with different subscription tiers receive correct credits"""
        # User 1: PRO
        pro_sub = Mock(
            id='sub_pro_1',
            metadata={'user_id': '100', 'tier': 'pro'}
        )
        pro_invoice = Mock(id='in_pro_1', subscription='sub_pro_1')

        # User 2: MAX
        max_sub = Mock(
            id='sub_max_2',
            metadata={'user_id': '200', 'tier': 'max'}
        )
        max_invoice = Mock(id='in_max_2', subscription='sub_max_2')

        # User 3: PRO
        pro_sub_2 = Mock(
            id='sub_pro_3',
            metadata={'user_id': '300', 'tier': 'pro'}
        )
        pro_invoice_2 = Mock(id='in_pro_3', subscription='sub_pro_3')

        # Execute all invoices
        mock_retrieve_subscription.return_value = pro_sub
        stripe_service._handle_invoice_paid(pro_invoice)

        mock_retrieve_subscription.return_value = max_sub
        stripe_service._handle_invoice_paid(max_invoice)

        mock_retrieve_subscription.return_value = pro_sub_2
        stripe_service._handle_invoice_paid(pro_invoice_2)

        # Verify all calls
        assert mock_add_credits.call_count == 3

        # Check each call
        calls = mock_add_credits.call_args_list

        # User 100 (PRO): $20
        assert calls[0].kwargs['user_id'] == 100
        assert calls[0].kwargs['credits'] == 20.0

        # User 200 (MAX): $150
        assert calls[1].kwargs['user_id'] == 200
        assert calls[1].kwargs['credits'] == 150.0

        # User 300 (PRO): $20
        assert calls[2].kwargs['user_id'] == 300
        assert calls[2].kwargs['credits'] == 20.0


class TestSubscriptionCreditsEdgeCases:
    """Test edge cases and error scenarios"""

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_missing_user_id_in_subscription_metadata(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service
    ):
        """Test handling when user_id is missing from subscription metadata"""
        # Setup - subscription without user_id
        bad_sub = Mock(
            id='sub_bad_123',
            metadata={'tier': 'pro'}  # Missing user_id
        )
        invoice = Mock(id='in_bad_123', subscription='sub_bad_123')
        mock_retrieve_subscription.return_value = bad_sub

        # Execute - should raise error or handle gracefully
        with pytest.raises(Exception):
            stripe_service._handle_invoice_paid(invoice)

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_tier_defaults_to_pro_when_missing(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service
    ):
        """Test that tier defaults to 'pro' when not specified in metadata"""
        # Setup - subscription without tier
        sub_no_tier = Mock(
            id='sub_no_tier_123',
            metadata={'user_id': '1'}  # Missing tier
        )
        invoice = Mock(id='in_no_tier_123', subscription='sub_no_tier_123')
        mock_retrieve_subscription.return_value = sub_no_tier

        # Execute
        stripe_service._handle_invoice_paid(invoice)

        # Verify - should default to pro tier ($20)
        assert mock_add_credits.called
        call_args = mock_add_credits.call_args
        assert call_args.kwargs['credits'] == 20.0  # Pro tier default

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_case_sensitivity_of_tier(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service
    ):
        """Test that tier matching is case-sensitive (lowercase expected)"""
        # Test uppercase tier
        sub_upper = Mock(
            id='sub_upper_123',
            metadata={'user_id': '1', 'tier': 'PRO'}  # Uppercase
        )
        invoice_upper = Mock(id='in_upper_123', subscription='sub_upper_123')
        mock_retrieve_subscription.return_value = sub_upper

        # Execute
        stripe_service._handle_invoice_paid(invoice_upper)

        # Verify - uppercase 'PRO' won't match 'pro', so no credits
        mock_add_credits.assert_not_called()

        # Reset and test lowercase
        mock_add_credits.reset_mock()
        sub_lower = Mock(
            id='sub_lower_456',
            metadata={'user_id': '1', 'tier': 'pro'}  # Lowercase
        )
        invoice_lower = Mock(id='in_lower_456', subscription='sub_lower_456')
        mock_retrieve_subscription.return_value = sub_lower

        # Execute
        stripe_service._handle_invoice_paid(invoice_lower)

        # Verify - lowercase 'pro' should work
        assert mock_add_credits.called
        call_args = mock_add_credits.call_args
        assert call_args.kwargs['credits'] == 20.0

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_subscription_retrieve_fails(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service
    ):
        """Test handling when Stripe API fails to retrieve subscription"""
        # Setup
        invoice = Mock(id='in_fail_123', subscription='sub_fail_123')
        mock_retrieve_subscription.side_effect = Exception("Stripe API error")

        # Execute - should raise error
        with pytest.raises(Exception):
            stripe_service._handle_invoice_paid(invoice)

        # Verify no credits were added
        mock_add_credits.assert_not_called()

    @patch('src.services.payments.add_credits_to_user')
    @patch('stripe.Subscription.retrieve')
    def test_add_credits_fails_gracefully(
        self,
        mock_retrieve_subscription,
        mock_add_credits,
        stripe_service,
        mock_pro_subscription,
        mock_pro_invoice
    ):
        """Test that errors in add_credits_to_user are propagated"""
        # Setup
        mock_retrieve_subscription.return_value = mock_pro_subscription
        mock_add_credits.side_effect = Exception("Database error")

        # Execute - should raise error
        with pytest.raises(Exception):
            stripe_service._handle_invoice_paid(mock_pro_invoice)
