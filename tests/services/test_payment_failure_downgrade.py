#!/usr/bin/env python3
"""
Tests for payment failure tier downgrade functionality
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch, MagicMock

from src.services.payments import StripeService


class TestPaymentFailureDowngrade:
    """Test tier downgrade on payment failure"""

    @pytest.fixture
    def stripe_service(self):
        """Create StripeService instance for testing"""
        with patch.dict(
            "os.environ",
            {
                "STRIPE_SECRET_KEY": "sk_test_123",
                "STRIPE_WEBHOOK_SECRET": "whsec_test_123",
            },
        ):
            return StripeService()

    @pytest.fixture
    def mock_supabase_client(self):
        """Mock Supabase client"""
        mock_client = MagicMock()
        with patch("src.config.supabase_config.get_supabase_client") as mock:
            mock.return_value = mock_client
            yield mock_client

    def test_invoice_payment_failed_downgrades_tier(self, stripe_service, mock_supabase_client):
        """Test that invoice payment failure downgrades user to basic tier"""
        # Mock invoice data
        mock_invoice = Mock(
            id="in_test_failed_123",
            subscription="sub_test_123",
        )

        # Mock subscription data
        mock_subscription = Mock(
            id="sub_test_123",
            metadata={"user_id": "42", "tier": "pro"}
        )

        with patch("src.services.payments.stripe.Subscription.retrieve") as mock_retrieve:
            mock_retrieve.return_value = mock_subscription

            # Mock database update
            mock_users_table = MagicMock()
            mock_api_keys_table = MagicMock()

            def table_side_effect(table_name):
                if table_name == "users":
                    return mock_users_table
                elif table_name == "api_keys_new":
                    return mock_api_keys_table
                return MagicMock()

            mock_supabase_client.table.side_effect = table_side_effect

            # Execute payment failure handler
            stripe_service._handle_invoice_payment_failed(mock_invoice)

            # Verify user was downgraded to basic tier
            mock_users_table.update.assert_called_once()
            update_call = mock_users_table.update.call_args[0][0]

            assert update_call["subscription_status"] == "past_due"
            assert update_call["tier"] == "basic"  # Should downgrade to basic
            assert "updated_at" in update_call

            # Verify API keys were also updated
            mock_api_keys_table.update.assert_called_once()
            api_key_update = mock_api_keys_table.update.call_args[0][0]

            assert api_key_update["subscription_status"] == "past_due"
            assert api_key_update["subscription_plan"] == "basic"

    def test_invoice_payment_failed_for_max_tier(self, stripe_service, mock_supabase_client):
        """Test that MAX tier is also downgraded on payment failure"""
        # Mock invoice for MAX tier user
        mock_invoice = Mock(
            id="in_test_failed_max_123",
            subscription="sub_test_max_123",
        )

        mock_subscription = Mock(
            id="sub_test_max_123",
            metadata={"user_id": "99", "tier": "max"}
        )

        with patch("src.services.payments.stripe.Subscription.retrieve") as mock_retrieve:
            mock_retrieve.return_value = mock_subscription

            mock_users_table = MagicMock()
            mock_api_keys_table = MagicMock()

            def table_side_effect(table_name):
                if table_name == "users":
                    return mock_users_table
                elif table_name == "api_keys_new":
                    return mock_api_keys_table
                return MagicMock()

            mock_supabase_client.table.side_effect = table_side_effect

            # Execute payment failure handler
            stripe_service._handle_invoice_payment_failed(mock_invoice)

            # Verify MAX tier user was downgraded to basic
            update_call = mock_users_table.update.call_args[0][0]
            assert update_call["tier"] == "basic"
            assert update_call["subscription_status"] == "past_due"

    def test_invoice_payment_failed_non_subscription(self, stripe_service):
        """Test that non-subscription invoices are skipped"""
        # Mock invoice without subscription
        mock_invoice = Mock(
            id="in_test_no_sub_123",
            subscription=None,
        )

        # Should not raise exception, just skip
        stripe_service._handle_invoice_payment_failed(mock_invoice)

        # No assertions needed - just verifying no exception is raised

    def test_payment_failure_updates_both_tables(self, stripe_service, mock_supabase_client):
        """Test that payment failure updates both users and api_keys_new tables"""
        mock_invoice = Mock(
            id="in_test_123",
            subscription="sub_test_123",
        )

        mock_subscription = Mock(
            id="sub_test_123",
            metadata={"user_id": "10", "tier": "pro"}
        )

        with patch("src.services.payments.stripe.Subscription.retrieve") as mock_retrieve:
            mock_retrieve.return_value = mock_subscription

            users_update_chain = MagicMock()
            api_keys_update_chain = MagicMock()

            def table_side_effect(table_name):
                if table_name == "users":
                    return users_update_chain
                elif table_name == "api_keys_new":
                    return api_keys_update_chain
                return MagicMock()

            mock_supabase_client.table.side_effect = table_side_effect

            # Execute handler
            stripe_service._handle_invoice_payment_failed(mock_invoice)

            # Verify both tables were updated
            assert users_update_chain.update.called
            assert api_keys_update_chain.update.called

            # Verify update chains were executed
            users_update_chain.update.return_value.eq.assert_called_with("id", 10)
            api_keys_update_chain.update.return_value.eq.assert_called_with("user_id", 10)

    def test_payment_failure_logs_warning(self, stripe_service, mock_supabase_client, caplog):
        """Test that payment failure logs appropriate warning"""
        import logging

        caplog.set_level(logging.INFO)  # Capture both WARNING and INFO logs

        mock_invoice = Mock(
            id="in_warning_test_123",
            subscription="sub_test_123",
        )

        mock_subscription = Mock(
            id="sub_test_123",
            metadata={"user_id": "5", "tier": "pro"}
        )

        with patch("src.services.payments.stripe.Subscription.retrieve") as mock_retrieve:
            mock_retrieve.return_value = mock_subscription

            mock_supabase_client.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock()

            # Execute handler
            stripe_service._handle_invoice_payment_failed(mock_invoice)

            # Verify warning was logged
            assert any("Invoice payment failed for user 5" in record.message for record in caplog.records)
            assert any("past_due and downgraded to basic tier" in record.message for record in caplog.records)

    def test_payment_failure_handles_database_error(self, stripe_service, mock_supabase_client):
        """Test that database errors during payment failure are handled"""
        mock_invoice = Mock(
            id="in_error_test_123",
            subscription="sub_test_123",
        )

        mock_subscription = Mock(
            id="sub_test_123",
            metadata={"user_id": "7", "tier": "pro"}
        )

        with patch("src.services.payments.stripe.Subscription.retrieve") as mock_retrieve:
            mock_retrieve.return_value = mock_subscription

            # Simulate database error
            mock_supabase_client.table.side_effect = Exception("Database connection error")

            # Should raise exception (to be handled by webhook system)
            with pytest.raises(Exception, match="Database connection error"):
                stripe_service._handle_invoice_payment_failed(mock_invoice)
