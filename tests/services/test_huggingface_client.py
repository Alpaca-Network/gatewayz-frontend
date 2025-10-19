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
        try:
            assert client is not None
            assert str(client.base_url).rstrip('/') == "https://router.huggingface.co/v1"
        finally:
            client.close()

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
        mock_response.json.return_value = {
            "id": "test_id",
            "object": "chat.completion",
            "created": 123,
            "model": "meta-llama/Llama-2-7b-chat-hf:hf-inference",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "Hello!"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 5, "completion_tokens": 7, "total_tokens": 12},
        }
        mock_response.raise_for_status.return_value = None
        mock_client.post.return_value = mock_response
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "Hello"}]
        response = make_huggingface_request_openai(messages, "meta-llama/Llama-2-7b-chat-hf")

        assert response["id"] == "test_id"
        mock_client.post.assert_called_once()
        mock_client.close.assert_called_once()

    @patch('src.services.huggingface_client.get_huggingface_client')
    def test_make_huggingface_request_openai_stream(self, mock_get_client):
        """Test making streaming request to Hugging Face"""
        from unittest.mock import MagicMock

        mock_client = MagicMock()
        mock_stream_context = MagicMock()
        mock_response = MagicMock()
        mock_response.iter_lines.return_value = [
            'data: {"id":"abc","object":"chat.completion.chunk","created":123,"model":"meta-llama/Llama-2-7b-chat-hf:hf-inference","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
            "data: [DONE]",
        ]
        mock_response.raise_for_status.return_value = None
        mock_stream_context.__enter__.return_value = mock_response
        mock_stream_context.__exit__.return_value = False
        mock_client.stream.return_value = mock_stream_context
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "Hello"}]
        stream = make_huggingface_request_openai_stream(messages, "meta-llama/Llama-2-7b-chat-hf")
        chunk = next(stream)
        # Exhaust generator to trigger cleanup
        for _ in stream:
            pass

        assert chunk.model == "meta-llama/Llama-2-7b-chat-hf:hf-inference"
        assert chunk.choices[0].delta.content == "Hello"
        mock_client.stream.assert_called_once()
        mock_client.close.assert_called_once()

    def test_process_huggingface_response(self):
        """Test processing Hugging Face response"""
        mock_response = {
            "id": "test_id",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "meta-llama/Llama-2-7b-chat-hf",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "Test response"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 20,
                "total_tokens": 30,
            },
        }

        processed = process_huggingface_response(mock_response)

        assert processed["id"] == "test_id"
        assert processed["object"] == "chat.completion"
        assert processed["model"] == "meta-llama/Llama-2-7b-chat-hf"
        assert len(processed["choices"]) == 1
        assert processed["choices"][0]["message"]["content"] == "Test response"
        assert processed["usage"]["total_tokens"] == 30
