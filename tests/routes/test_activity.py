#!/usr/bin/env python3
"""
Comprehensive tests for activity tracking API endpoints

Tests cover:
- Activity statistics endpoint
- Activity log endpoint with pagination
- Date range filtering
- Model and provider filtering
- User authentication
- Error handling
"""

import pytest
from unittest.mock import Mock, patch
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
def mock_current_user():
    """Mock authenticated user"""
    return {
        'id': 123,
        'username': 'testuser',
        'email': 'test@example.com',
        'role': 'user'
    }


@pytest.fixture
def mock_activity_stats():
    """Mock activity statistics"""
    return {
        'total_requests': 150,
        'total_tokens': 45000,
        'total_spend': 2.35,
        'total_cost': 2.35,
        'daily_stats': [
            {
                'date': '2024-01-15',
                'spend': 0.75,
                'tokens': 15000,
                'requests': 50
            },
            {
                'date': '2024-01-16',
                'spend': 0.80,
                'tokens': 16000,
                'requests': 50
            },
            {
                'date': '2024-01-17',
                'spend': 0.80,
                'tokens': 14000,
                'requests': 50
            }
        ],
        'by_date': [
            {'date': '2024-01-15', 'requests': 50, 'tokens': 15000, 'cost': 0.75},
            {'date': '2024-01-16', 'requests': 50, 'tokens': 16000, 'cost': 0.80},
            {'date': '2024-01-17', 'requests': 50, 'tokens': 14000, 'cost': 0.80}
        ],
        'by_model': {
            'gpt-4': {'requests': 100, 'tokens': 30000, 'cost': 1.50},
            'claude-3-sonnet': {'requests': 50, 'tokens': 15000, 'cost': 0.85}
        },
        'by_provider': {
            'OpenAI': {'requests': 100, 'tokens': 30000, 'cost': 1.50},
            'Anthropic': {'requests': 50, 'tokens': 15000, 'cost': 0.85}
        }
    }


@pytest.fixture
def mock_activity_logs():
    """Mock activity log entries"""
    return [
        {
            'id': 1,
            'user_id': 123,
            'timestamp': '2024-01-17T10:00:00Z',
            'model': 'gpt-4',
            'provider': 'OpenAI',
            'tokens': 1500,
            'cost': 0.045,
            'speed': 45.5,
            'finish_reason': 'stop',
            'app': 'API',
            'metadata': {}
        },
        {
            'id': 2,
            'user_id': 123,
            'timestamp': '2024-01-17T11:00:00Z',
            'model': 'claude-3-sonnet',
            'provider': 'Anthropic',
            'tokens': 2000,
            'cost': 0.060,
            'speed': 50.0,
            'finish_reason': 'stop',
            'app': 'API',
            'metadata': {}
        }
    ]


# ============================================================
# TEST CLASS: Activity Statistics Endpoint
# ============================================================

