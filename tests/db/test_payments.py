#!/usr/bin/env python3
"""
Comprehensive tests for payment database operations - CRITICAL for financial integrity

Tests cover:
- Payment record creation
- Payment retrieval (by ID, Stripe intent, user)
- Payment status updates
- Payment metadata updates
- Payment statistics and analytics
- Revenue calculations
- Payment trends
- Error handling
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone, timedelta

from src.db.payments import (
    create_payment,
    get_payment,
    get_payment_by_stripe_intent,
    get_user_payments,
    get_recent_payments,
    update_payment_status,
    update_payment_metadata,
    delete_payment,
    get_payment_statistics,
    get_total_revenue,
    get_payment_trends
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client"""
    client = Mock()
    table_mock = Mock()
    client.table.return_value = table_mock
    return client, table_mock


@pytest.fixture
def mock_payment_data():
    """Sample payment data"""
    return {
        'id': 1,
        'user_id': 123,
        'amount_usd': 29.99,
        'amount_cents': 2999,
        'credits_purchased': 2999,
        'bonus_credits': 0,
        'currency': 'usd',
        'payment_method': 'stripe',
        'status': 'completed',
        'stripe_payment_intent_id': 'pi_abc123',
        'stripe_checkout_session_id': 'cs_def456',
        'stripe_customer_id': 'cus_xyz789',
        'metadata': {},
        'created_at': datetime.now(timezone.utc).isoformat(),
        'completed_at': datetime.now(timezone.utc).isoformat()
    }


# ============================================================
# TEST CLASS: Create Payment
# ============================================================

