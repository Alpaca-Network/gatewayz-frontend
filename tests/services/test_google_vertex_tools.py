"""Tests for Google Vertex client tools extraction"""

import pytest
from unittest.mock import patch, MagicMock

from src.services.google_vertex_client import make_google_vertex_request_openai


class TestGoogleVertexToolsSupport:
    """Test that Google Vertex client extracts tools parameter"""

    @patch("src.services.google_vertex_client.get_google_vertex_access_token")
    @patch("src.services.google_vertex_client.httpx.Client")
    def test_tools_extracted_from_kwargs(self, mock_client_class, mock_get_token):
        """Test that tools are extracted from kwargs"""
        mock_get_token.return_value = "test-token"
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {"parts": [{"text": "test"}]},
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 10},
        }
        mock_response.raise_for_status = MagicMock()
        
        mock_client_instance = MagicMock()
        mock_client_instance.post.return_value = mock_response
        mock_client_class.return_value.__enter__.return_value = mock_client_instance
        
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

    @patch("src.services.google_vertex_client.get_google_vertex_access_token")
    @patch("src.services.google_vertex_client.httpx.Client")
    def test_tools_not_in_payload_yet(self, mock_client_class, mock_get_token):
        """Test that tools are not yet added to request payload (not implemented)"""
        mock_get_token.return_value = "test-token"
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {"parts": [{"text": "test"}]},
                    "finishReason": "STOP",
                }
            ],
            "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 10},
        }
        mock_response.raise_for_status = MagicMock()
        
        mock_client_instance = MagicMock()
        mock_client_instance.post.return_value = mock_response
        mock_client_class.return_value.__enter__.return_value = mock_client_instance
        
        tools = [{"type": "function", "function": {"name": "test"}}]
        
        make_google_vertex_request_openai(
            messages=[{"role": "user", "content": "test"}],
            model="gemini-2.0-flash",
            tools=tools,
        )
        
        # Check that request was made
        assert mock_client_instance.post.called
        
        # Get the request payload
        call_args = mock_client_instance.post.call_args
        request_body = call_args[1]["json"]
        
        # Tools should not be in payload yet (transformation not implemented)
        assert "tools" not in request_body

