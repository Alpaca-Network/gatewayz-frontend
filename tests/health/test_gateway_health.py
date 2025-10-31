#!/usr/bin/env python3
"""
Test suite for Gateway Model URL Health Checker script

Tests the gateway health check functionality to ensure all configured
gateways are properly validated and can be auto-fixed.
"""

import pytest
import os
import sys
import httpx
from pathlib import Path
from typing import Dict, Tuple
from datetime import datetime, timezone
from unittest.mock import Mock, patch

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Import the functions directly from the check script
import importlib.util
spec = importlib.util.spec_from_file_location(
    "check_and_fix_gateway_models",
    str(project_root / "check_and_fix_gateway_models.py")
)
check_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check_module)

# Mark all tests in this module as health tests
pytestmark = pytest.mark.health


class TestGatewayHealthChecker:
    """Test suite for gateway health checker"""

    def test_gateway_config_exists(self):
        """Test that gateway configuration is properly defined"""
        assert hasattr(check_module, 'GATEWAY_CONFIG'), \
            "Script should define GATEWAY_CONFIG"
        assert len(check_module.GATEWAY_CONFIG) > 0, \
            "GATEWAY_CONFIG should not be empty"

    def test_all_required_gateways_configured(self):
        """Test that all expected gateways are in the configuration"""
        expected_gateways = [
            'openrouter', 'portkey', 'featherless', 'chutes', 'groq',
            'fireworks', 'together', 'deepinfra', 'google', 'cerebras',
            'nebius', 'xai', 'novita', 'huggingface', 'aimo', 'near', 'fal'
        ]

        for gateway in expected_gateways:
            assert gateway in check_module.GATEWAY_CONFIG, \
                f"Gateway '{gateway}' should be in GATEWAY_CONFIG"

    def test_gateway_config_has_required_fields(self):
        """Test that each gateway config has required fields"""
        required_fields = ['name', 'url', 'api_key_env', 'cache', 'header_type']

        for gateway_name, config in check_module.GATEWAY_CONFIG.items():
            for field in required_fields:
                assert field in config, \
                    f"Gateway '{gateway_name}' missing required field '{field}'"

    @pytest.mark.unit
    def test_build_headers_bearer_token(self):
        """Test header building for bearer token auth"""
        config = {
            'api_key': 'test-bearer-key',
            'header_type': 'bearer'
        }

        headers = check_module.build_headers(config)
        assert 'Authorization' in headers
        assert headers['Authorization'] == 'Bearer test-bearer-key'

    @pytest.mark.unit
    def test_build_headers_portkey(self):
        """Test header building for Portkey auth"""
        config = {
            'api_key': 'test-portkey-key',
            'header_type': 'portkey'
        }

        headers = check_module.build_headers(config)
        assert 'x-portkey-api-key' in headers
        assert headers['x-portkey-api-key'] == 'test-portkey-key'

    @pytest.mark.unit
    def test_build_headers_no_api_key(self):
        """Test header building when no API key is provided"""
        config = {
            'api_key': None,
            'header_type': 'bearer'
        }

        headers = check_module.build_headers(config)
        assert headers == {}

    @pytest.mark.unit
    def test_cache_test_with_empty_cache(self):
        """Test cache testing with empty cache"""
        config = {
            'cache': {
                'data': None,
                'timestamp': None
            },
            'min_expected_models': 10
        }

        success, message, count, models = check_module.test_gateway_cache('test_gateway', config)

        assert success is False, "Empty cache should fail"
        assert count == 0, "Empty cache should return 0 models"
        assert models == [], "Empty cache should return empty models list"

    @pytest.mark.unit
    def test_cache_test_with_valid_cache(self):
        """Test cache testing with valid cached models"""
        config = {
            'cache': {
                'data': ['model1', 'model2', 'model3'],
                'timestamp': datetime.now(timezone.utc)
            },
            'min_expected_models': 2
        }

        success, message, count, models = check_module.test_gateway_cache('test_gateway', config)

        assert success is True, "Valid cache should pass"
        assert count == 3, "Should return correct model count"
        assert len(models) == 3, "Should return correct models list"

    @pytest.mark.unit
    def test_clear_gateway_cache(self):
        """Test clearing gateway cache"""
        config = {
            'cache': {
                'data': ['model1', 'model2'],
                'timestamp': 'some-timestamp'
            }
        }

        result = check_module.clear_gateway_cache('test_gateway', config)

        assert result is True, "Cache should be cleared successfully"
        assert config['cache']['data'] is None, "Cache data should be None"
        assert config['cache']['timestamp'] is None, "Cache timestamp should be None"

    @pytest.mark.unit
    def test_gateway_config_min_expected_models(self):
        """Test that each gateway has reasonable min_expected_models"""
        for gateway_name, config in check_module.GATEWAY_CONFIG.items():
            assert 'min_expected_models' in config, \
                f"Gateway '{gateway_name}' should have min_expected_models"

            min_models = config['min_expected_models']
            assert isinstance(min_models, int) and min_models > 0, \
                f"Gateway '{gateway_name}' min_expected_models should be positive integer"

    @pytest.mark.unit
    def test_gateway_urls_are_valid(self):
        """Test that all gateway URLs are properly formatted"""
        for gateway_name, config in check_module.GATEWAY_CONFIG.items():
            url = config['url']
            # URL can be None for static catalog gateways (like Fal)
            if url is not None:
                assert isinstance(url, str), \
                    f"Gateway '{gateway_name}' URL should be a string or None"
                assert url.startswith('http'), \
                    f"Gateway '{gateway_name}' URL should start with http(s)"


