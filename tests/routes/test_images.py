#!/usr/bin/env python3
"""
Comprehensive tests for image generation endpoint

Tests cover:
- Image generation with DeepInfra
- Image generation with Fal.ai
- Authentication and authorization
- Credit validation and deduction
- Request validation
- Provider selection
- Response processing
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient

from src.main import app


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
        'credits': 1000.0,
        'api_key': 'test_api_key_12345'
    }


@pytest.fixture
def mock_user_no_credits():
    """Sample user with insufficient credits"""
    return {
        'id': 2,
        'email': 'broke@example.com',
        'credits': 50.0,  # Less than 100 needed for 1 image
        'api_key': 'broke_api_key_12345'
    }


@pytest.fixture
def mock_deepinfra_response():
    """Sample DeepInfra image generation response"""
    return {
        'created': 1677652288,
        'data': [
            {
                'url': 'https://cdn.deepinfra.com/image123.png',
                'b64_json': None
            }
        ]
    }


@pytest.fixture
def mock_fal_response():
    """Sample Fal.ai image generation response"""
    return {
        'created': 1677652288,
        'data': [
            {
                'url': 'https://fal.media/files/elephant/image789.png',
                'b64_json': None
            }
        ]
    }


@pytest.fixture
def valid_image_request():
    """Valid image generation request"""
    return {
        'prompt': 'A serene mountain landscape at sunset',
        'model': 'stable-diffusion-3.5-large',
        'size': '1024x1024',
        'n': 1,
        'quality': 'standard',
        'provider': 'deepinfra'
    }


# ============================================================
# TEST CLASS: Image Generation - Success Cases
# ============================================================

class TestImageGenerationSuccess:
    """Test successful image generation"""

    @patch('src.routes.images.get_user')
    @patch('src.routes.images.make_deepinfra_image_request')
    @patch('src.routes.images.process_image_generation_response')
    @patch('src.routes.images.deduct_credits')
    @patch('src.routes.images.record_usage')
    @patch('src.routes.images.increment_api_key_usage')
    def test_generate_image_deepinfra_success(
        self,
        mock_increment_usage,
        mock_record_usage,
        mock_deduct_credits,
        mock_process_response,
        mock_make_request,
        mock_get_user,
        client,
        mock_user,
        mock_deepinfra_response,
        valid_image_request
    ):
        """Test successful image generation with DeepInfra"""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_make_request.return_value = mock_deepinfra_response
        mock_process_response.return_value = {
            'created': 1677652288,
            'data': mock_deepinfra_response['data'],
            'provider': 'deepinfra',
            'model': 'stable-diffusion-3.5-large'
        }

        # Execute
        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_image_request
        )

        # Verify
        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert 'data' in data
        assert len(data['data']) == 1
        assert 'url' in data['data'][0]
        assert data['data'][0]['url'].startswith('https://')
        assert data['provider'] == 'deepinfra'
        assert data['model'] == 'stable-diffusion-3.5-large'

        # Verify gateway usage metadata
        assert 'gateway_usage' in data
        assert data['gateway_usage']['tokens_charged'] == 100  # 100 tokens per image
        assert data['gateway_usage']['images_generated'] == 1

        # Verify credits were deducted
        mock_deduct_credits.assert_called_once_with('test_api_key_12345', 100)
        mock_record_usage.assert_called_once()
        mock_increment_usage.assert_called_once_with('test_api_key_12345')

    @patch('src.routes.images.get_user')
    @patch('src.routes.images.make_deepinfra_image_request')
    @patch('src.routes.images.process_image_generation_response')
    @patch('src.routes.images.deduct_credits')
    @patch('src.routes.images.record_usage')
    @patch('src.routes.images.increment_api_key_usage')
    def test_generate_multiple_images(
        self,
        mock_increment_usage,
        mock_record_usage,
        mock_deduct_credits,
        mock_process_response,
        mock_make_request,
        mock_get_user,
        client,
        mock_user
    ):
        """Test generating multiple images"""
        mock_get_user.return_value = mock_user
        mock_make_request.return_value = {
            'created': 1677652288,
            'data': [
                {'url': 'https://cdn.example.com/image1.png'},
                {'url': 'https://cdn.example.com/image2.png'},
                {'url': 'https://cdn.example.com/image3.png'}
            ]
        }
        mock_process_response.return_value = {
            'created': 1677652288,
            'data': mock_make_request.return_value['data'],
            'provider': 'deepinfra',
            'model': 'stable-diffusion-3.5-large'
        }

        request_data = {
            'prompt': 'Three different scenes',
            'model': 'stable-diffusion-3.5-large',
            'provider': 'deepinfra',
            'n': 3  # Generate 3 images
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data['data']) == 3
        assert data['gateway_usage']['tokens_charged'] == 300  # 100 * 3
        assert data['gateway_usage']['images_generated'] == 3

        # Verify credits deducted for all images
        mock_deduct_credits.assert_called_once_with('test_api_key_12345', 300)

    @patch('src.routes.images.get_user')
    @patch('src.routes.images.make_fal_image_request')
    @patch('src.routes.images.process_image_generation_response')
    @patch('src.routes.images.deduct_credits')
    @patch('src.routes.images.record_usage')
    @patch('src.routes.images.increment_api_key_usage')
    def test_generate_image_fal_success(
        self,
        mock_increment_usage,
        mock_record_usage,
        mock_deduct_credits,
        mock_process_response,
        mock_make_request,
        mock_get_user,
        client,
        mock_user,
        mock_fal_response
    ):
        """Test successful image generation with Fal.ai"""
        # Setup mocks
        mock_get_user.return_value = mock_user
        mock_make_request.return_value = mock_fal_response
        mock_process_response.return_value = {
            'created': 1677652288,
            'data': mock_fal_response['data'],
            'provider': 'fal',
            'model': 'fal-ai/stable-diffusion-v15'
        }

        request_data = {
            'prompt': 'A serene mountain landscape at sunset',
            'model': 'fal-ai/stable-diffusion-v15',
            'provider': 'fal',
            'size': '1024x1024',
            'n': 1
        }

        # Execute
        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=request_data
        )

        # Verify
        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert 'data' in data
        assert len(data['data']) == 1
        assert 'url' in data['data'][0]
        assert data['data'][0]['url'].startswith('https://')
        assert data['provider'] == 'fal'
        assert data['model'] == 'fal-ai/stable-diffusion-v15'

        # Verify gateway usage metadata
        assert 'gateway_usage' in data
        assert data['gateway_usage']['tokens_charged'] == 100  # 100 tokens per image
        assert data['gateway_usage']['images_generated'] == 1

        # Verify credits were deducted
        mock_deduct_credits.assert_called_once_with('test_api_key_12345', 100)
        mock_record_usage.assert_called_once()
        mock_increment_usage.assert_called_once_with('test_api_key_12345')


# ============================================================
# TEST CLASS: Image Generation - Authentication
# ============================================================

class TestImageGenerationAuth:
    """Test authentication and authorization"""

    @patch('src.routes.images.get_user')
    def test_generate_image_no_auth_header(self, mock_get_user, client, valid_image_request):
        """Test request without Authorization header"""
        response = client.post(
            '/v1/images/generations',
            json=valid_image_request
        )

        assert response.status_code in [401, 403]

    @patch('src.routes.images.get_user')
    def test_generate_image_invalid_api_key(self, mock_get_user, client, valid_image_request):
        """Test request with invalid API key"""
        mock_get_user.return_value = None

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer invalid_key'},
            json=valid_image_request
        )

        assert response.status_code == 401
        assert 'invalid' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Image Generation - Credit Validation
# ============================================================

class TestImageGenerationCredits:
    """Test credit validation and deduction"""

    @patch('src.routes.images.get_user')
    def test_generate_image_insufficient_credits(
        self,
        mock_get_user,
        client,
        mock_user_no_credits,
        valid_image_request
    ):
        """Test request with insufficient credits"""
        mock_get_user.return_value = mock_user_no_credits

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer broke_api_key_12345'},
            json=valid_image_request
        )

        assert response.status_code == 402
        assert 'insufficient credits' in response.json()['detail'].lower()

    @patch('src.routes.images.get_user')
    def test_generate_image_insufficient_credits_multiple(
        self,
        mock_get_user,
        client,
        mock_user_no_credits
    ):
        """Test request for multiple images with insufficient credits"""
        mock_get_user.return_value = mock_user_no_credits

        request_data = {
            'prompt': 'Test prompt',
            'n': 5  # 5 images = 500 credits needed
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer broke_api_key_12345'},
            json=request_data
        )

        assert response.status_code == 402
        detail = response.json()['detail'].lower()
        assert 'insufficient credits' in detail
        assert '500' in detail  # Should mention required amount


# ============================================================
# TEST CLASS: Image Generation - Validation
# ============================================================

class TestImageGenerationValidation:
    """Test request validation"""

    def test_generate_image_missing_prompt(self, client):
        """Test request without required prompt"""
        request_data = {
            'model': 'stable-diffusion-3.5-large',
            'n': 1
            # prompt is missing
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_key'},
            json=request_data
        )

        assert response.status_code == 422

    def test_generate_image_empty_prompt(self, client):
        """Test request with empty prompt"""
        request_data = {
            'prompt': '',
            'n': 1
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_key'},
            json=request_data
        )

        assert response.status_code == 422

    def test_generate_image_invalid_size(self, client):
        """Test request with invalid size"""
        request_data = {
            'prompt': 'Test prompt',
            'size': 'invalid_size',
            'n': 1
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_key'},
            json=request_data
        )

        # Should validate size format
        assert response.status_code in [400, 422]

    def test_generate_image_invalid_n(self, client):
        """Test request with invalid n value"""
        request_data = {
            'prompt': 'Test prompt',
            'n': 0  # Invalid: must be positive
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_key'},
            json=request_data
        )

        assert response.status_code == 422


# ============================================================
# TEST CLASS: Image Generation - Provider Selection
# ============================================================

class TestImageGenerationProviders:
    """Test provider selection and routing"""

    @patch('src.routes.images.get_user')
    @patch('src.routes.images.make_deepinfra_image_request')
    @patch('src.routes.images.process_image_generation_response')
    @patch('src.routes.images.deduct_credits')
    @patch('src.routes.images.record_usage')
    @patch('src.routes.images.increment_api_key_usage')
    def test_default_provider_is_deepinfra(
        self,
        mock_increment_usage,
        mock_record_usage,
        mock_deduct_credits,
        mock_process_response,
        mock_make_request,
        mock_get_user,
        client,
        mock_user,
        mock_deepinfra_response
    ):
        """Test that DeepInfra is the default provider"""
        mock_get_user.return_value = mock_user
        mock_make_request.return_value = mock_deepinfra_response
        mock_process_response.return_value = {
            'created': 1677652288,
            'data': mock_deepinfra_response['data'],
            'provider': 'deepinfra',
            'model': 'stable-diffusion-3.5-large'
        }

        # Request without specifying provider
        request_data = {
            'prompt': 'Test prompt',
            'n': 1
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=request_data
        )

        assert response.status_code == 200
        # Verify DeepInfra was called
        mock_make_request.assert_called_once()

    @patch('src.routes.images.get_user')
    def test_unsupported_provider_error(self, mock_get_user, client, mock_user):
        """Test error handling for unsupported providers"""
        mock_get_user.return_value = mock_user

        request_data = {
            'prompt': 'Test prompt',
            'provider': 'unsupported_provider',
            'n': 1
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=request_data
        )

        assert response.status_code == 400
        assert 'not supported' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Image Generation - Response Processing
# ============================================================

class TestImageGenerationResponseProcessing:
    """Test response processing"""

    @patch('src.routes.images.get_user')
    @patch('src.routes.images.make_deepinfra_image_request')
    @patch('src.routes.images.process_image_generation_response')
    @patch('src.routes.images.deduct_credits')
    @patch('src.routes.images.record_usage')
    @patch('src.routes.images.increment_api_key_usage')
    def test_response_includes_gateway_usage(
        self,
        mock_increment_usage,
        mock_record_usage,
        mock_deduct_credits,
        mock_process_response,
        mock_make_request,
        mock_get_user,
        client,
        mock_user,
        mock_deepinfra_response,
        valid_image_request
    ):
        """Test that response includes gateway usage metadata"""
        mock_get_user.return_value = mock_user
        mock_make_request.return_value = mock_deepinfra_response
        mock_process_response.return_value = {
            'created': 1677652288,
            'data': mock_deepinfra_response['data'],
            'provider': 'deepinfra',
            'model': 'stable-diffusion-3.5-large'
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_image_request
        )

        assert response.status_code == 200
        data = response.json()

        # Verify gateway usage metadata
        assert 'gateway_usage' in data
        gateway_usage = data['gateway_usage']
        assert 'tokens_charged' in gateway_usage
        assert 'request_ms' in gateway_usage
        assert 'user_balance_after' in gateway_usage
        assert 'images_generated' in gateway_usage

        # Verify values
        assert gateway_usage['tokens_charged'] == 100
        assert gateway_usage['images_generated'] == 1
        assert gateway_usage['user_balance_after'] == 900.0  # 1000 - 100

    @patch('src.routes.images.get_user')
    @patch('src.routes.images.make_deepinfra_image_request')
    @patch('src.routes.images.process_image_generation_response')
    @patch('src.routes.images.deduct_credits')
    @patch('src.routes.images.record_usage')
    @patch('src.routes.images.increment_api_key_usage')
    def test_response_timing_tracked(
        self,
        mock_increment_usage,
        mock_record_usage,
        mock_deduct_credits,
        mock_process_response,
        mock_make_request,
        mock_get_user,
        client,
        mock_user,
        mock_deepinfra_response,
        valid_image_request
    ):
        """Test that request timing is tracked"""
        mock_get_user.return_value = mock_user
        mock_make_request.return_value = mock_deepinfra_response
        mock_process_response.return_value = {
            'created': 1677652288,
            'data': mock_deepinfra_response['data'],
            'provider': 'deepinfra',
            'model': 'stable-diffusion-3.5-large'
        }

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_image_request
        )

        assert response.status_code == 200
        data = response.json()

        # Verify timing is recorded
        assert 'request_ms' in data['gateway_usage']
        assert data['gateway_usage']['request_ms'] > 0


# ============================================================
# TEST CLASS: Image Generation - Error Handling
# ============================================================

class TestImageGenerationErrorHandling:
    """Test error handling"""

    @patch('src.routes.images.get_user')
    @patch('src.routes.images.make_deepinfra_image_request')
    def test_provider_error_handling(
        self,
        mock_make_request,
        mock_get_user,
        client,
        mock_user,
        valid_image_request
    ):
        """Test handling of provider errors"""
        mock_get_user.return_value = mock_user
        mock_make_request.side_effect = Exception("Provider error")

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_image_request
        )

        assert response.status_code == 500
        assert 'failed' in response.json()['detail'].lower()

    @patch('src.routes.images.get_user')
    @patch('src.routes.images.make_deepinfra_image_request')
    @patch('src.routes.images.process_image_generation_response')
    @patch('src.routes.images.deduct_credits')
    def test_credit_deduction_failure_logged(
        self,
        mock_deduct_credits,
        mock_process_response,
        mock_make_request,
        mock_get_user,
        client,
        mock_user,
        mock_deepinfra_response,
        valid_image_request
    ):
        """Test that credit deduction failures are logged but don't fail request"""
        mock_get_user.return_value = mock_user
        mock_make_request.return_value = mock_deepinfra_response
        mock_process_response.return_value = {
            'created': 1677652288,
            'data': mock_deepinfra_response['data'],
            'provider': 'deepinfra',
            'model': 'stable-diffusion-3.5-large'
        }
        mock_deduct_credits.side_effect = ValueError("Insufficient credits")

        response = client.post(
            '/v1/images/generations',
            headers={'Authorization': 'Bearer test_api_key_12345'},
            json=valid_image_request
        )

        # Request should still succeed (image was generated)
        # Credit deduction error is logged
        assert response.status_code == 200
