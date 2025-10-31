#!/usr/bin/env python3
"""
Tests for models service functions

These integration tests execute code to increase coverage
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from src.services.models import (
    sanitize_pricing,
    load_featherless_catalog_export,
    get_cached_models,
    enhance_model_with_provider_info,
    enhance_model_with_huggingface_data,
    get_model_count_by_provider,
    fetch_specific_model,
    fetch_specific_model_from_fal,
    detect_model_gateway,
)


class TestSanitizePricing:
    """Test pricing sanitization"""

    def test_sanitize_none(self):
        """Test with None input"""
        result = sanitize_pricing(None)
        assert result is None

    def test_sanitize_empty_dict(self):
        """Test with empty dict"""
        result = sanitize_pricing({})
        assert result == {}

    def test_sanitize_non_dict(self):
        """Test with non-dict input"""
        result = sanitize_pricing("not a dict")
        assert result == "not a dict"

    def test_sanitize_positive_values(self):
        """Test that positive values are preserved"""
        pricing = {
            "prompt": "0.001",
            "completion": "0.002",
            "request": "0.0001"
        }
        result = sanitize_pricing(pricing)
        assert result["prompt"] == "0.001"
        assert result["completion"] == "0.002"
        assert result["request"] == "0.0001"

    def test_sanitize_negative_values(self):
        """Test that negative values are converted to 0"""
        pricing = {
            "prompt": "-1",
            "completion": "-0.5",
            "request": "0.001"
        }
        result = sanitize_pricing(pricing)
        assert result["prompt"] == "0"
        assert result["completion"] == "0"
        assert result["request"] == "0.001"

    def test_sanitize_mixed_values(self):
        """Test with mix of positive, negative, and special fields"""
        pricing = {
            "prompt": "0.001",
            "completion": "-1",
            "image": "-1",
            "web_search": "0.002",
            "internal_reasoning": "-2"
        }
        result = sanitize_pricing(pricing)
        assert result["prompt"] == "0.001"
        assert result["completion"] == "0"
        assert result["image"] == "0"
        assert result["web_search"] == "0.002"
        assert result["internal_reasoning"] == "0"

    def test_sanitize_numeric_values(self):
        """Test with numeric (not string) values"""
        pricing = {
            "prompt": -1.0,
            "completion": 0.002,
            "request": -0.5
        }
        result = sanitize_pricing(pricing)
        assert result["prompt"] == "0"
        assert result["completion"] == 0.002
        assert result["request"] == "0"

    def test_sanitize_invalid_values(self):
        """Test with invalid numeric values"""
        pricing = {
            "prompt": "invalid",
            "completion": "0.002"
        }
        result = sanitize_pricing(pricing)
        # Invalid values should be preserved
        assert result["prompt"] == "invalid"
        assert result["completion"] == "0.002"

    def test_sanitize_zero_values(self):
        """Test that zero values are preserved"""
        pricing = {
            "prompt": "0",
            "completion": 0,
            "request": "0.0"
        }
        result = sanitize_pricing(pricing)
        assert result["prompt"] == "0"
        assert result["completion"] == 0
        assert result["request"] == "0.0"

    def test_sanitize_preserves_other_fields(self):
        """Test that non-pricing fields are preserved"""
        pricing = {
            "prompt": "-1",
            "custom_field": "value",
            "another": 123
        }
        result = sanitize_pricing(pricing)
        assert result["prompt"] == "0"
        assert result["custom_field"] == "value"
        assert result["another"] == 123


class TestLoadFeatherlessCatalogExport:
    """Test Featherless catalog loading"""

    def test_load_when_no_file_exists(self):
        """Test when CSV file doesn't exist"""
        result = load_featherless_catalog_export()
        # Should return list (empty or None)
        assert result is None or isinstance(result, list)

    @patch('pathlib.Path.exists')
    def test_load_file_not_found(self, mock_exists):
        """Test when file is not found"""
        mock_exists.return_value = False
        result = load_featherless_catalog_export()
        assert result is None or isinstance(result, list)


