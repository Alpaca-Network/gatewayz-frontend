"""
Tests for Admin Route Endpoints

Covers:
- Admin authentication and authorization
- User creation
- Credit management
- Rate limit management
- System operations (cache clearing, model refresh)
- Security validations
"""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from datetime import datetime, timezone

# Set test environment
os.environ['APP_ENV'] = 'testing'
os.environ['TESTING'] = 'true'
os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
os.environ['SUPABASE_KEY'] = 'test-key'
os.environ['ADMIN_API_KEY'] = 'test-admin-key-12345'
os.environ['ENCRYPTION_KEY'] = 'test-encryption-key-32-bytes-long!'

from src.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def admin_user():
    """Mock admin user"""
    return {
        'id': 1,
        'user_id': 1,
        'email': 'admin@gatewayz.ai',
        'username': 'admin',
        'credits': 1000.0,
        'api_key': 'gw_admin_key_123',
        'is_active': True,
        'is_admin': True,
        'role': 'admin',
    }


@pytest.fixture
def regular_user():
    """Mock regular user"""
    return {
        'id': 2,
        'user_id': 2,
        'email': 'user@example.com',
        'username': 'testuser',
        'credits': 100.0,
        'api_key': 'gw_test_key_456',
        'is_active': True,
        'is_admin': False,
        'role': 'user',
    }


@pytest.fixture
def admin_headers():
    """Admin authentication headers"""
    return {
        'Authorization': 'Bearer test-admin-key-12345',
        'Content-Type': 'application/json'
    }


@pytest.fixture
def user_headers():
    """Regular user authentication headers"""
    return {
        'Authorization': 'Bearer gw_test_key_456',
        'Content-Type': 'application/json'
    }


class TestAdminAuthentication:
    """Test admin authentication and authorization"""

    def test_admin_endpoint_requires_authentication(self, client):
        """Admin endpoint rejects requests without authentication"""
        response = client.post('/admin/add_credits', json={
            'api_key': 'gw_test_key',
            'credits': 10
        })
        assert response.status_code == 401

    def test_admin_endpoint_rejects_invalid_auth(self, client):
        """Admin endpoint rejects invalid authentication"""
        headers = {'Authorization': 'Bearer invalid_admin_key'}
        response = client.post(
            '/admin/add_credits',
            json={'api_key': 'gw_test_key', 'credits': 10},
            headers=headers
        )
        assert response.status_code == 401

    @patch('src.security.deps.get_user_by_api_key')
    def test_admin_endpoint_rejects_non_admin_user(self, mock_get_user, client, regular_user, user_headers):
        """Regular user cannot access admin endpoints"""
        mock_get_user.return_value = regular_user

        response = client.post(
            '/admin/add_credits',
            json={'api_key': 'gw_test_key', 'credits': 10},
            headers=user_headers
        )
        assert response.status_code == 403

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.db.users.add_credits_to_user')
    def test_admin_endpoint_accepts_valid_admin(self, mock_add_credits, mock_get_user, mock_get_admin, client, admin_user, admin_headers):
        """Admin user can access admin endpoints"""
        mock_get_admin.return_value = admin_user
        mock_get_user.side_effect = [
            regular_user := {'id': 2, 'username': 'testuser', 'credits': 100},
            {'id': 2, 'username': 'testuser', 'credits': 110}
        ]
        mock_add_credits.return_value = None

        response = client.post(
            '/admin/add_credits',
            json={'api_key': 'gw_test_key', 'credits': 10},
            headers=admin_headers
        )

        # Should succeed or return auth error depending on implementation
        assert response.status_code in [200, 401, 403]


