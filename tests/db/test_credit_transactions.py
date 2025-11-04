#!/usr/bin/env python3
"""
Comprehensive tests for credit transaction tracking - CRITICAL for financial accuracy

Tests cover:
- Transaction logging with full audit trail
- User transaction retrieval with pagination
- Credit addition with balance tracking
- Transaction summary calculations
- Edge cases and error handling
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
from typing import Dict, Any, List

from src.db.credit_transactions import (
    log_credit_transaction,
    get_user_transactions,
    add_credits,
    get_transaction_summary,
    TransactionType
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client with table operations"""
    client = Mock()
    table_mock = Mock()
    client.table.return_value = table_mock
    return client, table_mock


@pytest.fixture
def mock_user():
    """Sample user data"""
    return {
        'id': 1,
        'email': 'test@example.com',
        'credits': 100.0,
        'api_key': 'test_api_key_12345'
    }


@pytest.fixture
def mock_transaction():
    """Sample transaction data"""
    return {
        'id': 1,
        'user_id': 1,
        'amount': 10.0,
        'transaction_type': TransactionType.API_USAGE,
        'description': 'Chat completion - gpt-4',
        'balance_before': 100.0,
        'balance_after': 90.0,
        'payment_id': None,
        'metadata': {'model': 'gpt-4', 'tokens': 500},
        'created_by': None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }


# ============================================================
# TEST CLASS: Transaction Logging
# ============================================================

