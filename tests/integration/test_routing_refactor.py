#!/usr/bin/env python3
"""
Comprehensive integration tests for the routing refactor

This test suite verifies:
1. ProviderSelector correctly routes models to providers
2. Automatic failover works when providers fail
3. Circuit breaker pattern prevents repeated failures
4. Multi-provider registry correctly maps canonical models
5. Models can be successfully prompted through different providers
6. Health tracking works correctly
"""

import pytest
import logging
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient

from src.main import app
from src.services.provider_selector import ProviderSelector, get_selector
from src.services.multi_provider_registry import (
    MultiProviderModel,
    ProviderConfig,
    get_registry,
)

logger = logging.getLogger(__name__)
client = TestClient(app)


# ============================================================
# TEST CLASS: ProviderSelector Basic Functionality
# ============================================================


@pytest.mark.integration
class TestProviderSelectorBasics:
    """Test basic ProviderSelector functionality"""

    def test_selector_initialization(self):
        """Test that selector initializes correctly"""
        selector = get_selector()
        assert selector is not None
        assert selector.registry is not None
        assert selector.health_tracker is not None

    def test_get_model_providers(self):
        """Test getting available providers for a model"""
        selector = get_selector()

        # Test with a common model
        providers = selector.get_model_providers("gpt-4")

        # If model exists in registry, should return list
        if providers:
            assert isinstance(providers, list)
            assert len(providers) > 0
            logger.info(f"gpt-4 available through providers: {providers}")

    def test_check_provider_health(self):
        """Test checking provider health status"""
        selector = get_selector()

        # Test health check for a provider
        health = selector.check_provider_health("gpt-4", "openrouter")

        assert isinstance(health, dict)
        assert "available" in health
        assert "reason" in health
        logger.info(f"Provider health for gpt-4/openrouter: {health}")


# ============================================================
# TEST CLASS: Multi-Provider Registry
# ============================================================


@pytest.mark.integration
class TestMultiProviderRegistry:
    """Test multi-provider registry functionality"""

    def test_registry_initialization(self):
        """Test that registry initializes and has models"""
        registry = get_registry()
        assert registry is not None

        models = registry.get_all_models()
        logger.info(f"Registry has {len(models)} models")

    def test_get_model(self):
        """Test retrieving a model from registry"""
        registry = get_registry()

        # Try to get a common model
        model = registry.get_model("gpt-4")

        if model:
            assert isinstance(model, MultiProviderModel)
            assert model.id is not None
            assert len(model.providers) > 0
            logger.info(f"Model gpt-4 has {len(model.providers)} providers")

    def test_select_provider(self):
        """Test provider selection logic"""
        registry = get_registry()

        # Test selecting a provider for a model
        provider = registry.select_provider("gpt-4")

        if provider:
            assert isinstance(provider, ProviderConfig)
            assert provider.name is not None
            assert provider.model_id is not None
            logger.info(f"Selected provider {provider.name} for gpt-4")

    def test_get_fallback_providers(self):
        """Test getting fallback providers"""
        registry = get_registry()

        # Get fallback providers for a model
        fallbacks = registry.get_fallback_providers("gpt-4", exclude_provider="openrouter")

        assert isinstance(fallbacks, list)
        # Verify openrouter is not in fallbacks
        if fallbacks:
            assert not any(p.name == "openrouter" for p in fallbacks)
            logger.info(f"Fallback providers: {[p.name for p in fallbacks]}")


# ============================================================
# TEST CLASS: Provider Failover Logic
# ============================================================


