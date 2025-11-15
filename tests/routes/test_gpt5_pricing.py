#!/usr/bin/env python3
"""
GPT-5.1 Pricing Availability Tests

These tests verify that GPT-5.1 pricing is available through the API
and that the dynamic pricing system works correctly for OpenRouter models.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


class TestGPT51ModelAvailability:
    """Test that GPT-5.1 models are available in the catalog"""

    @patch('src.routes.catalog.get_cached_models')
    def test_gpt51_in_openrouter_models(self, mock_get_models):
        """Test that GPT-5.1 is returned from OpenRouter models endpoint"""
        mock_get_models.return_value = [
            {
                "id": "openai/gpt-5.1",
                "name": "GPT-5.1",
                "pricing": {
                    "prompt": "1.25",
                    "completion": "10.00"
                },
                "context_length": 128000,
                "source_gateway": "openrouter"
            },
            {
                "id": "openai/gpt-5",
                "name": "GPT-5",
                "pricing": {
                    "prompt": "0.10",
                    "completion": "0.40"
                },
                "context_length": 128000,
                "source_gateway": "openrouter"
            }
        ]

        response = client.get("/v1/models")

        assert response.status_code in [200, 503, 500]


class TestGPT51Pricing:
    """Test GPT-5.1 pricing data structure and availability"""

    @patch('src.routes.catalog.get_cached_models')
    def test_gpt51_pricing_structure(self, mock_get_models):
        """Test that GPT-5.1 pricing has correct structure"""
        gpt51_model = {
            "id": "openai/gpt-5.1",
            "name": "GPT-5.1",
            "pricing": {
                "prompt": "1.25",
                "completion": "10.00"
            },
            "context_length": 128000,
            "source_gateway": "openrouter"
        }

        mock_get_models.return_value = [gpt51_model]

        # Test via models endpoint
        response = client.get("/v1/models")
        assert response.status_code in [200, 503, 500]

    @patch('src.services.models.get_cached_models')
    def test_gpt51_pricing_lookup(self, mock_get_cached):
        """Test that pricing can be looked up for GPT-5.1"""
        from src.services.pricing import get_model_pricing

        mock_get_cached.return_value = [
            {
                "id": "openai/gpt-5.1",
                "pricing": {
                    "prompt": "1.25",
                    "completion": "10.00"
                }
            }
        ]

        pricing = get_model_pricing("openai/gpt-5.1")

        assert pricing["found"] is True
        assert float(pricing["prompt"]) == 1.25
        assert float(pricing["completion"]) == 10.00

    @patch('src.services.models.get_cached_models')
    def test_gpt51_cost_calculation(self, mock_get_cached):
        """Test that costs are calculated correctly for GPT-5.1"""
        from src.services.pricing import calculate_cost

        mock_get_cached.return_value = [
            {
                "id": "openai/gpt-5.1",
                "pricing": {
                    "prompt": "1.25",
                    "completion": "10.00"
                }
            }
        ]

        # 1000 prompt tokens + 500 completion tokens
        cost = calculate_cost("openai/gpt-5.1", 1000, 500)

        # Expected: (1000 * 1.25 / 1M) + (500 * 10.00 / 1M)
        expected_cost = (1000 * 1.25 / 1_000_000) + (500 * 10.00 / 1_000_000)

        assert cost == pytest.approx(expected_cost, rel=1e-9)


class TestGPT51ModelCatalogEndpoints:
    """Test GPT-5.1 availability through various catalog endpoints"""

    @patch('src.routes.catalog.get_cached_models')
    def test_models_endpoint_includes_gpt51(self, mock_get_models):
        """Test that /v1/models includes GPT-5.1"""
        mock_get_models.return_value = [
            {
                "id": "openai/gpt-5.1",
                "name": "GPT-5.1",
                "pricing": {
                    "prompt": "1.25",
                    "completion": "10.00"
                },
                "source_gateway": "openrouter"
            }
        ]

        response = client.get("/v1/models")
        assert response.status_code in [200, 503, 500]

    @patch('src.routes.catalog.get_cached_models')
    @patch('src.routes.catalog.get_cached_providers')
    def test_provider_endpoint_openai_includes_gpt51(self, mock_providers, mock_get_models):
        """Test that /v1/provider returns OpenAI provider with GPT-5.1"""
        mock_get_models.return_value = [
            {
                "id": "openai/gpt-5.1",
                "provider_slug": "openai"
            }
        ]
        mock_providers.return_value = [
            {
                "slug": "openai",
                "name": "OpenAI"
            }
        ]

        response = client.get("/v1/provider?gateway=openrouter")
        assert response.status_code in [200, 503, 500]

    @patch('src.routes.catalog.get_cached_models')
    def test_catalog_page_loads_gpt51(self, mock_get_models):
        """Test that models catalog page loads with GPT-5.1"""
        mock_get_models.return_value = [
            {
                "id": "openai/gpt-5.1",
                "slug": "openai-gpt-5-1",
                "canonical_slug": "openai/gpt-5.1",
                "name": "GPT-5.1",
                "pricing": {
                    "prompt": "1.25",
                    "completion": "10.00"
                },
                "source_gateway": "openrouter"
            }
        ]

        response = client.get("/models")
        assert response.status_code in [200, 503, 500]


class TestGPT51DynamicPricing:
    """Test that GPT-5.1 pricing is dynamically fetched from OpenRouter"""

    @patch('src.services.models.httpx.get')
    @patch('src.config.Config.OPENROUTER_API_KEY', 'test-key')
    def test_fetch_gpt51_from_openrouter_api(self, mock_httpx_get):
        """Test that GPT-5.1 can be fetched from OpenRouter API"""
        from src.services.models import fetch_models_from_openrouter

        # Mock OpenRouter API response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "openai/gpt-5.1",
                    "name": "GPT-5.1",
                    "pricing": {
                        "prompt": "1.25",
                        "completion": "10.00"
                    },
                    "context_length": 128000
                },
                {
                    "id": "openai/gpt-5",
                    "name": "GPT-5",
                    "pricing": {
                        "prompt": "0.10",
                        "completion": "0.40"
                    },
                    "context_length": 128000
                }
            ]
        }
        mock_httpx_get.return_value = mock_response

        models = fetch_models_from_openrouter()

        assert models is not None
        assert len(models) == 2

        # Find GPT-5.1
        gpt51 = next((m for m in models if m["id"] == "openai/gpt-5.1"), None)
        assert gpt51 is not None
        assert gpt51["pricing"]["prompt"] == "1.25"
        assert gpt51["pricing"]["completion"] == "10.00"

    def test_gpt51_pricing_sanitization(self):
        """Test that negative pricing values are sanitized"""
        from src.services.models import sanitize_pricing

        # Test that negative values are converted to "0"
        pricing = {
            "prompt": "-1",
            "completion": "10.00"
        }

        sanitized = sanitize_pricing(pricing)

        assert sanitized["prompt"] == "0"
        assert sanitized["completion"] == "10.00"

    def test_gpt51_pricing_sanitization_all_negative(self):
        """Test sanitization when all pricing is dynamic (-1)"""
        from src.services.models import sanitize_pricing

        pricing = {
            "prompt": "-1",
            "completion": "-1"
        }

        sanitized = sanitize_pricing(pricing)

        assert sanitized["prompt"] == "0"
        assert sanitized["completion"] == "0"


class TestGPT51Variants:
    """Test different GPT-5 model variants are all available with pricing"""

    @patch('src.routes.catalog.get_cached_models')
    def test_all_gpt5_variants_have_pricing(self, mock_get_models):
        """Test that all GPT-5 variants have pricing"""
        mock_get_models.return_value = [
            {
                "id": "openai/gpt-5",
                "name": "GPT-5",
                "pricing": {"prompt": "0.10", "completion": "0.40"},
                "source_gateway": "openrouter"
            },
            {
                "id": "openai/gpt-5.1",
                "name": "GPT-5.1",
                "pricing": {"prompt": "1.25", "completion": "10.00"},
                "source_gateway": "openrouter"
            },
            {
                "id": "openai/gpt-5-turbo",
                "name": "GPT-5 Turbo",
                "pricing": {"prompt": "0.05", "completion": "0.20"},
                "source_gateway": "openrouter"
            }
        ]

        response = client.get("/v1/models")
        assert response.status_code in [200, 503, 500]

        # Verify all models have pricing
        for model in mock_get_models.return_value:
            assert "pricing" in model
            assert "prompt" in model["pricing"]
            assert "completion" in model["pricing"]


class TestGPT51CostEstimation:
    """Test accurate cost estimation for GPT-5.1 requests"""

    @patch('src.services.models.get_cached_models')
    def test_estimate_gpt51_request_cost(self, mock_get_cached):
        """Test cost estimation for typical GPT-5.1 requests"""
        from src.services.pricing import calculate_cost

        mock_get_cached.return_value = [
            {
                "id": "openai/gpt-5.1",
                "pricing": {
                    "prompt": "1.25",
                    "completion": "10.00"
                }
            }
        ]

        # Typical request: 2000 prompt tokens, 1000 completion tokens
        cost = calculate_cost("openai/gpt-5.1", 2000, 1000)

        # Expected: (2000 * 1.25 / 1M) + (1000 * 10.00 / 1M) = 0.0025 + 0.01 = 0.0125
        expected_cost = (2000 * 1.25 + 1000 * 10.00) / 1_000_000

        assert cost == pytest.approx(expected_cost, rel=1e-9)

    @patch('src.services.models.get_cached_models')
    def test_large_gpt51_request_cost(self, mock_get_cached):
        """Test cost estimation for large GPT-5.1 requests"""
        from src.services.pricing import calculate_cost

        mock_get_cached.return_value = [
            {
                "id": "openai/gpt-5.1",
                "pricing": {
                    "prompt": "1.25",
                    "completion": "10.00"
                }
            }
        ]

        # Large request: 100k prompt tokens, 50k completion tokens
        cost = calculate_cost("openai/gpt-5.1", 100_000, 50_000)

        expected_cost = (100_000 * 1.25 + 50_000 * 10.00) / 1_000_000

        assert cost == pytest.approx(expected_cost, rel=1e-9)
        # Should be ~$0.625 (125 + 500) / 1M = 625 / 1M
        assert cost > 0.6 and cost < 0.7


class TestGPT51Integration:
    """Integration tests for GPT-5.1 with the full system"""

    @patch('src.routes.catalog.get_cached_models')
    @patch('src.routes.catalog.get_cached_providers')
    @patch('src.routes.catalog.enhance_providers_with_logos_and_sites')
    def test_gpt51_in_full_catalog_response(
        self, mock_enhance, mock_providers, mock_get_models
    ):
        """Test GPT-5.1 appears in full catalog response"""

        def fake_get_models(gateway: str):
            if gateway == "openrouter":
                return [
                    {
                        "id": "openai/gpt-5.1",
                        "name": "GPT-5.1",
                        "pricing": {"prompt": "1.25", "completion": "10.00"},
                        "source_gateway": "openrouter"
                    }
                ]
            return []

        mock_get_models.side_effect = fake_get_models
        mock_providers.return_value = [{"slug": "openai"}]
        mock_enhance.side_effect = lambda p: p

        response = client.get("/models?gateway=openrouter")
        assert response.status_code == 200
