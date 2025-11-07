"""Tests for proxy schemas, including tools field validation"""

import pytest
from pydantic import ValidationError

from src.schemas.proxy import ProxyRequest, ResponseRequest


class TestProxyRequestTools:
    """Test ProxyRequest schema with tools field"""

    def test_proxy_request_without_tools(self):
        """Test ProxyRequest without tools field"""
        request = ProxyRequest(
            model="gpt-4",
            messages=[{"role": "user", "content": "Hello"}],
        )
        assert request.tools is None

    def test_proxy_request_with_tools(self):
        """Test ProxyRequest with tools field"""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get weather",
                    "parameters": {
                        "type": "object",
                        "properties": {"location": {"type": "string"}},
                    },
                },
            }
        ]
        request = ProxyRequest(
            model="gpt-4",
            messages=[{"role": "user", "content": "Hello"}],
            tools=tools,
        )
        assert request.tools == tools
        assert len(request.tools) == 1

    def test_proxy_request_with_empty_tools_list(self):
        """Test ProxyRequest with empty tools list"""
        request = ProxyRequest(
            model="gpt-4",
            messages=[{"role": "user", "content": "Hello"}],
            tools=[],
        )
        assert request.tools == []

    def test_proxy_request_tools_extra_fields(self):
        """Test ProxyRequest accepts tools via extra fields (backward compatibility)"""
        # Even though tools is now explicitly defined, extra="allow" should still work
        request_data = {
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Hello"}],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "test_function",
                        "description": "Test",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }
            ],
        }
        request = ProxyRequest(**request_data)
        assert request.tools is not None
        assert len(request.tools) == 1


class TestResponseRequestTools:
    """Test ResponseRequest schema with tools field"""

    def test_response_request_without_tools(self):
        """Test ResponseRequest without tools field"""
        request = ResponseRequest(
            model="gpt-4",
            input=[{"role": "user", "content": "Hello"}],
        )
        assert request.tools is None

    def test_response_request_with_tools(self):
        """Test ResponseRequest with tools field"""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get weather",
                    "parameters": {
                        "type": "object",
                        "properties": {"location": {"type": "string"}},
                    },
                },
            }
        ]
        request = ResponseRequest(
            model="gpt-4",
            input=[{"role": "user", "content": "Hello"}],
            tools=tools,
        )
        assert request.tools == tools
        assert len(request.tools) == 1

    def test_response_request_with_multiple_tools(self):
        """Test ResponseRequest with multiple tools"""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get weather",
                    "parameters": {"type": "object", "properties": {}},
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_time",
                    "description": "Get time",
                    "parameters": {"type": "object", "properties": {}},
                },
            },
        ]
        request = ResponseRequest(
            model="gpt-4",
            input=[{"role": "user", "content": "Hello"}],
            tools=tools,
        )
        assert len(request.tools) == 2

