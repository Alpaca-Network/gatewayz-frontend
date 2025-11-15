"""Tests for Google Vertex client tools extraction"""

import pytest
import sys
from unittest.mock import patch, MagicMock

# Mock vertexai modules before importing our module (needed for lazy imports)
sys.modules['vertexai'] = MagicMock()
sys.modules['vertexai.generative_models'] = MagicMock()
sys.modules['google.protobuf'] = MagicMock()
sys.modules['google.protobuf.json_format'] = MagicMock()

from src.services.google_vertex_client import make_google_vertex_request_openai, _ensure_vertex_imports


class TestGoogleVertexToolsSupport:
    """Test that Google Vertex client extracts tools parameter"""

    @patch("src.services.google_vertex_client.initialize_vertex_ai")
    @patch("src.services.google_vertex_client._ensure_vertex_imports")
    def test_tools_extracted_from_kwargs(self, mock_ensure_imports, mock_init_vertex):
        """Test that tools are extracted from kwargs"""
        # Mock the lazy import to return a mock GenerativeModel class
        mock_generative_model_class = MagicMock()
        mock_model_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "test"
        mock_response.usage_metadata = MagicMock()
        mock_response.usage_metadata.prompt_token_count = 5
        mock_response.usage_metadata.candidates_token_count = 10
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].finish_reason = 1  # STOP

        mock_model_instance.generate_content.return_value = mock_response
        mock_generative_model_class.return_value = mock_model_instance

        # Mock _ensure_vertex_imports to return our mocked GenerativeModel class
        mock_ensure_imports.return_value = (MagicMock(), mock_generative_model_class)

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get weather",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]

        # Check that tools were detected (warning should be logged)
        with patch("src.services.google_vertex_client.logger") as mock_logger:
            make_google_vertex_request_openai(
                messages=[{"role": "user", "content": "test"}],
                model="gemini-2.0-flash",
                tools=tools,
            )

            # Check that warning or info was logged about tools
            all_calls = []
            all_calls.extend(mock_logger.warning.call_args_list)
            all_calls.extend(mock_logger.info.call_args_list)

            tools_logged = any(
                "tools" in str(call).lower()
                for call in all_calls
                if call
            )
            assert tools_logged, "Should log about tools parameter"

    @patch("src.services.google_vertex_client.initialize_vertex_ai")
    @patch("src.services.google_vertex_client._ensure_vertex_imports")
    def test_tools_not_in_payload_yet(self, mock_ensure_imports, mock_init_vertex):
        """Test that tools are not yet added to request payload (not implemented)"""
        # Mock the lazy import to return a mock GenerativeModel class
        mock_generative_model_class = MagicMock()
        mock_model_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "test"
        mock_response.usage_metadata = MagicMock()
        mock_response.usage_metadata.prompt_token_count = 5
        mock_response.usage_metadata.candidates_token_count = 10
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].finish_reason = 1  # STOP

        mock_model_instance.generate_content.return_value = mock_response
        mock_generative_model_class.return_value = mock_model_instance

        # Mock _ensure_vertex_imports to return our mocked GenerativeModel class
        mock_ensure_imports.return_value = (MagicMock(), mock_generative_model_class)

        tools = [{"type": "function", "function": {"name": "test"}}]

        make_google_vertex_request_openai(
            messages=[{"role": "user", "content": "test"}],
            model="gemini-2.0-flash",
            tools=tools,
        )

        # Check that generate_content was called
        assert mock_model_instance.generate_content.called

        # Get the call arguments
        call_args = mock_model_instance.generate_content.call_args

        # Tools transformation not yet implemented, so no tools in the call
        # This test just verifies the request goes through without errors
        assert call_args is not None

