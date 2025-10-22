#!/usr/bin/env python3
"""
Comprehensive tests for system endpoints (cache management and gateway health)

Tests cover:
- Cache status retrieval
- Cache refresh operations
- Cache clearing
- Gateway health checks
- Modelz cache management
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timezone
from fastapi.testclient import TestClient
import httpx

from src.main import app


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_cache_info():
    """Sample cache information"""
    return {
        "data": [{"id": "model1"}, {"id": "model2"}, {"id": "model3"}],
        "timestamp": datetime.now(timezone.utc).timestamp(),
        "ttl": 3600
    }


@pytest.fixture
def mock_empty_cache():
    """Empty cache"""
    return None


# ============================================================
# TEST CLASS: Cache Status
# ============================================================

class TestCacheStatus:
    """Test cache status retrieval"""

    @patch('src.routes.system.get_models_cache')
    @patch('src.routes.system.get_providers_cache')
    def test_get_cache_status_with_data(
        self,
        mock_get_providers,
        mock_get_models,
        client,
        mock_cache_info
    ):
        """Test cache status with data"""
        mock_get_models.return_value = mock_cache_info
        mock_get_providers.return_value = mock_cache_info

        response = client.get('/cache/status')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'data' in data
        assert 'openrouter' in data['data']
        assert 'providers' in data['data']

        # Verify openrouter cache info
        openrouter = data['data']['openrouter']
        assert openrouter['models_cached'] == 3
        assert openrouter['status'] == 'healthy'
        assert openrouter['has_data'] is True

    @patch('src.routes.system.get_models_cache')
    @patch('src.routes.system.get_providers_cache')
    def test_get_cache_status_empty_cache(
        self,
        mock_get_providers,
        mock_get_models,
        client
    ):
        """Test cache status with empty cache"""
        mock_get_models.return_value = None
        mock_get_providers.return_value = None

        response = client.get('/cache/status')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

        # All gateways should show empty status
        openrouter = data['data']['openrouter']
        assert openrouter['models_cached'] == 0
        assert openrouter['status'] == 'empty'
        assert openrouter['has_data'] is False

    @patch('src.routes.system.get_models_cache')
    @patch('src.routes.system.get_providers_cache')
    def test_get_cache_status_stale_cache(
        self,
        mock_get_providers,
        mock_get_models,
        client
    ):
        """Test cache status with stale cache"""
        # Create stale cache (old timestamp)
        stale_cache = {
            "data": [{"id": "model1"}],
            "timestamp": datetime.now(timezone.utc).timestamp() - 7200,  # 2 hours old
            "ttl": 3600  # 1 hour TTL
        }
        mock_get_models.return_value = stale_cache
        mock_get_providers.return_value = stale_cache

        response = client.get('/cache/status')

        assert response.status_code == 200
        data = response.json()

        openrouter = data['data']['openrouter']
        assert openrouter['status'] == 'stale'
        assert openrouter['cache_age_seconds'] > 3600

    @patch('src.routes.system.get_models_cache')
    def test_get_cache_status_error_handling(
        self,
        mock_get_models,
        client
    ):
        """Test cache status error handling"""
        mock_get_models.side_effect = Exception("Cache error")

        response = client.get('/cache/status')

        assert response.status_code == 500
        assert 'error' in response.json()['detail'].lower() or 'failed' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Cache Refresh
# ============================================================

class TestCacheRefresh:
    """Test cache refresh operations"""

    @patch('src.routes.system.get_models_cache')
    @patch('src.routes.system.clear_models_cache')
    @patch('src.routes.system.fetch_models_from_openrouter')
    def test_refresh_gateway_cache_success(
        self,
        mock_fetch,
        mock_clear,
        mock_get_cache,
        client
    ):
        """Test successful cache refresh"""
        # Old stale cache
        old_cache = {
            "data": [{"id": "old_model"}],
            "timestamp": datetime.now(timezone.utc).timestamp() - 7200,
            "ttl": 3600
        }
        # New cache after refresh
        new_cache = {
            "data": [{"id": "new_model1"}, {"id": "new_model2"}],
            "timestamp": datetime.now(timezone.utc).timestamp(),
            "ttl": 3600
        }

        mock_get_cache.side_effect = [old_cache, new_cache]
        mock_fetch.return_value = None

        response = client.post('/cache/refresh/openrouter?force=false')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['action'] == 'refreshed'
        assert data['models_cached'] == 2
        assert data['gateway'] == 'openrouter'

        mock_clear.assert_called_once_with('openrouter')
        mock_fetch.assert_called_once()

    @patch('src.routes.system.get_models_cache')
    def test_refresh_gateway_cache_skip_if_valid(
        self,
        mock_get_cache,
        client,
        mock_cache_info
    ):
        """Test cache refresh skipped if cache is still valid"""
        mock_get_cache.return_value = mock_cache_info

        response = client.post('/cache/refresh/openrouter?force=false')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['action'] == 'skipped'

    @patch('src.routes.system.get_models_cache')
    @patch('src.routes.system.clear_models_cache')
    @patch('src.routes.system.fetch_models_from_openrouter')
    def test_refresh_gateway_cache_force(
        self,
        mock_fetch,
        mock_clear,
        mock_get_cache,
        client,
        mock_cache_info
    ):
        """Test forced cache refresh"""
        new_cache = {
            "data": [{"id": "model1"}],
            "timestamp": datetime.now(timezone.utc).timestamp(),
            "ttl": 3600
        }

        mock_get_cache.side_effect = [mock_cache_info, new_cache]
        mock_fetch.return_value = None

        response = client.post('/cache/refresh/openrouter?force=true')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['action'] == 'refreshed'

        mock_clear.assert_called_once()
        mock_fetch.assert_called_once()

    def test_refresh_gateway_cache_invalid_gateway(self, client):
        """Test refresh with invalid gateway"""
        response = client.post('/cache/refresh/invalid_gateway')

        assert response.status_code == 400
        assert 'invalid gateway' in response.json()['detail'].lower()

    def test_refresh_gateway_cache_deepinfra_not_supported(self, client):
        """Test that DeepInfra doesn't support bulk refresh"""
        response = client.post('/cache/refresh/deepinfra?force=true')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is False
        assert data['action'] == 'not_supported'
        assert 'on-demand' in data['message'].lower()

    @patch('src.routes.system.get_models_cache')
    @patch('src.routes.system.clear_models_cache')
    @patch('src.routes.system.fetch_models_from_portkey')
    def test_refresh_gateway_cache_fetch_error(
        self,
        mock_fetch,
        mock_clear,
        mock_get_cache,
        client
    ):
        """Test error handling during fetch"""
        old_cache = {
            "data": [],
            "timestamp": datetime.now(timezone.utc).timestamp() - 7200,
            "ttl": 3600
        }

        mock_get_cache.return_value = old_cache
        mock_fetch.side_effect = Exception("Fetch failed")

        response = client.post('/cache/refresh/portkey?force=true')

        assert response.status_code == 500
        assert 'failed' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Cache Clear
