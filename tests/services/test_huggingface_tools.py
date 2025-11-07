"""Tests for HuggingFace client tools support"""

import pytest

from src.services.huggingface_client import ALLOWED_PARAMS, _build_payload


class TestHuggingFaceToolsSupport:
    """Test that HuggingFace client supports tools parameter"""

    def test_tools_in_allowed_params(self):
        """Test that 'tools' is in ALLOWED_PARAMS"""
        assert "tools" in ALLOWED_PARAMS, "tools should be in ALLOWED_PARAMS"

    def test_build_payload_includes_tools(self):
        """Test that _build_payload includes tools when provided"""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get weather",
                    "parameters": {
                        "type": "object",
                        "properties": {"location": {"type": "string"}},
                    },
                },
            }
        ]

        messages = [{"role": "user", "content": "What's the weather?"}]
        payload = _build_payload(messages, "test-model", tools=tools)

        assert "tools" in payload
        assert payload["tools"] == tools

    def test_build_payload_without_tools(self):
        """Test that _build_payload works without tools"""
        messages = [{"role": "user", "content": "Hello"}]
        payload = _build_payload(messages, "test-model")

        assert "tools" not in payload

    def test_build_payload_filters_other_params(self):
        """Test that _build_payload only includes allowed params"""
        messages = [{"role": "user", "content": "Hello"}]
        payload = _build_payload(
            messages,
            "test-model",
            max_tokens=100,
            temperature=0.7,
            tools=[{"type": "function", "function": {"name": "test"}}],
            invalid_param="should_be_filtered",
        )

        assert "max_tokens" in payload
        assert "temperature" in payload
        assert "tools" in payload
        assert "invalid_param" not in payload

