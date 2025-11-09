#!/usr/bin/env python3
"""
Tests for Stripe webhook event deduplication
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch, MagicMock

from src.services.payments import StripeService
from src.db.webhook_events import (
    is_event_processed,
    record_processed_event,
    get_processed_event,
)


class TestWebhookDeduplication:
    """Test webhook event deduplication functionality"""

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
        with patch("src.db.webhook_events.get_supabase_client") as mock:
            client = MagicMock()
            mock.return_value = client
            yield client

    def test_event_not_processed_initially(self, mock_supabase_client):
        """Test that new event is not marked as processed"""
        # Mock empty result (event not found)
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        result = is_event_processed("evt_test_123")

        assert result is False
        mock_supabase_client.table.assert_called_with("stripe_webhook_events")

    def test_event_already_processed(self, mock_supabase_client):
        """Test that processed event is detected"""
        # Mock result with existing event
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"event_id": "evt_test_123"}
        ]

        result = is_event_processed("evt_test_123")

        assert result is True

    def test_record_processed_event(self, mock_supabase_client):
        """Test recording a processed event"""
        # Mock successful insert
        mock_supabase_client.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "event_id": "evt_test_123",
                "event_type": "invoice.paid",
                "user_id": 1,
            }
        ]

        result = record_processed_event(
            event_id="evt_test_123",
            event_type="invoice.paid",
            user_id=1,
            metadata={"test": "data"}
        )

        assert result is True
        mock_supabase_client.table.assert_called_with("stripe_webhook_events")

    def test_webhook_handler_skips_duplicate_events(self, stripe_service):
        """Test that webhook handler skips duplicate events"""
        # Create mock webhook payload
        event_data = {
            "id": "evt_test_duplicate_123",
            "type": "invoice.paid",
            "data": {
                "object": Mock(
                    subscription="sub_123",
                    id="in_123",
                    metadata={"user_id": "1", "tier": "pro"}
                )
            }
        }

        with patch("src.services.payments.stripe.Webhook.construct_event") as mock_construct:
            mock_construct.return_value = event_data

            with patch("src.services.payments.is_event_processed") as mock_is_processed:
                # First call - event not processed
                mock_is_processed.return_value = False

                with patch("src.services.payments.record_processed_event"):
                    with patch.object(stripe_service, "_handle_invoice_paid"):
                        # Process event first time
                        result1 = stripe_service.handle_webhook(b"payload", "sig_123")
                        assert result1.success is True
                        assert "processed successfully" in result1.message.lower()

                # Second call - event already processed
                mock_is_processed.return_value = True

                with patch.object(stripe_service, "_handle_invoice_paid") as mock_handler:
                    # Process same event again
                    result2 = stripe_service.handle_webhook(b"payload", "sig_123")

                    # Should skip processing
                    assert result2.success is True
                    assert "duplicate" in result2.message.lower()
                    # Handler should NOT be called
                    mock_handler.assert_not_called()

    def test_record_event_with_metadata(self, mock_supabase_client):
        """Test recording event with metadata"""
        mock_supabase_client.table.return_value.insert.return_value.execute.return_value.data = [
            {"event_id": "evt_test_123"}
        ]

        metadata = {
            "stripe_account": "acct_123",
            "environment": "test"
        }

        result = record_processed_event(
            event_id="evt_test_123",
            event_type="customer.subscription.created",
            user_id=42,
            metadata=metadata
        )

        assert result is True

        # Verify insert was called with correct data
        call_args = mock_supabase_client.table.return_value.insert.call_args
        insert_data = call_args[0][0]

        assert insert_data["event_id"] == "evt_test_123"
        assert insert_data["event_type"] == "customer.subscription.created"
        assert insert_data["user_id"] == 42
        assert insert_data["metadata"] == metadata

    def test_get_processed_event(self, mock_supabase_client):
        """Test retrieving processed event details"""
        expected_event = {
            "event_id": "evt_test_123",
            "event_type": "invoice.paid",
            "user_id": 1,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            expected_event
        ]

        result = get_processed_event("evt_test_123")

        assert result == expected_event

    def test_event_processing_error_does_not_block(self, mock_supabase_client):
        """Test that database errors don't block event processing"""
        # Simulate database error when checking if event is processed
        mock_supabase_client.table.side_effect = Exception("Database error")

        # Should return False (allow processing) on error
        result = is_event_processed("evt_test_123")

        assert result is False  # Better to process twice than not at all