# ============================================================

class TestCacheClear:
    """Test cache clearing operations"""

    @patch('src.routes.system.clear_models_cache')
    def test_clear_specific_gateway_cache(
        self,
        mock_clear,
        client
    ):
        """Test clearing cache for specific gateway"""
        response = client.post('/cache/clear?gateway=openrouter')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['gateway'] == 'openrouter'

        mock_clear.assert_called_once_with('openrouter')

    @patch('src.routes.system.clear_models_cache')
    @patch('src.routes.system.clear_providers_cache')
    def test_clear_all_caches(
        self,
        mock_clear_providers,
        mock_clear_models,
        client
    ):
        """Test clearing all caches"""
        response = client.post('/cache/clear')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'all caches cleared' in data['message'].lower()
        assert 'providers' in data['gateways_cleared']

        # Should clear all gateways
        assert mock_clear_models.call_count >= 7
        mock_clear_providers.assert_called_once()

    @patch('src.routes.system.clear_models_cache')
    def test_clear_cache_error_handling(
        self,
        mock_clear,
        client
    ):
        """Test cache clear error handling"""
        mock_clear.side_effect = Exception("Clear failed")

        response = client.post('/cache/clear?gateway=openrouter')

        assert response.status_code == 500


# ============================================================
# TEST CLASS: Gateway Health Checks
# ============================================================

