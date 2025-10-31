#!/usr/bin/env python3
"""
Comprehensive tests for trial management database operations

Tests cover:
- Trial creation
- Trial status checking
- Trial conversion to paid
- Trial usage tracking
- Trial analytics
- Error handling
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone, timedelta

from src.db.trials import (
    start_trial_for_key,
    get_trial_status_for_key,
    convert_trial_to_paid_for_key,
    track_trial_usage_for_key,
    get_trial_analytics
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client with chainable methods"""
    client = Mock()
    table_mock = Mock()
    rpc_mock = Mock()

    client.table.return_value = table_mock
    client.rpc.return_value = rpc_mock

    # Chainable methods
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = Mock(data=[])

    rpc_mock.execute.return_value = Mock(data={})

    return client, table_mock, rpc_mock


@pytest.fixture
def mock_api_key():
    """Mock API key"""
    return "gw_test_1234567890abcdef"


@pytest.fixture
def mock_api_key_data():
    """Mock API key database record"""
    return {
        'id': 1,
        'key': 'gw_test_1234567890abcdef',
        'user_id': 123,
        'is_trial': False,
        'trial_start_date': None,
        'trial_end_date': None
    }


# ============================================================
# TEST CLASS: Start Trial
# ============================================================

class TestStartTrial:
    """Test starting trials"""

    @patch('src.db.trials.get_supabase_client')
    def test_start_trial_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test successfully starting a trial"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock API key lookup
        table_mock.execute.return_value = Mock(data=[mock_api_key_data])

        # Mock RPC response
        trial_result = {
            'success': True,
            'trial_start_date': '2024-01-01T00:00:00Z',
            'trial_end_date': '2024-01-15T00:00:00Z',
            'trial_credits': 10.0
        }
        rpc_mock.execute.return_value = Mock(data=trial_result)

        result = start_trial_for_key(mock_api_key, trial_days=14)

        assert result['success'] is True
        assert 'trial_start_date' in result
        assert 'trial_end_date' in result

        # Verify RPC was called
        client.rpc.assert_called_once_with('start_trial', {
            'api_key_id': 1,
            'trial_days': 14
        })

    @patch('src.db.trials.get_supabase_client')
    def test_start_trial_custom_duration(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test starting trial with custom duration"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])
        rpc_mock.execute.return_value = Mock(data={'success': True})

        result = start_trial_for_key(mock_api_key, trial_days=30)

        # Verify custom duration was passed
        client.rpc.assert_called_once_with('start_trial', {
            'api_key_id': 1,
            'trial_days': 30
        })

    @patch('src.db.trials.get_supabase_client')
    def test_start_trial_api_key_not_found(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key
    ):
        """Test starting trial with invalid API key"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock API key not found
        table_mock.execute.return_value = Mock(data=[])

        result = start_trial_for_key(mock_api_key)

        assert result['success'] is False
        assert result['error'] == 'API key not found'

    @patch('src.db.trials.get_supabase_client')
    def test_start_trial_database_error(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test error handling during trial start"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])

        # Mock RPC returning no data (database error)
        rpc_mock.execute.return_value = Mock(data=None)

        result = start_trial_for_key(mock_api_key)

        assert result['success'] is False
        assert result['error'] == 'Database error'

    @patch('src.db.trials.get_supabase_client')
    def test_start_trial_exception(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key
    ):
        """Test exception handling"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock exception
        client.table.side_effect = Exception("Connection error")

        result = start_trial_for_key(mock_api_key)

        assert result['success'] is False
        assert 'Connection error' in result['error']


# ============================================================
# TEST CLASS: Get Trial Status
# ============================================================

class TestGetTrialStatus:
    """Test getting trial status"""

    @patch('src.db.trials.get_supabase_client')
    def test_get_trial_status_active(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test getting status for active trial"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])

        status_result = {
            'is_trial': True,
            'trial_active': True,
            'trial_expired': False,
            'trial_start_date': '2024-01-01T00:00:00Z',
            'trial_end_date': '2024-01-15T00:00:00Z',
            'trial_credits': 10.0,
            'trial_used_credits': 2.5,
            'trial_remaining_credits': 7.5
        }
        rpc_mock.execute.return_value = Mock(data=status_result)

        result = get_trial_status_for_key(mock_api_key)

        assert result['is_trial'] is True
        assert result['trial_active'] is True
        assert result['trial_expired'] is False
        assert result['trial_remaining_credits'] == 7.5

    @patch('src.db.trials.get_supabase_client')
    def test_get_trial_status_expired(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test getting status for expired trial"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])

        status_result = {
            'is_trial': True,
            'trial_active': False,
            'trial_expired': True,
            'trial_end_date': '2023-12-31T00:00:00Z'
        }
        rpc_mock.execute.return_value = Mock(data=status_result)

        result = get_trial_status_for_key(mock_api_key)

        assert result['trial_expired'] is True
        assert result['trial_active'] is False

    @patch('src.db.trials.get_supabase_client')
    def test_get_trial_status_not_trial(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test getting status for non-trial key"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])

        status_result = {
            'is_trial': False,
            'trial_active': False
        }
        rpc_mock.execute.return_value = Mock(data=status_result)

        result = get_trial_status_for_key(mock_api_key)

        assert result['is_trial'] is False

    @patch('src.db.trials.get_supabase_client')
    def test_get_trial_status_api_key_not_found(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key
    ):
        """Test getting status with invalid API key"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        result = get_trial_status_for_key(mock_api_key)

        assert result['success'] is False
        assert result['error'] == 'API key not found'


# ============================================================
# TEST CLASS: Convert Trial to Paid
# ============================================================

class TestConvertTrialToPaid:
    """Test converting trials to paid subscriptions"""

    @patch('src.db.trials.get_supabase_client')
    def test_convert_trial_to_paid_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test successfully converting trial to paid"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])

        conversion_result = {
            'success': True,
            'plan_name': 'pro',
            'trial_converted': True,
            'subscription_status': 'active'
        }
        rpc_mock.execute.return_value = Mock(data=conversion_result)

        result = convert_trial_to_paid_for_key(mock_api_key, 'pro')

        assert result['success'] is True
        assert result['plan_name'] == 'pro'
        assert result['trial_converted'] is True

        client.rpc.assert_called_once_with('convert_trial_to_paid', {
            'api_key_id': 1,
            'plan_name': 'pro'
        })

    @patch('src.db.trials.get_supabase_client')
    def test_convert_trial_different_plans(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test converting to different plan types"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])

        plans = ['starter', 'pro', 'enterprise']

        for plan in plans:
            rpc_mock.execute.return_value = Mock(data={'success': True, 'plan_name': plan})

            result = convert_trial_to_paid_for_key(mock_api_key, plan)

            assert result['plan_name'] == plan

    @patch('src.db.trials.get_supabase_client')
    def test_convert_trial_api_key_not_found(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key
    ):
        """Test converting with invalid API key"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        result = convert_trial_to_paid_for_key(mock_api_key, 'pro')

        assert result['success'] is False
        assert result['error'] == 'API key not found'

    @patch('src.db.trials.get_supabase_client')
    def test_convert_trial_exception(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key
    ):
        """Test exception handling during conversion"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        client.table.side_effect = Exception("Database error")

        result = convert_trial_to_paid_for_key(mock_api_key, 'pro')

        assert result['success'] is False
        assert 'Database error' in result['error']


# ============================================================
# TEST CLASS: Track Trial Usage
# ============================================================

class TestTrackTrialUsage:
    """Test tracking trial usage"""

    @patch('src.db.trials.get_supabase_client')
    def test_track_trial_usage_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test successfully tracking trial usage"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])

        usage_result = {
            'success': True,
            'trial_used_tokens': 1500,
            'trial_used_requests': 1,
            'trial_remaining_credits': 8.5
        }
        rpc_mock.execute.return_value = Mock(data=usage_result)

        result = track_trial_usage_for_key(mock_api_key, tokens_used=1500)

        assert result['success'] is True
        assert result['trial_used_tokens'] == 1500

        client.rpc.assert_called_once_with('track_trial_usage', {
            'api_key_id': 1,
            'tokens_used': 1500,
            'requests_used': 1
        })

    @patch('src.db.trials.get_supabase_client')
    def test_track_trial_usage_custom_requests(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test tracking usage with custom request count"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])
        rpc_mock.execute.return_value = Mock(data={'success': True})

        result = track_trial_usage_for_key(
            mock_api_key,
            tokens_used=5000,
            requests_used=5
        )

        # Verify custom requests count
        client.rpc.assert_called_once_with('track_trial_usage', {
            'api_key_id': 1,
            'tokens_used': 5000,
            'requests_used': 5
        })

    @patch('src.db.trials.get_supabase_client')
    def test_track_trial_usage_api_key_not_found(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key
    ):
        """Test tracking usage with invalid API key"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        result = track_trial_usage_for_key(mock_api_key, 1000)

        assert result['success'] is False
        assert result['error'] == 'API key not found'


# ============================================================
# TEST CLASS: Trial Analytics
# ============================================================

class TestTrialAnalytics:
    """Test trial analytics"""

    @patch('src.db.trials.get_supabase_client')
    def test_get_trial_analytics_success(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test getting trial analytics"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock trial data
        future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        past_date = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()

        trial_data = [
            {
                'is_trial': True,
                'trial_converted': False,
                'trial_start_date': past_date,
                'trial_end_date': future_date,  # Active
                'trial_used_tokens': 1000,
                'trial_used_requests': 10,
                'trial_used_credits': 2.5,
                'trial_credits': 10.0,
                'subscription_status': None
            },
            {
                'is_trial': True,
                'trial_converted': True,
                'trial_start_date': past_date,
                'trial_end_date': past_date,  # Expired but converted
                'trial_used_tokens': 5000,
                'trial_used_requests': 50,
                'trial_used_credits': 8.0,
                'trial_credits': 10.0,
                'subscription_status': 'active'
            },
            {
                'is_trial': True,
                'trial_converted': False,
                'trial_start_date': past_date,
                'trial_end_date': past_date,  # Expired
                'trial_used_tokens': 500,
                'trial_used_requests': 5,
                'trial_used_credits': 1.0,
                'trial_credits': 10.0,
                'subscription_status': None
            },
            {
                'is_trial': False,  # Not a trial
                'subscription_status': 'active'
            }
        ]

        table_mock.execute.return_value = Mock(data=trial_data)

        result = get_trial_analytics()

        assert result['total_trials'] == 3  # Only trial keys
        assert result['active_trials'] == 1
        assert result['expired_trials'] == 2
        assert result['converted_trials'] == 1
        assert result['conversion_rate'] == 33.33  # 1/3 * 100

        # Check usage stats
        assert result['usage_statistics']['total_tokens_used'] == 6500
        assert result['usage_statistics']['total_requests_used'] == 65
        assert result['usage_statistics']['total_credits_used'] == 11.5

    @patch('src.db.trials.get_supabase_client')
    def test_get_trial_analytics_no_trials(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test analytics with no trials"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        # No trial data
        table_mock.execute.return_value = Mock(data=[
            {'is_trial': False, 'subscription_status': 'active'}
        ])

        result = get_trial_analytics()

        assert result['total_trials'] == 0
        assert result['active_trials'] == 0
        assert result['conversion_rate'] == 0

    @patch('src.db.trials.get_supabase_client')
    def test_get_trial_analytics_no_data(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test analytics with no data"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        result = get_trial_analytics()

        assert 'error' in result

    @patch('src.db.trials.get_supabase_client')
    def test_get_trial_analytics_calculates_averages(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test analytics calculates correct averages"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()

        trial_data = [
            {
                'is_trial': True,
                'trial_converted': False,
                'trial_end_date': future_date,
                'trial_used_tokens': 1000,
                'trial_used_requests': 10,
                'trial_used_credits': 2.0,
                'trial_credits': 10.0
            },
            {
                'is_trial': True,
                'trial_converted': False,
                'trial_end_date': future_date,
                'trial_used_tokens': 3000,
                'trial_used_requests': 30,
                'trial_used_credits': 6.0,
                'trial_credits': 10.0
            }
        ]

        table_mock.execute.return_value = Mock(data=trial_data)

        result = get_trial_analytics()

        # Average tokens: (1000 + 3000) / 2 = 2000
        assert result['average_usage_per_trial']['tokens'] == 2000.0
        # Average requests: (10 + 30) / 2 = 20
        assert result['average_usage_per_trial']['requests'] == 20.0
        # Average credits: (2 + 6) / 2 = 4
        assert result['average_usage_per_trial']['credits'] == 4.0

    @patch('src.db.trials.get_supabase_client')
    def test_get_trial_analytics_exception(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test exception handling in analytics"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        client.table.side_effect = Exception("Database error")

        result = get_trial_analytics()

        assert 'error' in result
        assert 'Database error' in result['error']


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestTrialsIntegration:
    """Test trial workflow integration"""

    @patch('src.db.trials.get_supabase_client')
    def test_complete_trial_workflow(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_api_key,
        mock_api_key_data
    ):
        """Test complete trial workflow: start -> use -> convert"""
        client, table_mock, rpc_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[mock_api_key_data])

        # 1. Start trial
        rpc_mock.execute.return_value = Mock(data={'success': True})
        start_result = start_trial_for_key(mock_api_key, 14)
        assert start_result['success'] is True

        # 2. Track usage
        rpc_mock.execute.return_value = Mock(data={'success': True})
        usage_result = track_trial_usage_for_key(mock_api_key, 1000)
        assert usage_result['success'] is True

        # 3. Convert to paid
        rpc_mock.execute.return_value = Mock(data={'success': True, 'plan_name': 'pro'})
        convert_result = convert_trial_to_paid_for_key(mock_api_key, 'pro')
        assert convert_result['success'] is True