class TestActivityStatsEndpoint:
    """Test /user/activity/stats endpoint"""

    @patch('src.routes.activity.get_user_activity_stats')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_stats_default(
        self,
        mock_get_user,
        mock_get_stats,
        client,
        mock_current_user,
        mock_activity_stats
    ):
        """Test getting activity stats with defaults"""
        mock_get_user.return_value = mock_current_user
        mock_get_stats.return_value = mock_activity_stats

        response = client.get('/user/activity/stats')

        assert response.status_code == 200
        data = response.json()

        assert data['total_requests'] == 150
        assert data['total_tokens'] == 45000
        assert data['total_spend'] == 2.35
        assert len(data['daily_stats']) == 3
        assert 'gpt-4' in data['by_model']
        assert 'OpenAI' in data['by_provider']

        # Verify get_user_activity_stats was called
        mock_get_stats.assert_called_once_with(
            123,
            from_date=None,
            to_date=None,
            days=None
        )

    @patch('src.routes.activity.get_user_activity_stats')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_stats_with_days(
        self,
        mock_get_user,
        mock_get_stats,
        client,
        mock_current_user,
        mock_activity_stats
    ):
        """Test getting activity stats with days parameter"""
        mock_get_user.return_value = mock_current_user
        mock_get_stats.return_value = mock_activity_stats

        response = client.get('/user/activity/stats?days=7')

        assert response.status_code == 200

        # Verify days parameter was passed
        mock_get_stats.assert_called_once_with(
            123,
            from_date=None,
            to_date=None,
            days=7
        )

    @patch('src.routes.activity.get_user_activity_stats')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_stats_with_date_range(
        self,
        mock_get_user,
        mock_get_stats,
        client,
        mock_current_user,
        mock_activity_stats
    ):
        """Test getting activity stats with date range"""
        mock_get_user.return_value = mock_current_user
        mock_get_stats.return_value = mock_activity_stats

        response = client.get(
            '/user/activity/stats?from=2024-01-01&to=2024-01-31'
        )

        assert response.status_code == 200

        # Verify date range was passed
        mock_get_stats.assert_called_once_with(
            123,
            from_date='2024-01-01',
            to_date='2024-01-31',
            days=None
        )

    @patch('src.routes.activity.get_user_activity_stats')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_stats_empty(
        self,
        mock_get_user,
        mock_get_stats,
        client,
        mock_current_user
    ):
        """Test getting stats when no activity exists"""
        mock_get_user.return_value = mock_current_user
        mock_get_stats.return_value = {
            'total_requests': 0,
            'total_tokens': 0,
            'total_spend': 0.0,
            'total_cost': 0.0,
            'daily_stats': [],
            'by_date': [],
            'by_model': {},
            'by_provider': {}
        }

        response = client.get('/user/activity/stats')

        assert response.status_code == 200
        data = response.json()

        assert data['total_requests'] == 0
        assert data['total_tokens'] == 0
        assert data['daily_stats'] == []

    @patch('src.routes.activity.get_user_activity_stats')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_stats_error(
        self,
        mock_get_user,
        mock_get_stats,
        client,
        mock_current_user
    ):
        """Test error handling in stats endpoint"""
        mock_get_user.return_value = mock_current_user
        mock_get_stats.side_effect = Exception("Database error")

        response = client.get('/user/activity/stats')

        assert response.status_code == 500
        assert 'Failed to retrieve activity statistics' in response.json()['detail']

    def test_get_activity_stats_days_validation(self, client):
        """Test validation for days parameter"""
        # Days must be >= 1
        response = client.get('/user/activity/stats?days=0')
        assert response.status_code == 422

        # Days must be <= 365
        response = client.get('/user/activity/stats?days=366')
        assert response.status_code == 422


# ============================================================
# TEST CLASS: Activity Log Endpoint
# ============================================================

