#!/usr/bin/env python3
"""
Tests for catalog utility functions

These tests actually execute code to increase coverage
"""

import pytest
from src.routes.catalog import (
    normalize_developer_segment,
    normalize_model_segment,
    annotate_provider_sources,
    derive_portkey_providers
)


class TestNormalizeDeveloperSegment:
    """Test developer segment normalization"""

    def test_normalize_none(self):
        assert normalize_developer_segment(None) is None

    def test_normalize_empty_string(self):
        assert normalize_developer_segment("") is None
        assert normalize_developer_segment("   ") is None

    def test_normalize_with_at_symbol(self):
        assert normalize_developer_segment("@developer") == "developer"
        assert normalize_developer_segment("@@developer") == "developer"

    def test_normalize_regular_string(self):
        assert normalize_developer_segment("openai") == "openai"
        assert normalize_developer_segment(" anthropic ") == "anthropic"

    def test_normalize_non_string(self):
        # Should convert to string
        result = normalize_developer_segment(123)
        assert isinstance(result, str)


class TestNormalizeModelSegment:
    """Test model segment normalization"""

    def test_normalize_none(self):
        assert normalize_model_segment(None) is None

    def test_normalize_empty_string(self):
        assert normalize_model_segment("") is None
        assert normalize_model_segment("   ") is None

    def test_normalize_preserves_casing(self):
        assert normalize_model_segment("GPT-4") == "GPT-4"
        assert normalize_model_segment("claude-3-opus") == "claude-3-opus"

    def test_normalize_strips_whitespace(self):
        assert normalize_model_segment("  model-name  ") == "model-name"

    def test_normalize_non_string(self):
        result = normalize_model_segment(456)
        assert isinstance(result, str)


class TestAnnotateProviderSources:
    """Test provider source annotation"""

    def test_annotate_empty_list(self):
        result = annotate_provider_sources([], "openrouter")
        assert result == []

    def test_annotate_none(self):
        result = annotate_provider_sources(None, "openrouter")
        assert result == []

    def test_annotate_single_provider(self):
        providers = [{"id": "openai", "name": "OpenAI"}]
        result = annotate_provider_sources(providers, "openrouter")

        assert len(result) == 1
        assert result[0]["source_gateway"] == "openrouter"
        assert "openrouter" in result[0]["source_gateways"]

    def test_annotate_multiple_providers(self):
        providers = [
            {"id": "openai", "name": "OpenAI"},
            {"id": "anthropic", "name": "Anthropic"}
        ]
        result = annotate_provider_sources(providers, "portkey")

        assert len(result) == 2
        for provider in result:
            assert provider["source_gateway"] == "portkey"
            assert "portkey" in provider["source_gateways"]

    def test_annotate_preserves_existing_data(self):
        providers = [{"id": "openai", "name": "OpenAI", "custom_field": "value"}]
        result = annotate_provider_sources(providers, "openrouter")

        assert result[0]["custom_field"] == "value"
        assert result[0]["id"] == "openai"

    def test_annotate_doesnt_duplicate_source(self):
        providers = [{
            "id": "openai",
            "source_gateways": ["openrouter"]
        }]
        result = annotate_provider_sources(providers, "openrouter")

        # Should only have one "openrouter" entry
        assert result[0]["source_gateways"].count("openrouter") == 1

    def test_annotate_adds_new_source(self):
        providers = [{
            "id": "openai",
            "source_gateways": ["portkey"]
        }]
        result = annotate_provider_sources(providers, "openrouter")

        assert "portkey" in result[0]["source_gateways"]
        assert "openrouter" in result[0]["source_gateways"]
        assert len(result[0]["source_gateways"]) == 2


class TestDerivePortkeyProviders:
    """Test deriving providers from Portkey models"""

    def test_derive_from_empty_list(self):
        result = derive_portkey_providers([])
        assert result == []

    def test_derive_from_none(self):
        result = derive_portkey_providers(None)
        assert result == []

    def test_derive_with_provider_slug(self):
        models = [{
            "id": "gpt-4",
            "provider_slug": "openai"
        }]
        result = derive_portkey_providers(models)

        assert len(result) == 1
        assert result[0]["slug"] == "openai"

    def test_derive_from_model_id(self):
        models = [{
            "id": "openai/gpt-4"
        }]
        result = derive_portkey_providers(models)

        assert len(result) == 1
        assert result[0]["slug"] == "openai"

    def test_derive_strips_at_symbol(self):
        models = [{
            "id": "gpt-4",
            "provider_slug": "@openai"
        }]
        result = derive_portkey_providers(models)

        assert result[0]["slug"] == "openai"

    def test_derive_multiple_providers(self):
        models = [
            {"id": "openai/gpt-4"},
            {"id": "anthropic/claude-3"}
        ]
        result = derive_portkey_providers(models)

        assert len(result) == 2
        provider_slugs = [p["slug"] for p in result]
        assert "openai" in provider_slugs
        assert "anthropic" in provider_slugs

    def test_derive_deduplicates_providers(self):
        models = [
            {"id": "openai/gpt-4"},
            {"id": "openai/gpt-3.5"}
        ]
        result = derive_portkey_providers(models)

        # Should only have one OpenAI provider
        assert len(result) == 1
        assert result[0]["slug"] == "openai"

    def test_derive_skips_invalid_models(self):
        models = [
            {"id": ""},  # Empty ID
            {"id": "no-slash"},  # No slash, no provider_slug
            {"id": "openai/gpt-4"}  # Valid
        ]
        result = derive_portkey_providers(models)

        assert len(result) == 1
        assert result[0]["slug"] == "openai"

    def test_derive_sets_default_fields(self):
        models = [{"id": "openai/gpt-4"}]
        result = derive_portkey_providers(models)

        provider = result[0]
        assert provider["slug"] == "openai"
        assert provider["source_gateway"] == "portkey"
        assert "portkey" in provider["source_gateways"]