class TestCreatePayment:
    """Test payment record creation"""

    @patch('src.db.payments.get_supabase_client')
    def test_create_payment_success(self, mock_get_client, mock_supabase_client, mock_payment_data):
        """Test successful payment creation"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        result_mock = Mock()
        result_mock.data = [mock_payment_data]
        table_mock.insert.return_value.execute.return_value = result_mock

        payment = create_payment(
            user_id=123,
            amount=29.99,
            stripe_payment_intent_id='pi_abc123',
            stripe_session_id='cs_def456',
            stripe_customer_id='cus_xyz789'
        )

        assert payment is not None
        assert payment['user_id'] == 123
        assert payment['amount_usd'] == 29.99
        assert payment['amount_cents'] == 2999
        assert payment['credits_purchased'] == 2999

        # Verify insert was called
        table_mock.insert.assert_called_once()

    @patch('src.db.payments.get_supabase_client')
    def test_create_payment_with_metadata(self, mock_get_client, mock_supabase_client):
        """Test payment creation with metadata"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        payment_data = {
            'id': 1,
            'user_id': 123,
            'amount_usd': 10.00,
            'metadata': {'source': 'web', 'campaign': 'promo2024'}
        }

        result_mock = Mock()
        result_mock.data = [payment_data]
        table_mock.insert.return_value.execute.return_value = result_mock

        payment = create_payment(
            user_id=123,
            amount=10.00,
            metadata={'source': 'web', 'campaign': 'promo2024'}
        )

        assert payment is not None
        assert payment['metadata']['source'] == 'web'
        assert payment['metadata']['campaign'] == 'promo2024'

    @patch('src.db.payments.get_supabase_client')
    def test_create_payment_no_data_returned(self, mock_get_client, mock_supabase_client):
        """Test handling when no data returned"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        result_mock = Mock()
        result_mock.data = None
        table_mock.insert.return_value.execute.return_value = result_mock

        payment = create_payment(user_id=123, amount=10.00)

        assert payment is None

    @patch('src.db.payments.get_supabase_client')
    def test_create_payment_exception(self, mock_get_client):
        """Test exception handling during creation"""
        mock_get_client.side_effect = Exception("Database error")

        payment = create_payment(user_id=123, amount=10.00)

        assert payment is None


# ============================================================
# TEST CLASS: Retrieve Payments
# ============================================================

class TestRetrievePayments:
    """Test payment retrieval operations"""

    @patch('src.db.payments.get_supabase_client')
    def test_get_payment_success(self, mock_get_client, mock_supabase_client, mock_payment_data):
        """Test retrieving payment by ID"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        result_mock = Mock()
        result_mock.data = [mock_payment_data]
        table_mock.select.return_value.eq.return_value.execute.return_value = result_mock

        payment = get_payment(1)

        assert payment is not None
        assert payment['id'] == 1
        assert payment['user_id'] == 123

    @patch('src.db.payments.get_supabase_client')
    def test_get_payment_not_found(self, mock_get_client, mock_supabase_client):
        """Test getting non-existent payment"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        result_mock = Mock()
        result_mock.data = []
        table_mock.select.return_value.eq.return_value.execute.return_value = result_mock

        payment = get_payment(999)

        assert payment is None

    @patch('src.db.payments.get_supabase_client')
    def test_get_payment_by_stripe_intent_payment_intent(
        self, mock_get_client, mock_supabase_client, mock_payment_data
    ):
        """Test getting payment by Stripe payment intent ID"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        result_mock = Mock()
        result_mock.data = [mock_payment_data]
        table_mock.select.return_value.eq.return_value.execute.return_value = result_mock

        payment = get_payment_by_stripe_intent('pi_abc123')

        assert payment is not None
        assert payment['stripe_payment_intent_id'] == 'pi_abc123'

    @patch('src.db.payments.get_supabase_client')
    def test_get_payment_by_stripe_intent_session_id(
        self, mock_get_client, mock_supabase_client, mock_payment_data
    ):
        """Test getting payment by Stripe session ID (fallback)"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # First query returns empty, second returns payment
        result_empty = Mock()
        result_empty.data = []

        result_found = Mock()
        result_found.data = [mock_payment_data]

        table_mock.select.return_value.eq.return_value.execute.side_effect = [
            result_empty,
            result_found
        ]

        payment = get_payment_by_stripe_intent('cs_def456')

        assert payment is not None
        assert payment['stripe_checkout_session_id'] == 'cs_def456'

    @patch('src.db.payments.get_supabase_client')
    def test_get_user_payments(self, mock_get_client, mock_supabase_client):
        """Test getting all payments for a user"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        payments_data = [
            {'id': 1, 'user_id': 123, 'amount_usd': 10.00},
            {'id': 2, 'user_id': 123, 'amount_usd': 20.00}
        ]

        result_mock = Mock()
        result_mock.data = payments_data

        select_mock = Mock()
        eq_mock = Mock()
        order_mock = Mock()
        range_mock = Mock()

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.order.return_value = order_mock
        order_mock.range.return_value = range_mock
        range_mock.execute.return_value = result_mock

        payments = get_user_payments(123)

        assert len(payments) == 2
        assert payments[0]['id'] == 1
        assert payments[1]['id'] == 2

    @patch('src.db.payments.get_supabase_client')
    def test_get_user_payments_with_status_filter(
        self, mock_get_client, mock_supabase_client
    ):
        """Test getting user payments filtered by status"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        completed_payments = [
            {'id': 1, 'user_id': 123, 'status': 'completed'}
        ]

        result_mock = Mock()
        result_mock.data = completed_payments

        select_mock = Mock()
        eq_user_mock = Mock()
        eq_status_mock = Mock()
        order_mock = Mock()
        range_mock = Mock()

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_user_mock
        eq_user_mock.eq.return_value = eq_status_mock
        eq_status_mock.order.return_value = order_mock
        order_mock.range.return_value = range_mock
        range_mock.execute.return_value = result_mock

        payments = get_user_payments(123, status='completed')

        assert len(payments) == 1
        assert payments[0]['status'] == 'completed'

    @patch('src.db.payments.get_supabase_client')
    def test_get_recent_payments(self, mock_get_client, mock_supabase_client):
        """Test getting recent payments (admin function)"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        recent_payments = [{'id': i} for i in range(1, 21)]

        result_mock = Mock()
        result_mock.data = recent_payments

        select_mock = Mock()
        order_mock = Mock()
        limit_mock = Mock()

        table_mock.select.return_value = select_mock
        select_mock.order.return_value = order_mock
        order_mock.limit.return_value = limit_mock
        limit_mock.execute.return_value = result_mock

        payments = get_recent_payments(20)

        assert len(payments) == 20