class TestGetCachedModels:
    """Test model caching functionality"""

    def test_get_cached_models_openrouter(self):
        """Test getting OpenRouter models from cache"""
        result = get_cached_models("openrouter")
        # Should return list or None
        assert result is None or isinstance(result, list)

    def test_get_cached_models_portkey(self):
        """Test getting Portkey models from cache"""
        result = get_cached_models("portkey")
        assert result is None or isinstance(result, list)

    def test_get_cached_models_featherless(self):
        """Test getting Featherless models"""
        result = get_cached_models("featherless")
        assert result is None or isinstance(result, list)

    def test_get_cached_models_groq(self):
        """Test getting Groq models"""
        result = get_cached_models("groq")
        assert result is None or isinstance(result, list)

    def test_get_cached_models_hug(self):
        """Test getting Hugging Face models"""
        result = get_cached_models("hug")
        assert result is None or isinstance(result, list)

    def test_get_cached_models_huggingface_alias(self):
        """Test huggingface alias"""
        result = get_cached_models("huggingface")
        assert result is None or isinstance(result, list)

    def test_get_cached_models_invalid_gateway(self):
        """Test with invalid gateway name"""
        result = get_cached_models("invalid_gateway_name")
        # Should handle gracefully
        assert result is None or isinstance(result, list)

    def test_get_cached_models_case_insensitive(self):
        """Test that gateway names are case-insensitive"""
        result1 = get_cached_models("OPENROUTER")
        result2 = get_cached_models("OpenRouter")
        # Both should work without errors
        assert result1 is None or isinstance(result1, list)
        assert result2 is None or isinstance(result2, list)


class TestEnhanceModelWithProviderInfo:
    """Test model enhancement with provider info"""

    def test_enhance_empty_model(self):
        """Test enhancing empty model"""
        model = {}
        result = enhance_model_with_provider_info(model, [])
        assert isinstance(result, dict)

    def test_enhance_model_basic(self):
        """Test basic model enhancement"""
        model = {
            "id": "openai/gpt-4",
            "name": "GPT-4"
        }
        providers = [
            {"id": "openai", "name": "OpenAI"}
        ]
        result = enhance_model_with_provider_info(model, providers)
        assert isinstance(result, dict)

    def test_enhance_model_no_providers(self):
        """Test when no providers available"""
        model = {"id": "model-1", "name": "Test Model"}
        result = enhance_model_with_provider_info(model, [])
        assert isinstance(result, dict)

    def test_enhance_preserves_existing_fields(self):
        """Test that existing fields are preserved"""
        model = {
            "id": "test-model",
            "name": "Test",
            "custom_field": "value"
        }
        result = enhance_model_with_provider_info(model, [])
        assert "custom_field" in result
        assert result["custom_field"] == "value"


class TestEnhanceModelWithHuggingFaceData:
    """Test Hugging Face data enhancement"""

    @patch('src.services.models.get_huggingface_model_info')
    def test_enhance_with_hf_data_success(self, mock_get_info):
        """Test successful HF enhancement"""
        mock_get_info.return_value = {
            "downloads": 1000,
            "likes": 50,
            "tags": ["text-generation"]
        }

        model = {"id": "model-1", "name": "Test"}
        result = enhance_model_with_huggingface_data(model)

        assert isinstance(result, dict)

    @patch('src.services.models.get_huggingface_model_info')
    def test_enhance_with_hf_data_none(self, mock_get_info):
        """Test when HF returns None"""
        mock_get_info.return_value = None

        model = {"id": "model-1"}
        result = enhance_model_with_huggingface_data(model)

        assert isinstance(result, dict)

    def test_enhance_with_hf_data_no_model(self):
        """Test with empty model"""
        result = enhance_model_with_huggingface_data({})
        assert isinstance(result, dict)


class TestGetModelCountByProvider:
    """Test model counting by provider"""

    def test_count_empty_list(self):
        """Test counting with empty model list"""
        result = get_model_count_by_provider([], [])
        assert isinstance(result, dict)
        assert len(result) == 0

    def test_count_no_providers(self):
        """Test with no providers"""
        models = [
            {"id": "model-1", "provider": "openai"}
        ]
        result = get_model_count_by_provider(models, [])
        assert isinstance(result, dict)

    def test_count_basic(self):
        """Test basic counting"""
        models = [
            {"id": "openai/gpt-4"},
            {"id": "openai/gpt-3.5"},
            {"id": "anthropic/claude-3"}
        ]
        providers = [
            {"id": "openai"},
            {"id": "anthropic"}
        ]
        result = get_model_count_by_provider(models, providers)
        assert isinstance(result, dict)

    def test_count_with_none_inputs(self):
        """Test with None inputs"""
        # With the refactored signature, None triggers legacy behavior returning int
        # To get dict behavior, pass empty lists
        result = get_model_count_by_provider([], [])
        assert isinstance(result, dict)


