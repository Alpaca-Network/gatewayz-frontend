"""Comprehensive unit tests for the cache module

Tests cover all cache management functions including:
- Cache initialization and retrieval by gateway
- Cache expiration (fresh, stale, revalidation)
- Cache clearing and reset operations
- Cache state management
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import src.cache as cache_module


class TestCacheInitialization:
    """Test cache structure and initialization"""

    def test_models_cache_initialized(self):
        """Test that models cache is properly initialized"""
        assert cache_module._models_cache is not None
        assert cache_module._models_cache["data"] is None
        assert cache_module._models_cache["timestamp"] is None
        assert cache_module._models_cache["ttl"] == 3600
        assert cache_module._models_cache["stale_ttl"] == 7200

    def test_portkey_models_cache_initialized(self):
        """Test Portkey models cache initialization with correct TTL"""
        assert cache_module._portkey_models_cache is not None
        assert cache_module._portkey_models_cache["data"] is None
        assert cache_module._portkey_models_cache["ttl"] == 1800
        assert cache_module._portkey_models_cache["stale_ttl"] == 3600

    def test_provider_cache_initialized(self):
        """Test provider cache is properly initialized"""
        assert cache_module._provider_cache is not None
        assert cache_module._provider_cache["data"] is None
        assert cache_module._provider_cache["timestamp"] is None

    def test_all_gateway_caches_exist(self):
        """Test all gateway-specific caches are initialized"""
        expected_gateways = [
            "openrouter", "portkey", "featherless", "deepinfra",
            "chutes", "groq", "fireworks", "together",
            "google-vertex", "cerebras", "nebius", "xai",
            "novita", "huggingface", "aimo", "near",
            "fal", "vercel-ai-gateway", "aihubmix", "anannas", "modelz"
        ]

        for gateway in expected_gateways:
            cache = cache_module.get_models_cache(gateway)
            assert cache is not None, f"Cache missing for gateway: {gateway}"
            assert isinstance(cache, dict)
            assert "data" in cache
            assert "timestamp" in cache
            assert "ttl" in cache


class TestGetModelsCacheByGateway:
    """Test get_models_cache function with various gateways"""

    def test_get_models_cache_openrouter(self):
        """Test retrieving OpenRouter cache"""
        cache = cache_module.get_models_cache("openrouter")
        assert cache is cache_module._models_cache

    def test_get_models_cache_portkey(self):
        """Test retrieving Portkey cache"""
        cache = cache_module.get_models_cache("portkey")
        assert cache is cache_module._portkey_models_cache
        assert cache["ttl"] == 1800

    def test_get_models_cache_featherless(self):
        """Test retrieving Featherless cache"""
        cache = cache_module.get_models_cache("featherless")
        assert cache is cache_module._featherless_models_cache

    def test_get_models_cache_google_vertex(self):
        """Test retrieving Google Vertex AI cache"""
        cache = cache_module.get_models_cache("google-vertex")
        assert cache is cache_module._google_vertex_models_cache

    def test_get_models_cache_case_insensitive(self):
        """Test that gateway name is case insensitive"""
        cache_lower = cache_module.get_models_cache("openrouter")
        cache_upper = cache_module.get_models_cache("OPENROUTER")
        assert cache_lower is cache_upper

    def test_get_models_cache_mixed_case(self):
        """Test mixed case gateway names"""
        cache = cache_module.get_models_cache("Google-Vertex")
        assert cache is cache_module._google_vertex_models_cache

    def test_get_models_cache_invalid_gateway(self):
        """Test requesting cache for non-existent gateway"""
        cache = cache_module.get_models_cache("invalid-gateway")
        assert cache is None

    def test_get_models_cache_empty_string(self):
        """Test requesting cache with empty string"""
        cache = cache_module.get_models_cache("")
        assert cache is None

    def test_huggingface_alias_compatibility(self):
        """Test backward compatibility with 'hug' alias"""
        hug_cache = cache_module.get_models_cache("hug")
        huggingface_cache = cache_module.get_models_cache("huggingface")
        assert hug_cache is huggingface_cache
        assert hug_cache is cache_module._huggingface_models_cache


class TestGetProvidersCacheFunction:
    """Test get_providers_cache function"""

    def test_get_providers_cache(self):
        """Test retrieving providers cache"""
        cache = cache_module.get_providers_cache()
        assert cache is cache_module._provider_cache

    def test_providers_cache_structure(self):
        """Test providers cache has correct structure"""
        cache = cache_module.get_providers_cache()
        assert "data" in cache
        assert "timestamp" in cache
        assert "ttl" in cache
        assert "stale_ttl" in cache


class TestClearModelsCacheFunction:
    """Test clear_models_cache function"""

    def test_clear_models_cache_openrouter(self):
        """Test clearing OpenRouter cache"""
        # Set up cache with data
        cache_module._models_cache["data"] = {"model": "data"}
        cache_module._models_cache["timestamp"] = datetime.now(timezone.utc)

        # Clear cache
        cache_module.clear_models_cache("openrouter")

        # Verify cleared
        assert cache_module._models_cache["data"] is None
        assert cache_module._models_cache["timestamp"] is None

    def test_clear_models_cache_portkey(self):
        """Test clearing Portkey cache"""
        cache_module._portkey_models_cache["data"] = {"models": []}
        cache_module._portkey_models_cache["timestamp"] = datetime.now(timezone.utc)

        cache_module.clear_models_cache("portkey")

        assert cache_module._portkey_models_cache["data"] is None
        assert cache_module._portkey_models_cache["timestamp"] is None

    def test_clear_models_cache_case_insensitive(self):
        """Test cache clearing is case insensitive"""
        cache_module._models_cache["data"] = {"test": "data"}
        cache_module._models_cache["timestamp"] = datetime.now(timezone.utc)

        cache_module.clear_models_cache("OPENROUTER")

        assert cache_module._models_cache["data"] is None

    def test_clear_models_cache_invalid_gateway(self):
        """Test clearing cache for non-existent gateway (should be no-op)"""
        # This should not raise an error
        cache_module.clear_models_cache("invalid-gateway-xyz")
        # Verify no errors occurred

    def test_clear_all_gateway_caches(self):
        """Test clearing all gateway caches"""
        gateways = [
            "openrouter", "portkey", "featherless", "google-vertex",
            "cerebras", "xai", "huggingface", "vercel-ai-gateway"
        ]

        # Populate all caches
        for gateway in gateways:
            cache = cache_module.get_models_cache(gateway)
            if cache:
                cache["data"] = {"test": "data"}
                cache["timestamp"] = datetime.now(timezone.utc)

        # Clear all
        for gateway in gateways:
            cache_module.clear_models_cache(gateway)

        # Verify all cleared
        for gateway in gateways:
            cache = cache_module.get_models_cache(gateway)
            if cache:
                assert cache["data"] is None
                assert cache["timestamp"] is None


class TestClearProvidersCacheFunction:
    """Test clear_providers_cache function"""

    def test_clear_providers_cache(self):
        """Test clearing providers cache"""
        # Set up cache
        cache_module._provider_cache["data"] = {"providers": ["openrouter"]}
        cache_module._provider_cache["timestamp"] = datetime.now(timezone.utc)

        # Clear cache
        cache_module.clear_providers_cache()

        # Verify cleared
        assert cache_module._provider_cache["data"] is None
        assert cache_module._provider_cache["timestamp"] is None

    def test_clear_providers_cache_idempotent(self):
        """Test clearing already-empty providers cache"""
        cache_module.clear_providers_cache()
        cache_module.clear_providers_cache()
        # Should not raise any errors


class TestModelzCacheFunctions:
    """Test Modelz-specific cache functions"""

    def test_get_modelz_cache(self):
        """Test getting Modelz cache"""
        cache = cache_module.get_modelz_cache()
        assert cache is cache_module._modelz_cache

    def test_modelz_cache_structure(self):
        """Test Modelz cache has correct structure"""
        cache = cache_module.get_modelz_cache()
        assert "data" in cache
        assert "timestamp" in cache
        assert "ttl" in cache
        assert cache["ttl"] == 1800  # 30 minute TTL

    def test_clear_modelz_cache(self):
        """Test clearing Modelz cache"""
        cache_module._modelz_cache["data"] = {"token": "data"}
        cache_module._modelz_cache["timestamp"] = datetime.now(timezone.utc)

        cache_module.clear_modelz_cache()

        assert cache_module._modelz_cache["data"] is None
        assert cache_module._modelz_cache["timestamp"] is None


class TestCacheFreshness:
    """Test is_cache_fresh function"""

    def test_cache_fresh_with_valid_timestamp(self):
        """Test cache is fresh when within TTL"""
        cache = {
            "data": {"model": "test"},
            "timestamp": datetime.now(timezone.utc),
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_fresh(cache) is True

    def test_cache_not_fresh_expired(self):
        """Test cache is not fresh when TTL exceeded"""
        # Set timestamp to 2 hours ago
        old_time = datetime.now(timezone.utc) - timedelta(hours=2)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_fresh(cache) is False

    def test_cache_fresh_with_none_data(self):
        """Test cache is fresh when data is None but timestamp is valid
        
        Note: With the fix, we only check timestamp, not data value.
        Empty lists [] are valid cached values representing "no models found".
        """
        cache = {
            "data": None,
            "timestamp": datetime.now(timezone.utc),
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_fresh(cache) is True

    def test_cache_fresh_with_empty_list(self):
        """Test cache is fresh when data is empty list [] (valid cached value)"""
        cache = {
            "data": [],
            "timestamp": datetime.now(timezone.utc),
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_fresh(cache) is True

    def test_cache_not_fresh_no_timestamp(self):
        """Test cache is not fresh when timestamp is None"""
        cache = {
            "data": {"model": "test"},
            "timestamp": None,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_fresh(cache) is False

    def test_cache_not_fresh_empty_data(self):
        """Test cache with empty dict is still fresh if timestamp valid"""
        cache = {
            "data": {},
            "timestamp": datetime.now(timezone.utc),
            "ttl": 3600,
            "stale_ttl": 7200
        }

        # Empty dict is truthy for freshness check
        assert cache_module.is_cache_fresh(cache) is True

    def test_cache_fresh_with_custom_ttl(self):
        """Test cache freshness with custom TTL value"""
        cache = {
            "data": {"model": "test"},
            "timestamp": datetime.now(timezone.utc),
            "ttl": 600,  # 10 minutes
            "stale_ttl": 1200
        }

        assert cache_module.is_cache_fresh(cache) is True

    def test_cache_freshness_boundary_condition(self):
        """Test cache at TTL boundary (just expired)"""
        # Set timestamp to exactly TTL seconds ago + 1 second
        old_time = datetime.now(timezone.utc) - timedelta(seconds=3601)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_fresh(cache) is False


class TestCacheStaleness:
    """Test is_cache_stale_but_usable function"""

    def test_cache_stale_but_usable(self):
        """Test cache is usable in stale window"""
        # Set timestamp to 90 minutes ago (between TTL and stale_ttl)
        old_time = datetime.now(timezone.utc) - timedelta(minutes=90)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 3600,  # 1 hour
            "stale_ttl": 7200  # 2 hours
        }

        assert cache_module.is_cache_stale_but_usable(cache) is True

    def test_cache_fresh_not_stale(self):
        """Test fresh cache is not considered stale"""
        cache = {
            "data": {"model": "test"},
            "timestamp": datetime.now(timezone.utc),
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_stale_but_usable(cache) is False

    def test_cache_expired_beyond_stale_window(self):
        """Test cache beyond stale window is not usable"""
        # Set timestamp to 3 hours ago (beyond stale_ttl)
        old_time = datetime.now(timezone.utc) - timedelta(hours=3)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_stale_but_usable(cache) is False

    def test_cache_stale_with_none_data(self):
        """Test stale check with None data but valid timestamp
        
        Note: With the fix, we only check timestamp, not data value.
        Empty lists [] are valid cached values representing "no models found".
        """
        cache = {
            "data": None,
            "timestamp": datetime.now(timezone.utc),
            "ttl": 3600,
            "stale_ttl": 7200
        }

        # Cache is fresh (not stale) when timestamp is recent
        assert cache_module.is_cache_stale_but_usable(cache) is False

    def test_cache_stale_with_empty_list(self):
        """Test stale check with empty list [] (valid cached value)"""
        # Set timestamp to 90 minutes ago (between TTL and stale_ttl)
        old_time = datetime.now(timezone.utc) - timedelta(minutes=90)
        cache = {
            "data": [],
            "timestamp": old_time,
            "ttl": 3600,  # 1 hour
            "stale_ttl": 7200  # 2 hours
        }

        assert cache_module.is_cache_stale_but_usable(cache) is True

    def test_cache_stale_no_timestamp(self):
        """Test stale check with no timestamp"""
        cache = {
            "data": {"model": "test"},
            "timestamp": None,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_stale_but_usable(cache) is False

    def test_cache_stale_custom_ttl(self):
        """Test stale window with custom TTL"""
        # 35 minutes ago with 30 min TTL and 60 min stale (stale but usable)
        old_time = datetime.now(timezone.utc) - timedelta(minutes=35)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 1800,  # 30 minutes
            "stale_ttl": 3600  # 60 minutes
        }

        assert cache_module.is_cache_stale_but_usable(cache) is True

    def test_cache_stale_boundary_ttl(self):
        """Test at TTL boundary (just became stale)"""
        # Set timestamp to exactly TTL seconds ago
        old_time = datetime.now(timezone.utc) - timedelta(seconds=3600)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_stale_but_usable(cache) is True

    def test_cache_stale_boundary_stale_ttl(self):
        """Test at stale_ttl boundary (just expired from stale window)"""
        # Set timestamp to exactly stale_ttl seconds ago
        old_time = datetime.now(timezone.utc) - timedelta(seconds=7200)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.is_cache_stale_but_usable(cache) is False


class TestShouldRevalidateInBackground:
    """Test should_revalidate_in_background function"""

    def test_should_revalidate_stale_but_usable(self):
        """Test revalidation needed for stale but usable cache"""
        # Set timestamp to 90 minutes ago
        old_time = datetime.now(timezone.utc) - timedelta(minutes=90)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.should_revalidate_in_background(cache) is True

    def test_should_not_revalidate_fresh_cache(self):
        """Test no revalidation needed for fresh cache"""
        cache = {
            "data": {"model": "test"},
            "timestamp": datetime.now(timezone.utc),
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.should_revalidate_in_background(cache) is False

    def test_should_not_revalidate_expired_cache(self):
        """Test no revalidation for cache beyond stale window"""
        old_time = datetime.now(timezone.utc) - timedelta(hours=3)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.should_revalidate_in_background(cache) is False

    def test_should_revalidate_no_data(self):
        """Test revalidation flag for cache with no data"""
        cache = {
            "data": None,
            "timestamp": None,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        assert cache_module.should_revalidate_in_background(cache) is False

    def test_should_revalidate_logic_combination(self):
        """Test revalidation logic (not fresh AND stale usable)"""
        # Just past TTL but within stale window
        old_time = datetime.now(timezone.utc) - timedelta(minutes=65)
        cache = {
            "data": {"model": "test"},
            "timestamp": old_time,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        # Should trigger revalidation
        is_fresh = cache_module.is_cache_fresh(cache)
        is_stale_usable = cache_module.is_cache_stale_but_usable(cache)
        should_revalidate = cache_module.should_revalidate_in_background(cache)

        assert is_fresh is False
        assert is_stale_usable is True
        assert should_revalidate is True


class TestInitializeFalCache:
    """Test initialize_fal_cache_from_catalog function"""

    @patch('src.services.fal_image_client.load_fal_models_catalog')
    def test_initialize_fal_cache_success(self, mock_load_catalog):
        """Test successful FAL cache initialization"""
        mock_models = [
            {"id": "fal-ai/flux-pro", "name": "Flux Pro"},
            {"id": "fal-ai/flux-realism", "name": "Flux Realism"}
        ]
        mock_load_catalog.return_value = mock_models

        # Clear cache first
        cache_module._fal_models_cache["data"] = None
        cache_module._fal_models_cache["timestamp"] = None

        # Initialize
        cache_module.initialize_fal_cache_from_catalog()

        # Verify cache populated
        assert cache_module._fal_models_cache["data"] == mock_models
        assert cache_module._fal_models_cache["timestamp"] is not None

    @patch('src.services.fal_image_client.load_fal_models_catalog')
    def test_initialize_fal_cache_empty_catalog(self, mock_load_catalog):
        """Test FAL cache initialization with empty catalog"""
        mock_load_catalog.return_value = []

        cache_module._fal_models_cache["data"] = None
        cache_module._fal_models_cache["timestamp"] = None

        cache_module.initialize_fal_cache_from_catalog()

        # Cache should remain empty
        assert cache_module._fal_models_cache["data"] is None

    @patch('src.services.fal_image_client.load_fal_models_catalog')
    def test_initialize_fal_cache_import_error(self, mock_load_catalog):
        """Test FAL cache initialization with import error"""
        mock_load_catalog.side_effect = ImportError("Module not found")

        cache_module._fal_models_cache["data"] = None
        cache_module._fal_models_cache["timestamp"] = None

        # Should handle error gracefully
        cache_module.initialize_fal_cache_from_catalog()

        # Cache should remain None
        assert cache_module._fal_models_cache["data"] is None

    @patch('src.services.fal_image_client.load_fal_models_catalog')
    def test_initialize_fal_cache_os_error(self, mock_load_catalog):
        """Test FAL cache initialization with OS error"""
        mock_load_catalog.side_effect = OSError("File not found")

        cache_module._fal_models_cache["data"] = None
        cache_module._fal_models_cache["timestamp"] = None

        # Should handle error gracefully
        cache_module.initialize_fal_cache_from_catalog()

        assert cache_module._fal_models_cache["data"] is None

    @patch('src.services.fal_image_client.load_fal_models_catalog')
    def test_initialize_fal_cache_timestamp_set(self, mock_load_catalog):
        """Test that FAL cache timestamp is set on successful init"""
        mock_models = [{"id": "fal-ai/test"}]
        mock_load_catalog.return_value = mock_models

        cache_module._fal_models_cache["data"] = None
        cache_module._fal_models_cache["timestamp"] = None

        before = datetime.now(timezone.utc)
        cache_module.initialize_fal_cache_from_catalog()
        after = datetime.now(timezone.utc)

        timestamp = cache_module._fal_models_cache["timestamp"]
        assert timestamp is not None
        assert before <= timestamp <= after


class TestCacheIntegration:
    """Integration tests for cache module functions"""

    def test_full_cache_lifecycle(self):
        """Test complete cache lifecycle: init, populate, check, clear"""
        # Start fresh
        cache_module._models_cache["data"] = None
        cache_module._models_cache["timestamp"] = None

        # Populate
        cache_module._models_cache["data"] = [{"id": "model1"}]
        cache_module._models_cache["timestamp"] = datetime.now(timezone.utc)

        # Check fresh
        assert cache_module.is_cache_fresh(cache_module._models_cache) is True

        # Clear
        cache_module.clear_models_cache("openrouter")

        # Verify cleared
        assert cache_module._models_cache["data"] is None
        assert cache_module._models_cache["timestamp"] is None

    def test_multiple_gateway_cache_independence(self):
        """Test that clearing one gateway doesn't affect others"""
        # Populate both caches
        cache_module._models_cache["data"] = ["openrouter_model"]
        cache_module._models_cache["timestamp"] = datetime.now(timezone.utc)

        cache_module._portkey_models_cache["data"] = ["portkey_model"]
        cache_module._portkey_models_cache["timestamp"] = datetime.now(timezone.utc)

        # Clear only openrouter
        cache_module.clear_models_cache("openrouter")

        # Verify openrouter cleared
        assert cache_module._models_cache["data"] is None

        # Verify portkey intact
        assert cache_module._portkey_models_cache["data"] == ["portkey_model"]

        # Cleanup
        cache_module.clear_models_cache("portkey")

    def test_cache_freshness_state_transitions(self):
        """Test cache transitions from fresh to stale to expired"""
        cache = {
            "data": {"models": []},
            "timestamp": None,
            "ttl": 3600,
            "stale_ttl": 7200
        }

        # Fresh state
        cache["timestamp"] = datetime.now(timezone.utc)
        assert cache_module.is_cache_fresh(cache) is True
        assert cache_module.is_cache_stale_but_usable(cache) is False

        # Stale but usable state
        cache["timestamp"] = datetime.now(timezone.utc) - timedelta(minutes=90)
        assert cache_module.is_cache_fresh(cache) is False
        assert cache_module.is_cache_stale_but_usable(cache) is True
        assert cache_module.should_revalidate_in_background(cache) is True

        # Expired state
        cache["timestamp"] = datetime.now(timezone.utc) - timedelta(hours=3)
        assert cache_module.is_cache_fresh(cache) is False
        assert cache_module.is_cache_stale_but_usable(cache) is False
        assert cache_module.should_revalidate_in_background(cache) is False

    def test_cache_ttl_variations(self):
        """Test caches with different TTL configurations"""
        short_ttl_cache = {
            "data": {"test": "data"},
            "timestamp": datetime.now(timezone.utc) - timedelta(minutes=16),
            "ttl": 900,  # 15 minutes
            "stale_ttl": 1800
        }

        long_ttl_cache = {
            "data": {"test": "data"},
            "timestamp": datetime.now(timezone.utc) - timedelta(minutes=16),
            "ttl": 3600,  # 1 hour
            "stale_ttl": 7200
        }

        # Short TTL cache should be stale
        assert cache_module.is_cache_fresh(short_ttl_cache) is False
        assert cache_module.is_cache_stale_but_usable(short_ttl_cache) is True

        # Long TTL cache should be fresh
        assert cache_module.is_cache_fresh(long_ttl_cache) is True
        assert cache_module.is_cache_stale_but_usable(long_ttl_cache) is False
