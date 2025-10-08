"""Unit tests for Featherless client"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os


@pytest.fixture
def mock_featherless_api_key():
    """Mock the Featherless API key"""
    with patch('src.services.featherless_client.Config') as mock_config:
        mock_config.FEATHERLESS_API_KEY = "test_featherless_key_123"
        yield mock_config


@pytest.fixture
def mock_openai_response():
    """Create a mock OpenAI-style response"""
    mock_response = Mock()
    mock_response.id = "chatcmpl-test123"
    mock_response.object = "chat.completion"
    mock_response.created = 1234567890
    mock_response.model = "meta-llama/Meta-Llama-3.1-8B-Instruct"

    # Mock choice
    mock_choice = Mock()
    mock_choice.index = 0
    mock_choice.message = Mock()
    mock_choice.message.role = "assistant"
    mock_choice.message.content = "Hello! How can I help you?"
    mock_choice.finish_reason = "stop"
    mock_response.choices = [mock_choice]

    # Mock usage
    mock_response.usage = Mock()
    mock_response.usage.prompt_tokens = 10
    mock_response.usage.completion_tokens = 8
    mock_response.usage.total_tokens = 18

    return mock_response


@pytest.fixture
def mock_openai_response_no_usage():
    """Create a mock response without usage data"""
    mock_response = Mock()
    mock_response.id = "chatcmpl-test123"
    mock_response.object = "chat.completion"
    mock_response.created = 1234567890
    mock_response.model = "meta-llama/Meta-Llama-3.1-8B-Instruct"

    mock_choice = Mock()
    mock_choice.index = 0
    mock_choice.message = Mock()
    mock_choice.message.role = "assistant"
    mock_choice.message.content = "Test response"
    mock_choice.finish_reason = "stop"
    mock_response.choices = [mock_choice]

    mock_response.usage = None

    return mock_response


class TestGetFeatherlessClient:
    """Test get_featherless_client function"""

    def test_get_featherless_client_success(self, mock_featherless_api_key):
        """Test successful client initialization"""
        from src.services.featherless_client import get_featherless_client

        with patch('src.services.featherless_client.OpenAI') as mock_openai:
            mock_client = Mock()
            mock_openai.return_value = mock_client

            client = get_featherless_client()

            assert client is not None
            mock_openai.assert_called_once_with(
                base_url="https://api.featherless.ai/v1",
                api_key="test_featherless_key_123"
            )

    def test_get_featherless_client_missing_key(self):
        """Test client initialization with missing API key"""
        from src.services.featherless_client import get_featherless_client

        with patch('src.services.featherless_client.Config') as mock_config:
            mock_config.FEATHERLESS_API_KEY = None

            with pytest.raises(ValueError, match="Featherless API key not configured"):
                get_featherless_client()


class TestMakeFeatherlessRequest:
    """Test make_featherless_request_openai function"""

    def test_make_featherless_request_openai_forwards_args(
        self, mock_featherless_api_key, mock_openai_response
    ):
        """Test that request forwards all arguments correctly"""
        from src.services.featherless_client import make_featherless_request_openai

        messages = [{"role": "user", "content": "Hello"}]
        model = "meta-llama/Meta-Llama-3.1-8B-Instruct"

        with patch('src.services.featherless_client.get_featherless_client') as mock_get_client:
            mock_client = Mock()
            mock_completions = Mock()
            mock_completions.create.return_value = mock_openai_response
            mock_client.chat.completions = mock_completions
            mock_get_client.return_value = mock_client

            response = make_featherless_request_openai(
                messages=messages,
                model=model,
                max_tokens=100,
                temperature=0.7
            )

            assert response == mock_openai_response
            mock_completions.create.assert_called_once_with(
                model=model,
                messages=messages,
                max_tokens=100,
                temperature=0.7
            )

    def test_make_featherless_request_openai_error(self, mock_featherless_api_key):
        """Test request error handling"""
        from src.services.featherless_client import make_featherless_request_openai

        messages = [{"role": "user", "content": "Hello"}]
        model = "meta-llama/Meta-Llama-3.1-8B-Instruct"

        with patch('src.services.featherless_client.get_featherless_client') as mock_get_client:
            mock_client = Mock()
            mock_client.chat.completions.create.side_effect = Exception("API error")
            mock_get_client.return_value = mock_client

            with pytest.raises(Exception, match="API error"):
                make_featherless_request_openai(messages=messages, model=model)


class TestMakeFeatherlessRequestStream:
    """Test make_featherless_request_openai_stream function"""

    def test_make_featherless_request_openai_stream(self, mock_featherless_api_key):
        """Test streaming request"""
        from src.services.featherless_client import make_featherless_request_openai_stream

        messages = [{"role": "user", "content": "Hello"}]
        model = "meta-llama/Meta-Llama-3.1-8B-Instruct"
        mock_stream = Mock()

        with patch('src.services.featherless_client.get_featherless_client') as mock_get_client:
            mock_client = Mock()
            mock_completions = Mock()
            mock_completions.create.return_value = mock_stream
            mock_client.chat.completions = mock_completions
            mock_get_client.return_value = mock_client

            stream = make_featherless_request_openai_stream(
                messages=messages,
                model=model,
                max_tokens=100
            )

            assert stream == mock_stream
            mock_completions.create.assert_called_once_with(
                model=model,
                messages=messages,
                stream=True,
                max_tokens=100
            )

    def test_make_featherless_request_openai_stream_error(self, mock_featherless_api_key):
        """Test streaming request error handling"""
        from src.services.featherless_client import make_featherless_request_openai_stream

        messages = [{"role": "user", "content": "Hello"}]
        model = "meta-llama/Meta-Llama-3.1-8B-Instruct"

        with patch('src.services.featherless_client.get_featherless_client') as mock_get_client:
            mock_client = Mock()
            mock_client.chat.completions.create.side_effect = Exception("Streaming error")
            mock_get_client.return_value = mock_client

            with pytest.raises(Exception, match="Streaming error"):
                make_featherless_request_openai_stream(messages=messages, model=model)


class TestProcessFeatherlessResponse:
    """Test process_featherless_response function"""

    def test_process_featherless_response_happy(self, mock_openai_response):
        """Test processing a normal response"""
        from src.services.featherless_client import process_featherless_response

        processed = process_featherless_response(mock_openai_response)

        assert processed["id"] == "chatcmpl-test123"
        assert processed["object"] == "chat.completion"
        assert processed["created"] == 1234567890
        assert processed["model"] == "meta-llama/Meta-Llama-3.1-8B-Instruct"
        assert len(processed["choices"]) == 1
        assert processed["choices"][0]["index"] == 0
        assert processed["choices"][0]["message"]["role"] == "assistant"
        assert processed["choices"][0]["message"]["content"] == "Hello! How can I help you?"
        assert processed["choices"][0]["finish_reason"] == "stop"
        assert processed["usage"]["prompt_tokens"] == 10
        assert processed["usage"]["completion_tokens"] == 8
        assert processed["usage"]["total_tokens"] == 18

    def test_process_featherless_response_no_usage(self, mock_openai_response_no_usage):
        """Test processing response without usage data"""
        from src.services.featherless_client import process_featherless_response

        processed = process_featherless_response(mock_openai_response_no_usage)

        assert processed["id"] == "chatcmpl-test123"
        assert processed["model"] == "meta-llama/Meta-Llama-3.1-8B-Instruct"
        assert len(processed["choices"]) == 1
        assert processed["usage"] == {}

    def test_process_featherless_response_error(self):
        """Test processing error handling"""
        from src.services.featherless_client import process_featherless_response

        bad_response = Mock()
        bad_response.id = None  # This will cause an error

        # The function doesn't explicitly handle errors, so it should raise
        with pytest.raises(Exception):
            process_featherless_response(bad_response)