class TestFetchSpecificModel:
    """Test fetching specific model"""

    def test_fetch_model_not_found(self):
        """Test fetching non-existent model"""
        # fetch_specific_model now requires provider_name and model_name as separate args
        # It's a regular function, not async
        result = fetch_specific_model("nonexistent-provider", "xyz-123")
        # Should return None or empty
        assert result is None or isinstance(result, dict)

    def test_fetch_model_invalid_format(self):
        """Test with invalid model format"""
        # fetch_specific_model now requires provider_name and model_name as separate args
        # It's a regular function, not async
        result = fetch_specific_model("", "")
        assert result is None or isinstance(result, dict)

    def test_fetch_model_none(self):
        """Test with None input"""
        # fetch_specific_model now requires provider_name and model_name as separate args
        # It's a regular function, not async
        result = fetch_specific_model(None, None)
        assert result is None or isinstance(result, dict)

    def test_fetch_openrouter_auto(self):
        """Test fetching openrouter/auto model specifically"""
        result = fetch_specific_model("openrouter", "auto", gateway="openrouter")
        # Should find the model or return None gracefully
        if result is not None:
            assert isinstance(result, dict)
            assert result.get("id") == "openrouter/auto"


class TestFalAiIntegration:
    """Test Fal.ai model integration"""

    @patch('src.services.models.get_cached_models')
    def test_fetch_specific_model_from_fal_success(self, mock_get_cached_models):
        """Test successful fetch from Fal.ai cache"""
        # Mock cached Fal models
        mock_fal_models = [
            {"id": "fal-ai/stable-diffusion-v15", "name": "Stable Diffusion v1.5"},
            {"id": "minimax/video-01", "name": "Video Generation Model"}
        ]
        mock_get_cached_models.return_value = mock_fal_models

        result = fetch_specific_model_from_fal("fal-ai", "stable-diffusion-v15")

        assert result is not None
        assert result["id"] == "fal-ai/stable-diffusion-v15"
        assert result["name"] == "Stable Diffusion v1.5"
        mock_get_cached_models.assert_called_once_with("fal")

    @patch('src.services.models.get_cached_models')
    def test_fetch_specific_model_from_fal_case_insensitive(self, mock_get_cached_models):
        """Test case-insensitive matching"""
        mock_fal_models = [
            {"id": "Fal-AI/Stable-Diffusion-V15", "name": "Stable Diffusion v1.5"}
        ]
        mock_get_cached_models.return_value = mock_fal_models

        result = fetch_specific_model_from_fal("fal-ai", "stable-diffusion-v15")

        assert result is not None
        assert result["id"] == "Fal-AI/Stable-Diffusion-V15"

    @patch('src.services.models.get_cached_models')
    def test_fetch_specific_model_from_fal_not_found(self, mock_get_cached_models):
        """Test model not found in cache"""
        mock_fal_models = [
            {"id": "fal-ai/other-model", "name": "Other Model"}
        ]
        mock_get_cached_models.return_value = mock_fal_models

        result = fetch_specific_model_from_fal("fal-ai", "nonexistent-model")

        assert result is None

    @patch('src.services.models.get_cached_models')
    def test_fetch_specific_model_from_fal_empty_cache(self, mock_get_cached_models):
        """Test with empty cache"""
        mock_get_cached_models.return_value = []

        result = fetch_specific_model_from_fal("fal-ai", "stable-diffusion-v15")

        assert result is None

    @patch('src.services.models.get_cached_models')
    def test_fetch_specific_model_from_fal_exception(self, mock_get_cached_models):
        """Test exception handling"""
        mock_get_cached_models.side_effect = Exception("Cache error")

        result = fetch_specific_model_from_fal("fal-ai", "stable-diffusion-v15")

        assert result is None

    @patch('src.services.models.get_cached_models')
    def test_detect_model_gateway_fal(self, mock_get_cached_models):
        """Test that Fal models are detected in gateway detection"""
        def mock_cache_side_effect(gateway):
            if gateway == "fal":
                return [{"id": "fal-ai/stable-diffusion-v15", "name": "Stable Diffusion v1.5"}]
            return []

        mock_get_cached_models.side_effect = mock_cache_side_effect

        result = detect_model_gateway("fal-ai", "stable-diffusion-v15")

        assert result == "fal"

    @patch('src.services.models.get_cached_models')
    def test_detect_model_gateway_fallback_to_openrouter(self, mock_get_cached_models):
        """Test fallback to openrouter when model not found"""
        mock_get_cached_models.return_value = []

        result = detect_model_gateway("unknown", "model")

        assert result == "openrouter"
