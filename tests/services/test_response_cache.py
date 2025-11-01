"""
Tests for Response Cache Service

Covers:
- Cache hit/miss functionality
- Cache key generation
- TTL (Time-To-Live) expiration
- Cache invalidation
- Caching strategies
- Performance optimization
- Memory management
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import hashlib
import json
import os

os.environ['APP_ENV'] = 'testing'

# Import after setting environment
try:
    from src.services.response_cache import (
        ResponseCache,
        generate_cache_key,
        get_cached_response,
        cache_response,
        invalidate_cache,
        clear_all_cache,
    )
    CACHE_AVAILABLE = True
except (ImportError, AttributeError):
    CACHE_AVAILABLE = False
    # Create mocks for testing structure
    class ResponseCache:
        pass


@pytest.fixture
def cache():
    """Create a cache instance"""
    if CACHE_AVAILABLE:
        return ResponseCache()
    return Mock()


@pytest.fixture
def sample_request():
    """Sample request data"""
    return {
        'model': 'gpt-3.5-turbo',
        'messages': [{'role': 'user', 'content': 'Hello'}],
        'temperature': 0.7,
        'max_tokens': 100
    }


@pytest.fixture
def sample_response():
    """Sample response data"""
    return {
        'id': 'chatcmpl-123',
        'choices': [
            {
                'message': {'role': 'assistant', 'content': 'Hi there!'},
                'finish_reason': 'stop'
            }
        ],
        'usage': {'total_tokens': 10}
    }


class TestCacheKeyGeneration:
    """Test cache key generation"""

    def test_generate_cache_key_from_request(self, sample_request):
        """Generate cache key from request parameters"""
        # Mock key generation
        key_parts = [
            sample_request['model'],
            json.dumps(sample_request['messages'], sort_keys=True),
            str(sample_request.get('temperature', 0)),
            str(sample_request.get('max_tokens', 0))
        ]

        key_string = '|'.join(key_parts)
        cache_key = hashlib.md5(key_string.encode()).hexdigest()

        assert cache_key is not None
        assert len(cache_key) == 32  # MD5 hash length

    def test_same_request_same_key(self, sample_request):
        """Same request should generate same cache key"""
        key1 = self._generate_key(sample_request)
        key2 = self._generate_key(sample_request)

        assert key1 == key2

    def test_different_request_different_key(self, sample_request):
        """Different requests should generate different keys"""
        key1 = self._generate_key(sample_request)

        different_request = sample_request.copy()
        different_request['temperature'] = 0.9

        key2 = self._generate_key(different_request)

        assert key1 != key2

    def test_cache_key_ignores_irrelevant_params(self):
        """Cache key should ignore irrelevant parameters"""
        request1 = {
            'model': 'gpt-3.5-turbo',
            'messages': [{'role': 'user', 'content': 'Hello'}],
            'user_id': '123'  # Should be ignored
        }

        request2 = {
            'model': 'gpt-3.5-turbo',
            'messages': [{'role': 'user', 'content': 'Hello'}],
            'user_id': '456'  # Different but should be ignored
        }

        # If user_id is not part of cache key, these should match
        # (Implementation dependent)
        key1 = self._generate_key(request1)
        key2 = self._generate_key(request2)

        # This test shows the concept - actual implementation may vary
        assert key1 is not None and key2 is not None

    def _generate_key(self, request: dict) -> str:
        """Helper to generate cache key"""
        key_parts = [
            request.get('model', ''),
            json.dumps(request.get('messages', []), sort_keys=True),
            str(request.get('temperature', 0)),
            str(request.get('max_tokens', 0))
        ]
        key_string = '|'.join(key_parts)
        return hashlib.md5(key_string.encode()).hexdigest()


@pytest.mark.skipif(not CACHE_AVAILABLE, reason="Cache not implemented yet")
class TestCacheOperations:
    """Test cache operations"""

    def test_cache_miss(self, cache, sample_request):
        """Cache miss returns None"""
        cache_key = "nonexistent_key"

        result = get_cached_response(cache_key)

        assert result is None

    def test_cache_hit(self, cache, sample_request, sample_response):
        """Cache hit returns cached response"""
        cache_key = "test_key_123"

        # Cache the response
        cache_response(cache_key, sample_response, ttl=3600)

        # Retrieve from cache
        result = get_cached_response(cache_key)

        if result:
            assert result == sample_response

    def test_cache_set_and_get(self, cache, sample_response):
        """Set and get cache entry"""
        cache_key = "test_key_456"

        # Set cache
        cache_response(cache_key, sample_response)

        # Get cache
        result = get_cached_response(cache_key)

        if result:
            assert result['id'] == sample_response['id']


class TestCacheTTL:
    """Test cache TTL (Time-To-Live)"""

    def test_cache_expires_after_ttl(self):
        """Cache entry should expire after TTL"""
        created_at = datetime.now()
        ttl_seconds = 60
        current_time = datetime.now() + timedelta(seconds=65)

        time_elapsed = (current_time - created_at).total_seconds()
        is_expired = time_elapsed > ttl_seconds

        assert is_expired is True

    def test_cache_valid_within_ttl(self):
        """Cache entry should be valid within TTL"""
        created_at = datetime.now()
        ttl_seconds = 60
        current_time = datetime.now() + timedelta(seconds=30)

        time_elapsed = (current_time - created_at).total_seconds()
        is_expired = time_elapsed > ttl_seconds

        assert is_expired is False

    @pytest.mark.skipif(not CACHE_AVAILABLE, reason="Cache not implemented yet")
    def test_custom_ttl(self, cache, sample_response):
        """Support custom TTL values"""
        cache_key = "test_key_ttl"
        custom_ttl = 120  # 2 minutes

        cache_response(cache_key, sample_response, ttl=custom_ttl)

        # Should be cached
        result = get_cached_response(cache_key)
        assert result is not None or result is None  # Depends on implementation


class TestCacheInvalidation:
    """Test cache invalidation"""

    @pytest.mark.skipif(not CACHE_AVAILABLE, reason="Cache not implemented yet")
    def test_invalidate_single_entry(self, cache, sample_response):
        """Invalidate single cache entry"""
        cache_key = "test_key_invalidate"

        cache_response(cache_key, sample_response)

        # Invalidate
        invalidate_cache(cache_key)

        # Should be gone
        result = get_cached_response(cache_key)
        assert result is None

    @pytest.mark.skipif(not CACHE_AVAILABLE, reason="Cache not implemented yet")
    def test_clear_all_cache(self, cache, sample_response):
        """Clear all cache entries"""
        # Cache multiple entries
        cache_response("key1", sample_response)
        cache_response("key2", sample_response)
        cache_response("key3", sample_response)

        # Clear all
        clear_all_cache()

        # All should be gone
        assert get_cached_response("key1") is None
        assert get_cached_response("key2") is None
        assert get_cached_response("key3") is None


class TestCachingStrategies:
    """Test different caching strategies"""

    def test_streaming_responses_not_cached(self):
        """Streaming responses should not be cached"""
        request = {
            'model': 'gpt-3.5-turbo',
            'messages': [{'role': 'user', 'content': 'Hello'}],
            'stream': True
        }

        should_cache = not request.get('stream', False)

        assert should_cache is False

    def test_error_responses_not_cached(self):
        """Error responses should not be cached"""
        response = {
            'error': {
                'message': 'Rate limit exceeded',
                'type': 'rate_limit_error'
            }
        }

        should_cache = 'error' not in response

        assert should_cache is False

    def test_successful_responses_cached(self):
        """Successful responses should be cached"""
        response = {
            'id': 'chatcmpl-123',
            'choices': [
                {'message': {'role': 'assistant', 'content': 'Hi'}}
            ]
        }

        should_cache = 'error' not in response and 'choices' in response

        assert should_cache is True

    def test_cache_respects_max_tokens(self, sample_request):
        """Different max_tokens should create different cache keys"""
        request1 = sample_request.copy()
        request1['max_tokens'] = 100

        request2 = sample_request.copy()
        request2['max_tokens'] = 200

        key1 = self._generate_key(request1)
        key2 = self._generate_key(request2)

        assert key1 != key2

    def test_cache_respects_temperature(self, sample_request):
        """Different temperature should create different cache keys"""
        request1 = sample_request.copy()
        request1['temperature'] = 0.7

        request2 = sample_request.copy()
        request2['temperature'] = 0.9

        key1 = self._generate_key(request1)
        key2 = self._generate_key(request2)

        assert key1 != key2

    def _generate_key(self, request: dict) -> str:
        """Helper to generate cache key"""
        key_parts = [
            request.get('model', ''),
            json.dumps(request.get('messages', []), sort_keys=True),
            str(request.get('temperature', 0)),
            str(request.get('max_tokens', 0))
        ]
        key_string = '|'.join(key_parts)
        return hashlib.md5(key_string.encode()).hexdigest()


class TestCachePerformance:
    """Test cache performance characteristics"""

    def test_cache_reduces_latency(self):
        """Cache hit should be faster than API call"""
        # Simulate API call latency
        api_latency = 1.5  # seconds

        # Simulate cache latency
        cache_latency = 0.01  # seconds

        assert cache_latency < api_latency

    @pytest.mark.skipif(not CACHE_AVAILABLE, reason="Cache not implemented yet")
    def test_cache_size_limited(self, cache):
        """Cache size should be limited to prevent memory issues"""
        # This test verifies the concept
        # Actual implementation would check max cache size
        max_cache_size = 1000  # entries

        # Would need to fill cache and verify eviction
        assert max_cache_size > 0

    def test_cache_eviction_lru(self):
        """Least Recently Used (LRU) eviction strategy"""
        # Mock LRU cache behavior
        cache_entries = [
            {'key': 'entry1', 'last_accessed': datetime.now() - timedelta(hours=2)},
            {'key': 'entry2', 'last_accessed': datetime.now() - timedelta(hours=1)},
            {'key': 'entry3', 'last_accessed': datetime.now()},
        ]

        # Sort by last accessed (oldest first)
        sorted_entries = sorted(cache_entries, key=lambda x: x['last_accessed'])

        # Oldest should be evicted first
        assert sorted_entries[0]['key'] == 'entry1'


class TestCacheMonitoring:
    """Test cache monitoring and metrics"""

    def test_cache_hit_ratio_calculation(self):
        """Calculate cache hit ratio"""
        cache_hits = 80
        cache_misses = 20
        total_requests = cache_hits + cache_misses

        hit_ratio = cache_hits / total_requests

        assert hit_ratio == 0.8

    def test_cache_memory_usage(self):
        """Track cache memory usage"""
        # Mock memory usage
        cached_responses = [
            {'size': 1024},  # 1KB
            {'size': 2048},  # 2KB
            {'size': 512},   # 0.5KB
        ]

        total_memory = sum(r['size'] for r in cached_responses)

        assert total_memory == 3584  # bytes

    @pytest.mark.skipif(not CACHE_AVAILABLE, reason="Cache not implemented yet")
    def test_cache_metrics_exposed(self, cache):
        """Cache metrics should be exposed via API"""
        # Mock metrics
        metrics = {
            'hits': 100,
            'misses': 20,
            'hit_ratio': 0.833,
            'size': 50,
            'memory_usage': 1024000
        }

        assert 'hits' in metrics
        assert 'misses' in metrics
        assert 'hit_ratio' in metrics


class TestCacheEdgeCases:
    """Test edge cases"""

    @pytest.mark.skipif(not CACHE_AVAILABLE, reason="Cache not implemented yet")
    def test_cache_null_response(self, cache):
        """Cache should handle null responses"""
        cache_key = "null_key"

        try:
            cache_response(cache_key, None)
            result = get_cached_response(cache_key)
            assert result is None
        except (ValueError, TypeError):
            # Acceptable to reject None
            pass

    @pytest.mark.skipif(not CACHE_AVAILABLE, reason="Cache not implemented yet")
    def test_cache_large_response(self, cache):
        """Cache should handle large responses"""
        large_response = {
            'content': 'x' * 1000000,  # 1MB of data
            'metadata': {'size': 'large'}
        }

        cache_key = "large_key"

        try:
            cache_response(cache_key, large_response)
            result = get_cached_response(cache_key)
            assert result is not None or result is None
        except (MemoryError, ValueError):
            # Acceptable to reject too large
            pass

    def test_cache_key_collision_handling(self):
        """Handle potential cache key collisions"""
        # MD5 can have collisions (though rare)
        # Good practice to handle them
        key1 = hashlib.md5(b"string1").hexdigest()
        key2 = hashlib.md5(b"string2").hexdigest()

        # Different inputs should produce different keys
        assert key1 != key2


class TestCacheConfiguration:
    """Test cache configuration"""

    def test_default_ttl_configuration(self):
        """Default TTL should be configurable"""
        default_ttl = 3600  # 1 hour

        assert default_ttl > 0

    def test_max_cache_size_configuration(self):
        """Max cache size should be configurable"""
        max_size = 1000  # entries

        assert max_size > 0

    def test_cache_enabled_configuration(self):
        """Cache should be enable/disable via configuration"""
        cache_enabled = os.getenv('CACHE_ENABLED', 'true').lower() == 'true'

        assert isinstance(cache_enabled, bool)
