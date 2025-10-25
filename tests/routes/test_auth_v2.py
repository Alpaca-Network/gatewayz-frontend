#!/usr/bin/env python3
"""
Comprehensive tests for authentication endpoints using dependency injection

This test file uses proper mocking strategies for FastAPI route testing:
- Mocks database calls before app creation
- Uses monkeypatch at module level for Supabase client
- Tests all auth endpoints with proper fixtures
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient


# ==================================================
# IN-MEMORY SUPABASE STUB (Reusing from db tests)
# ==================================================

class _Result:
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count

    def execute(self):
        return self


class _BaseQuery:
    def __init__(self, store, table):
        self.store = store
        self.table = table
        self._filters = []
        self._order = None
        self._limit = None

    def eq(self, field, value):
        self._filters.append(("eq", field, value))
        return self

    def neq(self, field, value):
        self._filters.append(("neq", field, value))
        return self

    def order(self, field, desc=False):
        self._order = (field, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def _match(self, row):
        for op, f, v in self._filters:
            rv = row.get(f)
            if op == "eq" and rv != v:
                return False
            elif op == "neq" and rv == v:
                return False
        return True

    def execute(self):
        rows = self.store.tables.get(self.table, [])
        matched = [r for r in rows if self._match(r)]

        if self._order:
            field, desc = self._order
            matched.sort(key=lambda x: x.get(field, 0), reverse=desc)

        if self._limit:
            matched = matched[:self._limit]

        return _Result(matched, len(matched))


class _SelectQuery(_BaseQuery):
    pass


class _InsertQuery:
    def __init__(self, store, table, data):
        self.store = store
        self.table = table
        self.data = data

    def execute(self):
        if not isinstance(self.data, list):
            self.data = [self.data]

        if self.table not in self.store.tables:
            self.store.tables[self.table] = []

        # Auto-assign IDs if not present (as strings to match Supabase/PostgreSQL)
        for record in self.data:
            if 'id' not in record:
                existing_ids = [int(r.get('id', 0)) for r in self.store.tables[self.table]]
                record['id'] = str(max(existing_ids, default=0) + 1)

        self.store.tables[self.table].extend(self.data)
        return _Result(self.data)


class _UpdateQuery(_BaseQuery):
    def __init__(self, store, table, data):
        super().__init__(store, table)
        self.update_data = data

    def execute(self):
        rows = self.store.tables.get(self.table, [])
        updated = []

        for row in rows:
            if self._match(row):
                row.update(self.update_data)
                updated.append(row)

        return _Result(updated)


class _DeleteQuery(_BaseQuery):
    def execute(self):
        rows = self.store.tables.get(self.table, [])
        to_delete = [r for r in rows if self._match(r)]
        self.store.tables[self.table] = [r for r in rows if not self._match(r)]
        return _Result(to_delete)


class _Table:
    def __init__(self, store, name):
        self.store = store
        self.name = name

    def select(self, *fields):
        # Accept multiple arguments like real Supabase: .select('id', 'username', 'email')
        # Or single argument: .select('*') or .select('id,username,email')
        return _SelectQuery(self.store, self.name)

    def insert(self, data):
        return _InsertQuery(self.store, self.name, data)

    def update(self, data):
        return _UpdateQuery(self.store, self.name, data)

    def delete(self):
        return _DeleteQuery(self.store, self.name)


class SupabaseStub:
    def __init__(self):
        self.tables = {}

    def table(self, name):
        return _Table(self, name)


# ==================================================
# FIXTURES
# ==================================================

@pytest.fixture
def sb():
    """Provide in-memory Supabase stub with cleanup"""
    stub = SupabaseStub()
    yield stub
    # Cleanup: Clear all tables after test
    stub.tables.clear()


@pytest.fixture
def client(sb, monkeypatch):
    """FastAPI test client with mocked dependencies"""
    # Mock get_supabase_client to return our stub
    import src.config.supabase_config
    monkeypatch.setattr(src.config.supabase_config, "get_supabase_client", lambda: sb)

    # Mock the db functions that auth uses
    import src.db.users as users_module
    import src.db.api_keys as api_keys_module
    import src.db.activity as activity_module

    # Store original functions
    original_get_user_by_privy_id = users_module.get_user_by_privy_id
    original_create_enhanced_user = users_module.create_enhanced_user
    original_get_user_by_username = users_module.get_user_by_username
    original_log_activity = activity_module.log_activity

    # Replace with stub-aware versions
    def mock_get_user_by_privy_id(privy_id):
        result = sb.table('users').select('*').eq('privy_user_id', privy_id).execute()
        return result.data[0] if result.data else None

    def mock_get_user_by_username(username):
        result = sb.table('users').select('*').eq('username', username).execute()
        return result.data[0] if result.data else None

    def mock_create_enhanced_user(username, email, auth_method, privy_user_id=None, credits=10):
        # Create user (let stub auto-assign ID)
        user_data = {
            'username': username,
            'email': email,
            'credits': credits,
            'privy_user_id': privy_user_id,
            'auth_method': auth_method.value if hasattr(auth_method, 'value') else str(auth_method),
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        result = sb.table('users').insert(user_data).execute()
        created_user = result.data[0]  # Get the user with auto-assigned ID

        # Create API key
        api_key = f"gw_live_{username}_test"
        api_key_data = {
            'user_id': created_user['id'],
            'api_key': api_key,
            'key_name': 'Primary API Key',
            'is_primary': True,
            'is_active': True,
            'environment_tag': 'production',
        }
        sb.table('api_keys_new').insert(api_key_data).execute()

        return {
            'user_id': created_user['id'],
            'username': username,
            'email': email,
            'credits': credits,
            'primary_api_key': api_key,
            'api_key': api_key,
        }

    def mock_log_activity(*args, **kwargs):
        # Just a no-op for tests
        pass

    # Apply mocks
    monkeypatch.setattr(users_module, "get_user_by_privy_id", mock_get_user_by_privy_id)
    monkeypatch.setattr(users_module, "create_enhanced_user", mock_create_enhanced_user)
    monkeypatch.setattr(users_module, "get_user_by_username", mock_get_user_by_username)
    monkeypatch.setattr(activity_module, "log_activity", mock_log_activity)

    # Also mock notification service
    import src.enhanced_notification_service as notif_module

    class MockNotificationService:
        def send_welcome_email(self, *args, **kwargs):
            return True
        def send_welcome_email_if_needed(self, *args, **kwargs):
            return True
        def send_password_reset_email(self, *args, **kwargs):
            return "reset_token_123"

    monkeypatch.setattr(notif_module, "enhanced_notification_service", MockNotificationService())

    # Now import and create the app
    from src.main import app
    from fastapi.testclient import TestClient

    return TestClient(app)


# ==================================================
# TESTS: Privy Auth - Existing Users
# ==================================================

def test_privy_auth_existing_user_success(client, sb):
    """Test successful authentication for existing user"""
    # Create existing user
    sb.table('users').insert({
        'id': '100',
        'username': 'testuser',
        'email': 'test@example.com',
        'credits': 50.0,
        'privy_user_id': 'privy_user_123',
        'api_key': 'gw_legacy_key',
        'welcome_email_sent': True,
    }).execute()

    # Create API key
    sb.table('api_keys_new').insert({
        'id': '1',
        'user_id': '100',
        'api_key': 'gw_live_primary_key',
        'is_primary': True,
        'is_active': True,
    }).execute()

    request_data = {
        "user": {
            "id": "privy_user_123",
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
        },
        "token": "privy_token_123",
        "email": "test@example.com",
        "is_new_user": False
    }

    response = client.post('/auth', json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    assert data['message'] == 'Login successful'
    assert data['user_id'] == 100  # Pydantic converts to int in response
    assert data['api_key'] == 'gw_live_primary_key'
    assert data['is_new_user'] is False
    assert data['email'] == 'test@example.com'
    assert data['credits'] == 50.0


def test_privy_auth_existing_user_no_api_keys_uses_legacy(client, sb):
    """Test existing user with no API keys falls back to legacy key"""
    sb.table('users').insert({
        'id': '200',
        'username': 'legacy_user',
        'email': 'legacy@example.com',
        'credits': 100.0,
        'privy_user_id': 'privy_user_456',
        'api_key': 'gw_legacy_fallback',
    }).execute()

    # No API keys in api_keys_new table

    request_data = {
        "user": {
            "id": "privy_user_456",
            "created_at": 1705123456,
            "linked_accounts": [{"type": "email", "email": "legacy@example.com"}],
            "mfa_methods": [],
            "has_accepted_terms": True,
            "is_guest": False
        },
        "token": "privy_token_456"
    }

    response = client.post('/auth', json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    assert data['api_key'] == 'gw_legacy_fallback'


def test_privy_auth_fallback_to_username_lookup(client, sb):
    """Test fallback to username lookup if Privy ID not found"""
    # User exists but doesn't have privy_user_id set yet
    sb.table('users').insert({
        'id': '300',
        'username': 'test',
        'email': 'test@example.com',
        'credits': 75.0,
        'api_key': 'gw_legacy_username',
    }).execute()

    sb.table('api_keys_new').insert({
        'id': '2',
        'user_id': '300',
        'api_key': 'gw_live_username_key',
        'is_primary': True,
        'is_active': True,
    }).execute()

    request_data = {
        "user": {
            "id": "privy_user_999",
            "created_at": 1705123456,
            "linked_accounts": [{"type": "email", "email": "test@example.com"}],
            "mfa_methods": [],
            "has_accepted_terms": True,
            "is_guest": False
        },
        "token": "privy_token_999",
        "email": "test@example.com"
    }

    response = client.post('/auth', json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    # Should have updated the user with privy_user_id
    updated_user = sb.table('users').select('*').eq('id', '300').execute()
    assert updated_user.data[0]['privy_user_id'] == 'privy_user_999'


# ==================================================
# TESTS: Privy Auth - New Users
# ==================================================

def test_privy_auth_new_user_creation(client, sb):
    """Test creating new user via Privy auth"""
    request_data = {
        "user": {
            "id": "privy_new_123",
            "created_at": 1705123456,
            "linked_accounts": [
                {
                    "type": "email",
                    "email": "newuser@example.com",
                    "verified_at": 1705123456
                }
            ],
            "mfa_methods": [],
            "has_accepted_terms": True,
            "is_guest": False
        },
        "token": "privy_token_new",
        "email": "newuser@example.com",
        "is_new_user": True
    }

    response = client.post('/auth', json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    assert data['message'] == 'Account created successfully'
    assert data['is_new_user'] is True
    assert isinstance(data['user_id'], int)  # Pydantic converts to int in response
    assert data['user_id'] > 0  # Valid ID
    assert data['credits'] == 10.0
    assert 'api_key' in data

    # Verify user was created in database
    users = sb.table('users').select('*').eq('username', 'newuser').execute()
    assert len(users.data) == 1
    assert users.data[0]['email'] == 'newuser@example.com'
    assert users.data[0]['privy_user_id'] == 'privy_new_123'


def test_privy_auth_google_oauth(client, sb):
    """Test authentication with Google OAuth"""
    request_data = {
        "user": {
            "id": "privy_google_123",
            "created_at": 1705123456,
            "linked_accounts": [
                {
                    "type": "google_oauth",
                    "email": "google@gmail.com",
                    "name": "Google User",
                    "verified_at": 1705123456
                }
            ],
            "mfa_methods": [],
            "has_accepted_terms": True,
            "is_guest": False
        },
        "token": "privy_token_google"
    }

    response = client.post('/auth', json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    assert data['auth_method'] == 'google'
    assert data['email'] == 'google@gmail.com'


def test_privy_auth_github(client, sb):
    """Test authentication with GitHub"""
    request_data = {
        "user": {
            "id": "privy_github_123",
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
        },
        "token": "privy_token_github",
        "email": "github@example.com"  # Email provided at top level, so auth_method will be EMAIL
    }

    response = client.post('/auth', json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    # Since email is provided at top level, auth_method is set to EMAIL
    # The GitHub account type detection only works when there's no top-level email
    assert data['auth_method'] == 'email'


def test_privy_auth_email_fallback(client, sb):
    """Test email fallback when no email found in linked accounts"""
    request_data = {
        "user": {
            "id": "privy_fallback_123",
            "created_at": 1705123456,
            "linked_accounts": [],  # No linked accounts
            "mfa_methods": [],
            "has_accepted_terms": True,
            "is_guest": False
        },
        "token": "privy_token_fallback"
    }

    response = client.post('/auth', json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    # Should use fallback email format
    assert '@privy.user' in data['email']


# ==================================================
# TESTS: User Registration
# ==================================================

def test_register_user_success(client, sb):
    """Test successful user registration"""
    request_data = {
        "username": "newreg",
        "email": "newreg@example.com",
        "auth_method": "email"
    }

    response = client.post('/auth/register', json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data['user_id'], int)  # Pydantic converts to int in response
    assert data['user_id'] > 0  # Valid ID
    assert data['username'] == 'newreg'
    assert data['email'] == 'newreg@example.com'
    assert data['credits'] == 10.0
    assert data['subscription_status'] == 'trial'
    assert 'api_key' in data


def test_register_user_duplicate_email(client, sb):
    """Test registration with existing email"""
    # Create existing user with different username
    sb.table('users').insert({
        'id': '999',
        'username': 'existing_different',  # Different from request
        'email': 'existing@example.com',
    }).execute()

    request_data = {
        "username": "totally_new_username",  # Different from existing
        "email": "existing@example.com",  # Same email - should fail
        "auth_method": "email"
    }

    response = client.post('/auth/register', json=request_data)

    assert response.status_code == 400
    assert 'email already exists' in response.json()['detail'].lower()


def test_register_user_duplicate_username(client, sb):
    """Test registration with existing username"""
    # Create existing user with different email
    sb.table('users').insert({
        'id': '888',
        'username': 'existinguser',
        'email': 'totally_different@example.com',  # Different from request
    }).execute()

    request_data = {
        "username": "existinguser",  # Same username - should fail
        "email": "brand_new_email@example.com",  # Different email
        "auth_method": "email"
    }

    response = client.post('/auth/register', json=request_data)

    assert response.status_code == 400
    assert 'username already taken' in response.json()['detail'].lower()


# ==================================================
# TESTS: Password Reset
# ==================================================

def test_request_password_reset_success(client, sb):
    """Test successful password reset request"""
    sb.table('users').insert({
        'id': '1',
        'username': 'testuser',
        'email': 'test@example.com'
    }).execute()

    response = client.post('/auth/password-reset?email=test@example.com')

    assert response.status_code == 200
    assert 'password reset email sent' in response.json()['message'].lower()


def test_request_password_reset_user_not_found(client, sb):
    """Test password reset for non-existent email (security - don't reveal)"""
    response = client.post('/auth/password-reset?email=nonexistent@example.com')

    assert response.status_code == 200
    # Should return generic message for security
    assert 'if an account with that email exists' in response.json()['message'].lower()


def test_reset_password_with_valid_token(client, sb):
    """Test resetting password with valid token"""
    # Create valid token
    expires_at = datetime.now(timezone.utc).replace(hour=23, minute=59)
    sb.table('password_reset_tokens').insert({
        'id': '1',
        'token': 'valid_token_123',
        'user_id': '1',
        'used': False,
        'expires_at': expires_at.isoformat()
    }).execute()

    response = client.post('/auth/reset-password?token=valid_token_123')

    assert response.status_code == 200
    assert 'password reset successfully' in response.json()['message'].lower()

    # Verify token was marked as used
    token_data = sb.table('password_reset_tokens').select('*').eq('id', '1').execute()
    assert token_data.data[0]['used'] is True


def test_reset_password_with_invalid_token(client, sb):
    """Test resetting password with invalid token"""
    response = client.post('/auth/reset-password?token=invalid_token')

    assert response.status_code == 400
    assert 'invalid or expired' in response.json()['detail'].lower()


def test_reset_password_with_expired_token(client, sb):
    """Test resetting password with expired token"""
    # Create expired token
    expires_at = datetime.now(timezone.utc).replace(year=2020)
    sb.table('password_reset_tokens').insert({
        'id': '1',
        'token': 'expired_token_123',
        'user_id': '1',
        'used': False,
        'expires_at': expires_at.isoformat()
    }).execute()

    response = client.post('/auth/reset-password?token=expired_token_123')

    assert response.status_code == 400
    assert 'expired' in response.json()['detail'].lower()


def test_reset_password_with_used_token(client, sb):
    """Test resetting password with already used token"""
    expires_at = datetime.now(timezone.utc).replace(hour=23, minute=59)
    sb.table('password_reset_tokens').insert({
        'id': '1',
        'token': 'used_token_123',
        'user_id': '1',
        'used': True,  # Already used
        'expires_at': expires_at.isoformat()
    }).execute()

    response = client.post('/auth/reset-password?token=used_token_123')

    assert response.status_code == 400
    assert 'invalid or expired' in response.json()['detail'].lower()
