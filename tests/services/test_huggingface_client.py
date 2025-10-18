"""Tests for Hugging Face Inference API client"""
import pytest
from unittest.mock import Mock, patch
from src.services.huggingface_client import (
    get_huggingface_client,
    make_huggingface_request_openai,
    make_huggingface_request_openai_stream,
    process_huggingface_response
)


class TestHuggingFaceClient:
    """Test Hugging Face Inference API client functionality"""

    @patch('src.services.huggingface_client.Config.HUG_API_KEY', 'hf_test_token')
    def test_get_huggingface_client(self):
        """Test getting Hugging Face client"""
        client = get_huggingface_client()
        assert client is not None
        assert str(client.base_url).rstrip('/') == "https://router.huggingface.co/v1"

    @patch('src.services.huggingface_client.Config.HUG_API_KEY', None)
    def test_get_huggingface_client_no_key(self):
        """Test getting Hugging Face client without API key"""
        with pytest.raises(ValueError, match="Hugging Face API key"):
            get_huggingface_client()

    @patch('src.services.huggingface_client.get_huggingface_client')
    def test_make_huggingface_request_openai(self, mock_get_client):
        """Test making request to Hugging Face"""
        # Mock the client and response
        mock_client = Mock()
        mock_response = Mock()
        mock_response.id = "test_id"
        mock_response.model = "meta-llama/Llama-2-7b-chat-hf"
        mock_client.chat.completions.create.return_value = mock_response
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "Hello"}]
        response = make_huggingface_request_openai(messages, "meta-llama/Llama-2-7b-chat-hf")

        assert response is not None
        assert response.id == "test_id"
        mock_client.chat.completions.create.assert_called_once()

    @patch('src.services.huggingface_client.get_huggingface_client')
    def test_make_huggingface_request_openai_stream(self, mock_get_client):
        """Test making streaming request to Hugging Face"""
        # Mock the client and stream
        mock_client = Mock()
        mock_stream = Mock()
        mock_client.chat.completions.create.return_value = mock_stream
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "Hello"}]
        stream = make_huggingface_request_openai_stream(messages, "meta-llama/Llama-2-7b-chat-hf")

        assert stream is not None
        # The function automatically appends :hf-inference suffix if not present
        mock_client.chat.completions.create.assert_called_once_with(
            model="meta-llama/Llama-2-7b-chat-hf:hf-inference",
            messages=messages,
            stream=True
        )

    def test_process_huggingface_response(self):
        """Test processing Hugging Face response"""
        # Create a mock response
        mock_response = Mock()
        mock_response.id = "test_id"
        mock_response.object = "chat.completion"
        mock_response.created = 1234567890
        mock_response.model = "meta-llama/Llama-2-7b-chat-hf"

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

        processed = process_huggingface_response(mock_response)

        assert processed["id"] == "test_id"
        assert processed["object"] == "chat.completion"
        assert processed["model"] == "meta-llama/Llama-2-7b-chat-hf"
        assert len(processed["choices"]) == 1
        assert processed["choices"][0]["message"]["content"] == "Test response"
        assert processed["usage"]["total_tokens"] == 30