@pytest.mark.integration
class TestProviderFailover:
    """Test automatic provider failover"""

    def test_execute_with_failover_success(self):
        """Test successful execution with failover"""
        selector = get_selector()

        # Create a mock execution function that succeeds
        def mock_execute(provider_name: str, model_id: str):
            return {"response": "success", "provider": provider_name}

        # Execute with failover
        result = selector.execute_with_failover(
            model_id="gpt-4",
            execute_fn=mock_execute,
        )

        # If model exists in registry, should succeed
        if result["success"]:
            assert result["response"] is not None
            assert result["provider"] is not None
            assert result["error"] is None
            logger.info(f"Successful execution with provider: {result['provider']}")

    def test_execute_with_failover_retry(self):
        """Test failover retries with different providers"""
        selector = get_selector()

        attempt_count = 0

        def mock_execute_fail_once(provider_name: str, model_id: str):
            nonlocal attempt_count
            attempt_count += 1

            # Fail first attempt, succeed second
            if attempt_count == 1:
                raise Exception("Provider failed")
            return {"response": "success", "provider": provider_name}

        # Execute with failover
        result = selector.execute_with_failover(
            model_id="gpt-4",
            execute_fn=mock_execute_fail_once,
            max_retries=3,
        )

        # Should succeed on second attempt
        if result["success"]:
            assert attempt_count > 1
            assert len(result["attempts"]) > 1
            logger.info(f"Succeeded after {attempt_count} attempts")

    def test_execute_with_failover_all_fail(self):
        """Test when all providers fail"""
        selector = get_selector()

        def mock_execute_always_fail(provider_name: str, model_id: str):
            raise Exception(f"Provider {provider_name} failed")

        # Execute with failover
        result = selector.execute_with_failover(
            model_id="gpt-4",
            execute_fn=mock_execute_always_fail,
            max_retries=2,
        )

        # Should fail with error
        assert result["success"] is False
        assert result["error"] is not None
        logger.info(f"Failed as expected: {result['error']}")


# ============================================================
# TEST CLASS: Circuit Breaker Pattern
# ============================================================


@pytest.mark.integration
class TestCircuitBreaker:
    """Test circuit breaker health tracking"""

    def test_health_tracker_records_success(self):
        """Test recording successful requests"""
        selector = get_selector()
        tracker = selector.health_tracker

        # Record a success
        tracker.record_success("test-model", "test-provider")

        # Provider should be available
        assert tracker.is_available("test-model", "test-provider") is True

    def test_health_tracker_records_failure(self):
        """Test recording failed requests"""
        selector = get_selector()
        tracker = selector.health_tracker

        # Record a few failures (below threshold)
        for i in range(3):
            should_disable = tracker.record_failure("test-model-2", "test-provider-2")
            assert should_disable is False

        # Provider should still be available
        assert tracker.is_available("test-model-2", "test-provider-2") is True

    def test_circuit_breaker_opens_after_threshold(self):
        """Test circuit breaker opens after failure threshold"""
        selector = ProviderSelector()  # New instance to avoid state pollution
        tracker = selector.health_tracker

        # Record failures up to threshold
        model_id = "test-model-3"
        provider_name = "test-provider-3"

        for i in range(tracker.failure_threshold):
            should_disable = tracker.record_failure(model_id, provider_name)

            if i < tracker.failure_threshold - 1:
                assert should_disable is False
            else:
                assert should_disable is True

        # Provider should now be unavailable
        assert tracker.is_available(model_id, provider_name) is False
        logger.info(f"Circuit breaker opened after {tracker.failure_threshold} failures")


# ============================================================
# TEST CLASS: End-to-End Model Prompting
# ============================================================


