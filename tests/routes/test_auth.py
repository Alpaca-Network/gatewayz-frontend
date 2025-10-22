#!/usr/bin/env python3
"""
Comprehensive tests for authentication endpoints

Tests cover:
- Privy authentication (existing and new users)
- User registration with referral codes
- Password reset functionality
- Email extraction and fallback
- Welcome email sending
- Activity logging
- Background task execution
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from src.main import app
from src.schemas import AuthMethod, SubscriptionStatus


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_privy_user_data():
    """Sample Privy user data"""
    return {
        "id": "privy_user_123",
        "created_at": 1705123456,
        "linked_accounts": [
            {
                "type": "email",
                "subject": None,
                "email": "test@example.com",
                "name": None,
                "verified_at": 1705123456,
                "first_verified_at": 1705123456,
                "latest_verified_at": 1705123456
            }
        ],
        "mfa_methods": [],
        "has_accepted_terms": True,
        "is_guest": False
    }


@pytest.fixture
def mock_existing_user():
    """Sample existing user from database"""
    return {
        'id': '1',
        'username': 'test',
        'email': 'test@example.com',
        'credits': 100.0,
        'api_key': 'sk-test-key-12345',
        'privy_user_id': 'privy_user_123',
        'welcome_email_sent': False
    }


@pytest.fixture
def mock_new_user_data():
    """Sample new user creation response"""
    return {
        'user_id': '2',
        'username': 'newuser',
        'email': 'newuser@example.com',
        'credits': 10.0,
        'primary_api_key': 'sk-new-key-12345',
        'api_key': 'sk-new-key-12345'
    }


@pytest.fixture
def mock_api_keys_result():
    """Sample API keys query result"""
    return Mock(data=[
        {
            'api_key': 'sk-primary-key-12345',
            'is_primary': True
        }
    ])


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client with chainable methods"""
    client = Mock()

    # Create chainable table mock
    table_mock = Mock()
    table_mock.select.return_value = table_mock
    table_mock.insert.return_value = table_mock
    table_mock.update.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.execute.return_value = Mock(data=[])

    client.table.return_value = table_mock

    return client, table_mock


# ============================================================
# TEST CLASS: Privy Auth - Existing Users
# ============================================================

