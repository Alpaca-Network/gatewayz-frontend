"""Tests for Google Vertex AI client"""

import pytest
import sys
from unittest.mock import patch, MagicMock, Mock

# Mock Google Cloud dependencies before importing our module
# This allows tests to run even if google-cloud-aiplatform isn't installed
sys.modules['google'] = MagicMock()
sys.modules['google.auth'] = MagicMock()
sys.modules['google.auth.transport'] = MagicMock()
sys.modules['google.auth.transport.requests'] = MagicMock()
sys.modules['google.oauth2'] = MagicMock()
sys.modules['google.oauth2.service_account'] = MagicMock()

# Mock vertexai before importing our module (needed for lazy imports)
sys.modules['vertexai'] = MagicMock()
sys.modules['vertexai.generative_models'] = MagicMock()
sys.modules['google.protobuf'] = MagicMock()
sys.modules['google.protobuf.json_format'] = MagicMock()

# Now import our module (which will use the mocked dependencies)
try:
    from src.services.google_vertex_client import (
        make_google_vertex_request_openai,
        make_google_vertex_request_openai_stream,
        transform_google_vertex_model_id,
        _build_vertex_content,
        _process_google_vertex_rest_response,
        _ensure_vertex_imports,
        _ensure_protobuf_imports,
    )
    GOOGLE_VERTEX_AVAILABLE = True
except ImportError:
    GOOGLE_VERTEX_AVAILABLE = False


@pytest.mark.skipif(not GOOGLE_VERTEX_AVAILABLE, reason="Google Vertex AI SDK not available")
class TestTransformGoogleVertexModelId:
    """Tests for model ID transformation"""

    def test_transform_simple_model_id(self):
        """Test transforming a simple model ID returns the model name"""
        result = transform_google_vertex_model_id("gemini-2.0-flash")
        assert result == "gemini-2.0-flash"

    def test_transform_full_resource_name(self):
        """Test that full resource names are extracted to simple model name"""
        model_id = "projects/my-project/locations/us-central1/publishers/google/models/gemini-2.0-flash"
        result = transform_google_vertex_model_id(model_id)
        assert result == "gemini-2.0-flash"

    def test_transform_various_models(self):
        """Test transforming various model IDs"""
        models = [
            "gemini-2.0-flash",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-1.0-pro",
            "gemini-2.5-flash-lite-preview-09-2025",
        ]
        for model in models:
            result = transform_google_vertex_model_id(model)
            assert result == model


@pytest.mark.skipif(not GOOGLE_VERTEX_AVAILABLE, reason="Google Vertex AI SDK not available")
class TestBuildVertexContent:
    """Tests for content building"""

    def test_build_simple_text_content(self):
        """Test building content from simple text messages"""
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]
        result = _build_vertex_content(messages)

        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[0]["parts"][0]["text"] == "Hello"
        assert result[1]["role"] == "model"
        assert result[1]["parts"][0]["text"] == "Hi there!"

    def test_build_multimodal_content(self):
        """Test building multimodal content with images"""
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What's in this image?"},
                    {
                        "type": "image_url",
                        "image_url": {"url": "https://example.com/image.jpg"}
                    },
                ],
            }
        ]
        result = _build_vertex_content(messages)

        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert len(result[0]["parts"]) >= 2

    def test_build_system_message(self):
        """Test that system messages are mapped to model role"""
        messages = [
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": "Hello"},
        ]
        result = _build_vertex_content(messages)

        # System messages are not user messages, so they map to "model"
        # In Vertex AI, only "user" and "model" roles exist
        assert result[0]["role"] == "model"
        assert result[1]["role"] == "user"


@pytest.mark.skipif(not GOOGLE_VERTEX_AVAILABLE, reason="Google Vertex AI SDK not available")
class TestProcessGoogleVertexResponse:
    """Tests for response processing"""

    def test_process_successful_rest_response(self):
        """Test processing a successful REST API response"""
        # Mock REST API response format (not protobuf)
        response_data = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "This is a response"}
                        ]
                    },
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 10,
                "candidatesTokenCount": 5,
            }
        }

        result = _process_google_vertex_rest_response(response_data, "gemini-2.0-flash")

        assert result["model"] == "gemini-2.0-flash"
        assert result["choices"][0]["message"]["content"] == "This is a response"
        assert result["choices"][0]["finish_reason"] == "stop"
        assert result["usage"]["prompt_tokens"] == 10
        assert result["usage"]["completion_tokens"] == 5
        assert result["usage"]["total_tokens"] == 15

    def test_process_multiple_content_parts(self):
        """Test processing response with multiple content parts"""
        # Mock REST API response with multiple parts
        response_data = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Part 1 "},
                            {"text": "Part 2"}
                        ]
                    },
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 10,
                "candidatesTokenCount": 5,
            }
        }

        result = _process_google_vertex_rest_response(response_data, "gemini-1.5-pro")

        assert result["choices"][0]["message"]["content"] == "Part 1 Part 2"

    def test_process_gemini_flash_lite_response(self):
        """Test processing response from gemini-2.5-flash-lite-preview-09-2025"""
        response_data = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Flash Lite response"}
                        ]
                    },
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 5,
                "candidatesTokenCount": 3,
            }
        }

        result = _process_google_vertex_rest_response(response_data, "gemini-2.5-flash-lite-preview-09-2025")

        assert result["model"] == "gemini-2.5-flash-lite-preview-09-2025"
        assert result["choices"][0]["message"]["content"] == "Flash Lite response"
        assert result["usage"]["total_tokens"] == 8