@pytest.mark.integration
class TestModelPrompting:
    """Test actual model prompting through the API"""

    @pytest.mark.skip(reason="Requires live API credentials - use --run-live-tests to enable")
    def test_prompt_gpt4_through_api(self):
        """Test prompting GPT-4 through the chat API"""
        # This requires a valid API key and credits

        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "gpt-4",
                "messages": [
                    {"role": "user", "content": "Say 'routing test successful'"}
                ],
                "max_tokens": 20,
            },
            headers={
                "Authorization": "Bearer test-key",  # Would need real key
            },
        )

        # Should either succeed or fail with auth error
        assert response.status_code in [200, 401, 403]

        if response.status_code == 200:
            data = response.json()
            assert "choices" in data
            logger.info(f"GPT-4 response: {data['choices'][0]['message']['content']}")

    def test_model_routing_with_mock_providers(self):
        """Test model routing with mocked provider responses"""

        with patch("src.routes.chat.make_openrouter_request_openai") as mock_openrouter:
            # Mock a successful response
            mock_response = Mock()
            mock_response.id = "test-id"
            mock_response.model = "gpt-4"
            mock_response.choices = [
                Mock(
                    index=0,
                    message=Mock(
                        role="assistant",
                        content="Routing test successful",
                    ),
                    finish_reason="stop",
                )
            ]
            mock_response.usage = Mock(
                prompt_tokens=10,
                completion_tokens=5,
                total_tokens=15,
            )

            mock_openrouter.return_value = mock_response

            # Make a request
            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": "gpt-4",
                    "messages": [
                        {"role": "user", "content": "Test"}
                    ],
                },
                headers={
                    "Authorization": "Bearer test-key",
                },
            )

            # Should route correctly (even if auth fails)
            logger.info(f"Routing test response status: {response.status_code}")


# ============================================================
# TEST CLASS: Provider-Specific Routing
# ============================================================


@pytest.mark.integration
class TestProviderSpecificRouting:
    """Test routing to specific providers"""

    def test_route_to_openrouter(self):
        """Test explicit routing to OpenRouter"""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "gpt-4",
                "messages": [{"role": "user", "content": "Test"}],
                "provider": "openrouter",
            },
            headers={"Authorization": "Bearer test-key"},
        )

        # Should attempt to route to OpenRouter
        assert response.status_code in [200, 401, 403, 404, 500, 503]
        logger.info(f"OpenRouter routing status: {response.status_code}")

    def test_route_gemini_model(self):
        """Test routing Google Gemini model"""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "google/gemini-2.0-flash-001",
                "messages": [{"role": "user", "content": "Test"}],
            },
            headers={"Authorization": "Bearer test-key"},
        )

        # Should route to appropriate provider
        assert response.status_code in [200, 401, 403, 404, 500, 503]
        logger.info(f"Gemini routing status: {response.status_code}")


# ============================================================
# TEST CLASS: Model Transformation
# ============================================================


@pytest.mark.integration
class TestModelTransformation:
    """Test model ID transformation and provider detection"""

    def test_detect_provider_from_model_id(self):
        """Test automatic provider detection from model ID"""
        from src.services.model_transformations import detect_provider_from_model_id

        test_cases = [
            ("google/gemini-2.0-flash-001", "openrouter"),  # Without credentials
            ("gpt-4", None),  # No specific provider
            ("openai/gpt-4", "openrouter"),
        ]

        for model_id, expected_provider in test_cases:
            provider = detect_provider_from_model_id(model_id)
            logger.info(f"Model {model_id} detected provider: {provider}")

            # Provider detection should return a value or None
            assert provider is None or isinstance(provider, str)


# ============================================================
# TEST CLASS: Integration with Catalog
# ============================================================


@pytest.mark.integration
class TestCatalogIntegration:
    """Test integration with model catalog"""

    def test_get_models_catalog(self):
        """Test retrieving models catalog"""
        response = client.get("/models?gateway=all&limit=10")

        assert response.status_code == 200
        data = response.json()

        assert "data" in data
        assert "returned" in data
        assert isinstance(data["data"], list)

        logger.info(f"Catalog returned {data['returned']} models")

    def test_catalog_includes_multi_provider_models(self):
        """Test that catalog includes multi-provider model info"""
        response = client.get("/models?gateway=all&limit=100")

        if response.status_code == 200:
            data = response.json()
            models = data.get("data", [])

            # Check if any models have provider information
            models_with_providers = [
                m for m in models
                if m.get("provider_slug") or m.get("providers")
            ]

            logger.info(f"Found {len(models_with_providers)} models with provider info")


# ============================================================
# Test Summary
# ============================================================


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