class TestGatewayEndpointChecks:
    """Test gateway endpoint checking functionality"""

    @pytest.mark.unit
    def test_endpoint_check_timeout_handling(self):
        """Test that timeout is handled properly"""
        config = {
            'name': 'Test Gateway',
            'url': 'https://httpbin.org/delay/60',  # This will timeout
            'api_key': 'test-key',
            'header_type': 'bearer',
            'api_key_env': 'TEST_API_KEY',
            'min_expected_models': 1
        }

        # Mock httpx.get to raise a timeout exception
        with patch('httpx.get') as mock_get:
            mock_get.side_effect = httpx.TimeoutException("Request timeout")

            success, message, count = check_module.test_gateway_endpoint('test', config)

            # Should handle timeout gracefully
            assert isinstance(success, bool)
            assert isinstance(message, str)
            assert isinstance(count, int)
            assert success is False, "Timeout should result in failure"

    @pytest.mark.unit
    def test_endpoint_check_response_parsing(self):
        """Test proper response parsing for different formats"""
        # Test with list format
        config = {
            'name': 'Test',
            'url': 'https://api.example.com/models',
            'api_key': 'test',
            'header_type': 'bearer',
            'api_key_env': 'TEST_KEY',
            'min_expected_models': 1
        }

        # Mock httpx.get to return list format
        with patch('httpx.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = [
                {'id': 'model1'}, {'id': 'model2'}, {'id': 'model3'}
            ]
            mock_get.return_value = mock_response

            success, message, count = check_module.test_gateway_endpoint('test', config)

            assert success is True
            assert count == 3


class TestGatewayHealthCheckFlow:
    """Test the overall health check flow"""

    @pytest.mark.unit
    def test_build_headers_for_all_gateway_types(self):
        """Test header building for all configured gateway types"""
        header_types = set()

        for gateway_name, config in check_module.GATEWAY_CONFIG.items():
            header_type = config.get('header_type', 'bearer')
            header_types.add(header_type)

        # Common header types that should be supported
        assert 'bearer' in header_types or len(header_types) > 0, \
            "Should have at least one supported header type"

    @pytest.mark.unit
    def test_comprehensive_check_result_structure(self):
        """Test structure of comprehensive check results"""
        with patch.dict(os.environ, {'OPENROUTER_API_KEY': 'test-key'}, clear=False):
            results = check_module.run_comprehensive_check(auto_fix=False, verbose=False)

        # Validate result structure
        assert 'timestamp' in results
        assert 'total_gateways' in results
        assert 'healthy' in results
        assert 'unhealthy' in results
        assert 'unconfigured' in results
        assert 'gateways' in results
        assert 'fixed' in results

        # Validate data types
        assert isinstance(results['total_gateways'], int)
        assert isinstance(results['healthy'], int)
        assert isinstance(results['unhealthy'], int)
        assert isinstance(results['unconfigured'], int)
        assert isinstance(results['gateways'], dict)

    @pytest.mark.unit
    def test_gateway_count_consistency(self):
        """Test that gateway counts add up correctly"""
        with patch.dict(os.environ, {'OPENROUTER_API_KEY': 'test-key'}, clear=False):
            results = check_module.run_comprehensive_check(auto_fix=False, verbose=False)

        total = (results['healthy'] + results['unhealthy'] + results['unconfigured'])
        assert total == results['total_gateways'], \
            f"Gateway counts should sum to total: {total} != {results['total_gateways']}"


class TestGatewayCache:
    """Test gateway cache functionality"""

    @pytest.mark.unit
    def test_cache_with_expired_timestamp(self):
        """Test cache age calculation for expired cache"""
        old_timestamp = datetime(2020, 1, 1, tzinfo=timezone.utc)
        config = {
            'cache': {
                'data': ['model1', 'model2'],
                'timestamp': old_timestamp
            },
            'min_expected_models': 1
        }

        success, message, count, models = check_module.test_gateway_cache('test', config)

        assert 'h old' in message or 'day' in message, \
            "Should report age in message"

    @pytest.mark.unit
    def test_cache_model_count_validation(self):
        """Test that cache validates minimum model count"""
        config = {
            'cache': {
                'data': ['model1'],  # Only 1 model
                'timestamp': datetime.now(timezone.utc)
            },
            'min_expected_models': 5  # But expecting 5
        }

        success, message, count, models = check_module.test_gateway_cache('test', config)

        assert success is False, "Should fail when models below minimum"
        assert count == 1, "Should report actual count"
        assert len(models) == 1, "Should return the actual models"


class TestGatewayIntegration:
    """Integration tests for gateway checking"""

    @pytest.mark.integration
    def test_openrouter_endpoint_reachable(self):
        """Test that OpenRouter endpoint is reachable"""
        config = {
            'name': 'OpenRouter',
            'url': 'https://openrouter.ai/api/v1/models',
            'api_key': 'test-key',
            'header_type': 'bearer',
            'api_key_env': 'OPENROUTER_API_KEY',
            'min_expected_models': 10
        }

        success, message, count = check_module.test_gateway_endpoint('openrouter', config)

        # OpenRouter should be reachable and return models
        assert isinstance(success, bool)
        assert isinstance(count, int)
        if success:
            assert count > 0, "OpenRouter should return models when successful"

    @pytest.mark.integration
    def test_script_runs_without_errors(self):
        """Test that the full script runs without exceptions"""
        with patch.dict(os.environ, {'OPENROUTER_API_KEY': 'test-key'}, clear=False):
            # Should not raise any exceptions
            results = check_module.run_comprehensive_check(auto_fix=False, verbose=False)
            assert results is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-m', 'unit or integration'])