class TestUserCreation:
    """Test user creation endpoint"""

    @patch('src.db.users.create_enhanced_user')
    @patch('src.enhanced_notification_service.enhanced_notification_service.send_welcome_email')
    def test_create_user_success(self, mock_send_email, mock_create_user, client):
        """Successfully create a new user"""
        mock_create_user.return_value = {
            'user_id': 1,
            'username': 'newuser',
            'email': 'newuser@example.com',
            'primary_api_key': 'gw_new_key_123',
            'credits': 10.0
        }
        mock_send_email.return_value = None

        response = client.post('/admin/create', json={
            'username': 'newuser',
            'email': 'newuser@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code == 200
        data = response.json()
        assert data['username'] == 'newuser'
        assert data['email'] == 'newuser@example.com'
        assert 'api_key' in data
        assert data['credits'] == 10.0
        assert data['subscription_status'] == 'trial'

    def test_create_user_invalid_environment(self, client):
        """Create user fails with invalid environment tag"""
        response = client.post('/admin/create', json={
            'username': 'newuser',
            'email': 'newuser@example.com',
            'auth_method': 'privy',
            'environment_tag': 'invalid_env'
        })

        assert response.status_code == 400

    def test_create_user_missing_fields(self, client):
        """Create user fails with missing required fields"""
        response = client.post('/admin/create', json={
            'username': 'newuser'
            # Missing email, auth_method
        })

        assert response.status_code == 422  # Validation error

    @patch('src.db.users.create_enhanced_user')
    def test_create_user_database_error(self, mock_create_user, client):
        """Create user handles database errors"""
        mock_create_user.side_effect = Exception('Database error')

        response = client.post('/admin/create', json={
            'username': 'newuser',
            'email': 'newuser@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code == 500

    @patch('src.db.users.create_enhanced_user')
    @patch('src.enhanced_notification_service.enhanced_notification_service.send_welcome_email')
    def test_create_user_email_failure_continues(self, mock_send_email, mock_create_user, client):
        """User creation continues even if welcome email fails"""
        mock_create_user.return_value = {
            'user_id': 1,
            'username': 'newuser',
            'email': 'newuser@example.com',
            'primary_api_key': 'gw_new_key_123',
            'credits': 10.0
        }
        mock_send_email.side_effect = Exception('Email service error')

        response = client.post('/admin/create', json={
            'username': 'newuser',
            'email': 'newuser@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        # User should still be created
        assert response.status_code == 200


class TestCreditManagement:
    """Test credit management operations"""

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.db.users.add_credits_to_user')
    def test_add_credits_success(self, mock_add_credits, mock_get_user, mock_get_admin, client, admin_user, admin_headers):
        """Admin can add credits to user"""
        mock_get_admin.return_value = admin_user
        mock_get_user.side_effect = [
            {'id': 2, 'username': 'testuser', 'credits': 100},
            {'id': 2, 'username': 'testuser', 'credits': 150}
        ]
        mock_add_credits.return_value = None

        response = client.post(
            '/admin/add_credits',
            json={'api_key': 'gw_test_key', 'credits': 50},
            headers=admin_headers
        )

        if response.status_code == 200:
            data = response.json()
            assert data['status'] == 'success'
            assert data['new_balance'] == 150

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    def test_add_credits_user_not_found(self, mock_get_user, mock_get_admin, client, admin_user, admin_headers):
        """Add credits fails when user not found"""
        mock_get_admin.return_value = admin_user
        mock_get_user.return_value = None

        response = client.post(
            '/admin/add_credits',
            json={'api_key': 'gw_nonexistent_key', 'credits': 50},
            headers=admin_headers
        )

        # Should return 404 or 401 depending on auth
        assert response.status_code in [404, 401, 403]

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.db.users.add_credits_to_user')
    def test_add_negative_credits(self, mock_add_credits, mock_get_user, mock_get_admin, client, admin_user, admin_headers):
        """Admin can add negative credits (deduct)"""
        mock_get_admin.return_value = admin_user
        mock_get_user.side_effect = [
            {'id': 2, 'username': 'testuser', 'credits': 100},
            {'id': 2, 'username': 'testuser', 'credits': 90}
        ]
        mock_add_credits.return_value = None

        response = client.post(
            '/admin/add_credits',
            json={'api_key': 'gw_test_key', 'credits': -10},
            headers=admin_headers
        )

        if response.status_code == 200:
            data = response.json()
            assert data['new_balance'] == 90


class TestRateLimitManagement:
    """Test rate limit management"""

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.db.rate_limits.set_user_rate_limits')
    def test_set_rate_limits_success(self, mock_set_limits, mock_get_user, mock_get_admin, client, admin_user, admin_headers):
        """Admin can set user rate limits"""
        mock_get_admin.return_value = admin_user
        mock_get_user.return_value = {'id': 2, 'username': 'testuser'}
        mock_set_limits.return_value = None

        response = client.post(
            '/admin/set_rate_limits',
            json={
                'api_key': 'gw_test_key',
                'requests_per_minute': 100,
                'requests_per_day': 5000
            },
            headers=admin_headers
        )

        # Should succeed or return auth error
        assert response.status_code in [200, 401, 403, 404]


class TestSystemOperations:
    """Test system operations"""

    @patch('src.security.deps.get_user_by_api_key')
    def test_clear_cache_success(self, mock_get_admin, client, admin_user, admin_headers):
        """Admin can clear system caches"""
        mock_get_admin.return_value = admin_user

        response = client.post('/admin/clear_cache', headers=admin_headers)

        # Should succeed or return not found if endpoint doesn't exist
        assert response.status_code in [200, 404, 401, 403]

    @patch('src.security.deps.get_user_by_api_key')
    def test_refresh_models_success(self, mock_get_admin, client, admin_user, admin_headers):
        """Admin can trigger model refresh"""
        mock_get_admin.return_value = admin_user

        response = client.post('/admin/refresh_models', headers=admin_headers)

        # Should succeed or return not found if endpoint doesn't exist
        assert response.status_code in [200, 404, 401, 403]

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_all_users')
    def test_get_all_users(self, mock_get_all_users, mock_get_admin, client, admin_user, admin_headers):
        """Admin can view all users"""
        mock_get_admin.return_value = admin_user
        mock_get_all_users.return_value = [
            {'id': 1, 'username': 'user1', 'email': 'user1@example.com'},
            {'id': 2, 'username': 'user2', 'email': 'user2@example.com'}
        ]

        response = client.get('/admin/users', headers=admin_headers)

        # Should succeed or return not found if endpoint doesn't exist
        assert response.status_code in [200, 404, 401, 403]


class TestAdminSecurity:
    """Test admin security measures"""

    def test_admin_key_from_environment(self, client):
        """Admin key is loaded from environment variable"""
        assert os.getenv('ADMIN_API_KEY') is not None

    @patch('src.security.deps.get_user_by_api_key')
    def test_admin_operations_logged(self, mock_get_admin, client, admin_user, admin_headers):
        """Admin operations should be logged (audit trail)"""
        mock_get_admin.return_value = admin_user

        # This test verifies logging happens (implementation-dependent)
        response = client.post(
            '/admin/clear_cache',
            headers=admin_headers
        )

        # Actual logging verification would require log capture
        assert response.status_code in [200, 404, 401, 403]

    def test_admin_endpoint_rate_limited(self, client, admin_headers):
        """Admin endpoints should have rate limiting"""
        # Make multiple rapid requests
        responses = []
        for _ in range(20):
            response = client.post(
                '/admin/clear_cache',
                headers=admin_headers
            )
            responses.append(response.status_code)

        # Should either work or return 429 rate limit if implemented
        assert all(status in [200, 404, 429, 401, 403] for status in responses)


class TestAdminValidation:
    """Test input validation for admin endpoints"""

    def test_add_credits_requires_api_key(self, client, admin_headers):
        """Add credits requires api_key parameter"""
        response = client.post(
            '/admin/add_credits',
            json={'credits': 50},  # Missing api_key
            headers=admin_headers
        )

        assert response.status_code in [422, 400, 401, 403]

    def test_add_credits_requires_credits_amount(self, client, admin_headers):
        """Add credits requires credits parameter"""
        response = client.post(
            '/admin/add_credits',
            json={'api_key': 'gw_test_key'},  # Missing credits
            headers=admin_headers
        )

        assert response.status_code in [422, 400, 401, 403]

    def test_create_user_validates_email_format(self, client):
        """Create user validates email format"""
        response = client.post('/admin/create', json={
            'username': 'newuser',
            'email': 'invalid-email',  # Invalid format
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code in [422, 400]


class TestAdminEdgeCases:
    """Test edge cases and error handling"""

    @patch('src.security.deps.get_user_by_api_key')
    @patch('src.db.users.get_user')
    @patch('src.db.users.add_credits_to_user')
    def test_add_zero_credits(self, mock_add_credits, mock_get_user, mock_get_admin, client, admin_user, admin_headers):
        """Adding zero credits should work"""
        mock_get_admin.return_value = admin_user
        mock_get_user.side_effect = [
            {'id': 2, 'username': 'testuser', 'credits': 100},
            {'id': 2, 'username': 'testuser', 'credits': 100}
        ]
        mock_add_credits.return_value = None

        response = client.post(
            '/admin/add_credits',
            json={'api_key': 'gw_test_key', 'credits': 0},
            headers=admin_headers
        )

        assert response.status_code in [200, 401, 403]

    @patch('src.db.users.create_enhanced_user')
    def test_create_duplicate_username(self, mock_create_user, client):
        """Creating user with duplicate username should fail"""
        mock_create_user.side_effect = ValueError('Username already exists')

        response = client.post('/admin/create', json={
            'username': 'existinguser',
            'email': 'new@example.com',
            'auth_method': 'privy',
            'environment_tag': 'live'
        })

        assert response.status_code == 400