class TestActivityLogEndpoint:
    """Test /user/activity/log endpoint"""

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_log_default(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user,
        mock_activity_logs
    ):
        """Test getting activity log with defaults"""
        mock_get_user.return_value = mock_current_user
        mock_get_log.return_value = mock_activity_logs

        response = client.get('/user/activity/log')

        assert response.status_code == 200
        data = response.json()

        assert 'logs' in data
        assert len(data['logs']) == 2
        assert data['logs'][0]['model'] == 'gpt-4'
        assert data['total'] == 2
        assert data['limit'] == 10
        assert data['page'] == 1

        # Verify default parameters
        mock_get_log.assert_called_once_with(
            user_id=123,
            limit=10,
            offset=0,
            from_date=None,
            to_date=None,
            model_filter=None,
            provider_filter=None
        )

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_log_with_pagination(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user,
        mock_activity_logs
    ):
        """Test activity log with pagination"""
        mock_get_user.return_value = mock_current_user
        mock_get_log.return_value = mock_activity_logs

        response = client.get('/user/activity/log?limit=20&offset=40')

        assert response.status_code == 200
        data = response.json()

        assert data['limit'] == 20
        assert data['page'] == 3  # (offset // limit) + 1 = (40 // 20) + 1 = 3

        # Verify pagination parameters
        mock_get_log.assert_called_once()
        call_args = mock_get_log.call_args[1]
        assert call_args['limit'] == 20
        assert call_args['offset'] == 40

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_log_with_page_number(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user,
        mock_activity_logs
    ):
        """Test activity log with page number"""
        mock_get_user.return_value = mock_current_user
        mock_get_log.return_value = mock_activity_logs

        response = client.get('/user/activity/log?limit=10&page=3')

        assert response.status_code == 200
        data = response.json()

        assert data['page'] == 3

        # Verify offset was calculated from page
        mock_get_log.assert_called_once()
        call_args = mock_get_log.call_args[1]
        assert call_args['offset'] == 20  # (page - 1) * limit = (3 - 1) * 10 = 20

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_log_with_date_filters(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user,
        mock_activity_logs
    ):
        """Test activity log with date filtering"""
        mock_get_user.return_value = mock_current_user
        mock_get_log.return_value = mock_activity_logs

        response = client.get(
            '/user/activity/log?from=2024-01-01&to=2024-01-31'
        )

        assert response.status_code == 200

        # Verify date filters were passed
        mock_get_log.assert_called_once()
        call_args = mock_get_log.call_args[1]
        assert call_args['from_date'] == '2024-01-01'
        assert call_args['to_date'] == '2024-01-31'

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_log_with_model_filter(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user,
        mock_activity_logs
    ):
        """Test activity log with model filter"""
        mock_get_user.return_value = mock_current_user
        mock_get_log.return_value = [mock_activity_logs[0]]  # Only gpt-4

        response = client.get('/user/activity/log?model=gpt-4')

        assert response.status_code == 200
        data = response.json()

        assert len(data['logs']) == 1
        assert data['logs'][0]['model'] == 'gpt-4'

        # Verify model filter was passed
        mock_get_log.assert_called_once()
        call_args = mock_get_log.call_args[1]
        assert call_args['model_filter'] == 'gpt-4'

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_log_with_provider_filter(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user,
        mock_activity_logs
    ):
        """Test activity log with provider filter"""
        mock_get_user.return_value = mock_current_user
        mock_get_log.return_value = [mock_activity_logs[1]]  # Only Anthropic

        response = client.get('/user/activity/log?provider=Anthropic')

        assert response.status_code == 200
        data = response.json()

        assert len(data['logs']) == 1
        assert data['logs'][0]['provider'] == 'Anthropic'

        # Verify provider filter was passed
        mock_get_log.assert_called_once()
        call_args = mock_get_log.call_args[1]
        assert call_args['provider_filter'] == 'Anthropic'

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_log_combined_filters(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user,
        mock_activity_logs
    ):
        """Test activity log with multiple filters"""
        mock_get_user.return_value = mock_current_user
        mock_get_log.return_value = mock_activity_logs

        response = client.get(
            '/user/activity/log?limit=50&from=2024-01-01&to=2024-01-31&model=gpt-4&provider=OpenAI'
        )

        assert response.status_code == 200

        # Verify all filters were passed
        mock_get_log.assert_called_once()
        call_args = mock_get_log.call_args[1]
        assert call_args['limit'] == 50
        assert call_args['from_date'] == '2024-01-01'
        assert call_args['to_date'] == '2024-01-31'
        assert call_args['model_filter'] == 'gpt-4'
        assert call_args['provider_filter'] == 'OpenAI'

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_log_empty(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user
    ):
        """Test getting empty activity log"""
        mock_get_user.return_value = mock_current_user
        mock_get_log.return_value = []

        response = client.get('/user/activity/log')

        assert response.status_code == 200
        data = response.json()

        assert data['logs'] == []
        assert data['total'] == 0

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_get_activity_log_error(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user
    ):
        """Test error handling in log endpoint"""
        mock_get_user.return_value = mock_current_user
        mock_get_log.side_effect = Exception("Database error")

        response = client.get('/user/activity/log')

        assert response.status_code == 500
        assert 'Failed to retrieve activity log' in response.json()['detail']

    def test_get_activity_log_limit_validation(self, client):
        """Test validation for limit parameter"""
        # Limit must be >= 1
        response = client.get('/user/activity/log?limit=0')
        assert response.status_code == 422

        # Limit must be <= 1000
        response = client.get('/user/activity/log?limit=1001')
        assert response.status_code == 422

    def test_get_activity_log_offset_validation(self, client):
        """Test validation for offset parameter"""
        # Offset must be >= 0
        response = client.get('/user/activity/log?offset=-1')
        assert response.status_code == 422

    def test_get_activity_log_page_validation(self, client):
        """Test validation for page parameter"""
        # Page must be >= 1
        response = client.get('/user/activity/log?page=0')
        assert response.status_code == 422


