#!/usr/bin/env python3
"""
Comprehensive tests for analytics endpoints

Tests cover:
- Single event logging to Statsig and PostHog
- Batch event logging
- Authenticated vs anonymous users
- User ID determination
- Event metadata handling
- Error handling
"""

import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient

from src.main import app
from src.security.deps import get_current_user


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    # Clear any existing dependency overrides
    app.dependency_overrides = {}
    yield TestClient(app)
    # Cleanup after test
    app.dependency_overrides = {}


@pytest.fixture
def mock_current_user():
    """Mock authenticated user"""
    return {
        'user_id': 123,
        'email': 'test@example.com'
    }


@pytest.fixture
def valid_event_data():
    """Valid analytics event data"""
    return {
        'event_name': 'chat_message_sent',
        'value': 'gpt-4',
        'metadata': {
            'model': 'gpt-4',
            'tokens': 150,
            'cost': 0.003
        }
    }


# ============================================================
# TEST CLASS: Single Event Logging
# ============================================================

class TestLogEvent:
    """Test single analytics event logging"""

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_log_event_authenticated_user(
        self,
        mock_posthog,
        mock_statsig,
        client,
        mock_current_user,
        valid_event_data
    ):
        """Test logging event with authenticated user"""
        # Override dependency
        async def mock_get_current_user_dep():
            return mock_current_user

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=valid_event_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'logged successfully' in data['message']

        # Verify Statsig was called
        mock_statsig.log_event.assert_called_once_with(
            user_id='123',
            event_name='chat_message_sent',
            value='gpt-4',
            metadata={'model': 'gpt-4', 'tokens': 150, 'cost': 0.003}
        )

        # Verify PostHog was called
        mock_posthog.capture.assert_called_once_with(
            distinct_id='123',
            event='chat_message_sent',
            properties={'model': 'gpt-4', 'tokens': 150, 'cost': 0.003}
        )

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_log_event_anonymous_user(
        self,
        mock_posthog,
        mock_statsig,
        client,
        valid_event_data
    ):
        """Test logging event without authentication"""
        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=valid_event_data
        )

        assert response.status_code == 200

        # Verify both services called with 'anonymous' user
        mock_statsig.log_event.assert_called_once()
        assert mock_statsig.log_event.call_args[1]['user_id'] == 'anonymous'

        mock_posthog.capture.assert_called_once()
        assert mock_posthog.capture.call_args[1]['distinct_id'] == 'anonymous'

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_log_event_with_provided_user_id(
        self,
        mock_posthog,
        mock_statsig,
        client
    ):
        """Test logging event with user_id in payload"""
        event_data = {
            'event_name': 'page_view',
            'user_id': 'custom_user_456',
            'metadata': {'page': '/dashboard'}
        }

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=event_data
        )

        assert response.status_code == 200

        # Verify custom user_id was used
        mock_statsig.log_event.assert_called_once()
        assert mock_statsig.log_event.call_args[1]['user_id'] == 'custom_user_456'

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_log_event_without_metadata(
        self,
        mock_posthog,
        mock_statsig,
        client
    ):
        """Test logging event without optional metadata"""
        event_data = {
            'event_name': 'button_click'
        }

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=event_data
        )

        assert response.status_code == 200

        # Verify calls with None metadata
        mock_statsig.log_event.assert_called_once_with(
            user_id='anonymous',
            event_name='button_click',
            value=None,
            metadata=None
        )

    @patch('src.routes.analytics.statsig_service')
    def test_log_event_statsig_error(
        self,
        mock_statsig,
        client,
        valid_event_data
    ):
        """Test error handling when Statsig fails"""
        mock_statsig.log_event.side_effect = Exception("Statsig error")

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=valid_event_data
        )

        assert response.status_code == 500
        assert 'failed' in response.json()['detail'].lower()

    def test_log_event_missing_event_name(self, client):
        """Test validation error for missing event_name"""
        event_data = {
            'value': 'some_value'
            # event_name is missing
        }

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=event_data
        )

        assert response.status_code == 422  # Validation error


# ============================================================
# TEST CLASS: Batch Event Logging
# ============================================================

class TestLogBatchEvents:
    """Test batch analytics event logging"""

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_log_batch_events_authenticated_user(
        self,
        mock_posthog,
        mock_statsig,
        client,
        mock_current_user
    ):
        """Test logging multiple events for authenticated user"""
        # Override dependency
        async def mock_get_current_user_dep():
            return mock_current_user

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        events_data = [
            {
                'event_name': 'chat_message_sent',
                'metadata': {'model': 'gpt-4'}
            },
            {
                'event_name': 'page_view',
                'metadata': {'page': '/dashboard'}
            },
            {
                'event_name': 'button_click',
                'value': 'export_data'
            }
        ]

        response = client.post(
            '/v1/analytics/batch',
            json=events_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert '3 events logged successfully' in data['message']

        # Verify all events were logged
        assert mock_statsig.log_event.call_count == 3
        assert mock_posthog.capture.call_count == 3

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_log_batch_events_mixed_user_ids(
        self,
        mock_posthog,
        mock_statsig,
        client,
        mock_current_user
    ):
        """Test batch events with different user IDs"""
        # Override dependency
        async def mock_get_current_user_dep():
            return mock_current_user

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        events_data = [
            {
                'event_name': 'event1',
                'user_id': 'user_a'
            },
            {
                'event_name': 'event2',
                'user_id': 'user_b'
            },
            {
                'event_name': 'event3'
                # No user_id, should use authenticated user
            }
        ]

        response = client.post(
            '/v1/analytics/batch',
            json=events_data
        )

        assert response.status_code == 200

        # Verify different user IDs were used
        statsig_calls = mock_statsig.log_event.call_args_list
        assert statsig_calls[0][1]['user_id'] == 'user_a'
        assert statsig_calls[1][1]['user_id'] == 'user_b'
        assert statsig_calls[2][1]['user_id'] == '123'  # Authenticated user

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_log_batch_events_empty_list(
        self,
        mock_posthog,
        mock_statsig,
        client
    ):
        """Test batch logging with empty events list"""
        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/batch',
            json=[]
        )

        assert response.status_code == 200
        data = response.json()
        assert '0 events logged successfully' in data['message']

        # Verify no events were logged
        mock_statsig.log_event.assert_not_called()
        mock_posthog.capture.assert_not_called()

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_log_batch_events_large_batch(
        self,
        mock_posthog,
        mock_statsig,
        client
    ):
        """Test logging large batch of events"""
        # Create 100 events
        events_data = [
            {
                'event_name': f'event_{i}',
                'metadata': {'index': i}
            }
            for i in range(100)
        ]

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/batch',
            json=events_data
        )

        assert response.status_code == 200
        assert '100 events logged successfully' in response.json()['message']

        # Verify all events were logged
        assert mock_statsig.log_event.call_count == 100
        assert mock_posthog.capture.call_count == 100

    @patch('src.routes.analytics.statsig_service')
    def test_log_batch_events_partial_failure(
        self,
        mock_statsig,
        client
    ):
        """Test error handling when batch logging fails"""
        mock_statsig.log_event.side_effect = Exception("Batch error")

        events_data = [
            {'event_name': 'event1'},
            {'event_name': 'event2'}
        ]

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/batch',
            json=events_data
        )

        assert response.status_code == 500
        assert 'failed' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Event Metadata Handling
