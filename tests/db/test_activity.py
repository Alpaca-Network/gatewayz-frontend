#!/usr/bin/env python3
"""
Comprehensive tests for activity tracking database layer

Tests cover:
- Activity logging
- Activity statistics retrieval
- Activity log retrieval with pagination
- Date filtering
- Model and provider filtering
- Provider detection from model name
- Error handling
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone, timedelta

from src.db.activity import (
    log_activity,
    get_user_activity_stats,
    get_user_activity_log,
    get_provider_from_model
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client with chainable methods"""
    client = Mock()
    table_mock = Mock()

    client.table.return_value = table_mock

    # Chainable methods
    table_mock.insert.return_value = table_mock
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.gte.return_value = table_mock
    table_mock.lte.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.range.return_value = table_mock
    table_mock.execute.return_value = Mock(data=[])

    return client, table_mock


@pytest.fixture
def mock_activity_data():
    """Mock activity log entry"""
    return {
        'id': 1,
        'user_id': 123,
        'timestamp': '2024-01-15T10:00:00Z',
        'model': 'gpt-4',
        'provider': 'OpenAI',
        'tokens': 1500,
        'cost': 0.045,
        'speed': 45.5,
        'finish_reason': 'stop',
        'app': 'API',
        'metadata': {
            'prompt_tokens': 1000,
            'completion_tokens': 500
        }
    }


# ============================================================
# TEST CLASS: Activity Logging
# ============================================================