# ============================================================
# TEST CLASS: Authentication
# ============================================================

class TestActivityAuthentication:
    """Test authentication requirements"""

    @patch('src.routes.activity.get_current_user')
    def test_stats_requires_authentication(
        self,
        mock_get_user,
        client
    ):
        """Test that stats endpoint requires authentication"""
        from fastapi import HTTPException

        mock_get_user.side_effect = HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

        response = client.get('/user/activity/stats')

        assert response.status_code == 401

    @patch('src.routes.activity.get_current_user')
    def test_log_requires_authentication(
        self,
        mock_get_user,
        client
    ):
        """Test that log endpoint requires authentication"""
        from fastapi import HTTPException

        mock_get_user.side_effect = HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

        response = client.get('/user/activity/log')

        assert response.status_code == 401


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestActivityIntegration:
    """Test activity endpoint integration scenarios"""

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_user_activity_stats')
    @patch('src.routes.activity.get_current_user')
    def test_stats_and_log_consistency(
        self,
        mock_get_user,
        mock_get_stats,
        mock_get_log,
        client,
        mock_current_user,
        mock_activity_stats,
        mock_activity_logs
    ):
        """Test that stats and log endpoints return consistent data"""
        mock_get_user.return_value = mock_current_user
        mock_get_stats.return_value = mock_activity_stats
        mock_get_log.return_value = mock_activity_logs

        # Get stats
        stats_response = client.get('/user/activity/stats?days=7')
        assert stats_response.status_code == 200
        stats = stats_response.json()

        # Get log
        log_response = client.get('/user/activity/log?limit=100')
        assert log_response.status_code == 200
        log = log_response.json()

        # Both should be for the same user
        assert mock_get_stats.call_args[0][0] == mock_get_log.call_args[1]['user_id']

    @patch('src.routes.activity.get_user_activity_log')
    @patch('src.routes.activity.get_current_user')
    def test_pagination_workflow(
        self,
        mock_get_user,
        mock_get_log,
        client,
        mock_current_user,
        mock_activity_logs
    ):
        """Test pagination workflow across multiple pages"""
        mock_get_user.return_value = mock_current_user

        # Page 1
        mock_get_log.return_value = mock_activity_logs
        response1 = client.get('/user/activity/log?limit=10&page=1')
        assert response1.json()['page'] == 1

        # Page 2
        response2 = client.get('/user/activity/log?limit=10&page=2')
        assert response2.json()['page'] == 2

        # Verify offset calculation
        call_args_1 = mock_get_log.call_args_list[0][1]
        call_args_2 = mock_get_log.call_args_list[1][1]

        assert call_args_1['offset'] == 0   # Page 1
        assert call_args_2['offset'] == 10  # Page 2

    @patch('src.routes.activity.get_user_activity_stats')
    @patch('src.routes.activity.get_current_user')
    def test_date_range_filtering(
        self,
        mock_get_user,
        mock_get_stats,
        client,
        mock_current_user,
        mock_activity_stats
    ):
        """Test date range filtering across stats endpoint"""
        mock_get_user.return_value = mock_current_user
        mock_get_stats.return_value = mock_activity_stats

        # Test different date ranges
        response1 = client.get('/user/activity/stats?days=7')
        response2 = client.get('/user/activity/stats?days=30')
        response3 = client.get('/user/activity/stats?from=2024-01-01&to=2024-01-31')

        # All should succeed
        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response3.status_code == 200

        # Verify different parameters were passed
        calls = mock_get_stats.call_args_list
        assert calls[0][1]['days'] == 7
        assert calls[1][1]['days'] == 30
        assert calls[2][1]['from_date'] == '2024-01-01'
        assert calls[2][1]['to_date'] == '2024-01-31'