# ============================================================

class TestEventMetadataHandling:
    """Test metadata handling in analytics events"""

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_event_with_complex_metadata(
        self,
        mock_posthog,
        mock_statsig,
        client
    ):
        """Test event with complex nested metadata"""
        event_data = {
            'event_name': 'api_call',
            'metadata': {
                'model': 'gpt-4',
                'tokens': {
                    'prompt': 100,
                    'completion': 50,
                    'total': 150
                },
                'request': {
                    'method': 'POST',
                    'endpoint': '/v1/chat/completions'
                },
                'response': {
                    'status': 200,
                    'latency_ms': 1234
                }
            }
        }

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=event_data
        )

        assert response.status_code == 200

        # Verify complex metadata was preserved
        mock_statsig.log_event.assert_called_once()
        metadata = mock_statsig.log_event.call_args[1]['metadata']
        assert metadata['tokens']['total'] == 150
        assert metadata['response']['latency_ms'] == 1234

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_event_with_array_metadata(
        self,
        mock_posthog,
        mock_statsig,
        client
    ):
        """Test event with array in metadata"""
        event_data = {
            'event_name': 'multi_model_request',
            'metadata': {
                'models': ['gpt-4', 'claude-3', 'llama-2'],
                'count': 3
            }
        }

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=event_data
        )

        assert response.status_code == 200

        metadata = mock_statsig.log_event.call_args[1]['metadata']
        assert len(metadata['models']) == 3
        assert 'claude-3' in metadata['models']


# ============================================================
# TEST CLASS: User ID Priority
# ============================================================

class TestUserIDPriority:
    """Test user ID determination priority"""

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_user_id_priority_authenticated_over_provided(
        self,
        mock_posthog,
        mock_statsig,
        client,
        mock_current_user
    ):
        """Test authenticated user ID takes priority over provided user_id"""
        # Override dependency
        async def mock_get_current_user_dep():
            return mock_current_user

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        event_data = {
            'event_name': 'test_event',
            'user_id': 'should_be_ignored'
        }

        response = client.post(
            '/v1/analytics/events',
            json=event_data
        )

        assert response.status_code == 200

        # Authenticated user ID should be used, not provided user_id
        assert mock_statsig.log_event.call_args[1]['user_id'] == '123'

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_user_id_priority_provided_over_anonymous(
        self,
        mock_posthog,
        mock_statsig,
        client
    ):
        """Test provided user_id takes priority over anonymous"""
        event_data = {
            'event_name': 'test_event',
            'user_id': 'custom_user'
        }

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=event_data
        )

        assert response.status_code == 200

        # Custom user ID should be used
        assert mock_statsig.log_event.call_args[1]['user_id'] == 'custom_user'

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_user_id_default_to_anonymous(
        self,
        mock_posthog,
        mock_statsig,
        client
    ):
        """Test default to anonymous when no user info available"""
        event_data = {
            'event_name': 'test_event'
        }

        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep
        response = client.post(
            '/v1/analytics/events',
            json=event_data
        )

        assert response.status_code == 200

        # Should default to anonymous
        assert mock_statsig.log_event.call_args[1]['user_id'] == 'anonymous'


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestAnalyticsIntegration:
    """Test analytics integration scenarios"""

    @patch('src.routes.analytics.statsig_service')
    @patch('src.routes.analytics.posthog_service')
    def test_single_and_batch_consistency(
        self,
        mock_posthog,
        mock_statsig,
        client
    ):
        """Test that single and batch endpoints produce consistent results"""
        # Override dependency for anonymous user
        async def mock_get_current_user_dep():
            return None

        app.dependency_overrides[get_current_user] = mock_get_current_user_dep

        event_data = {
            'event_name': 'test_event',
            'value': 'test_value',
            'metadata': {'key': 'value'}
        }

        # Log single event
        response1 = client.post(
            '/v1/analytics/events',
            json=event_data
        )

        # Log batch with same event
        response2 = client.post(
            '/v1/analytics/batch',
            json=[event_data]
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        # Both should log to both services
        assert mock_statsig.log_event.call_count == 2
        assert mock_posthog.capture.call_count == 2