class TestLogCreditTransaction:
    """Test logging credit transactions with full audit trail"""

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_log_deduction_transaction_success(self, mock_get_client, mock_supabase_client, mock_transaction):
        """Test successfully logging a credit deduction"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Setup mock response
        result_mock = Mock()
        result_mock.data = [mock_transaction]
        table_mock.insert.return_value.execute.return_value = result_mock

        # Execute
        result = log_credit_transaction(
            user_id=1,
            amount=-10.0,
            transaction_type=TransactionType.API_USAGE,
            description="Chat completion - gpt-4",
            balance_before=100.0,
            balance_after=90.0,
            metadata={'model': 'gpt-4', 'tokens': 500}
        )

        # Verify
        assert result is not None
        assert result['amount'] == mock_transaction['amount']
        assert result['transaction_type'] == TransactionType.API_USAGE
        assert result['user_id'] == 1

        # Verify insert was called with correct data
        table_mock.insert.assert_called_once()
        insert_data = table_mock.insert.call_args[0][0]
        assert insert_data['user_id'] == 1
        assert insert_data['amount'] == -10.0
        assert insert_data['transaction_type'] == TransactionType.API_USAGE
        assert insert_data['balance_before'] == 100.0
        assert insert_data['balance_after'] == 90.0
        assert insert_data['metadata'] == {'model': 'gpt-4', 'tokens': 500}

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_log_addition_transaction_success(self, mock_get_client, mock_supabase_client):
        """Test successfully logging a credit addition"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        transaction_data = {
            'id': 2,
            'user_id': 1,
            'amount': 100.0,
            'transaction_type': TransactionType.PURCHASE,
            'description': 'Stripe payment - $10',
            'balance_before': 50.0,
            'balance_after': 150.0,
            'payment_id': 123,
            'metadata': {'payment_intent': 'pi_123'},
            'created_by': 'stripe_webhook',
            'created_at': datetime.now(timezone.utc).isoformat()
        }

        result_mock = Mock()
        result_mock.data = [transaction_data]
        table_mock.insert.return_value.execute.return_value = result_mock

        # Execute
        result = log_credit_transaction(
            user_id=1,
            amount=100.0,
            transaction_type=TransactionType.PURCHASE,
            description="Stripe payment - $10",
            balance_before=50.0,
            balance_after=150.0,
            payment_id=123,
            metadata={'payment_intent': 'pi_123'},
            created_by='stripe_webhook'
        )

        # Verify
        assert result is not None
        assert result['amount'] == 100.0
        assert result['transaction_type'] == TransactionType.PURCHASE
        assert result['payment_id'] == 123
        assert result['created_by'] == 'stripe_webhook'

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_log_transaction_with_all_types(self, mock_get_client, mock_supabase_client):
        """Test logging transactions with all available transaction types"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        transaction_types = [
            TransactionType.TRIAL,
            TransactionType.PURCHASE,
            TransactionType.ADMIN_CREDIT,
            TransactionType.ADMIN_DEBIT,
            TransactionType.API_USAGE,
            TransactionType.REFUND,
            TransactionType.BONUS,
            TransactionType.TRANSFER
        ]

        for trans_type in transaction_types:
            result_mock = Mock()
            result_mock.data = [{
                'id': 1,
                'user_id': 1,
                'transaction_type': trans_type,
                'amount': 10.0,
                'description': f'Test {trans_type}',
                'balance_before': 100.0,
                'balance_after': 110.0
            }]
            table_mock.insert.return_value.execute.return_value = result_mock

            result = log_credit_transaction(
                user_id=1,
                amount=10.0,
                transaction_type=trans_type,
                description=f'Test {trans_type}',
                balance_before=100.0,
                balance_after=110.0
            )

            assert result is not None
            assert result['transaction_type'] == trans_type

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_log_transaction_no_data_returned(self, mock_get_client, mock_supabase_client):
        """Test handling when no data is returned from insert"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        result_mock = Mock()
        result_mock.data = None
        table_mock.insert.return_value.execute.return_value = result_mock

        result = log_credit_transaction(
            user_id=1,
            amount=10.0,
            transaction_type=TransactionType.BONUS,
            description="Test",
            balance_before=100.0,
            balance_after=110.0
        )

        assert result is None

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_log_transaction_exception_handling(self, mock_get_client):
        """Test exception handling during transaction logging"""
        mock_get_client.side_effect = Exception("Database connection error")

        result = log_credit_transaction(
            user_id=1,
            amount=10.0,
            transaction_type=TransactionType.BONUS,
            description="Test",
            balance_before=100.0,
            balance_after=110.0
        )

        assert result is None

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_log_transaction_with_metadata(self, mock_get_client, mock_supabase_client):
        """Test logging transaction with complex metadata"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        metadata = {
            'model': 'gpt-4',
            'tokens': 500,
            'request_id': 'req_abc123',
            'endpoint': '/v1/chat/completions',
            'duration_ms': 1234
        }

        result_mock = Mock()
        result_mock.data = [{
            'id': 1,
            'user_id': 1,
            'metadata': metadata
        }]
        table_mock.insert.return_value.execute.return_value = result_mock

        result = log_credit_transaction(
            user_id=1,
            amount=-10.0,
            transaction_type=TransactionType.API_USAGE,
            description="API call",
            balance_before=100.0,
            balance_after=90.0,
            metadata=metadata
        )

        assert result is not None
        insert_data = table_mock.insert.call_args[0][0]
        assert insert_data['metadata'] == metadata


# ============================================================
# TEST CLASS: Transaction Retrieval
# ============================================================

class TestGetUserTransactions:
    """Test retrieving user transaction history"""

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_transactions_basic(self, mock_get_client, mock_supabase_client):
        """Test basic transaction retrieval"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        transactions = [
            {'id': 1, 'user_id': 1, 'amount': -10.0, 'created_at': '2024-01-01T00:00:00Z'},
            {'id': 2, 'user_id': 1, 'amount': 100.0, 'created_at': '2024-01-02T00:00:00Z'}
        ]

        # Setup chained mocks for query builder
        select_mock = Mock()
        eq_mock = Mock()
        order_mock = Mock()
        result_mock = Mock()
        result_mock.data = transactions

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.order.return_value = order_mock
        order_mock.execute.return_value = result_mock

        # Execute
        result = get_user_transactions(user_id=1)

        # Verify
        assert len(result) == 2
        assert result[0]['id'] == 1
        assert result[1]['id'] == 2

        # Verify query builder calls
        table_mock.select.assert_called_once_with('*')
        select_mock.eq.assert_called_once_with('user_id', 1)
        eq_mock.order.assert_called_once_with('created_at', desc=True)
        order_mock.execute.assert_called_once()

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_transactions_with_pagination(self, mock_get_client, mock_supabase_client):
        """Test transaction retrieval with pagination"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Setup mocks - provide enough data for pagination
        select_mock = Mock()
        eq_mock = Mock()
        order_mock = Mock()
        result_mock = Mock()
        # Provide 20 items total, so offset 10 + limit 10 gives us items 10-19
        result_mock.data = [{'id': i} for i in range(1, 21)]

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.order.return_value = order_mock
        order_mock.execute.return_value = result_mock

        # Execute with pagination
        result = get_user_transactions(user_id=1, limit=10, offset=10)

        # Verify - should get items 10-19 (indices 10-19 in the list)
        assert len(result) == 10
        assert result[0]['id'] == 11  # First item after offset 10
        assert result[9]['id'] == 20  # Last item
        order_mock.execute.assert_called_once()

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_transactions_with_type_filter(self, mock_get_client, mock_supabase_client):
        """Test filtering transactions by type"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Setup mocks
        select_mock = Mock()
        eq_user_mock = Mock()
        eq_type_mock = Mock()
        order_mock = Mock()
        result_mock = Mock()
        result_mock.data = [
            {'id': 1, 'transaction_type': TransactionType.PURCHASE},
            {'id': 2, 'transaction_type': TransactionType.PURCHASE}
        ]

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_user_mock
        eq_user_mock.eq.return_value = eq_type_mock
        eq_type_mock.order.return_value = order_mock
        order_mock.execute.return_value = result_mock

        # Execute with type filter
        result = get_user_transactions(
            user_id=1,
            transaction_type=TransactionType.PURCHASE
        )

        # Verify
        assert len(result) == 2
        order_mock.execute.assert_called_once()
        assert all(t['transaction_type'] == TransactionType.PURCHASE for t in result)

        # Verify eq was called twice (user_id and transaction_type)
        assert select_mock.eq.call_count == 1
        assert eq_user_mock.eq.call_count == 1

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_transactions_empty_result(self, mock_get_client, mock_supabase_client):
        """Test handling empty transaction history"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Setup mocks
        select_mock = Mock()
        eq_mock = Mock()
        order_mock = Mock()
        range_mock = Mock()
        result_mock = Mock()
        result_mock.data = []

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.order.return_value = order_mock
        order_mock.range.return_value = range_mock
        range_mock.execute.return_value = result_mock

        result = get_user_transactions(user_id=999)

        assert result == []

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_transactions_exception_handling(self, mock_get_client):
        """Test exception handling during retrieval"""
        mock_get_client.side_effect = Exception("Database error")

        result = get_user_transactions(user_id=1)

        assert result == []


# ============================================================
# TEST CLASS: Add Credits
# ============================================================

class TestAddCredits:
    """Test adding credits to user accounts"""

    @patch('src.db.credit_transactions.get_supabase_client')
    @patch('src.db.credit_transactions.log_credit_transaction')
    def test_add_credits_success_with_api_key(
        self, mock_log_transaction, mock_get_client, mock_supabase_client, mock_user
    ):
        """Test successfully adding credits using API key"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Setup mocks for user lookup
        select_mock = Mock()
        eq_mock = Mock()
        result_mock = Mock()
        result_mock.data = [mock_user]

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        # Setup mocks for update
        update_mock = Mock()
        update_eq_mock = Mock()
        update_result_mock = Mock()
        update_result_mock.data = [{'id': 1, 'credits': 150.0}]

        table_mock.update.return_value = update_mock
        update_mock.eq.return_value = update_eq_mock
        update_eq_mock.execute.return_value = update_result_mock

        # Execute
        result = add_credits(
            api_key='test_api_key_12345',
            amount=50.0,
            description='Bonus credits',
            metadata={'reason': 'promotion'}
        )

        # Verify
        assert result is True

        # Verify user lookup by API key
        select_mock.eq.assert_called_once_with('api_key', 'test_api_key_12345')

        # Verify credits update
        table_mock.update.assert_called_once_with({'credits': 150.0})

        # Verify transaction logged
        mock_log_transaction.assert_called_once()
        log_args = mock_log_transaction.call_args[1]
        assert log_args['user_id'] == 1
        assert log_args['amount'] == 50.0
        assert log_args['balance_before'] == 100.0
        assert log_args['balance_after'] == 150.0

    @patch('src.db.credit_transactions.get_supabase_client')
    @patch('src.db.credit_transactions.log_credit_transaction')
    def test_add_credits_success_with_user_id(
        self, mock_log_transaction, mock_get_client, mock_supabase_client, mock_user
    ):
        """Test successfully adding credits using user ID"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Setup mocks for user lookup by ID
        select_mock = Mock()
        eq_mock = Mock()
        result_mock = Mock()
        result_mock.data = [mock_user]

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        # Setup mocks for update
        update_mock = Mock()
        update_eq_mock = Mock()
        update_result_mock = Mock()
        update_result_mock.data = [{'id': 1, 'credits': 125.0}]

        table_mock.update.return_value = update_mock
        update_mock.eq.return_value = update_eq_mock
        update_eq_mock.execute.return_value = update_result_mock

        # Execute
        result = add_credits(
            api_key='',  # Not used when user_id provided
            amount=25.0,
            description='Admin bonus',
            transaction_type=TransactionType.ADMIN_CREDIT,
            user_id=1
        )

        # Verify
        assert result is True

        # Verify user lookup by ID
        select_mock.eq.assert_called_once_with('id', 1)

        # Verify transaction logged with correct type
        log_args = mock_log_transaction.call_args[1]
        assert log_args['transaction_type'] == TransactionType.ADMIN_CREDIT

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_add_credits_negative_amount(self, mock_get_client):
        """Test rejection of negative credit amounts"""
        result = add_credits(
            api_key='test_key',
            amount=-50.0,
            description='Invalid'
        )

        assert result is False

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_add_credits_zero_amount(self, mock_get_client):
        """Test rejection of zero credit amounts"""
        result = add_credits(
            api_key='test_key',
            amount=0.0,
            description='Invalid'
        )

        assert result is False

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_add_credits_user_not_found(self, mock_get_client, mock_supabase_client):
        """Test handling when user is not found"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        select_mock = Mock()
        eq_mock = Mock()
        result_mock = Mock()
        result_mock.data = None

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        result = add_credits(
            api_key='invalid_key',
            amount=50.0,
            description='Test'
        )

        assert result is False

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_add_credits_update_fails(self, mock_get_client, mock_supabase_client, mock_user):
        """Test handling when credit update fails"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # User lookup succeeds
        select_mock = Mock()
        eq_mock = Mock()
        result_mock = Mock()
        result_mock.data = [mock_user]

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        # Update fails
        update_mock = Mock()
        update_eq_mock = Mock()
        update_result_mock = Mock()
        update_result_mock.data = None

        table_mock.update.return_value = update_mock
        update_mock.eq.return_value = update_eq_mock
        update_eq_mock.execute.return_value = update_result_mock

        result = add_credits(
            api_key='test_key',
            amount=50.0,
            description='Test'
        )

        assert result is False

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_add_credits_exception_handling(self, mock_get_client):
        """Test exception handling during credit addition"""
        mock_get_client.side_effect = Exception("Database error")

        result = add_credits(
            api_key='test_key',
            amount=50.0,
            description='Test'
        )

        assert result is False


# ============================================================
# TEST CLASS: Transaction Summary
# ============================================================

class TestGetTransactionSummary:
    """Test transaction summary calculations"""

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_summary_with_mixed_transactions(self, mock_get_client, mock_supabase_client):
        """Test summary calculation with various transaction types"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        transactions = [
            {'amount': 100.0, 'transaction_type': TransactionType.PURCHASE},
            {'amount': 50.0, 'transaction_type': TransactionType.BONUS},
            {'amount': -10.0, 'transaction_type': TransactionType.API_USAGE},
            {'amount': -5.0, 'transaction_type': TransactionType.API_USAGE},
            {'amount': 25.0, 'transaction_type': TransactionType.REFUND},
            {'amount': -3.0, 'transaction_type': TransactionType.API_USAGE}
        ]

        # Setup mocks
        select_mock = Mock()
        eq_mock = Mock()
        result_mock = Mock()
        result_mock.data = transactions

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        # Execute
        summary = get_transaction_summary(user_id=1)

        # Verify
        assert summary['total_transactions'] == 6
        assert summary['total_credits_added'] == 175.0  # 100 + 50 + 25
        assert summary['total_credits_used'] == 18.0    # 10 + 5 + 3

        # Verify by_type breakdown
        assert summary['by_type'][TransactionType.PURCHASE]['count'] == 1
        assert summary['by_type'][TransactionType.PURCHASE]['total_amount'] == 100.0

        assert summary['by_type'][TransactionType.API_USAGE]['count'] == 3
        assert summary['by_type'][TransactionType.API_USAGE]['total_amount'] == -18.0

        assert summary['by_type'][TransactionType.BONUS]['count'] == 1
        assert summary['by_type'][TransactionType.BONUS]['total_amount'] == 50.0

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_summary_empty_transactions(self, mock_get_client, mock_supabase_client):
        """Test summary with no transactions"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        select_mock = Mock()
        eq_mock = Mock()
        result_mock = Mock()
        result_mock.data = []

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        summary = get_transaction_summary(user_id=999)

        assert summary['total_transactions'] == 0
        assert summary['total_credits_added'] == 0
        assert summary['total_credits_used'] == 0
        assert summary['by_type'] == {}

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_summary_only_additions(self, mock_get_client, mock_supabase_client):
        """Test summary with only credit additions"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        transactions = [
            {'amount': 100.0, 'transaction_type': TransactionType.PURCHASE},
            {'amount': 50.0, 'transaction_type': TransactionType.BONUS},
            {'amount': 25.0, 'transaction_type': TransactionType.TRIAL}
        ]

        select_mock = Mock()
        eq_mock = Mock()
        result_mock = Mock()
        result_mock.data = transactions

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        summary = get_transaction_summary(user_id=1)

        assert summary['total_credits_added'] == 175.0
        assert summary['total_credits_used'] == 0

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_summary_only_deductions(self, mock_get_client, mock_supabase_client):
        """Test summary with only credit deductions"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        transactions = [
            {'amount': -10.0, 'transaction_type': TransactionType.API_USAGE},
            {'amount': -5.0, 'transaction_type': TransactionType.API_USAGE},
            {'amount': -20.0, 'transaction_type': TransactionType.ADMIN_DEBIT}
        ]

        select_mock = Mock()
        eq_mock = Mock()
        result_mock = Mock()
        result_mock.data = transactions

        table_mock.select.return_value = select_mock
        select_mock.eq.return_value = eq_mock
        eq_mock.execute.return_value = result_mock

        summary = get_transaction_summary(user_id=1)

        assert summary['total_credits_added'] == 0
        assert summary['total_credits_used'] == 35.0

    @patch('src.db.credit_transactions.get_supabase_client')
    def test_get_summary_exception_handling(self, mock_get_client):
        """Test exception handling during summary calculation"""
        mock_get_client.side_effect = Exception("Database error")

        summary = get_transaction_summary(user_id=1)

        assert summary['total_transactions'] == 0
        assert summary['total_credits_added'] == 0
        assert summary['total_credits_used'] == 0
        assert summary['by_type'] == {}
        assert 'error' in summary


# ============================================================
# TEST CLASS: Transaction Types
# ============================================================

class TestTransactionType:
    """Test TransactionType enum values"""

    def test_transaction_type_values(self):
        """Test all transaction type constants are defined"""
        assert TransactionType.TRIAL == "trial"
        assert TransactionType.PURCHASE == "purchase"
        assert TransactionType.ADMIN_CREDIT == "admin_credit"
        assert TransactionType.ADMIN_DEBIT == "admin_debit"
        assert TransactionType.API_USAGE == "api_usage"
        assert TransactionType.REFUND == "refund"
        assert TransactionType.BONUS == "bonus"
        assert TransactionType.TRANSFER == "transfer"