class TestLogActivity:
    """Test activity logging operations"""

    @patch('src.db.activity.get_supabase_client')
    def test_log_activity_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_activity_data
    ):
        """Test successfully logging an activity"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock insert response
        table_mock.execute.return_value = Mock(data=[mock_activity_data])

        result = log_activity(
            user_id=123,
            model='gpt-4',
            provider='OpenAI',
            tokens=1500,
            cost=0.045,
            speed=45.5,
            finish_reason='stop',
            app='API',
            metadata={
                'prompt_tokens': 1000,
                'completion_tokens': 500
            }
        )

        assert result is not None
        assert result['model'] == 'gpt-4'
        assert result['tokens'] == 1500

        # Verify insert was called
        client.table.assert_called_once_with('activity_log')
        table_mock.insert.assert_called_once()

        # Verify data structure
        insert_data = table_mock.insert.call_args[0][0]
        assert insert_data['user_id'] == 123
        assert insert_data['model'] == 'gpt-4'
        assert insert_data['provider'] == 'OpenAI'
        assert insert_data['tokens'] == 1500
        assert insert_data['cost'] == 0.045
        assert 'timestamp' in insert_data

    @patch('src.db.activity.get_supabase_client')
    def test_log_activity_with_defaults(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test logging activity with default values"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock insert response
        table_mock.execute.return_value = Mock(data=[{
            'id': 1,
            'user_id': 123,
            'model': 'claude-3-sonnet',
            'provider': 'Anthropic',
            'tokens': 2000,
            'cost': 0.06,
            'speed': 0.0,
            'finish_reason': 'stop',
            'app': 'API',
            'metadata': {}
        }])

        result = log_activity(
            user_id=123,
            model='claude-3-sonnet',
            provider='Anthropic',
            tokens=2000,
            cost=0.06
        )

        assert result is not None

        # Verify default values were used
        insert_data = table_mock.insert.call_args[0][0]
        assert insert_data['speed'] == 0.0
        assert insert_data['finish_reason'] == 'stop'
        assert insert_data['app'] == 'API'
        assert insert_data['metadata'] == {}

    @patch('src.db.activity.get_supabase_client')
    def test_log_activity_no_data(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test logging activity when no data is returned"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock insert response: no data
        table_mock.execute.return_value = Mock(data=None)

        result = log_activity(
            user_id=123,
            model='gpt-4',
            provider='OpenAI',
            tokens=1500,
            cost=0.045
        )

        assert result is None

    @patch('src.db.activity.get_supabase_client')
    def test_log_activity_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling during activity logging"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock error
        client.table.side_effect = Exception("Database error")

        result = log_activity(
            user_id=123,
            model='gpt-4',
            provider='OpenAI',
            tokens=1500,
            cost=0.045
        )

        # Should return None on error (non-critical)
        assert result is None


# ============================================================
# TEST CLASS: Activity Statistics
# ============================================================

class TestActivityStatistics:
    """Test activity statistics retrieval"""

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_stats_with_data(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving activity statistics with data"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock activity records
        activities = [
            {
                'timestamp': '2024-01-15T10:00:00Z',
                'model': 'gpt-4',
                'provider': 'OpenAI',
                'tokens': 1500,
                'cost': 0.045
            },
            {
                'timestamp': '2024-01-15T11:00:00Z',
                'model': 'gpt-4',
                'provider': 'OpenAI',
                'tokens': 2000,
                'cost': 0.06
            },
            {
                'timestamp': '2024-01-16T10:00:00Z',
                'model': 'claude-3-sonnet',
                'provider': 'Anthropic',
                'tokens': 1800,
                'cost': 0.054
            }
        ]
        table_mock.execute.return_value = Mock(data=activities)

        stats = get_user_activity_stats(user_id=123, days=7)

        assert stats['total_requests'] == 3
        assert stats['total_tokens'] == 5300  # 1500 + 2000 + 1800
        assert stats['total_cost'] == 0.159  # 0.045 + 0.06 + 0.054

        # Check daily aggregation
        assert len(stats['daily_stats']) == 2  # 2 different days
        assert stats['daily_stats'][0]['date'] == '2024-01-15'
        assert stats['daily_stats'][0]['tokens'] == 3500  # 1500 + 2000
        assert stats['daily_stats'][0]['requests'] == 2

        # Check model aggregation
        assert 'gpt-4' in stats['by_model']
        assert stats['by_model']['gpt-4']['requests'] == 2
        assert stats['by_model']['gpt-4']['tokens'] == 3500

        assert 'claude-3-sonnet' in stats['by_model']
        assert stats['by_model']['claude-3-sonnet']['requests'] == 1

        # Check provider aggregation
        assert 'OpenAI' in stats['by_provider']
        assert stats['by_provider']['OpenAI']['requests'] == 2
        assert 'Anthropic' in stats['by_provider']
        assert stats['by_provider']['Anthropic']['requests'] == 1

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_stats_empty(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving statistics when no activity"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock empty response
        table_mock.execute.return_value = Mock(data=[])

        stats = get_user_activity_stats(user_id=123, days=7)

        assert stats['total_requests'] == 0
        assert stats['total_tokens'] == 0
        assert stats['total_cost'] == 0.0
        assert stats['daily_stats'] == []
        assert stats['by_model'] == {}
        assert stats['by_provider'] == {}

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_stats_with_date_range(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving statistics with specific date range"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        stats = get_user_activity_stats(
            user_id=123,
            from_date='2024-01-01',
            to_date='2024-01-31'
        )

        # Verify date filters were applied
        table_mock.gte.assert_called_once()
        table_mock.lte.assert_called_once()

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_stats_default_30_days(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test default 30-day lookback"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        stats = get_user_activity_stats(user_id=123)

        # Should use default 30 days
        assert stats['total_requests'] == 0

        # Verify gte and lte were called (date filtering)
        table_mock.gte.assert_called_once()
        table_mock.lte.assert_called_once()

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_stats_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling in statistics"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock error
        client.table.side_effect = Exception("Database error")

        stats = get_user_activity_stats(user_id=123, days=7)

        # Should return zero stats on error
        assert stats['total_requests'] == 0
        assert 'error' in stats


# ============================================================
# TEST CLASS: Activity Log Retrieval
# ============================================================

class TestActivityLogRetrieval:
    """Test paginated activity log retrieval"""

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_log_success(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_activity_data
    ):
        """Test retrieving activity log"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock activity records
        activities = [mock_activity_data]
        table_mock.execute.return_value = Mock(data=activities)

        result = get_user_activity_log(user_id=123, limit=50, offset=0)

        assert len(result) == 1
        assert result[0]['model'] == 'gpt-4'

        # Verify query construction
        client.table.assert_called_once_with('activity_log')
        table_mock.select.assert_called_once_with('*')
        table_mock.eq.assert_called_once_with('user_id', 123)
        table_mock.order.assert_called_once_with('timestamp', desc=True)
        table_mock.range.assert_called_once_with(0, 49)  # offset to offset + limit - 1

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_log_with_pagination(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test activity log with pagination"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        result = get_user_activity_log(user_id=123, limit=10, offset=20)

        # Verify range for pagination
        table_mock.range.assert_called_once_with(20, 29)  # offset=20, limit=10

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_log_with_date_filters(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test activity log with date filtering"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        result = get_user_activity_log(
            user_id=123,
            from_date='2024-01-01',
            to_date='2024-01-31'
        )

        # Verify date filters were applied
        table_mock.gte.assert_called_once()
        table_mock.lte.assert_called_once()

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_log_with_model_filter(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test activity log with model filter"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        result = get_user_activity_log(
            user_id=123,
            model_filter='gpt-4'
        )

        # Verify model filter was applied
        calls = [str(call) for call in table_mock.eq.call_args_list]
        assert any('gpt-4' in str(call) for call in calls)

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_log_with_provider_filter(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test activity log with provider filter"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        table_mock.execute.return_value = Mock(data=[])

        result = get_user_activity_log(
            user_id=123,
            provider_filter='OpenAI'
        )

        # Verify provider filter was applied
        calls = [str(call) for call in table_mock.eq.call_args_list]
        assert any('OpenAI' in str(call) for call in calls)

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_log_empty(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test retrieving empty activity log"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock empty response
        table_mock.execute.return_value = Mock(data=[])

        result = get_user_activity_log(user_id=123)

        assert result == []

    @patch('src.db.activity.get_supabase_client')
    def test_get_activity_log_error(
        self,
        mock_get_client,
        mock_supabase_client
    ):
        """Test error handling in activity log retrieval"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock error
        client.table.side_effect = Exception("Database error")

        result = get_user_activity_log(user_id=123)

        # Should return empty list on error
        assert result == []


# ============================================================
# TEST CLASS: Provider Detection
# ============================================================

class TestProviderDetection:
    """Test provider detection from model names"""

    def test_detect_openai_models(self):
        """Test detecting OpenAI models"""
        assert get_provider_from_model('gpt-4') == 'OpenAI'
        assert get_provider_from_model('gpt-3.5-turbo') == 'OpenAI'
        assert get_provider_from_model('GPT-4-Turbo') == 'OpenAI'
        assert get_provider_from_model('openai/gpt-4') == 'OpenAI'

    def test_detect_anthropic_models(self):
        """Test detecting Anthropic models"""
        assert get_provider_from_model('claude-3-sonnet') == 'Anthropic'
        assert get_provider_from_model('claude-3-opus') == 'Anthropic'
        assert get_provider_from_model('CLAUDE-2') == 'Anthropic'
        assert get_provider_from_model('anthropic/claude-3') == 'Anthropic'

    def test_detect_google_models(self):
        """Test detecting Google models"""
        assert get_provider_from_model('gemini-pro') == 'Google'
        assert get_provider_from_model('gemini-1.5-flash') == 'Google'
        assert get_provider_from_model('palm-2') == 'Google'
        assert get_provider_from_model('bard') == 'Google'

    def test_detect_meta_models(self):
        """Test detecting Meta models"""
        assert get_provider_from_model('llama-3-70b') == 'Meta'
        assert get_provider_from_model('meta-llama-3.1') == 'Meta'
        assert get_provider_from_model('LLAMA2') == 'Meta'

    def test_detect_mistral_models(self):
        """Test detecting Mistral AI models"""
        assert get_provider_from_model('mistral-7b') == 'Mistral AI'
        assert get_provider_from_model('mixtral-8x7b') == 'Mistral AI'
        assert get_provider_from_model('MISTRAL-LARGE') == 'Mistral AI'

    def test_detect_alibaba_models(self):
        """Test detecting Alibaba models"""
        assert get_provider_from_model('qwen-72b') == 'Alibaba'
        assert get_provider_from_model('qwen2-7b') == 'Alibaba'

    def test_detect_deepseek_models(self):
        """Test detecting DeepSeek models"""
        assert get_provider_from_model('deepseek-coder') == 'DeepSeek'
        assert get_provider_from_model('deepseek-v2') == 'DeepSeek'

    def test_detect_unknown_models(self):
        """Test detecting unknown/other models"""
        assert get_provider_from_model('unknown-model') == 'Other'
        assert get_provider_from_model('custom-model-v1') == 'Other'
        assert get_provider_from_model('test-123') == 'Other'

    def test_provider_detection_case_insensitive(self):
        """Test provider detection is case-insensitive"""
        assert get_provider_from_model('GPT-4') == 'OpenAI'
        assert get_provider_from_model('gpt-4') == 'OpenAI'
        assert get_provider_from_model('CLAUDE-3') == 'Anthropic'
        assert get_provider_from_model('claude-3') == 'Anthropic'


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestActivityIntegration:
    """Test activity tracking integration scenarios"""

    @patch('src.db.activity.get_supabase_client')
    def test_log_and_retrieve_activity(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_activity_data
    ):
        """Test logging activity and retrieving it"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock log activity
        table_mock.execute.return_value = Mock(data=[mock_activity_data])

        logged = log_activity(
            user_id=123,
            model='gpt-4',
            provider='OpenAI',
            tokens=1500,
            cost=0.045
        )

        assert logged is not None

        # Mock retrieve activity
        table_mock.execute.return_value = Mock(data=[mock_activity_data])

        activities = get_user_activity_log(user_id=123, limit=10)

        assert len(activities) == 1
        assert activities[0]['model'] == 'gpt-4'

    @patch('src.db.activity.get_supabase_client')
    def test_stats_include_logged_activity(
        self,
        mock_get_client,
        mock_supabase_client,
        mock_activity_data
    ):
        """Test that logged activities appear in statistics"""
        client, table_mock = mock_supabase_client
        mock_get_client.return_value = client

        # Mock multiple activities
        activities = [
            mock_activity_data,
            {**mock_activity_data, 'id': 2, 'tokens': 2000, 'cost': 0.06}
        ]
        table_mock.execute.return_value = Mock(data=activities)

        stats = get_user_activity_stats(user_id=123, days=7)

        assert stats['total_requests'] == 2
        assert stats['total_tokens'] == 3500  # 1500 + 2000
        assert stats['total_cost'] == 0.105  # 0.045 + 0.06
