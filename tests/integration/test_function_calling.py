"""Integration tests for function calling/tools support"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_user():
    """Mock user object"""
    return {
        "id": 1,
        "email": "test@example.com",
        "credits": 1000,
        "plan_id": 1,
        "environment_tag": "live",
    }


@pytest.fixture
def auth_headers():
    """Auth headers for testing"""
    return {"Authorization": "Bearer test-api-key"}


class TestFunctionCallingIntegration:
    """Integration tests for function calling"""

    @patch("src.db.users.get_user")
    @patch("src.routes.chat.make_openrouter_request_openai")
    @patch("src.routes.chat.process_openrouter_response")
    @patch("src.services.rate_limiting.get_rate_limit_manager")
    @patch("src.services.trial_validation.validate_trial_access")
    @patch("src.db.plans.enforce_plan_limits")
    @patch("src.db.users.deduct_credits")
    @patch("src.db.users.record_usage")
    @patch("src.db.rate_limits.update_rate_limit_usage")
    @patch("src.db.api_keys.increment_api_key_usage")
    @patch("src.db.activity.log_activity")
    @patch("src.services.pricing.calculate_cost")
    def test_chat_completions_with_tools(
        self,
        mock_calculate_cost,
        mock_log_activity,
        mock_increment,
        mock_update_rate,
        mock_record,
        mock_deduct,
        mock_enforce_limits,
        mock_trial,
        mock_rate_limiter,
        mock_process,
        mock_request,
        mock_get_user,
        client,
        mock_user,
        auth_headers,
    ):
        """Test that tools parameter is passed through to provider"""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_trial.return_value = {"is_valid": True, "is_trial": False, "is_expired": False}
        mock_enforce_limits.return_value = {"allowed": True}
        mock_calculate_cost.return_value = 0.01

        mock_rl_result = MagicMock()
        mock_rl_result.allowed = True
        mock_rl_result.remaining_requests = 1000
        mock_rl_result.remaining_tokens = 1000000
        mock_rl_result.retry_after = None

        mock_rl_manager = MagicMock()
        mock_rl_manager.check_rate_limit = AsyncMock(return_value=mock_rl_result)
        mock_rl_manager.release_concurrency = AsyncMock()
        mock_rate_limiter.return_value = mock_rl_manager

        # Mock response
        mock_response = MagicMock()
        mock_response.id = "test-id"
        mock_response.object = "chat.completion"
        mock_response.created = 1234567890
        mock_response.model = "gpt-4"
        mock_response.choices = [
            MagicMock(
                index=0,
                message=MagicMock(role="assistant", content="test response"),
                finish_reason="stop",
            )
        ]
        mock_response.usage = MagicMock(
            prompt_tokens=10, completion_tokens=5, total_tokens=15
        )
        mock_request.return_value = mock_response

        mock_process.return_value = {
            "id": "test-id",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "gpt-4",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "test response"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        }

        # Test request with tools
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

        response = client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={
                "model": "gpt-4",
                "messages": [{"role": "user", "content": "What's the weather?"}],
                "tools": tools,
            },
        )

        # Verify request was made
        assert mock_request.called
        
        # Get the call arguments - check both positional and keyword args
        call_args = mock_request.call_args
        # Function is called as: make_openrouter_request_openai(messages, model, **optional)
        # So tools should be in kwargs
        if len(call_args) > 1:
            kwargs = call_args[1]
        else:
            kwargs = {}
        
        # Verify tools were passed
        assert "tools" in kwargs, "Tools should be passed to provider function"
        assert kwargs["tools"] == tools, "Tools should match input"

    @patch("src.db.users.get_user")
    @patch("src.routes.chat.make_huggingface_request_openai")
    @patch("src.routes.chat.process_huggingface_response")
    @patch("src.services.rate_limiting.get_rate_limit_manager")
    @patch("src.services.trial_validation.validate_trial_access")
    @patch("src.db.plans.enforce_plan_limits")
    @patch("src.db.users.deduct_credits")
    @patch("src.db.users.record_usage")
    @patch("src.db.rate_limits.update_rate_limit_usage")
    @patch("src.db.api_keys.increment_api_key_usage")
    @patch("src.db.activity.log_activity")
    @patch("src.services.pricing.calculate_cost")
    def test_huggingface_with_tools(
        self,
        mock_calculate_cost,
        mock_log_activity,
        mock_increment,
        mock_update_rate,
        mock_record,
        mock_deduct,
        mock_enforce_limits,
        mock_trial,
        mock_rate_limiter,
        mock_process,
        mock_request,
        mock_get_user,
        client,
        mock_user,
        auth_headers,
    ):
        """Test that HuggingFace receives tools parameter"""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_trial.return_value = {"is_valid": True, "is_trial": False, "is_expired": False}
        mock_enforce_limits.return_value = {"allowed": True}
        mock_calculate_cost.return_value = 0.01

        mock_rl_result = MagicMock()
        mock_rl_result.allowed = True
        mock_rl_result.remaining_requests = 1000
        mock_rl_result.remaining_tokens = 1000000
        mock_rl_result.retry_after = None

        mock_rl_manager = MagicMock()
        mock_rl_manager.check_rate_limit = AsyncMock(return_value=mock_rl_result)
        mock_rl_manager.release_concurrency = AsyncMock()
        mock_rate_limiter.return_value = mock_rl_manager

        # Mock HuggingFace response
        mock_request.return_value = {
            "id": "test-id",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "test-model",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "test"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        }

        mock_process.return_value = {
            "id": "test-id",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "test-model",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "test"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        }

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

        client.post(
            "/v1/chat/completions",
            headers=auth_headers,
            json={
                "model": "meta-llama/Llama-3.1-8B-Instruct:hf-inference",
                "messages": [{"role": "user", "content": "Hello"}],
                "tools": tools,
                "provider": "huggingface",
            },
        )

        # Verify request was made
        assert mock_request.called
        
        # Get the call arguments - check both positional and keyword args
        call_args = mock_request.call_args
        if len(call_args) > 1:
            kwargs = call_args[1]
        else:
            kwargs = {}
        
        # Verify tools were passed
        assert "tools" in kwargs, "Tools should be passed to HuggingFace client"
        assert kwargs["tools"] == tools, "Tools should match input"