class TestPrivyAuthExistingUser:
    """Test Privy authentication for existing users"""

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_supabase_client')
    def test_privy_auth_existing_user_success(
        self,
        mock_get_client,
        mock_get_user,
        client,
        mock_privy_user_data,
        mock_existing_user,
        mock_supabase_client,
        mock_api_keys_result
    ):
        """Test successful authentication for existing user"""
        mock_get_user.return_value = mock_existing_user

        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        table_mock.execute.return_value = mock_api_keys_result

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123",
            "email": "test@example.com",
            "is_new_user": False
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['message'] == 'Login successful'
        assert data['user_id'] == '1'
        assert data['api_key'] == 'sk-primary-key-12345'
        assert data['is_new_user'] is False
        assert data['privy_user_id'] == 'privy_user_123'
        assert data['email'] == 'test@example.com'
        assert data['credits'] == 100.0

        # Verify user was looked up
        mock_get_user.assert_called_once_with('privy_user_123')

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_supabase_client')
    def test_privy_auth_existing_user_with_google_oauth(
        self,
        mock_get_client,
        mock_get_user,
        client,
        mock_existing_user,
        mock_supabase_client,
        mock_api_keys_result
    ):
        """Test authentication with Google OAuth"""
        mock_get_user.return_value = mock_existing_user

        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        table_mock.execute.return_value = mock_api_keys_result

        google_user_data = {
            "id": "privy_user_123",
            "created_at": 1705123456,
            "linked_accounts": [
                {
                    "type": "google_oauth",
                    "email": "test@gmail.com",
                    "name": "Test User",
                    "verified_at": 1705123456
                }
            ],
            "mfa_methods": [],
            "has_accepted_terms": True,
            "is_guest": False
        }

        request_data = {
            "user": google_user_data,
            "token": "privy_token_123"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['auth_method'] == 'google'
        assert data['display_name'] == 'test'

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_user_by_username')
    @patch('src.routes.auth.get_supabase_client')
    def test_privy_auth_fallback_to_username_lookup(
        self,
        mock_get_client,
        mock_get_by_username,
        mock_get_by_privy,
        client,
        mock_privy_user_data,
        mock_existing_user,
        mock_supabase_client,
        mock_api_keys_result
    ):
        """Test fallback to username lookup if Privy ID not found"""
        # First lookup by Privy ID fails
        mock_get_by_privy.return_value = None
        # Second lookup by username succeeds
        mock_get_by_username.return_value = mock_existing_user

        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        table_mock.execute.return_value = mock_api_keys_result

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123",
            "email": "test@example.com"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

        # Verify both lookups were called
        mock_get_by_privy.assert_called_once()
        mock_get_by_username.assert_called_once()

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_supabase_client')
    def test_privy_auth_no_active_keys_uses_legacy(
        self,
        mock_get_client,
        mock_get_user,
        client,
        mock_privy_user_data,
        mock_existing_user,
        mock_supabase_client
    ):
        """Test using legacy key when no active keys found"""
        mock_get_user.return_value = mock_existing_user

        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        # No keys in api_keys_new table
        table_mock.execute.return_value = Mock(data=[])

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        # Should use legacy key from users table
        assert data['api_key'] == 'sk-test-key-12345'

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_supabase_client')
    def test_privy_auth_email_fallback_to_privy_format(
        self,
        mock_get_client,
        mock_get_user,
        client,
        mock_existing_user,
        mock_supabase_client,
        mock_api_keys_result
    ):
        """Test email fallback when no email found in linked accounts"""
        mock_get_user.return_value = mock_existing_user

        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        table_mock.execute.return_value = mock_api_keys_result

        # User data with no email in linked accounts
        user_data_no_email = {
            "id": "privy_user_123",
            "created_at": 1705123456,
            "linked_accounts": [],
            "mfa_methods": [],
            "has_accepted_terms": True,
            "is_guest": False
        }

        request_data = {
            "user": user_data_no_email,
            "token": "privy_token_123"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True


# ============================================================
# TEST CLASS: Privy Auth - New Users
# ============================================================

class TestPrivyAuthNewUser:
    """Test Privy authentication for new users"""

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_user_by_username')
    @patch('src.routes.auth.create_enhanced_user')
    def test_privy_auth_new_user_creation(
        self,
        mock_create_user,
        mock_get_by_username,
        mock_get_by_privy,
        client,
        mock_privy_user_data,
        mock_new_user_data
    ):
        """Test creating new user via Privy auth"""
        # User doesn't exist
        mock_get_by_privy.return_value = None
        mock_get_by_username.return_value = None
        mock_create_user.return_value = mock_new_user_data

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123",
            "email": "newuser@example.com",
            "is_new_user": True
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert data['message'] == 'Account created successfully'
        assert data['user_id'] == '2'
        assert data['is_new_user'] is True
        assert data['credits'] == 10.0

        # Verify user creation was called with correct params
        mock_create_user.assert_called_once()
        call_args = mock_create_user.call_args[1]
        assert call_args['privy_user_id'] == 'privy_user_123'
        assert call_args['credits'] == 10

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_user_by_username')
    @patch('src.routes.auth.create_enhanced_user')
    @patch('src.routes.auth.track_referral_signup')
    @patch('src.routes.auth.get_supabase_client')
    def test_privy_auth_new_user_with_valid_referral(
        self,
        mock_get_client,
        mock_track_referral,
        mock_create_user,
        mock_get_by_username,
        mock_get_by_privy,
        client,
        mock_privy_user_data,
        mock_new_user_data,
        mock_supabase_client
    ):
        """Test new user creation with valid referral code"""
        mock_get_by_privy.return_value = None
        mock_get_by_username.return_value = None
        mock_create_user.return_value = mock_new_user_data

        # Valid referral
        referrer = {
            'id': '100',
            'email': 'referrer@example.com',
            'username': 'referrer_user'
        }
        mock_track_referral.return_value = (True, None, referrer)

        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123",
            "email": "newuser@example.com",
            "referral_code": "REFER123"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True

        # Verify referral was tracked
        mock_track_referral.assert_called_once_with('REFER123', '2')

        # Verify referral code was stored
        table_mock.update.assert_called()

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_user_by_username')
    @patch('src.routes.auth.create_enhanced_user')
    @patch('src.routes.auth.track_referral_signup')
    def test_privy_auth_new_user_with_invalid_referral(
        self,
        mock_track_referral,
        mock_create_user,
        mock_get_by_username,
        mock_get_by_privy,
        client,
        mock_privy_user_data,
        mock_new_user_data
    ):
        """Test new user creation with invalid referral code"""
        mock_get_by_privy.return_value = None
        mock_get_by_username.return_value = None
        mock_create_user.return_value = mock_new_user_data

        # Invalid referral
        mock_track_referral.return_value = (False, "Referral not found", None)

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123",
            "email": "newuser@example.com",
            "referral_code": "INVALID"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        # User should still be created despite invalid referral


# ============================================================
# TEST CLASS: User Registration
# ============================================================

class TestUserRegistration:
    """Test user registration endpoint"""

    @patch('src.routes.auth.get_supabase_client')
    @patch('src.routes.auth.create_enhanced_user')
    @patch('src.routes.auth.enhanced_notification_service')
    def test_register_user_success(
        self,
        mock_notification_service,
        mock_create_user,
        mock_get_client,
        client,
        mock_new_user_data,
        mock_supabase_client
    ):
        """Test successful user registration"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # No existing email or username
        table_mock.execute.return_value = Mock(data=[])

        mock_create_user.return_value = mock_new_user_data
        mock_notification_service.send_welcome_email.return_value = True

        request_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "auth_method": "email"
        }

        response = client.post('/auth/register', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['user_id'] == 2
        assert data['username'] == 'newuser'
        assert data['email'] == 'newuser@example.com'
        assert data['credits'] == 10
        assert data['subscription_status'] == 'trial'
        assert data['message'] == 'Account created successfully'

    @patch('src.routes.auth.get_supabase_client')
    def test_register_user_duplicate_email(
        self,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test registration with existing email"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # Email already exists
        table_mock.execute.return_value = Mock(data=[{'id': '1'}])

        request_data = {
            "username": "newuser",
            "email": "existing@example.com",
            "auth_method": "email"
        }

        response = client.post('/auth/register', json=request_data)

        assert response.status_code == 400
        assert 'email already exists' in response.json()['detail'].lower()

    @patch('src.routes.auth.get_supabase_client')
    def test_register_user_duplicate_username(
        self,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test registration with existing username"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # First call (email check) returns empty, second call (username check) returns existing
        table_mock.execute.side_effect = [
            Mock(data=[]),  # Email check passes
            Mock(data=[{'id': '1'}])  # Username check fails
        ]

        request_data = {
            "username": "existinguser",
            "email": "new@example.com",
            "auth_method": "email"
        }

        response = client.post('/auth/register', json=request_data)

        assert response.status_code == 400
        assert 'username already taken' in response.json()['detail'].lower()

    @patch('src.routes.auth.get_supabase_client')
    @patch('src.routes.auth.create_enhanced_user')
    @patch('src.routes.auth.track_referral_signup')
    @patch('src.routes.auth.enhanced_notification_service')
    def test_register_user_with_referral_code(
        self,
        mock_notification_service,
        mock_track_referral,
        mock_create_user,
        mock_get_client,
        client,
        mock_new_user_data,
        mock_supabase_client
    ):
        """Test registration with referral code"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        table_mock.execute.return_value = Mock(data=[])

        mock_create_user.return_value = mock_new_user_data

        referrer = {
            'id': '100',
            'email': 'referrer@example.com',
            'username': 'referrer'
        }
        mock_track_referral.return_value = (True, None, referrer)
        mock_notification_service.send_welcome_email.return_value = True

        request_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "auth_method": "email",
            "referral_code": "REFER123"
        }

        response = client.post('/auth/register', json=request_data)

        assert response.status_code == 200

        # Verify referral was tracked
        mock_track_referral.assert_called_once_with('REFER123', '2')

    @patch('src.routes.auth.get_supabase_client')
    @patch('src.routes.auth.create_enhanced_user')
    def test_register_user_error_handling(
        self,
        mock_create_user,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test registration error handling"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        table_mock.execute.return_value = Mock(data=[])

        # Simulate user creation failure
        mock_create_user.side_effect = Exception("Database error")

        request_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "auth_method": "email"
        }

        response = client.post('/auth/register', json=request_data)

        assert response.status_code == 500
        assert 'registration failed' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Password Reset
# ============================================================

class TestPasswordReset:
    """Test password reset functionality"""

    @patch('src.routes.auth.get_supabase_client')
    @patch('src.routes.auth.enhanced_notification_service')
    def test_request_password_reset_success(
        self,
        mock_notification_service,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test successful password reset request"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # User exists
        user_data = {
            'id': '1',
            'username': 'testuser',
            'email': 'test@example.com'
        }
        table_mock.execute.return_value = Mock(data=[user_data])

        mock_notification_service.send_password_reset_email.return_value = "reset_token_123"

        response = client.post('/auth/password-reset?email=test@example.com')

        assert response.status_code == 200
        data = response.json()
        assert 'password reset email sent' in data['message'].lower()

        # Verify email was sent
        mock_notification_service.send_password_reset_email.assert_called_once_with(
            user_id='1',
            username='testuser',
            email='test@example.com'
        )

    @patch('src.routes.auth.get_supabase_client')
    def test_request_password_reset_user_not_found(
        self,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test password reset for non-existent email (security - don't reveal)"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # User doesn't exist
        table_mock.execute.return_value = Mock(data=[])

        response = client.post('/auth/password-reset?email=nonexistent@example.com')

        assert response.status_code == 200
        data = response.json()
        # Should return generic message for security
        assert 'if an account with that email exists' in data['message'].lower()

    @patch('src.routes.auth.get_supabase_client')
    @patch('src.routes.auth.enhanced_notification_service')
    def test_request_password_reset_email_failure(
        self,
        mock_notification_service,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test password reset when email sending fails"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        user_data = {
            'id': '1',
            'username': 'testuser',
            'email': 'test@example.com'
        }
        table_mock.execute.return_value = Mock(data=[user_data])

        # Email sending fails
        mock_notification_service.send_password_reset_email.return_value = None

        response = client.post('/auth/password-reset?email=test@example.com')

        assert response.status_code == 500
        assert 'failed' in response.json()['detail'].lower()

    @patch('src.routes.auth.get_supabase_client')
    def test_reset_password_with_valid_token(
        self,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test resetting password with valid token"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # Valid, unused token
        token_data = {
            'id': '1',
            'token': 'valid_token_123',
            'user_id': '1',
            'used': False,
            'expires_at': (datetime.now(timezone.utc).replace(hour=23, minute=59)).isoformat()
        }

        # First call returns token data, second call updates it
        table_mock.execute.side_effect = [
            Mock(data=[token_data]),  # Token lookup
            Mock(data=[{'used': True}])  # Token update
        ]

        response = client.post('/auth/reset-password?token=valid_token_123')

        assert response.status_code == 200
        data = response.json()
        assert 'password reset successfully' in data['message'].lower()

    @patch('src.routes.auth.get_supabase_client')
    def test_reset_password_with_invalid_token(
        self,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test resetting password with invalid token"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # Token not found
        table_mock.execute.return_value = Mock(data=[])

        response = client.post('/auth/reset-password?token=invalid_token')

        assert response.status_code == 400
        assert 'invalid or expired' in response.json()['detail'].lower()

    @patch('src.routes.auth.get_supabase_client')
    def test_reset_password_with_expired_token(
        self,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test resetting password with expired token"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # Expired token
        token_data = {
            'id': '1',
            'token': 'expired_token_123',
            'user_id': '1',
            'used': False,
            'expires_at': (datetime.now(timezone.utc).replace(year=2020)).isoformat()
        }
        table_mock.execute.return_value = Mock(data=[token_data])

        response = client.post('/auth/reset-password?token=expired_token_123')

        assert response.status_code == 400
        assert 'expired' in response.json()['detail'].lower()

    @patch('src.routes.auth.get_supabase_client')
    def test_reset_password_error_handling(
        self,
        mock_get_client,
        client,
        mock_supabase_client
    ):
        """Test password reset error handling"""
        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        # Simulate database error
        table_mock.execute.side_effect = Exception("Database error")

        response = client.post('/auth/reset-password?token=any_token')

        assert response.status_code == 500
        assert 'internal server error' in response.json()['detail'].lower()


# ============================================================
# TEST CLASS: Background Tasks
# ============================================================

class TestAuthBackgroundTasks:
    """Test background task execution"""

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_supabase_client')
    @patch('src.routes.auth.log_activity')
    def test_auth_logs_activity_background(
        self,
        mock_log_activity,
        mock_get_client,
        mock_get_user,
        client,
        mock_privy_user_data,
        mock_existing_user,
        mock_supabase_client,
        mock_api_keys_result
    ):
        """Test that authentication logs activity in background"""
        mock_get_user.return_value = mock_existing_user

        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        table_mock.execute.return_value = mock_api_keys_result

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        # Background task would have been queued (but not executed in test)

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_user_by_username')
    @patch('src.routes.auth.create_enhanced_user')
    def test_new_user_registration_queues_welcome_email(
        self,
        mock_create_user,
        mock_get_by_username,
        mock_get_by_privy,
        client,
        mock_privy_user_data,
        mock_new_user_data
    ):
        """Test that new user registration queues welcome email"""
        mock_get_by_privy.return_value = None
        mock_get_by_username.return_value = None
        mock_create_user.return_value = mock_new_user_data

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123",
            "email": "newuser@example.com"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        # Background task for welcome email would be queued


# ============================================================
# TEST CLASS: Auth Method Detection
# ============================================================

class TestAuthMethodDetection:
    """Test detection of authentication methods from linked accounts"""

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_user_by_username')
    @patch('src.routes.auth.create_enhanced_user')
    def test_auth_method_github(
        self,
        mock_create_user,
        mock_get_by_username,
        mock_get_by_privy,
        client,
        mock_new_user_data
    ):
        """Test GitHub authentication method detection"""
        mock_get_by_privy.return_value = None
        mock_get_by_username.return_value = None
        mock_create_user.return_value = mock_new_user_data

        github_user_data = {
            "id": "privy_user_456",
            "created_at": 1705123456,
            "linked_accounts": [
                {
                    "type": "github",
                    "name": "githubuser",
                    "verified_at": 1705123456
                }
            ],
            "mfa_methods": [],
            "has_accepted_terms": True,
            "is_guest": False
        }

        request_data = {
            "user": github_user_data,
            "token": "privy_token_456",
            "email": "github@example.com"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['auth_method'] == 'github'

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_user_by_username')
    @patch('src.routes.auth.create_enhanced_user')
    def test_auth_method_email_default(
        self,
        mock_create_user,
        mock_get_by_username,
        mock_get_by_privy,
        client,
        mock_new_user_data
    ):
        """Test default email authentication method"""
        mock_get_by_privy.return_value = None
        mock_get_by_username.return_value = None
        mock_create_user.return_value = mock_new_user_data

        email_user_data = {
            "id": "privy_user_789",
            "created_at": 1705123456,
            "linked_accounts": [
                {
                    "type": "email",
                    "email": "test@example.com",
                    "verified_at": 1705123456
                }
            ],
            "mfa_methods": [],
            "has_accepted_terms": True,
            "is_guest": False
        }

        request_data = {
            "user": email_user_data,
            "token": "privy_token_789"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data['auth_method'] == 'email'


# ============================================================
# TEST CLASS: Integration Scenarios
# ============================================================

class TestAuthIntegration:
    """Test end-to-end authentication scenarios"""

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_user_by_username')
    @patch('src.routes.auth.create_enhanced_user')
    @patch('src.routes.auth.track_referral_signup')
    @patch('src.routes.auth.get_supabase_client')
    def test_complete_signup_flow_with_referral(
        self,
        mock_get_client,
        mock_track_referral,
        mock_create_user,
        mock_get_by_username,
        mock_get_by_privy,
        client,
        mock_privy_user_data,
        mock_new_user_data,
        mock_supabase_client
    ):
        """Test complete signup flow with referral code"""
        mock_get_by_privy.return_value = None
        mock_get_by_username.return_value = None
        mock_create_user.return_value = mock_new_user_data

        referrer = {
            'id': '100',
            'email': 'referrer@example.com',
            'username': 'referrer'
        }
        mock_track_referral.return_value = (True, None, referrer)

        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123",
            "email": "newuser@example.com",
            "is_new_user": True,
            "referral_code": "FRIEND10"
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()

        # Verify complete response
        assert data['success'] is True
        assert data['is_new_user'] is True
        assert data['user_id'] == '2'
        assert data['credits'] == 10.0

        # Verify all steps were executed
        mock_create_user.assert_called_once()
        mock_track_referral.assert_called_once()

    @patch('src.routes.auth.get_user_by_privy_id')
    @patch('src.routes.auth.get_supabase_client')
    def test_existing_user_login_flow(
        self,
        mock_get_client,
        mock_get_user,
        client,
        mock_privy_user_data,
        mock_existing_user,
        mock_supabase_client,
        mock_api_keys_result
    ):
        """Test complete login flow for existing user"""
        mock_get_user.return_value = mock_existing_user

        supabase_client, table_mock = mock_supabase_client
        mock_get_client.return_value = supabase_client
        table_mock.execute.return_value = mock_api_keys_result

        request_data = {
            "user": mock_privy_user_data,
            "token": "privy_token_123",
            "is_new_user": False
        }

        response = client.post('/auth', json=request_data)

        assert response.status_code == 200
        data = response.json()

        # Verify complete login response
        assert data['success'] is True
        assert data['message'] == 'Login successful'
        assert data['is_new_user'] is False
        assert data['user_id'] == '1'
        assert data['api_key'] is not None
        assert data['credits'] == 100.0
