#!/usr/bin/env python3
"""
Comprehensive tests for transaction analytics endpoints

Tests cover:
- Transaction analytics retrieval from OpenRouter
- Transaction summary processing
- Window parameter validation
- Error handling (timeouts, auth failures, API errors)
- Data processing and aggregation
- Model statistics calculation
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
import httpx

from src.main import app


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture(autouse=True)
def mock_config_cookie():
    """Mock OPENROUTER_COOKIE for all tests"""
    with patch('src.config.Config.OPENROUTER_COOKIE', 'test_cookie_value'):
        yield


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_openrouter_response():
    """Mock OpenRouter transaction analytics response"""
    return {
        "data": {
            "data": [
                {
                    "model_permaslug": "gpt-4-turbo",
                    "requests": 100,
                    "prompt_tokens": 50000,
                    "completion_tokens": 25000,
                    "reasoning_tokens": 0,
                    "usage": 3.75
                },
                {
                    "model_permaslug": "gpt-4-turbo",
                    "requests": 50,
                    "prompt_tokens": 25000,
                    "completion_tokens": 12500,
                    "reasoning_tokens": 0,
                    "usage": 1.875
                },
                {
                    "model_permaslug": "claude-3-sonnet",
                    "requests": 75,
                    "prompt_tokens": 37500,
                    "completion_tokens": 18750,
                    "reasoning_tokens": 500,
                    "usage": 2.25
                }
            ]
        }
    }


# ============================================================
# TEST CLASS: Get Transaction Analytics
# ============================================================

class TestGetTransactionAnalytics:
    """Test /analytics/transactions endpoint"""

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_analytics_success(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test successfully fetching transaction analytics"""
        # Mock the httpx response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        # Mock the async client context manager
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions?window=1d')

        assert response.status_code == 200
        data = response.json()

        assert data['success'] is True
        assert data['window'] == '1d'
        assert 'data' in data
        assert data['data'] == mock_openrouter_response

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_analytics_different_windows(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test fetching analytics with different time windows"""
        # Mock the httpx response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        # Test different window values
        windows = ['1hr', '1d', '1mo', '1y']

        for window in windows:
            response = client.get(f'/analytics/transactions?window={window}')

            assert response.status_code == 200
            data = response.json()
            assert data['window'] == window

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_analytics_default_window(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test default window parameter"""
        # Mock the httpx response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        # Request without window parameter
        response = client.get('/analytics/transactions')

        assert response.status_code == 200
        data = response.json()

        # Default should be '1d'
        assert data['window'] == '1d'

    @pytest.mark.asyncio
    @patch('src.config.Config.OPENROUTER_COOKIE', None)
    async def test_get_transaction_analytics_missing_cookie(
        self,
        client
    ):
        """Test that missing OPENROUTER_COOKIE returns 503"""
        response = client.get('/analytics/transactions')

        assert response.status_code == 503
        assert 'not configured' in response.json()['detail']
        assert 'OPENROUTER_COOKIE' in response.json()['detail']

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_analytics_auth_failure(
        self,
        mock_httpx_client,
        client
    ):
        """Test handling OpenRouter authentication failure"""
        # Mock 401 response
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions')

        assert response.status_code == 502
        assert 'authenticate with OpenRouter' in response.json()['detail']

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_analytics_api_error(
        self,
        mock_httpx_client,
        client
    ):
        """Test handling OpenRouter API errors"""
        # Mock 500 response
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions')

        assert response.status_code == 502
        assert 'OpenRouter API returned error: 500' in response.json()['detail']

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_analytics_timeout(
        self,
        mock_httpx_client,
        client
    ):
        """Test handling request timeout"""
        # Mock timeout exception
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(side_effect=httpx.TimeoutException("Request timeout"))
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions')

        assert response.status_code == 504
        assert 'timed out' in response.json()['detail']

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_analytics_request_error(
        self,
        mock_httpx_client,
        client
    ):
        """Test handling request errors"""
        # Mock request exception
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(
            side_effect=httpx.RequestError("Connection failed", request=Mock())
        )
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions')

        assert response.status_code == 502
        assert 'Failed to connect to OpenRouter API' in response.json()['detail']


# ============================================================
# TEST CLASS: Get Transaction Summary
# ============================================================

class TestGetTransactionSummary:
    """Test /analytics/transactions/summary endpoint"""

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_summary_success(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test successfully generating transaction summary"""
        # Mock the httpx response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions/summary?window=1d')

        assert response.status_code == 200
        data = response.json()

        assert data['success'] is True
        assert 'summary' in data

        summary = data['summary']
        assert summary['window'] == '1d'
        assert 'total_requests' in summary
        assert 'total_cost' in summary
        assert 'models_count' in summary
        assert 'models_stats' in summary

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_summary_aggregation(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test summary data aggregation"""
        # Mock the httpx response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions/summary')

        assert response.status_code == 200
        data = response.json()

        summary = data['summary']

        # Verify aggregation
        # 2 models: gpt-4-turbo and claude-3-sonnet
        assert summary['models_count'] == 2

        # Total requests: 100 + 50 + 75 = 225
        assert summary['total_requests'] == 225

        # Total cost: 3.75 + 1.875 + 2.25 = 7.875
        assert summary['total_cost'] == 7.875

        # Check model stats
        models_stats = summary['models_stats']

        assert 'gpt-4-turbo' in models_stats
        assert 'claude-3-sonnet' in models_stats

        # gpt-4-turbo: 100 + 50 = 150 requests
        assert models_stats['gpt-4-turbo']['requests'] == 150

        # claude-3-sonnet: 75 requests
        assert models_stats['claude-3-sonnet']['requests'] == 75

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_summary_token_stats(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test token statistics calculation"""
        # Mock the httpx response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions/summary')

        assert response.status_code == 200
        data = response.json()

        models_stats = data['summary']['models_stats']
        gpt4_stats = models_stats['gpt-4-turbo']

        # Check token structure
        assert 'tokens' in gpt4_stats
        assert 'prompt' in gpt4_stats['tokens']
        assert 'completion' in gpt4_stats['tokens']
        assert 'reasoning' in gpt4_stats['tokens']
        assert 'total' in gpt4_stats['tokens']

        # Each token stat should have sum, min, max, avg, count
        for token_type in ['prompt', 'completion', 'reasoning', 'total']:
            token_stat = gpt4_stats['tokens'][token_type]
            assert 'sum' in token_stat
            assert 'min' in token_stat
            assert 'max' in token_stat
            assert 'avg' in token_stat
            assert 'count' in token_stat

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_summary_usage_stats(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test usage (cost) statistics calculation"""
        # Mock the httpx response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions/summary')

        assert response.status_code == 200
        data = response.json()

        models_stats = data['summary']['models_stats']
        gpt4_stats = models_stats['gpt-4-turbo']

        # Check usage structure
        assert 'usage' in gpt4_stats
        usage = gpt4_stats['usage']

        assert 'sum' in usage
        assert 'min' in usage
        assert 'max' in usage
        assert 'avg' in usage
        assert 'count' in usage

        # gpt-4-turbo usage: 3.75 + 1.875 = 5.625
        assert usage['sum'] == 5.625

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_summary_empty_data(
        self,
        mock_httpx_client,
        client
    ):
        """Test summary with empty data"""
        # Mock empty response
        empty_response = {
            "data": {
                "data": []
            }
        }

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = empty_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions/summary')

        assert response.status_code == 200
        data = response.json()

        summary = data['summary']
        assert summary['total_requests'] == 0
        assert summary['total_cost'] == 0
        assert summary['models_count'] == 0
        assert summary['models_stats'] == {}

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_summary_with_reasoning_tokens(
        self,
        mock_httpx_client,
        client
    ):
        """Test summary correctly handles reasoning tokens"""
        # Data with reasoning tokens
        response_with_reasoning = {
            "data": {
                "data": [
                    {
                        "model_permaslug": "o1-preview",
                        "requests": 10,
                        "prompt_tokens": 5000,
                        "completion_tokens": 2500,
                        "reasoning_tokens": 1000,  # Has reasoning tokens
                        "usage": 1.25
                    }
                ]
            }
        }

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = response_with_reasoning

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions/summary')

        assert response.status_code == 200
        data = response.json()

        models_stats = data['summary']['models_stats']
        o1_stats = models_stats['o1-preview']

        # Reasoning tokens should be tracked separately
        assert o1_stats['tokens']['reasoning']['sum'] == 1000

        # Total tokens = prompt + completion (excluding reasoning)
        # 5000 + 2500 = 7500 (reasoning not included in total)
        assert o1_stats['tokens']['total']['sum'] == 7500

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_summary_rounding(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test numerical rounding in summary"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions/summary')

        assert response.status_code == 200
        data = response.json()

        summary = data['summary']

        # Total cost should be rounded to 6 decimal places
        assert isinstance(summary['total_cost'], float)
        assert len(str(summary['total_cost']).split('.')[-1]) <= 6

        # Token stats should be rounded to 2 decimal places
        models_stats = summary['models_stats']
        for model_stats in models_stats.values():
            for token_type in ['prompt', 'completion', 'reasoning', 'total']:
                token_stat = model_stats['tokens'][token_type]
                if token_stat['avg'] > 0:
                    assert len(str(token_stat['avg']).split('.')[-1]) <= 2

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_get_transaction_summary_error_propagation(
        self,
        mock_httpx_client,
        client
    ):
        """Test error propagation from get_transaction_analytics"""
        # Mock timeout in underlying call
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        response = client.get('/analytics/transactions/summary')

        # Should propagate the timeout error
        assert response.status_code == 504


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestTransactionAnalyticsIntegration:
    """Test transaction analytics integration scenarios"""

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_raw_and_summary_consistency(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test raw data and summary are consistent"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        # Get raw analytics
        raw_response = client.get('/analytics/transactions?window=1d')
        raw_data = raw_response.json()

        # Get summary
        summary_response = client.get('/analytics/transactions/summary?window=1d')
        summary_data = summary_response.json()

        # Both should use same window
        assert raw_data['window'] == summary_data['summary']['window']

        # Summary should be derived from raw data
        raw_items = raw_data['data']['data']['data']
        total_requests_raw = sum(item['requests'] for item in raw_items)

        assert summary_data['summary']['total_requests'] == total_requests_raw

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_multiple_window_queries(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test querying multiple time windows"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        windows = ['1hr', '1d', '1mo', '1y']

        for window in windows:
            # Raw analytics
            raw_response = client.get(f'/analytics/transactions?window={window}')
            assert raw_response.status_code == 200
            assert raw_response.json()['window'] == window

            # Summary
            summary_response = client.get(f'/analytics/transactions/summary?window={window}')
            assert summary_response.status_code == 200
            assert summary_response.json()['summary']['window'] == window

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient')
    async def test_public_access_no_auth_required(
        self,
        mock_httpx_client,
        client,
        mock_openrouter_response
    ):
        """Test that endpoints are public (no authentication required)"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openrouter_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)
        mock_httpx_client.return_value.__aenter__.return_value = mock_client_instance

        # Request without any authentication headers
        response1 = client.get('/analytics/transactions')
        response2 = client.get('/analytics/transactions/summary')

        # Both should succeed without authentication
        assert response1.status_code == 200
        assert response2.status_code == 200