@pytest.mark.skipif(not GOOGLE_VERTEX_AVAILABLE, reason="Google Vertex AI SDK not available")
class TestMakeGoogleVertexRequest:
    """Tests for making requests to Google Vertex"""

    @patch("src.services.google_vertex_client.initialize_vertex_ai")
    @patch("src.services.google_vertex_client._ensure_vertex_imports")
    def test_make_request_with_parameters(self, mock_ensure_imports, mock_init_vertex):
        """Test making a request with various parameters"""
        # Mock the lazy import to return a mock GenerativeModel class
        mock_generative_model_class = Mock()
        mock_model_instance = Mock()
        mock_response = Mock()
        mock_response.text = "Response"
        mock_response.usage_metadata = Mock()
        mock_response.usage_metadata.prompt_token_count = 5
        mock_response.usage_metadata.candidates_token_count = 10
        mock_response.candidates = [Mock()]
        mock_response.candidates[0].finish_reason = 1  # STOP

        mock_model_instance.generate_content.return_value = mock_response
        mock_generative_model_class.return_value = mock_model_instance

        # Mock _ensure_vertex_imports to return our mocked GenerativeModel class
        mock_ensure_imports.return_value = (Mock(), mock_generative_model_class)

        messages = [
            {"role": "user", "content": "Hello"}
        ]

        result = make_google_vertex_request_openai(
            messages=messages,
            model="gemini-2.0-flash",
            max_tokens=100,
            temperature=0.7,
            top_p=0.9
        )

        assert "choices" in result
        assert result["model"] == "gemini-2.0-flash"
        assert "usage" in result
        assert result["choices"][0]["message"]["content"] == "Response"

        # Verify initialization and lazy import were called
        mock_init_vertex.assert_called_once()
        mock_ensure_imports.assert_called_once()

    @patch("src.services.google_vertex_client.initialize_vertex_ai")
    @patch("src.services.google_vertex_client._ensure_vertex_imports")
    def test_make_streaming_request(self, mock_ensure_imports, mock_init_vertex):
        """Test making a streaming request"""
        # Mock the lazy import to return a mock GenerativeModel class
        mock_generative_model_class = Mock()
        mock_model_instance = Mock()
        mock_response = Mock()
        mock_response.text = "Streaming response"
        mock_response.usage_metadata = Mock()
        mock_response.usage_metadata.prompt_token_count = 5
        mock_response.usage_metadata.candidates_token_count = 10
        mock_response.candidates = [Mock()]
        mock_response.candidates[0].finish_reason = 1  # STOP

        mock_model_instance.generate_content.return_value = mock_response
        mock_generative_model_class.return_value = mock_model_instance

        # Mock _ensure_vertex_imports to return our mocked GenerativeModel class
        mock_ensure_imports.return_value = (Mock(), mock_generative_model_class)

        messages = [
            {"role": "user", "content": "Hello"}
        ]

        # Get the generator
        gen = make_google_vertex_request_openai_stream(
            messages=messages,
            model="gemini-1.5-flash",
            max_tokens=100
        )

        # Collect all chunks
        chunks = list(gen)

        assert len(chunks) >= 2  # At least a content chunk and a DONE chunk
        assert any("Streaming response" in chunk for chunk in chunks)
        assert any("[DONE]" in chunk for chunk in chunks)

    @patch("src.services.google_vertex_client.initialize_vertex_ai")
    @patch("src.services.google_vertex_client._ensure_vertex_imports")
    def test_make_request_gemini_flash_lite(self, mock_ensure_imports, mock_init_vertex):
        """Test making a request to gemini-2.5-flash-lite (maps to preview version)"""
        # Mock the lazy import to return a mock GenerativeModel class
        mock_generative_model_class = Mock()
        mock_model_instance = Mock()
        mock_response = Mock()
        mock_response.text = "Flash Lite works!"
        mock_response.usage_metadata = Mock()
        mock_response.usage_metadata.prompt_token_count = 3
        mock_response.usage_metadata.candidates_token_count = 4
        mock_response.candidates = [Mock()]
        mock_response.candidates[0].finish_reason = 1  # STOP

        mock_model_instance.generate_content.return_value = mock_response
        mock_generative_model_class.return_value = mock_model_instance

        # Mock _ensure_vertex_imports to return our mocked GenerativeModel class
        mock_ensure_imports.return_value = (Mock(), mock_generative_model_class)

        messages = [
            {"role": "user", "content": "Test"}
        ]

        result = make_google_vertex_request_openai(
            messages=messages,
            model="gemini-2.5-flash-lite-preview-09-2025"
        )

        assert result["model"] == "gemini-2.5-flash-lite-preview-09-2025"
        assert result["choices"][0]["message"]["content"] == "Flash Lite works!"

        # Verify the lazy import was called
        mock_ensure_imports.assert_called_once()


@pytest.mark.skipif(not GOOGLE_VERTEX_AVAILABLE, reason="Google Vertex AI SDK not available")
class TestGoogleVertexModelIntegration:
    """Integration tests for model detection and transformation"""

    @patch.dict('os.environ', {'GOOGLE_VERTEX_CREDENTIALS_JSON': '{"type":"service_account"}'})
    def test_gemini_model_detection(self):
        """Test that gemini models are properly detected when credentials are available"""
        from src.services.model_transformations import detect_provider_from_model_id

        models = [
            "gemini-2.0-flash",
            "gemini-1.5-pro",
            "google/gemini-1.5-flash",
        ]

        for model in models:
            provider = detect_provider_from_model_id(model)
            assert provider == "google-vertex", f"Model {model} should detect as google-vertex, got {provider}"

    def test_model_id_transformation_consistency(self):
        """Test that model IDs are transformed consistently"""
        from src.services.model_transformations import transform_model_id

        result1 = transform_model_id("gemini-2.0-flash", "google-vertex")
        result2 = transform_model_id("gemini-2.0-flash", "google-vertex")

        assert result1 == result2
        assert "gemini-2.0-flash" in result1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