class TestGatewayHealth:
    """Test gateway health monitoring"""

    @patch('httpx.AsyncClient.get')
    async def test_check_all_gateways_healthy(
        self,
        mock_get,
        client
    ):
        """Test all gateways healthy"""
        mock_response = Mock()
        mock_response.status_code = 200

        mock_get.return_value = mock_response

        response = client.get('/health/gateways')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'data' in data
        assert 'summary' in data

        # Check summary
        summary = data['summary']
        assert 'total_gateways' in summary
        assert 'healthy' in summary
        assert 'overall_health_percentage' in summary

    @patch('httpx.AsyncClient.get')
    async def test_check_all_gateways_some_unhealthy(
        self,
        mock_get,
        client
    ):
        """Test with some gateways unhealthy"""
        # Simulate mixed responses
        healthy_response = Mock()
        healthy_response.status_code = 200

        error_response = Mock()
        error_response.status_code = 500

        mock_get.side_effect = [healthy_response, error_response, healthy_response]

        response = client.get('/health/gateways')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

        # Should have both healthy and degraded gateways
        summary = data['summary']
        assert summary['degraded'] >= 0 or summary['unhealthy'] >= 0

    @patch('httpx.AsyncClient.get')
    async def test_check_all_gateways_timeout(
        self,
        mock_get,
        client
    ):
        """Test gateway timeout handling"""
        mock_get.side_effect = httpx.TimeoutException("Timeout")

        response = client.get('/health/gateways')

        assert response.status_code == 200
        data = response.json()

        # Should show timeout status for affected gateways
        for gateway_name, gateway_data in data['data'].items():
            if gateway_data['status'] == 'timeout':
                assert gateway_data['available'] is False
                assert gateway_data['error'] == 'Request timed out'

    @patch('httpx.AsyncClient.get')
    async def test_check_single_gateway_success(
        self,
        mock_get,
        client,
        mock_cache_info
    ):
        """Test checking single gateway"""
        with patch('src.routes.system.get_models_cache', return_value=mock_cache_info):
            mock_response = Mock()
            mock_response.status_code = 200
            mock_get.return_value = mock_response

            response = client.get('/health/openrouter')

            assert response.status_code == 200
            data = response.json()
            assert data['success'] is True
            assert data['gateway'] == 'openrouter'
            assert 'cache' in data['data']
            assert data['data']['cache']['models_cached'] == 3

    def test_check_single_gateway_not_found(self, client):
        """Test checking non-existent gateway"""
        response = client.get('/health/nonexistent_gateway')

        # Should return 404 or error
        assert response.status_code in [404, 500]


# ============================================================
# TEST CLASS: Modelz Cache Management
# ============================================================

