"""Unit tests for AiHubMix client"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from src.services.aihubmix_client import (
    get_aihubmix_client,
    make_aihubmix_request_openai,
    make_aihubmix_request_openai_stream,
    process_aihubmix_response,
    fetch_models_from_aihubmix,
    normalize_aihubmix_model,
)


class TestGetAihubmixClient:
    """Tests for get_aihubmix_client function"""

    @patch("src.services.aihubmix_client.Config")
    def test_get_client_success(self, mock_config):
        """Test successful client initialization"""
        mock_config.AIHUBMIX_API_KEY = "test-api-key"
        mock_config.AIHUBMIX_APP_CODE = "TEST123"

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

    @patch("src.services.aihubmix_client.Config")
    def test_get_client_missing_api_key(self, mock_config):
        """Test error when API key is missing"""
        mock_config.AIHUBMIX_API_KEY = None
        mock_config.AIHUBMIX_APP_CODE = "TEST123"

        with pytest.raises(ValueError, match="API key not configured"):
            get_aihubmix_client()

    @patch("src.services.aihubmix_client.Config")
    def test_get_client_missing_app_code(self, mock_config):
        """Test error when APP-Code is missing"""
        mock_config.AIHUBMIX_API_KEY = "test-api-key"
        mock_config.AIHUBMIX_APP_CODE = None

        with pytest.raises(ValueError, match="APP-Code not configured"):
            get_aihubmix_client()


class TestMakeAihubmixRequest:
    """Tests for making requests to AiHubMix"""

    @patch("src.services.aihubmix_client.get_aihubmix_client")
    def test_make_request_success(self, mock_get_client):
        """Test successful non-streaming request"""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.id = "chatcmpl-123"
        mock_response.object = "chat.completion"
        mock_response.created = 1234567890
        mock_response.model = "gpt-4o"
        mock_response.choices = [
            Mock(index=0, message=Mock(role="assistant", content="Hello"), finish_reason="stop")
        ]
        mock_response.usage = Mock(prompt_tokens=10, completion_tokens=20, total_tokens=30)

        mock_client.chat.completions.create.return_value = mock_response
        mock_get_client.return_value = mock_client

        messages = [{"role": "user", "content": "Hello"}]
        result = make_aihubmix_request_openai(messages, "gpt-4o", temperature=0.7)

        assert result == mock_response
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

    def test_process_response_success(self):
        """Test successful response processing"""
        mock_response = Mock()
        mock_response.id = "chatcmpl-123"
        mock_response.object = "chat.completion"
        mock_response.created = 1234567890
        mock_response.model = "gpt-4o"
        mock_response.choices = [
            Mock(
                index=0,
                message=Mock(role="assistant", content="Hello there"),
                finish_reason="stop",
            )
        ]
        mock_response.usage = Mock(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30,
        )

        result = process_aihubmix_response(mock_response)

        assert result["id"] == "chatcmpl-123"
        assert result["object"] == "chat.completion"
        assert result["model"] == "gpt-4o"
        assert len(result["choices"]) == 1
        assert result["choices"][0]["message"]["content"] == "Hello there"
        assert result["usage"]["total_tokens"] == 30

    def test_process_response_no_usage(self):
        """Test processing response without usage data"""
        mock_response = Mock()
        mock_response.id = "chatcmpl-123"
        mock_response.object = "chat.completion"
        mock_response.created = 1234567890
        mock_response.model = "gpt-4o"
        mock_response.choices = [Mock(index=0, message=Mock(role="assistant", content="Hi"))]
        mock_response.usage = None

        result = process_aihubmix_response(mock_response)

        assert result["usage"] == {}

    def test_process_response_error(self):
        """Test error handling in response processing"""
        mock_response = Mock()
        mock_response.id = None  # Missing required field
        mock_response.object = "chat.completion"

        with pytest.raises(Exception):
            process_aihubmix_response(mock_response)


class TestFetchModelsFromAihubmix:
    """Tests for fetching models from AiHubMix"""

    @patch("src.services.aihubmix_client.get_aihubmix_client")
    def test_fetch_models_success(self, mock_get_client):
        """Test successful model fetching"""
        mock_client = Mock()
        mock_model_1 = Mock()
        mock_model_1.id = "gpt-4o"
        mock_model_2 = Mock()
        mock_model_2.id = "gpt-3.5-turbo"

        mock_response = Mock()
        mock_response.data = [mock_model_1, mock_model_2]

        mock_client.models.list.return_value = mock_response
        mock_get_client.return_value = mock_client

        models = fetch_models_from_aihubmix()

        assert len(models) == 2
        assert models[0].id == "gpt-4o"
        assert models[1].id == "gpt-3.5-turbo"

    @patch("src.services.aihubmix_client.get_aihubmix_client")
    def test_fetch_models_empty_response(self, mock_get_client):
        """Test handling empty model response"""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.data = []

        mock_client.models.list.return_value = mock_response
        mock_get_client.return_value = mock_client

        models = fetch_models_from_aihubmix()

        assert models == []

    @patch("src.services.aihubmix_client.get_aihubmix_client")
    def test_fetch_models_error(self, mock_get_client):
        """Test error handling during model fetch"""
        mock_client = Mock()
        mock_client.models.list.side_effect = Exception("API Error")
        mock_get_client.return_value = mock_client

        models = fetch_models_from_aihubmix()

        # Should return empty list on error
        assert models == []


class TestNormalizeAihubmixModel:
    """Tests for normalizing AiHubMix models"""

    def test_normalize_model_success(self):
        """Test successful model normalization"""
        mock_model = Mock()
        mock_model.id = "gpt-4o"
        mock_model.name = "GPT-4o"
        mock_model.created_at = 1609459200
        mock_model.description = "OpenAI's GPT-4 with vision"
        mock_model.context_length = 128000

        result = normalize_aihubmix_model(mock_model)

        assert result is not None
        assert result["id"] == "gpt-4o"
        assert result["slug"] == "aihubmix/gpt-4o"
        assert result["canonical_slug"] == "aihubmix/gpt-4o"
        assert result["name"] == "GPT-4o"
        assert result["provider_slug"] == "aihubmix"
        assert result["source_gateway"] == "aihubmix"
        assert result["context_length"] == 128000

    def test_normalize_model_missing_id(self):
        """Test normalization with missing model ID"""
        mock_model = Mock()
        mock_model.id = None

        result = normalize_aihubmix_model(mock_model)

        assert result is None

    def test_normalize_model_defaults(self):
        """Test normalization with default values"""
        mock_model = Mock()
        mock_model.id = "test-model"
        # Remove other attributes to test defaults
        for attr in ["name", "created_at", "description", "context_length"]:
            if hasattr(mock_model, attr):
                delattr(mock_model, attr)

        # Use spec to limit attributes
        mock_model = Mock(spec=["id"])
        mock_model.id = "test-model"

        result = normalize_aihubmix_model(mock_model)

        assert result is not None
        assert result["id"] == "test-model"
        assert result["name"] == "test-model"  # Defaults to ID
        assert result["context_length"] == 4096  # Default context
        assert "pricing" in result

    def test_normalize_model_error(self):
        """Test error handling in model normalization"""
        # Pass invalid input
        result = normalize_aihubmix_model(None)

        assert result is None
