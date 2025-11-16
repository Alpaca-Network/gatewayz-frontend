#!/usr/bin/env python3
"""
Comprehensive tests for Anthropic Messages API endpoint (Claude API)

Tests cover:
- Basic Claude API message completion
- Authentication and authorization
- Credit validation and deduction
- Request transformation (Anthropic ↔ OpenAI format)
- Response transformation
- Provider failover
- Rate limiting
- Trial validation
- Plan enforcement
- Chat history integration
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from src.main import app
from src.schemas import MessagesRequest, AnthropicMessage
from src.services.anthropic_transformer import (
    transform_anthropic_to_openai,
    transform_openai_to_anthropic,
    extract_text_from_content
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_user():
    """Sample user with sufficient credits"""
    return {
        'id': 1,
        'email': 'test@example.com',
        'credits': 100.0,
        'api_key': 'test_api_key_12345',
        'environment_tag': 'live'
    }


@pytest.fixture
def mock_user_no_credits():
    """Sample user with zero credits"""
    return {
        'id': 2,
        'email': 'broke@example.com',
        'credits': 0.0,
        'api_key': 'broke_api_key_12345',
        'environment_tag': 'live'
    }


@pytest.fixture
def mock_openai_response():
    """Sample OpenAI-style response"""
    return {
        'id': 'chatcmpl-123',
        'object': 'chat.completion',
        'created': 1677652288,
        'model': 'claude-sonnet-4-5-20250929',
        'choices': [{
            'index': 0,
            'message': {
                'role': 'assistant',
                'content': 'Hello! How can I help you today?'
            },
            'finish_reason': 'stop'
        }],
        'usage': {
            'prompt_tokens': 10,
            'completion_tokens': 12,
            'total_tokens': 22
        }
    }


@pytest.fixture
def valid_messages_request():
    """Valid Anthropic messages request"""
    return {
        'model': 'claude-sonnet-4-5-20250929',
        'max_tokens': 1024,
        'messages': [
            {'role': 'user', 'content': 'Hello, Claude!'}
        ]
    }


# ============================================================
# TEST CLASS: Anthropic Transformer
# ============================================================

class TestAnthropicTransformer:
    """Test transformation between Anthropic and OpenAI formats"""

    def test_transform_anthropic_to_openai_basic(self):
        """Test basic message transformation"""
        messages = [{'role': 'user', 'content': 'Hello'}]

        openai_messages, params = transform_anthropic_to_openai(
            messages=messages,
            max_tokens=100
        )

        assert len(openai_messages) == 1
        assert openai_messages[0]['role'] == 'user'
        assert openai_messages[0]['content'] == 'Hello'
        assert params['max_tokens'] == 100

    def test_transform_anthropic_to_openai_with_system(self):
        """Test transformation with system message"""
        messages = [{'role': 'user', 'content': 'Hello'}]
        system = "You are a helpful assistant."

        openai_messages, params = transform_anthropic_to_openai(
            messages=messages,
            system=system,
            max_tokens=100
        )

        assert len(openai_messages) == 2
        assert openai_messages[0]['role'] == 'system'
        assert openai_messages[0]['content'] == system
        assert openai_messages[1]['role'] == 'user'

    def test_transform_anthropic_to_openai_with_params(self):
        """Test transformation with all parameters"""
        messages = [{'role': 'user', 'content': 'Hello'}]

        openai_messages, params = transform_anthropic_to_openai(
            messages=messages,
            max_tokens=100,
            temperature=0.7,
            top_p=0.9,
            top_k=40,
            stop_sequences=['STOP', 'END']
        )

        assert params['max_tokens'] == 100
        assert params['temperature'] == 0.7
        assert params['top_p'] == 0.9
        assert params['stop'] == ['STOP', 'END']
        # top_k is Anthropic-specific and should be logged but not in params
        assert 'top_k' not in params

    def test_transform_anthropic_to_openai_content_blocks(self):
        """Test transformation with content blocks"""
        messages = [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': 'Hello'},
                {'type': 'text', 'text': 'World'}
            ]
        }]

        openai_messages, _ = transform_anthropic_to_openai(
            messages=messages,
            max_tokens=100
        )

        assert len(openai_messages) == 1
        # Multiple blocks should be combined
        assert isinstance(openai_messages[0]['content'], list)

    def test_transform_anthropic_to_openai_single_text_block(self):
        """Test transformation with single text block (should unwrap)"""
        messages = [{
            'role': 'user',
            'content': [{'type': 'text', 'text': 'Hello'}]
        }]

        openai_messages, _ = transform_anthropic_to_openai(
            messages=messages,
            max_tokens=100
        )

        # Single text block should be unwrapped to string
        assert openai_messages[0]['content'] == 'Hello'

    def test_transform_anthropic_to_openai_image_blocks(self):
        """Test transformation with image content blocks"""
        messages = [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': 'What is in this image?'},
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': 'image/jpeg',
                        'data': 'base64_encoded_data'
                    }
                }
            ]
        }]

        openai_messages, _ = transform_anthropic_to_openai(
            messages=messages,
            max_tokens=100
        )

        content = openai_messages[0]['content']
        assert isinstance(content, list)
        assert len(content) == 2
        assert content[0]['type'] == 'text'
        assert content[1]['type'] == 'image_url'
        assert 'data:image/jpeg;base64,' in content[1]['image_url']['url']

    def test_transform_openai_to_anthropic_basic(self):
        """Test OpenAI to Anthropic response transformation"""
        openai_response = {
            'id': 'chatcmpl-123',
            'choices': [{
                'message': {'content': 'Hello!'},
                'finish_reason': 'stop'
            }],
            'usage': {
                'prompt_tokens': 10,
                'completion_tokens': 5
            }
        }

        anthropic_response = transform_openai_to_anthropic(
            openai_response,
            model='claude-sonnet-4-5-20250929'
        )

        assert anthropic_response['id'] == 'chatcmpl-123'
        assert anthropic_response['type'] == 'message'
        assert anthropic_response['role'] == 'assistant'
        assert anthropic_response['content'][0]['type'] == 'text'
        assert anthropic_response['content'][0]['text'] == 'Hello!'
        assert anthropic_response['model'] == 'claude-sonnet-4-5-20250929'
        assert anthropic_response['stop_reason'] == 'end_turn'
        assert anthropic_response['usage']['input_tokens'] == 10
        assert anthropic_response['usage']['output_tokens'] == 5

    def test_transform_openai_to_anthropic_finish_reasons(self):
        """Test finish reason mapping"""
        test_cases = [
            ('stop', 'end_turn'),
            ('length', 'max_tokens'),
            ('content_filter', 'stop_sequence'),
            ('tool_calls', 'tool_use'),
            ('function_call', 'tool_use'),
            ('unknown', 'end_turn')
        ]

        for openai_reason, expected_anthropic in test_cases:
            openai_response = {
                'id': 'test',
                'choices': [{
                    'message': {'content': 'test'},
                    'finish_reason': openai_reason
                }],
                'usage': {'prompt_tokens': 1, 'completion_tokens': 1}
            }

            result = transform_openai_to_anthropic(openai_response, 'claude')
            assert result['stop_reason'] == expected_anthropic

    def test_transform_openai_to_anthropic_tool_calls(self):
        """Test OpenAI to Anthropic transformation with tool_calls"""
        # Test case 1: tool_calls with null content (typical OpenAI response)
        openai_response_with_tools = {
            'id': 'chatcmpl-456',
            'choices': [{
                'message': {
                    'content': None,  # Typically None when tool_calls are present
                    'tool_calls': [
                        {
                            'id': 'call_abc123',
                            'type': 'function',
                            'function': {
                                'name': 'get_weather',
                                'arguments': '{"location": "San Francisco"}'
                            }
                        }
                    ]
                },
                'finish_reason': 'tool_calls'
            }],
            'usage': {
                'prompt_tokens': 20,
                'completion_tokens': 15
            }
        }

        anthropic_response = transform_openai_to_anthropic(
            openai_response_with_tools,
            model='claude-sonnet-4-5-20250929'
        )

        # Should have tool_use blocks, not empty text blocks
        assert len(anthropic_response['content']) == 1
        assert anthropic_response['content'][0]['type'] == 'tool_use'
        assert anthropic_response['content'][0]['id'] == 'call_abc123'
        assert anthropic_response['content'][0]['name'] == 'get_weather'
        assert anthropic_response['content'][0]['input'] == {'location': 'San Francisco'}
        assert anthropic_response['stop_reason'] == 'tool_use'

        # Test case 2: tool_calls with empty string content
        openai_response_empty_content = {
            'id': 'chatcmpl-789',
            'choices': [{
                'message': {
                    'content': '',  # Empty string
                    'tool_calls': [
                        {
                            'id': 'call_def456',
                            'type': 'function',
                            'function': {
                                'name': 'calculate',
                                'arguments': '{"x": 5, "y": 3}'
                            }
                        }
                    ]
                },
                'finish_reason': 'tool_calls'
            }],
            'usage': {
                'prompt_tokens': 10,
                'completion_tokens': 8
            }
        }

        anthropic_response2 = transform_openai_to_anthropic(
            openai_response_empty_content,
            model='claude-sonnet-4-5-20250929'
        )

        # Should only have tool_use block, no empty text block
        assert len(anthropic_response2['content']) == 1
        assert anthropic_response2['content'][0]['type'] == 'tool_use'
        assert anthropic_response2['content'][0]['name'] == 'calculate'

        # Test case 3: tool_calls with both text content and tool_calls (rare but possible)
        openai_response_with_both = {
            'id': 'chatcmpl-101',
            'choices': [{
                'message': {
                    'content': 'Let me check that for you.',
                    'tool_calls': [
                        {
                            'id': 'call_ghi789',
                            'type': 'function',
                            'function': {
                                'name': 'search',
                                'arguments': '{"query": "test"}'
                            }
                        }
                    ]
                },
                'finish_reason': 'tool_calls'
            }],
            'usage': {
                'prompt_tokens': 15,
                'completion_tokens': 12
            }
        }

        anthropic_response3 = transform_openai_to_anthropic(
            openai_response_with_both,
            model='claude-sonnet-4-5-20250929'
        )

        # Should have both tool_use and text blocks
        assert len(anthropic_response3['content']) == 2
        # Tool_use should come first (we process it first)
        assert anthropic_response3['content'][0]['type'] == 'tool_use'
        assert anthropic_response3['content'][1]['type'] == 'text'
        assert anthropic_response3['content'][1]['text'] == 'Let me check that for you.'

    def test_extract_text_from_string_content(self):
        """Test extracting text from string content"""
        text = extract_text_from_content("Hello, world!")
        assert text == "Hello, world!"

    def test_extract_text_from_content_blocks(self):
        """Test extracting text from content blocks"""
        content = [
            {'type': 'text', 'text': 'Hello'},
            {'type': 'text', 'text': 'World'}
        ]
        text = extract_text_from_content(content)
        assert text == "Hello World"

    def test_extract_text_from_mixed_blocks(self):
        """Test extracting text from mixed content blocks"""
        content = [
            {'type': 'text', 'text': 'Look at this:'},
            {'type': 'image', 'url': 'http://example.com/image.jpg'}
        ]
        text = extract_text_from_content(content)
        assert text == "Look at this:"

    def test_extract_text_from_empty_blocks(self):
        """Test extracting text from empty content"""
        assert extract_text_from_content([]) == "[multimodal content]"
        assert extract_text_from_content(None) == ""


# ============================================================
# TEST CLASS: Messages Endpoint - Success Cases
# ============================================================

class TestMessagesEndpointSuccess:
    """Test successful message completions"""

    @patch('src.routes.messages.get_user')
    @patch('src.routes.messages.enforce_plan_limits')
    @patch('src.routes.messages.validate_trial_access')
    @patch('src.routes.messages.get_rate_limit_manager')
    @patch('src.routes.messages.make_openrouter_request_openai')
    @patch('src.routes.messages.process_openrouter_response')
    @patch('src.routes.messages.calculate_cost')
    @patch('src.routes.messages.deduct_credits')
    @patch('src.routes.messages.record_usage')
    @patch('src.routes.messages.increment_api_key_usage')
    @patch('src.routes.messages.update_rate_limit_usage')
    @patch('src.routes.messages.log_activity')
    def test_messages_endpoint_basic_success(
        self,
        mock_log_activity,
        mock_update_rate_limit,
        mock_increment_usage,
        mock_record_usage,
        mock_deduct_credits,
        mock_calculate_cost,
        mock_process_response,
        mock_make_request,
        mock_rate_limit_mgr,
        mock_validate_trial,
        mock_enforce_plan,
        mock_get_user,
        client,
        mock_user,
        mock_openai_response,
        valid_messages_request
    ):
        """Test successful Claude API message completion"""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_enforce_plan.return_value = {'allowed': True}
        mock_validate_trial.return_value = {'is_valid': True, 'is_trial': False}

        rate_limit_result = Mock()
        rate_limit_result.allowed = True
        rate_limit_result.remaining_requests = 249
        rate_limit_result.remaining_tokens = 9900
        rate_limit_result.ratelimit_limit_requests = 250
        rate_limit_result.ratelimit_limit_tokens = 10000
        rate_limit_result.ratelimit_reset_requests = 1700000000
        rate_limit_result.ratelimit_reset_tokens = 1700000000
        rate_limit_result.burst_window_description = "100 per 60 seconds"
        rate_limit_mgr_instance = Mock()
        rate_limit_mgr_instance.check_rate_limit = AsyncMock(return_value=rate_limit_result)
        rate_limit_mgr_instance.release_concurrency = AsyncMock()
        mock_rate_limit_mgr.return_value = rate_limit_mgr_instance

        mock_make_request.return_value = mock_openai_response
        mock_process_response.return_value = mock_openai_response
        mock_calculate_cost.return_value = 0.01

        # Execute
        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_messages_request
        )

        # Verify
        assert response.status_code == 200
        data = response.json()

        # Verify Anthropic response format
        assert data['type'] == 'message'
        assert data['role'] == 'assistant'
        assert 'content' in data
        assert isinstance(data['content'], list)
        assert data['content'][0]['type'] == 'text'
        assert data['content'][0]['text'] == 'Hello! How can I help you today?'
        assert data['stop_reason'] == 'end_turn'
        assert data['usage']['input_tokens'] == 10
        assert data['usage']['output_tokens'] == 12

        # Verify gateway usage metadata
        assert 'gateway_usage' in data
        assert 'tokens_charged' in data['gateway_usage']
        assert 'cost_usd' in data['gateway_usage']

        # Verify credits deducted
        mock_deduct_credits.assert_called_once()
        mock_record_usage.assert_called_once()


# ============================================================
# TEST CLASS: Messages Endpoint - Authentication
# ============================================================

class TestMessagesEndpointAuth:
    """Test authentication and authorization"""

    @patch('src.routes.messages.get_user')
    def test_messages_endpoint_no_auth_header(self, mock_get_user, client, valid_messages_request):
        """Test request without Authorization header"""
        response = client.post(
            '/v1/messages',
            json=valid_messages_request
        )

        # Should fail with 401 or 403
        assert response.status_code in [401, 403]

    @patch('src.routes.messages.get_user')
    def test_messages_endpoint_invalid_api_key(self, mock_get_user, client, valid_messages_request):
        """Test request with invalid API key"""
        mock_get_user.return_value = None

        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer invalid_key'},
            json=valid_messages_request
        )

        assert response.status_code == 401


# ============================================================
# TEST CLASS: Messages Endpoint - Credit Validation
# ============================================================

class TestMessagesEndpointCredits:
    """Test credit validation and deduction"""

    @patch('src.routes.messages.get_user')
    @patch('src.routes.messages.enforce_plan_limits')
    @patch('src.routes.messages.validate_trial_access')
    @patch('src.routes.messages.get_rate_limit_manager')
    def test_messages_endpoint_insufficient_credits(
        self,
        mock_rate_limit_mgr,
        mock_validate_trial,
        mock_enforce_plan,
        mock_get_user,
        client,
        mock_user_no_credits,
        valid_messages_request
    ):
        """Test request with insufficient credits"""
        mock_get_user.return_value = mock_user_no_credits
        mock_enforce_plan.return_value = {'allowed': True}
        mock_validate_trial.return_value = {'is_valid': True, 'is_trial': False}

        rate_limit_result = Mock()
        rate_limit_result.allowed = True
        rate_limit_result.remaining_requests = 249
        rate_limit_result.remaining_tokens = 9900
        rate_limit_result.ratelimit_limit_requests = 250
        rate_limit_result.ratelimit_limit_tokens = 10000
        rate_limit_result.ratelimit_reset_requests = 1700000000
        rate_limit_result.ratelimit_reset_tokens = 1700000000
        rate_limit_result.burst_window_description = "100 per 60 seconds"
        rate_limit_mgr_instance = Mock()
        rate_limit_mgr_instance.check_rate_limit = AsyncMock(return_value=rate_limit_result)
        mock_rate_limit_mgr.return_value = rate_limit_mgr_instance

        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer broke_api_key_12345'},
            json=valid_messages_request
        )

        assert response.status_code == 402
        assert 'insufficient credits' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Messages Endpoint - Rate Limiting
# ============================================================

class TestMessagesEndpointRateLimiting:
    """Test rate limiting enforcement"""

    @patch('src.routes.messages.get_user')
    @patch('src.routes.messages.enforce_plan_limits')
    @patch('src.routes.messages.validate_trial_access')
    @patch('src.routes.messages.get_rate_limit_manager')
    def test_messages_endpoint_rate_limit_exceeded(
        self,
        mock_rate_limit_mgr,
        mock_validate_trial,
        mock_enforce_plan,
        mock_get_user,
        client,
        mock_user,
        valid_messages_request
    ):
        """Test rate limit exceeded"""
        mock_get_user.return_value = mock_user
        mock_enforce_plan.return_value = {'allowed': True}
        mock_validate_trial.return_value = {'is_valid': True, 'is_trial': False}

        # Rate limit exceeded
        rate_limit_result = Mock()
        rate_limit_result.allowed = False
        rate_limit_result.reason = 'Too many requests'
        rate_limit_result.retry_after = 60
        rate_limit_result.remaining_requests = 0
        rate_limit_result.remaining_tokens = 0
        rate_limit_result.ratelimit_limit_requests = 250
        rate_limit_result.ratelimit_limit_tokens = 10000
        rate_limit_result.ratelimit_reset_requests = 1700000000
        rate_limit_result.ratelimit_reset_tokens = 1700000000
        rate_limit_result.burst_window_description = "100 per 60 seconds"

        rate_limit_mgr_instance = Mock()
        rate_limit_mgr_instance.check_rate_limit = AsyncMock(return_value=rate_limit_result)
        mock_rate_limit_mgr.return_value = rate_limit_mgr_instance

        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_messages_request
        )

        assert response.status_code == 429
        assert 'rate limit' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Messages Endpoint - Plan Limits
# ============================================================

class TestMessagesEndpointPlanLimits:
    """Test plan limit enforcement"""

    @patch('src.routes.messages.get_user')
    @patch('src.routes.messages.enforce_plan_limits')
    @patch('src.routes.messages.validate_trial_access')
    def test_messages_endpoint_plan_limit_exceeded(
        self,
        mock_validate_trial,
        mock_enforce_plan,
        mock_get_user,
        client,
        mock_user,
        valid_messages_request
    ):
        """Test plan limit exceeded"""
        mock_get_user.return_value = mock_user
        mock_enforce_plan.return_value = {
            'allowed': False,
            'reason': 'Monthly token limit exceeded'
        }
        mock_validate_trial.return_value = {'is_valid': True, 'is_trial': False}

        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_messages_request
        )

        assert response.status_code == 429
        assert 'plan limit' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Messages Endpoint - Trial Validation
# ============================================================

class TestMessagesEndpointTrialValidation:
    """Test trial access validation"""

    @patch('src.routes.messages.get_user')
    @patch('src.routes.messages.enforce_plan_limits')
    @patch('src.routes.messages.validate_trial_access')
    def test_messages_endpoint_trial_expired(
        self,
        mock_validate_trial,
        mock_enforce_plan,
        mock_get_user,
        client,
        mock_user,
        valid_messages_request
    ):
        """Test expired trial access"""
        mock_get_user.return_value = mock_user
        mock_enforce_plan.return_value = {'allowed': True}
        mock_validate_trial.return_value = {
            'is_valid': False,
            'is_trial': True,
            'is_expired': True,
            'error': 'Trial period has ended',
            'trial_end_date': '2024-01-01'
        }

        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_messages_request
        )

        assert response.status_code == 403
        assert 'X-Trial-Expired' in response.headers


# ============================================================
# TEST CLASS: Messages Endpoint - Validation
# ============================================================

class TestMessagesEndpointValidation:
    """Test request validation"""

    def test_messages_endpoint_missing_max_tokens(self, client):
        """Test request without required max_tokens"""
        request_data = {
            'model': 'claude-sonnet-4-5-20250929',
            'messages': [{'role': 'user', 'content': 'Hello'}]
            # max_tokens is missing
        }

        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer test_key'},
            json=request_data
        )

        # Should fail validation
        assert response.status_code == 422

    def test_messages_endpoint_empty_messages(self, client):
        """Test request with empty messages array"""
        request_data = {
            'model': 'claude-sonnet-4-5-20250929',
            'max_tokens': 100,
            'messages': []
        }

        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer test_key'},
            json=request_data
        )

        assert response.status_code == 422

    def test_messages_endpoint_invalid_role(self, client):
        """Test request with invalid message role"""
        request_data = {
            'model': 'claude-sonnet-4-5-20250929',
            'max_tokens': 100,
            'messages': [{'role': 'invalid_role', 'content': 'Hello'}]
        }

        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer test_key'},
            json=request_data
        )

        assert response.status_code == 422


# ============================================================
# TEST CLASS: Messages Endpoint - Provider Failover
# ============================================================

class TestMessagesEndpointFailover:
    """Test provider failover logic"""

    @patch('src.routes.messages.get_user')
    @patch('src.routes.messages.enforce_plan_limits')
    @patch('src.routes.messages.validate_trial_access')
    @patch('src.routes.messages.get_rate_limit_manager')
    @patch('src.routes.messages.make_openrouter_request_openai')
    @patch('src.routes.messages.process_openrouter_response')
    @patch('src.routes.messages.build_provider_failover_chain')
    @patch('src.routes.messages.calculate_cost')
    @patch('src.routes.messages.deduct_credits')
    @patch('src.routes.messages.record_usage')
    @patch('src.routes.messages.increment_api_key_usage')
    @patch('src.routes.messages.update_rate_limit_usage')
    @patch('src.routes.messages.log_activity')
    def test_messages_endpoint_provider_failover_success(
        self,
        mock_log_activity,
        mock_update_rate_limit,
        mock_increment_usage,
        mock_record_usage,
        mock_deduct_credits,
        mock_calculate_cost,
        mock_build_chain,
        mock_process_response,
        mock_make_request,
        mock_rate_limit_mgr,
        mock_validate_trial,
        mock_enforce_plan,
        mock_get_user,
        client,
        mock_user,
        mock_openai_response,
        valid_messages_request
    ):
        """Test successful failover to backup provider"""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_enforce_plan.return_value = {'allowed': True}
        mock_validate_trial.return_value = {'is_valid': True, 'is_trial': False}

        rate_limit_result = Mock()
        rate_limit_result.allowed = True
        rate_limit_result.remaining_requests = 249
        rate_limit_result.remaining_tokens = 9900
        rate_limit_result.ratelimit_limit_requests = 250
        rate_limit_result.ratelimit_limit_tokens = 10000
        rate_limit_result.ratelimit_reset_requests = 1700000000
        rate_limit_result.ratelimit_reset_tokens = 1700000000
        rate_limit_result.burst_window_description = "100 per 60 seconds"
        rate_limit_mgr_instance = Mock()
        rate_limit_mgr_instance.check_rate_limit = AsyncMock(return_value=rate_limit_result)
        rate_limit_mgr_instance.release_concurrency = AsyncMock()
        mock_rate_limit_mgr.return_value = rate_limit_mgr_instance

        # First provider fails, second succeeds
        mock_build_chain.return_value = ['openrouter', 'portkey']
        mock_make_request.side_effect = [
            Exception("Provider error"),  # First attempt fails
            mock_openai_response  # Second attempt succeeds
        ]
        mock_process_response.return_value = mock_openai_response
        mock_calculate_cost.return_value = 0.01

        # Execute
        response = client.post(
            '/v1/messages',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_messages_request
        )

        # Should succeed after failover
        assert response.status_code == 200
        data = response.json()
        assert data['content'][0]['text'] == 'Hello! How can I help you today?'
