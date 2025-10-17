"""Tests for Together client"""
import pytest
from unittest.mock import Mock, patch
from src.services.together_client import (
    get_together_client,
    make_together_request_openai,
    make_together_request_openai_stream,
    process_together_response
)


class TestTogetherClient:
    """Test Together client functionality"""

    @patch('src.services.together_client.Config.TOGETHER_API_KEY', 'test_key')
    def test_get_together_client(self):
        """Test getting Together client"""
        client = get_together_client()
        assert client is not None
        assert str(client.base_url) == "https://api.together.xyz/v1/"

    @patch('src.services.together_client.Config.TOGETHER_API_KEY', None)
    def test_get_together_client_no_key(self):
        """Test getting Together client without API key"""
        with pytest.raises(ValueError, match="Together API key not configured"):
            get_together_client()

    @patch('src.services.together_client.get_together_client')
    def test_make_together_request_openai(self, mock_get_client):
        """Test making request to Together"""
        # Mock the client and response
        mock_client = Mock()
        mock_response = Mock()
        mock_response.id = "test_id"
        mock_response.model = "test-model"
        mock_client.chat.completions.create.return_value = mock_response
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "Hello"}]
        response = make_together_request_openai(messages, "test-model")

        assert response is not None
        assert response.id == "test_id"
        mock_client.chat.completions.create.assert_called_once()

    @patch('src.services.together_client.get_together_client')
    def test_make_together_request_openai_stream(self, mock_get_client):
        """Test making streaming request to Together"""
        # Mock the client and stream
        mock_client = Mock()
        mock_stream = Mock()
        mock_client.chat.completions.create.return_value = mock_stream
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "Hello"}]
        stream = make_together_request_openai_stream(messages, "test-model")

        assert stream is not None
        mock_client.chat.completions.create.assert_called_once_with(
            model="test-model",
            messages=messages,
            stream=True
        )

    def test_process_together_response(self):
        """Test processing Together response"""
        # Create a mock response
        mock_response = Mock()
        mock_response.id = "test_id"
        mock_response.object = "chat.completion"
        mock_response.created = 1234567890
        mock_response.model = "test-model"

        # Mock choice
        mock_choice = Mock()
        mock_choice.index = 0
        mock_choice.message = Mock()
        mock_choice.message.role = "assistant"
        mock_choice.message.content = "Test response"
        mock_choice.finish_reason = "stop"
        mock_response.choices = [mock_choice]

        # Mock usage
        mock_response.usage = Mock()
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_response.usage.total_tokens = 30

        processed = process_together_response(mock_response)

        assert processed["id"] == "test_id"
        assert processed["object"] == "chat.completion"
        assert processed["model"] == "test-model"
        assert len(processed["choices"]) == 1
        assert processed["choices"][0]["message"]["content"] == "Test response"
        assert processed["usage"]["total_tokens"] == 30