# ============================================================
# TEST CLASS: Update Payments
# ============================================================

class TestUpdatePayments:
    """Test payment update operations"""

    @patch('src.db.payments.get_supabase_client')
    def test_update_payment_status_to_completed(
        self, mock_get_client, mock_supabase_client
    ):
        """Test updating payment status to completed"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        updated_payment = {'id': 1, 'status': 'completed'}

        result_mock = Mock()
        result_mock.data = [updated_payment]

        update_mock = Mock()
        eq_mock = Mock()

        table_mock.update.return_value = update_mock
        update_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        payment = update_payment_status(1, 'completed')

        assert payment is not None
        assert payment['status'] == 'completed'

        # Verify update called with completed_at timestamp
        update_call_args = table_mock.update.call_args[0][0]
        assert 'completed_at' in update_call_args

    @patch('src.db.payments.get_supabase_client')
    @patch('src.db.payments.get_payment')
    def test_update_payment_status_to_failed_with_error(
        self, mock_get_payment, mock_get_client, mock_supabase_client
    ):
        """Test updating payment status to failed with error message"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock existing payment
        existing_payment = {'id': 1, 'status': 'pending', 'metadata': {}}
        mock_get_payment.return_value = existing_payment

        updated_payment = {'id': 1, 'status': 'failed'}
        result_mock = Mock()
        result_mock.data = [updated_payment]

        update_mock = Mock()
        eq_mock = Mock()

        table_mock.update.return_value = update_mock
        update_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        payment = update_payment_status(
            1,
            'failed',
            error_message='Card declined'
        )

        assert payment is not None

        # Verify update includes failed_at and error in metadata
        update_call_args = table_mock.update.call_args[0][0]
        assert 'failed_at' in update_call_args
        assert update_call_args['metadata']['error'] == 'Card declined'

    @patch('src.db.payments.get_supabase_client')
    @patch('src.db.payments.get_payment')
    def test_update_payment_metadata(
        self, mock_get_payment, mock_get_client, mock_supabase_client
    ):
        """Test updating payment metadata"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock existing payment
        existing_payment = {
            'id': 1,
            'metadata': {'existing_key': 'existing_value'}
        }
        mock_get_payment.return_value = existing_payment

        # Updated payment
        updated_payment = {
            'id': 1,
            'metadata': {
                'existing_key': 'existing_value',
                'new_key': 'new_value'
            }
        }
        result_mock = Mock()
        result_mock.data = [updated_payment]

        update_mock = Mock()
        eq_mock = Mock()

        table_mock.update.return_value = update_mock
        update_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        payment = update_payment_metadata(1, {'new_key': 'new_value'})

        assert payment is not None
        assert payment['metadata']['existing_key'] == 'existing_value'
        assert payment['metadata']['new_key'] == 'new_value'


# ============================================================
# TEST CLASS: Delete Payment
# ============================================================

class TestDeletePayment:
    """Test payment deletion (rare operation)"""

    @patch('src.db.payments.get_supabase_client')
    def test_delete_payment_success(self, mock_get_client, mock_supabase_client):
        """Test successful payment deletion"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        result_mock = Mock()
        result_mock.data = [{'id': 1}]

        delete_mock = Mock()
        eq_mock = Mock()

        table_mock.delete.return_value = delete_mock
        delete_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        result = delete_payment(1)

        assert result is True

    @patch('src.db.payments.get_supabase_client')
    def test_delete_payment_failure(self, mock_get_client, mock_supabase_client):
        """Test payment deletion failure"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        result_mock = Mock()
        result_mock.data = None

        delete_mock = Mock()
        eq_mock = Mock()

        table_mock.delete.return_value = delete_mock
        delete_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        result = delete_payment(999)

        assert result is False


# ============================================================
# TEST CLASS: Payment Statistics
# ============================================================

class TestPaymentStatistics:
    """Test payment statistics and analytics"""

    @patch('src.db.payments.get_supabase_client')
    def test_get_payment_statistics_user_specific(
        self, mock_get_client, mock_supabase_client
    ):
        """Test getting payment statistics for specific user"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        payments = [
            {'status': 'completed', 'amount_usd': 10.00},
            {'status': 'completed', 'amount_usd': 20.00},
            {'status': 'pending', 'amount_usd': 5.00},
            {'status': 'failed', 'amount_usd': 15.00},
            {'status': 'refunded', 'amount_usd': 10.00}
        ]

        result_mock = Mock()
        result_mock.data = payments

        select_mock = Mock()
        eq_mock = Mock()

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        stats = get_payment_statistics(user_id=123)

        assert stats['total_payments'] == 5
        assert stats['completed'] == 2
        assert stats['pending'] == 1
        assert stats['failed'] == 1
        assert stats['refunded'] == 1
        assert stats['total_amount'] == 30.00  # 10 + 20
        assert stats['refunded_amount'] == 10.00
        assert stats['net_amount'] == 20.00
        assert stats['average_payment'] == 15.00  # 30 / 2

    @patch('src.db.payments.get_supabase_client')
    def test_get_total_revenue(self, mock_get_client, mock_supabase_client):
        """Test getting total revenue statistics"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        payments = [
            {'amount_usd': 100.00, 'currency': 'usd'},
            {'amount_usd': 200.00, 'currency': 'usd'},
            {'amount_usd': 50.00, 'currency': 'eur'}
        ]

        result_mock = Mock()
        result_mock.data = payments

        select_mock = Mock()
        gte_mock = Mock()
        lte_mock = Mock()
        eq_mock = Mock()

        table_mock.select.return_value = select_mock
        select_mock.gte.return_value = gte_mock
        gte_mock.lte.return_value = lte_mock
        lte_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 12, 31, tzinfo=timezone.utc)

        revenue = get_total_revenue(start_date=start, end_date=end)

        assert revenue['total_transactions'] == 3
        assert revenue['revenue_by_currency']['usd'] == 300.00
        assert revenue['revenue_by_currency']['eur'] == 50.00

    @patch('src.db.payments.get_supabase_client')
    def test_get_payment_trends(self, mock_get_client, mock_supabase_client):
        """Test getting payment trends over time"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        today = datetime.now(timezone.utc).date().isoformat()
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()

        payments = [
            {
                'created_at': f'{today}T10:00:00Z',
                'status': 'completed',
                'amount_usd': 10.00
            },
            {
                'created_at': f'{today}T11:00:00Z',
                'status': 'failed',
                'amount_usd': 5.00
            },
            {
                'created_at': f'{yesterday}T10:00:00Z',
                'status': 'completed',
                'amount_usd': 20.00
            }
        ]

        result_mock = Mock()
        result_mock.data = payments

        select_mock = Mock()
        gte_mock = Mock()

        table_mock.select.return_value = select_mock
        select_mock.gte.return_value = gte_mock
        gte_mock.execute.return_value = result_mock

        trends = get_payment_trends(days=30)

        assert trends['period_days'] == 30
        assert trends['total_payments'] == 3
        assert today in trends['daily_stats']
        assert yesterday in trends['daily_stats']
        assert trends['daily_stats'][today]['total'] == 2
        assert trends['daily_stats'][today]['completed'] == 1
        assert trends['daily_stats'][today]['failed'] == 1
        assert trends['daily_stats'][yesterday]['amount'] == 20.00
