#!/usr/bin/env python3
"""
Comprehensive tests for user endpoints

Tests cover:
- User balance retrieval (trial and active users)
- User monitoring and metrics
- Rate limit retrieval
- User profile management (get/update)
- Account deletion
- Credit transaction history
- Trial validation integration
- Error handling
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from src.main import app


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_api_key():
    """Sample API key"""
    return "sk-test-key-12345"


@pytest.fixture
def mock_user():
    """Sample user from database"""
    return {
        'id': '1',
        'username': 'testuser',
        'email': 'test@example.com',
        'credits': 100.0,
        'api_key': 'sk-test-key-12345',
        'subscription_status': 'active',
        'tier': 'pro',
        'subscription_end_date': None
    }


@pytest.fixture
def mock_trial_user():
    """Sample trial user"""
    return {
        'id': '2',
        'username': 'trialuser',
        'email': 'trial@example.com',
        'credits': 10.0,
        'api_key': 'sk-trial-key-12345',
        'subscription_status': 'trial',
        'tier': 'basic',
        'trial_end_date': (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        'subscription_end_date': None
    }


@pytest.fixture
def mock_usage_metrics():
    """Sample usage metrics"""
    return {
        'user_id': '1',
        'current_credits': 100.0,
        'usage_metrics': {
            'total_requests': 150,
            'total_tokens': 50000,
            'total_cost': 25.50,
            'requests_today': 10,
            'tokens_today': 3000,
            'cost_today': 1.20,
            'last_request': '2024-01-01T12:00:00Z',
            'average_tokens_per_request': 333.33,
            'most_used_model': 'claude-3-sonnet'
        }
    }


@pytest.fixture
def mock_rate_limits():
    """Sample rate limits"""
    return {
        'requests_per_minute': 60,
        'requests_per_hour': 1000,
        'requests_per_day': 10000,
        'tokens_per_minute': 10000,
        'tokens_per_hour': 100000,
        'tokens_per_day': 1000000
    }


@pytest.fixture
def mock_user_profile():
    """Sample user profile"""
    return {
        'user_id': 1,
        'api_key': 'sk-test-key-12345',
        'credits': 100,
        'username': 'testuser',
        'email': 'test@example.com',
        'auth_method': 'email',
        'subscription_status': 'active',
        'tier': 'pro',  # Subscription tier: basic, pro, or max
        'tier_display_name': 'Pro',  # Display-friendly tier name
        'trial_expires_at': None,
        'subscription_end_date': None,  # Unix timestamp for subscription end
        'is_active': True,
        'registration_date': '2024-01-01T00:00:00Z',
        'created_at': '2024-01-01T00:00:00Z',
        'updated_at': '2024-01-01T12:00:00Z'
    }


@pytest.fixture
def mock_credit_transactions():
    """Sample credit transactions"""
    return [
        {
            'id': 1,
            'amount': 10.0,
            'transaction_type': 'trial',
            'description': 'Trial credits',
            'balance_before': 0.0,
            'balance_after': 10.0,
            'created_at': '2024-01-01T00:00:00Z',
            'payment_id': None,
            'metadata': {}
        },
        {
            'id': 2,
            'amount': 50.0,
            'transaction_type': 'purchase',
            'description': 'Credit purchase via Stripe',
            'balance_before': 10.0,
            'balance_after': 60.0,
            'created_at': '2024-01-02T00:00:00Z',
            'payment_id': 'pi_123456',
            'metadata': {'stripe_session_id': 'cs_test_123'}
        },
        {
            'id': 3,
            'amount': -2.50,
            'transaction_type': 'api_usage',
            'description': 'API usage - claude-3-sonnet',
            'balance_before': 60.0,
            'balance_after': 57.50,
            'created_at': '2024-01-03T00:00:00Z',
            'payment_id': None,
            'metadata': {'model': 'claude-3-sonnet', 'tokens': 10000}
        }
    ]


# ============================================================
# TEST CLASS: User Balance
# ============================================================

class TestUserBalance:
    """Test user balance retrieval"""

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.validate_trial_access')
    def test_get_balance_active_user(
        self,
        mock_validate_trial,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test getting balance for active (non-trial) user"""
        mock_get_user.return_value = mock_user
        mock_validate_trial.return_value = {'is_trial': False}

        response = client.get(
            '/user/balance',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['credits'] == 100.0
        assert data['status'] == 'active'
        assert data['user_id'] == '1'
        assert mock_api_key[:10] in data['api_key']

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.validate_trial_access')
    def test_get_balance_trial_user(
        self,
        mock_validate_trial,
        mock_get_user,
        client,
        mock_api_key,
        mock_trial_user
    ):
        """Test getting balance for trial user"""
        mock_get_user.return_value = mock_trial_user
        mock_validate_trial.return_value = {
            'is_trial': True,
            'remaining_credits': 8.5,
            'remaining_tokens': 50000,
            'remaining_requests': 200,
            'trial_end_date': '2024-01-15T00:00:00Z'
        }

        response = client.get(
            '/user/balance',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'trial'
        assert data['credits'] == 8.5
        assert data['tokens_remaining'] == 50000
        assert data['requests_remaining'] == 200
        assert 'trial_end_date' in data

    @patch('src.routes.users.get_user')
    def test_get_balance_invalid_api_key(
        self,
        mock_get_user,
        client
    ):
        """Test balance retrieval with invalid API key"""
        mock_get_user.return_value = None

        response = client.get(
            '/user/balance',
            headers={'Authorization': 'Bearer invalid-key'}
        )

        assert response.status_code == 401
        assert 'invalid api key' in response.json()['detail'].lower()

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.validate_trial_access')
    def test_get_balance_error_handling(
        self,
        mock_validate_trial,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test balance error handling"""
        mock_get_user.return_value = mock_user
        mock_validate_trial.side_effect = Exception("Validation error")

        response = client.get(
            '/user/balance',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 500
        assert 'internal server error' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: User Monitor
# ============================================================

class TestUserMonitor:
    """Test user monitoring and metrics"""

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_usage_metrics')
    @patch('src.routes.users.get_user_rate_limits')
    def test_user_monitor_success(
        self,
        mock_get_limits,
        mock_get_metrics,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_usage_metrics,
        mock_rate_limits
    ):
        """Test successful user monitoring"""
        mock_get_user.return_value = mock_user
        mock_get_metrics.return_value = mock_usage_metrics
        mock_get_limits.return_value = mock_rate_limits

        response = client.get(
            '/user/monitor',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['user_id'] == '1'
        assert data['current_credits'] == 100.0
        assert 'usage_metrics' in data
        assert 'rate_limits' in data
        assert data['usage_metrics']['total_requests'] == 150
        assert data['rate_limits']['requests_per_minute'] == 60

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_usage_metrics')
    @patch('src.routes.users.get_user_rate_limits')
    def test_user_monitor_no_rate_limits(
        self,
        mock_get_limits,
        mock_get_metrics,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_usage_metrics
    ):
        """Test user monitoring when no rate limits configured"""
        mock_get_user.return_value = mock_user
        mock_get_metrics.return_value = mock_usage_metrics
        mock_get_limits.return_value = None

        response = client.get(
            '/user/monitor',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['rate_limits'] == {}

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_usage_metrics')
    def test_user_monitor_failed_metrics(
        self,
        mock_get_metrics,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test monitoring when metrics retrieval fails"""
        mock_get_user.return_value = mock_user
        mock_get_metrics.return_value = None

        response = client.get(
            '/user/monitor',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 500
        assert 'failed to retrieve usage data' in response.json()['detail'].lower()

    @patch('src.routes.users.get_user')
    def test_user_monitor_invalid_key(
        self,
        mock_get_user,
        client
    ):
        """Test monitoring with invalid API key"""
        mock_get_user.return_value = None

        response = client.get(
            '/user/monitor',
            headers={'Authorization': 'Bearer invalid-key'}
        )

        assert response.status_code == 401


# ============================================================
# TEST CLASS: Rate Limits
# ============================================================

class TestRateLimits:
    """Test rate limit retrieval"""

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_rate_limits')
    @patch('src.routes.users.check_rate_limit')
    def test_get_rate_limits_configured(
        self,
        mock_check_limit,
        mock_get_limits,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_rate_limits
    ):
        """Test getting configured rate limits"""
        mock_get_user.return_value = mock_user
        mock_get_limits.return_value = mock_rate_limits
        mock_check_limit.return_value = {
            'allowed': True,
            'reason': 'Within limits',
            'current_requests': 10,
            'current_tokens': 1000
        }

        response = client.get(
            '/user/limit',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert 'current_limits' in data
        assert 'current_usage' in data
        assert 'reset_times' in data
        assert data['current_limits']['requests_per_minute'] == 60
        assert data['current_usage']['allowed'] is True

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_rate_limits')
    def test_get_rate_limits_default(
        self,
        mock_get_limits,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test getting default rate limits when none configured"""
        mock_get_user.return_value = mock_user
        mock_get_limits.return_value = None

        response = client.get(
            '/user/limit',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['current_limits']['requests_per_minute'] == 60
        assert data['current_limits']['requests_per_hour'] == 1000
        assert data['current_usage']['reason'] == 'No rate limits configured'

    @patch('src.routes.users.get_user')
    def test_get_rate_limits_invalid_key(
        self,
        mock_get_user,
        client
    ):
        """Test rate limits with invalid API key"""
        mock_get_user.return_value = None

        response = client.get(
            '/user/limit',
            headers={'Authorization': 'Bearer invalid-key'}
        )

        assert response.status_code == 401


# ============================================================
# TEST CLASS: User Profile
# ============================================================

class TestUserProfile:
    """Test user profile management"""

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_profile')
    def test_get_profile_success(
        self,
        mock_get_profile,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_user_profile
    ):
        """Test successfully getting user profile"""
        mock_get_user.return_value = mock_user
        mock_get_profile.return_value = mock_user_profile

        response = client.get(
            '/user/profile',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['user_id'] == 1
        assert data['username'] == 'testuser'
        assert data['email'] == 'test@example.com'
        assert data['credits'] == 100
        assert data['subscription_status'] == 'active'

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_profile')
    def test_get_profile_tier_display_names(
        self,
        mock_get_profile,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_user_profile
    ):
        """Test that tier display names are correctly mapped for all tiers"""
        # Test MAX tier
        mock_user_max = {**mock_user, 'tier': 'max'}
        mock_profile_max = {
            **mock_user_profile,
            'tier': 'max',
            'tier_display_name': 'MAX'
        }
        mock_get_user.return_value = mock_user_max
        mock_get_profile.return_value = mock_profile_max

        response = client.get(
            '/user/profile',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['tier'] == 'max'
        assert data['tier_display_name'] == 'MAX'

        # Test Pro tier
        mock_profile_pro = {**mock_user_profile, 'tier': 'pro', 'tier_display_name': 'Pro'}
        mock_get_profile.return_value = mock_profile_pro

        response = client.get(
            '/user/profile',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['tier'] == 'pro'
        assert data['tier_display_name'] == 'Pro'

        # Test Basic tier
        mock_profile_basic = {**mock_user_profile, 'tier': 'basic', 'tier_display_name': 'Basic'}
        mock_get_profile.return_value = mock_profile_basic

        response = client.get(
            '/user/profile',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['tier'] == 'basic'
        assert data['tier_display_name'] == 'Basic'

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_profile')
    def test_get_profile_not_found(
        self,
        mock_get_profile,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test getting profile when profile retrieval fails"""
        mock_get_user.return_value = mock_user
        mock_get_profile.return_value = None

        response = client.get(
            '/user/profile',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 500
        assert 'failed to retrieve' in response.json()['detail'].lower()

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_profile')
    @patch('src.routes.users.update_user_profile')
    def test_update_profile_success(
        self,
        mock_update_profile,
        mock_get_profile,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_user_profile
    ):
        """Test successfully updating user profile"""
        mock_get_user.return_value = mock_user
        mock_update_profile.return_value = True

        updated_profile = mock_user_profile.copy()
        updated_profile['email'] = 'newemail@example.com'
        mock_get_profile.return_value = updated_profile

        update_data = {
            'email': 'newemail@example.com'
        }

        response = client.put(
            '/user/profile',
            json=update_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['email'] == 'newemail@example.com'

    @patch('src.routes.users.get_user')
    def test_update_profile_no_fields(
        self,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test updating profile with no fields provided"""
        mock_get_user.return_value = mock_user

        response = client.put(
            '/user/profile',
            json={},
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 400
        assert 'at least one' in response.json()['detail'].lower()

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.update_user_profile')
    def test_update_profile_failed(
        self,
        mock_update_profile,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test profile update failure"""
        mock_get_user.return_value = mock_user
        mock_update_profile.return_value = None

        update_data = {
            'name': 'New Name'
        }

        response = client.put(
            '/user/profile',
            json=update_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 500
        assert 'failed to update' in response.json()['detail'].lower()

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_profile')
    @patch('src.routes.users.update_user_profile')
    def test_update_profile_multiple_fields(
        self,
        mock_update_profile,
        mock_get_profile,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_user_profile
    ):
        """Test updating multiple profile fields"""
        mock_get_user.return_value = mock_user
        mock_update_profile.return_value = True
        mock_get_profile.return_value = mock_user_profile

        update_data = {
            'name': 'New Name',
            'email': 'newemail@example.com',
            'preferences': {'theme': 'dark'},
            'settings': {'notifications': True}
        }

        response = client.put(
            '/user/profile',
            json=update_data,
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200


# ============================================================
# TEST CLASS: Account Deletion
# ============================================================

class TestAccountDeletion:
    """Test account deletion"""

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.delete_user_account')
    def test_delete_account_success(
        self,
        mock_delete_account,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test successfully deleting account"""
        mock_get_user.return_value = mock_user
        mock_delete_account.return_value = True

        delete_data = {
            'confirmation': 'DELETE_ACCOUNT'
        }

        response = client.request("DELETE",
            '/user/account',
            json=delete_data,
            headers={'Authorization': f'Bearer {mock_api_key}', 'Content-Type': 'application/json'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'success'
        assert data['message'] == 'User account deleted successfully'
        assert data['user_id'] == '1'

    @patch('src.routes.users.get_user')
    def test_delete_account_wrong_confirmation(
        self,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test account deletion with wrong confirmation"""
        mock_get_user.return_value = mock_user

        delete_data = {
            'confirmation': 'DELETE'
        }

        response = client.request("DELETE",
            '/user/account',
            json=delete_data,
            headers={'Authorization': f'Bearer {mock_api_key}', 'Content-Type': 'application/json'}
        )

        assert response.status_code == 400
        assert 'delete_account' in response.json()['detail'].lower()

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.delete_user_account')
    def test_delete_account_failed(
        self,
        mock_delete_account,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test account deletion failure"""
        mock_get_user.return_value = mock_user
        mock_delete_account.return_value = False

        delete_data = {
            'confirmation': 'DELETE_ACCOUNT'
        }

        response = client.request("DELETE",
            '/user/account',
            json=delete_data,
            headers={'Authorization': f'Bearer {mock_api_key}', 'Content-Type': 'application/json'}
        )

        assert response.status_code == 500
        assert 'failed to delete' in response.json()['detail'].lower()

    @patch('src.routes.users.get_user')
    def test_delete_account_invalid_key(
        self,
        mock_get_user,
        client
    ):
        """Test account deletion with invalid API key"""
        mock_get_user.return_value = None

        delete_data = {
            'confirmation': 'DELETE_ACCOUNT'
        }

        response = client.request("DELETE", "/user/account",
            json=delete_data,
            headers={'Authorization': 'Bearer invalid-key', 'Content-Type': 'application/json'})

        assert response.status_code == 401


# ============================================================
# TEST CLASS: Credit Transactions
# ============================================================

class TestCreditTransactions:
    """Test credit transaction history"""

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_transactions')
    @patch('src.routes.users.get_transaction_summary')
    def test_get_transactions_success(
        self,
        mock_get_summary,
        mock_get_transactions,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_credit_transactions
    ):
        """Test successfully getting credit transactions"""
        mock_get_user.return_value = mock_user
        mock_get_transactions.return_value = mock_credit_transactions
        mock_get_summary.return_value = {
            'total_credits_added': 60.0,
            'total_credits_used': 2.50,
            'net_credits': 57.50,
            'transaction_count': 3
        }

        response = client.get(
            '/user/credit-transactions',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert 'transactions' in data
        assert 'summary' in data
        assert data['total'] == 3
        assert len(data['transactions']) == 3

        # Verify transaction structure
        first_txn = data['transactions'][0]
        assert first_txn['transaction_type'] == 'trial'
        assert first_txn['amount'] == 10.0
        assert first_txn['balance_after'] == 10.0

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_transactions')
    @patch('src.routes.users.get_transaction_summary')
    def test_get_transactions_with_filters(
        self,
        mock_get_summary,
        mock_get_transactions,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test getting transactions with filters"""
        mock_get_user.return_value = mock_user

        # Filter for only purchases
        purchase_txn = [{
            'id': 2,
            'amount': 50.0,
            'transaction_type': 'purchase',
            'description': 'Credit purchase',
            'balance_before': 10.0,
            'balance_after': 60.0,
            'created_at': '2024-01-02T00:00:00Z',
            'payment_id': 'pi_123456',
            'metadata': {}
        }]
        mock_get_transactions.return_value = purchase_txn
        mock_get_summary.return_value = {'total_credits_added': 50.0}

        response = client.get(
            '/user/credit-transactions?transaction_type=purchase&limit=10&offset=0',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['limit'] == 10
        assert data['offset'] == 0
        assert len(data['transactions']) == 1
        assert data['transactions'][0]['transaction_type'] == 'purchase'

        # Verify correct parameters were passed
        mock_get_transactions.assert_called_once()

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_transactions')
    @patch('src.routes.users.get_transaction_summary')
    def test_get_transactions_pagination(
        self,
        mock_get_summary,
        mock_get_transactions,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_credit_transactions
    ):
        """Test transaction pagination"""
        mock_get_user.return_value = mock_user
        mock_get_transactions.return_value = mock_credit_transactions[1:]  # Skip first
        mock_get_summary.return_value = {'transaction_count': 3}

        response = client.get(
            '/user/credit-transactions?limit=2&offset=1',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['limit'] == 2
        assert data['offset'] == 1

    @patch('src.routes.users.get_user')
    def test_get_transactions_invalid_key(
        self,
        mock_get_user,
        client
    ):
        """Test transactions with invalid API key"""
        mock_get_user.return_value = None

        response = client.get(
            '/user/credit-transactions',
            headers={'Authorization': 'Bearer invalid-key'}
        )

        assert response.status_code == 401

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_transactions')
    def test_get_transactions_error_handling(
        self,
        mock_get_transactions,
        mock_get_user,
        client,
        mock_api_key,
        mock_user
    ):
        """Test transaction retrieval error handling"""
        mock_get_user.return_value = mock_user
        mock_get_transactions.side_effect = Exception("Database error")

        response = client.get(
            '/user/credit-transactions',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 500


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestUserIntegration:
    """Test user endpoint integration scenarios"""

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.validate_trial_access')
    @patch('src.routes.users.get_user_usage_metrics')
    @patch('src.routes.users.get_user_rate_limits')
    def test_complete_user_info_flow(
        self,
        mock_get_limits,
        mock_get_metrics,
        mock_validate_trial,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_usage_metrics,
        mock_rate_limits
    ):
        """Test getting complete user information"""
        mock_get_user.return_value = mock_user
        mock_validate_trial.return_value = {'is_trial': False}
        mock_get_metrics.return_value = mock_usage_metrics
        mock_get_limits.return_value = mock_rate_limits

        # Get balance
        balance_response = client.get(
            '/user/balance',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )
        assert balance_response.status_code == 200
        assert balance_response.json()['credits'] == 100.0

        # Get monitoring data
        monitor_response = client.get(
            '/user/monitor',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )
        assert monitor_response.status_code == 200
        assert monitor_response.json()['current_credits'] == 100.0

        # Get rate limits
        limits_response = client.get(
            '/user/limit',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )
        assert limits_response.status_code == 200
        assert limits_response.json()['current_limits']['requests_per_minute'] == 60

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.get_user_profile')
    @patch('src.routes.users.update_user_profile')
    def test_profile_update_workflow(
        self,
        mock_update_profile,
        mock_get_profile,
        mock_get_user,
        client,
        mock_api_key,
        mock_user,
        mock_user_profile
    ):
        """Test complete profile update workflow"""
        mock_get_user.return_value = mock_user

        # Get initial profile
        initial_profile = mock_user_profile.copy()
        mock_get_profile.return_value = initial_profile

        get_response = client.get(
            '/user/profile',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )
        assert get_response.status_code == 200
        assert get_response.json()['email'] == 'test@example.com'

        # Update profile
        mock_update_profile.return_value = True
        updated_profile = initial_profile.copy()
        updated_profile['email'] = 'updated@example.com'
        mock_get_profile.return_value = updated_profile

        update_response = client.put(
            '/user/profile',
            json={'email': 'updated@example.com'},
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )
        assert update_response.status_code == 200
        assert update_response.json()['email'] == 'updated@example.com'

    @patch('src.routes.users.get_user')
    @patch('src.routes.users.validate_trial_access')
    def test_trial_user_journey(
        self,
        mock_validate_trial,
        mock_get_user,
        client,
        mock_api_key,
        mock_trial_user
    ):
        """Test trial user accessing balance"""
        mock_get_user.return_value = mock_trial_user
        mock_validate_trial.return_value = {
            'is_trial': True,
            'remaining_credits': 7.0,
            'remaining_tokens': 45000,
            'remaining_requests': 180,
            'trial_end_date': mock_trial_user['trial_end_date']
        }

        response = client.get(
            '/user/balance',
            headers={'Authorization': f'Bearer {mock_api_key}'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'trial'
        assert data['credits'] == 7.0
        assert data['tokens_remaining'] == 45000
        assert 'trial_end_date' in data