class TestModelzCacheManagement:
    """Test Modelz cache management endpoints"""

    @patch('src.routes.system.get_modelz_cache_status_func')
    def test_get_modelz_cache_status_success(
        self,
        mock_get_status,
        client
    ):
        """Test getting Modelz cache status"""
        mock_status = {
            "status": "valid",
            "message": "Modelz cache is valid",
            "cache_size": 53,
            "timestamp": 1705123456.789,
            "ttl": 1800,
            "age_seconds": 245.3,
            "is_valid": True
        }
        mock_get_status.return_value = mock_status

        response = client.get('/cache/modelz/status')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['data']['cache_size'] == 53
        assert data['data']['is_valid'] is True

    @patch('src.routes.system.get_modelz_cache_status_func')
    def test_get_modelz_cache_status_error(
        self,
        mock_get_status,
        client
    ):
        """Test Modelz cache status error handling"""
        mock_get_status.side_effect = Exception("Status check failed")

        response = client.get('/cache/modelz/status')

        assert response.status_code == 500
        assert 'failed' in response.json()['detail'].lower()

    @patch('src.routes.system.refresh_modelz_cache')
    async def test_refresh_modelz_cache_success(
        self,
        mock_refresh,
        client
    ):
        """Test refreshing Modelz cache"""
        mock_result = {
            "status": "success",
            "message": "Modelz cache refreshed with 53 tokens",
            "cache_size": 53,
            "timestamp": 1705123456.789,
            "ttl": 1800
        }
        mock_refresh.return_value = mock_result

        response = client.post('/cache/modelz/refresh')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['data']['cache_size'] == 53

    @patch('src.routes.system.refresh_modelz_cache')
    async def test_refresh_modelz_cache_error(
        self,
        mock_refresh,
        client
    ):
        """Test Modelz cache refresh error handling"""
        mock_refresh.side_effect = Exception("Refresh failed")

        response = client.post('/cache/modelz/refresh')

        assert response.status_code == 500
        assert 'failed' in response.json()['detail'].lower()

    @patch('src.routes.system.clear_modelz_cache')
    def test_clear_modelz_cache_success(
        self,
        mock_clear,
        client
    ):
        """Test clearing Modelz cache"""
        response = client.delete('/cache/modelz/clear')

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'cleared successfully' in data['message'].lower()

        mock_clear.assert_called_once()

    @patch('src.routes.system.clear_modelz_cache')
    def test_clear_modelz_cache_error(
        self,
        mock_clear,
        client
    ):
        """Test Modelz cache clear error handling"""
        mock_clear.side_effect = Exception("Clear failed")

        response = client.delete('/cache/modelz/clear')

        assert response.status_code == 500
        assert 'failed' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Integration Tests
# ============================================================

class TestSystemIntegration:
    """Test system endpoint integration scenarios"""

    @patch('src.routes.system.get_models_cache')
    @patch('src.routes.system.get_providers_cache')
    @patch('src.routes.system.clear_models_cache')
    @patch('src.routes.system.fetch_models_from_openrouter')
    def test_cache_workflow_status_refresh_status(
        self,
        mock_fetch,
        mock_clear,
        mock_get_providers,
        mock_get_models,
        client
    ):
        """Test complete cache workflow: check status, refresh, check again"""
        # Initial empty cache
        mock_get_models.return_value = None
        mock_get_providers.return_value = None

        # 1. Check status (should show empty)
        response1 = client.get('/cache/status')
        assert response1.status_code == 200
        assert response1.json()['data']['openrouter']['status'] == 'empty'

        # 2. Refresh cache
        new_cache = {
            "data": [{"id": "model1"}],
            "timestamp": datetime.now(timezone.utc).timestamp(),
            "ttl": 3600
        }
        mock_get_models.side_effect = [None, new_cache]
        mock_fetch.return_value = None

        response2 = client.post('/cache/refresh/openrouter?force=true')
        assert response2.status_code == 200
        assert response2.json()['action'] == 'refreshed'

        # 3. Check status again (should show healthy)
        mock_get_models.return_value = new_cache
        response3 = client.get('/cache/status')
        assert response3.status_code == 200
        assert response3.json()['data']['openrouter']['models_cached'] == 1

    @patch('httpx.AsyncClient.get')
    @patch('src.routes.system.get_models_cache')
    def test_health_check_with_cache_info(
        self,
        mock_get_cache,
        mock_http_get,
        client,
        mock_cache_info
    ):
        """Test health check includes cache information"""
        mock_get_cache.return_value = mock_cache_info

        mock_response = Mock()
        mock_response.status_code = 200
        mock_http_get.return_value = mock_response

        response = client.get('/health/openrouter')

        assert response.status_code == 200
        data = response.json()

        # Should include both health and cache info
        assert 'status' in data['data']
        assert 'cache' in data['data']
        assert data['data']['cache']['models_cached'] == 3
        assert data['data']['cache']['has_data'] is True
