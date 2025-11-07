"""Unit tests for AiHubMix client"""

import pytest
from unittest.mock import Mock, patch
from src.services.aihubmix_client import (
    get_aihubmix_client,
    make_aihubmix_request_openai,
    make_aihubmix_request_openai_stream,
    process_aihubmix_response,
)


@pytest.fixture
def mock_aihubmix_config():
    """Mock AiHubMix configuration"""
    with patch("src.services.aihubmix_client.Config") as mock_config:
        mock_config.AIHUBMIX_API_KEY = "test-api-key"
        mock_config.AIHUBMIX_APP_CODE = "TEST123"
        yield mock_config


@pytest.fixture
def mock_openai_response():
    """Create a mock OpenAI-style response"""
    mock_response = Mock()
    mock_response.id = "chatcmpl-123"
    mock_response.object = "chat.completion"
    mock_response.created = 1234567890
    mock_response.model = "gpt-4o"
    mock_response.choices = [
        Mock(
            index=0,
            message=Mock(role="assistant", content="Hello"),
            finish_reason="stop",
        )
    ]
    mock_response.usage = Mock(
        prompt_tokens=10,
        completion_tokens=20,
        total_tokens=30,
    )
    return mock_response


@pytest.fixture
def mock_openai_response_no_usage():
    """Create a mock response without usage data"""
    mock_response = Mock()
    mock_response.id = "chatcmpl-123"
    mock_response.object = "chat.completion"
    mock_response.created = 1234567890
    mock_response.model = "gpt-4o"
    mock_response.choices = [
        Mock(
            index=0,
            message=Mock(role="assistant", content="Hi"),
            finish_reason="stop",
        )
    ]
    mock_response.usage = None
    return mock_response


class TestGetAihubmixClient:
    """Tests for get_aihubmix_client function"""

    def test_get_client_success(self, mock_aihubmix_config):
        """Test successful client initialization"""
        with patch("src.services.aihubmix_client.OpenAI") as mock_openai:
            mock_client = Mock()
            mock_openai.return_value = mock_client

            client = get_aihubmix_client()

            # Verify OpenAI was called with correct parameters
            mock_openai.assert_called_once()
            call_kwargs = mock_openai.call_args[1]
            assert call_kwargs["base_url"] == "https://aihubmix.com/v1"
            assert call_kwargs["api_key"] == "test-api-key"
            assert "APP-Code" in call_kwargs["default_headers"]
            assert call_kwargs["default_headers"]["APP-Code"] == "TEST123"

    def test_get_client_missing_api_key(self):
        """Test error when API key is missing"""
        with patch("src.services.aihubmix_client.Config") as mock_config:
            mock_config.AIHUBMIX_API_KEY = None
            mock_config.AIHUBMIX_APP_CODE = "TEST123"

            with pytest.raises(ValueError, match="API key not configured"):
                get_aihubmix_client()

    def test_get_client_missing_app_code(self):
        """Test error when APP-Code is missing"""
        with patch("src.services.aihubmix_client.Config") as mock_config:
            mock_config.AIHUBMIX_API_KEY = "test-api-key"
            mock_config.AIHUBMIX_APP_CODE = None

            with pytest.raises(ValueError, match="APP-Code not configured"):
                get_aihubmix_client()


class TestMakeAihubmixRequest:
    """Tests for making requests to AiHubMix"""

    @patch("src.services.aihubmix_client.get_aihubmix_client")
    def test_make_request_success(self, mock_get_client, mock_openai_response):
        """Test successful non-streaming request"""
        mock_client = Mock()
        mock_client.chat.completions.create.return_value = mock_openai_response
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "Hello"}]
        result = make_aihubmix_request_openai(messages, "gpt-4o", temperature=0.7)

        assert result == mock_openai_response
        mock_client.chat.completions.create.assert_called_once_with(
            model="gpt-4o", messages=messages, temperature=0.7
        )

    @patch("src.services.aihubmix_client.get_aihubmix_client")
    def test_make_streaming_request_success(self, mock_get_client):
        """Test successful streaming request"""
        mock_client = Mock()
        mock_stream = Mock()
        mock_client.chat.completions.create.return_value = mock_stream
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "Hello"}]
        result = make_aihubmix_request_openai_stream(messages, "gpt-4o", max_tokens=100)

        assert result == mock_stream
        mock_client.chat.completions.create.assert_called_once_with(
            model="gpt-4o", messages=messages, stream=True, max_tokens=100
        )

    @patch("src.services.aihubmix_client.get_aihubmix_client")
    def test_make_request_error(self, mock_get_client):
        """Test request error handling"""
        mock_client = Mock()
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        mock_get_client.return_value = mock_client

        with pytest.raises(Exception, match="API Error"):
            make_aihubmix_request_openai([{"role": "user", "content": "Hello"}], "gpt-4o")


class TestProcessAihubmixResponse:
    """Tests for processing AiHubMix responses"""

    def test_process_response_success(self, mock_openai_response):
        """Test successful response processing"""
        result = process_aihubmix_response(mock_openai_response)

        assert result["id"] == "chatcmpl-123"
        assert result["object"] == "chat.completion"
        assert result["model"] == "gpt-4o"
        assert len(result["choices"]) == 1
        assert result["choices"][0]["message"]["content"] == "Hello"
        assert result["usage"]["total_tokens"] == 30

    def test_process_response_no_usage(self, mock_openai_response_no_usage):
        """Test processing response without usage data"""
        result = process_aihubmix_response(mock_openai_response_no_usage)

        assert result["usage"] == {}

    def test_process_response_error(self):
        """Test error handling in response processing"""
        mock_response = Mock()
        mock_response.id = None  # Missing required field
        mock_response.object = "chat.completion"

        with pytest.raises(Exception):
            process_aihubmix_response(mock_response)
