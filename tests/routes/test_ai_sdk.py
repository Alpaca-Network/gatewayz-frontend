"""
Tests for the Vercel AI SDK endpoint.
"""

import os
import pytest
from unittest.mock import patch, MagicMock

# Set test environment variables before imports
os.environ.setdefault('APP_ENV', 'testing')
os.environ.setdefault('TESTING', 'true')
os.environ.setdefault('SUPABASE_URL', 'https://test.supabase.co')
os.environ.setdefault('SUPABASE_KEY', 'test-key')
os.environ.setdefault('OPENROUTER_API_KEY', 'test-openrouter-key')
os.environ.setdefault('ENCRYPTION_KEY', 'test-encryption-key-32-bytes-long!')
os.environ.setdefault('PORTKEY_API_KEY', 'test-portkey-key')
os.environ.setdefault('AI_SDK_API_KEY', 'test-ai-sdk-key')

from fastapi.testclient import TestClient
from src.main import app

# Create test client
client = TestClient(app)


class TestAISDKEndpoint:
    """Tests for the AI SDK chat completion endpoint"""

    def test_ai_sdk_endpoint_exists(self):
        """Test that the AI SDK endpoint is registered"""
        response = client.options("/api/chat/ai-sdk")
        # OPTIONS should be allowed or return method not allowed
        assert response.status_code in [200, 405]

    @patch("src.routes.ai_sdk.validate_ai_sdk_api_key")
    @patch("src.routes.ai_sdk.make_ai_sdk_request_openai")
    @patch("src.routes.ai_sdk.process_ai_sdk_response")
    def test_ai_sdk_chat_completion_success(
        self, mock_process, mock_request, mock_validate
    ):
        """Test successful AI SDK chat completion request"""
        # Setup mocks
        mock_validate.return_value = "test-api-key"

        # Mock response from OpenAI client
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(role="assistant", content="Hello!"),
                finish_reason="stop",
            )
        ]
        mock_response.usage = MagicMock(
            prompt_tokens=10, completion_tokens=5, total_tokens=15
        )
        mock_request.return_value = mock_response

        # Mock processed response
        mock_process.return_value = {
            "choices": [
                {
                    "message": {"role": "assistant", "content": "Hello!"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
            },
        }

        # Make request using Vercel AI Gateway model format
        response = client.post(
            "/api/chat/ai-sdk",
            json={
                "model": "openai/gpt-5",  # Vercel AI Gateway model format
                "messages": [{"role": "user", "content": "Hello!"}],
                "temperature": 0.7,
                "max_tokens": 100,
            },
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert "choices" in data
        assert "usage" in data
        assert data["choices"][0]["message"]["content"] == "Hello!"

    @patch("src.routes.ai_sdk.validate_ai_sdk_api_key")
    def test_ai_sdk_missing_api_key(self, mock_validate):
        """Test that missing API key returns proper error"""
        mock_validate.side_effect = ValueError("AI_SDK_API_KEY not configured")

        response = client.post(
            "/api/chat/ai-sdk",
            json={
                "model": "gpt-4",
                "messages": [{"role": "user", "content": "Hello!"}],
            },
        )

        assert response.status_code == 500
        assert "AI_SDK_API_KEY not configured" in response.text

    def test_ai_sdk_invalid_request_format(self):
        """Test that invalid request format returns proper error"""
        response = client.post(
            "/api/chat/ai-sdk",
            json={
                "model": "openai/gpt-5",
                # Missing required 'messages' field
            },
        )

        assert response.status_code == 422  # Validation error

    @patch("src.routes.ai_sdk.validate_ai_sdk_api_key")
    @patch("src.routes.ai_sdk.make_ai_sdk_request_openai_stream")
    def test_ai_sdk_streaming_request(self, mock_stream, mock_validate):
        """Test streaming response from AI SDK endpoint"""
        mock_validate.return_value = "test-api-key"

        # Mock streaming response
        mock_chunk1 = MagicMock()
        mock_chunk1.choices = [MagicMock(delta=MagicMock(content="Hello"))]

        mock_chunk2 = MagicMock()
        mock_chunk2.choices = [MagicMock(delta=MagicMock(content=" world"))]

        mock_stream.return_value = iter([mock_chunk1, mock_chunk2])

        # Make streaming request using Vercel AI Gateway model format
        response = client.post(
            "/api/chat/ai-sdk",
            json={
                "model": "openai/gpt-5",  # Vercel AI Gateway model format
                "messages": [{"role": "user", "content": "Hello!"}],
                "stream": True,
            },
        )

        assert response.status_code == 200
        # Check content-type contains text/event-stream (may have charset appended)
        assert "text/event-stream" in response.headers["content-type"]

    def test_ai_sdk_endpoint_schema(self):
        """Test that endpoint properly validates request schema"""
        # Valid request with all optional fields using Vercel AI Gateway format
        response = client.post(
            "/api/chat/ai-sdk",
            json={
                "model": "anthropic/claude-sonnet-4.5",  # Vercel AI Gateway model format
                "messages": [
                    {"role": "system", "content": "You are helpful"},
                    {"role": "user", "content": "Hello!"},
                ],
                "max_tokens": 1024,
                "temperature": 0.7,
                "top_p": 0.9,
                "frequency_penalty": 0.0,
                "presence_penalty": 0.0,
                "stream": False,
            },
        )

        # Should fail validation due to missing mock, but structure is valid
        assert response.status_code in [422, 500]  # Either validation or execution error


class TestAISDKConfiguration:
    """Tests for AI SDK configuration"""

    def test_ai_sdk_config_variable_exists(self):
        """Test that AI_SDK_API_KEY is available in Config"""
        from src.config import Config

        # Should have the attribute (may be None if not set)
        assert hasattr(Config, "AI_SDK_API_KEY")

    def test_ai_sdk_config_loading(self):
        """Test that AI_SDK_API_KEY is properly loaded from environment"""
        from src.config import Config

        # Config should have AI_SDK_API_KEY set from conftest.py
        # It should be set to a non-empty value during testing
        assert Config.AI_SDK_API_KEY is not None
        assert isinstance(Config.AI_SDK_API_KEY, str)
        assert len(Config.AI_SDK_API_KEY) > 0
