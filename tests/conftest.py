"""
Pytest configuration and fixtures for test database setup
"""
import os
import pytest
import random
import string
from datetime import datetime

# Set test environment variables before any imports
os.environ.setdefault('TESTING', 'true')

from src.config.supabase_config import get_supabase_client


@pytest.fixture
def anyio_backend():
    """Force pytest-anyio to run with asyncio only"""
    return "asyncio"


def generate_test_prefix():
    """Generate unique test prefix for this test run"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_suffix = ''.join(random.choices(string.ascii_lowercase, k=4))
    return f"test_{timestamp}_{random_suffix}"


@pytest.fixture(scope="session")
def test_prefix():
    """Unique prefix for all test data in this session"""
    return generate_test_prefix()


@pytest.fixture(scope="session")
def supabase_client():
    """Get Supabase client for tests"""
    try:
        client = get_supabase_client()
        # Test the connection
        client.table("users").select("id").limit(1).execute()
        return client
    except Exception as e:
        pytest.skip(f"Database not available: {e}")


@pytest.fixture(scope="function")
def clean_test_user(supabase_client, test_prefix):
    """Create a clean test user for each test"""
    created_users = []
    created_keys = []

    def _create_user(username=None, email=None, credits=100.0):
        """Create a test user with unique credentials"""
        if not username:
            username = f"{test_prefix}_user_{len(created_users)}"
        if not email:
            email = f"{username}@test.example.com"

        try:
            # Create user
            user_data = {
                "username": username,
                "email": email,
                "credits": credits,
                "created_at": datetime.utcnow().isoformat(),
            }

            result = supabase_client.table("users").insert(user_data).execute()

            if result.data:
                user = result.data[0]
                created_users.append(user['id'])
                return user
            return None

        except Exception as e:
            print(f"Error creating test user: {e}")
            return None

    yield _create_user

    # Cleanup: Delete created users and their keys
    try:
        if created_keys:
            supabase_client.table("api_keys_new").delete().in_("id", created_keys).execute()
            supabase_client.table("api_keys").delete().in_("user_id", created_users).execute()

        if created_users:
            supabase_client.table("users").delete().in_("id", created_users).execute()

    except Exception as e:
        print(f"Cleanup error: {e}")


@pytest.fixture(scope="function")
def isolated_test_data(supabase_client, test_prefix):
    """
    Fixture for tests that need isolated data
    Tracks and cleans up all created records
    """
    cleanup_data = {
        'users': [],
        'api_keys': [],
        'api_keys_new': [],
        'chat_sessions': [],
        'chat_messages': [],
        'rate_limit_usage': [],
        'user_plans': [],
    }

    yield cleanup_data

    # Cleanup in reverse order of dependencies
    try:
        if cleanup_data['chat_messages']:
            supabase_client.table("chat_messages").delete().in_("id", cleanup_data['chat_messages']).execute()

        if cleanup_data['chat_sessions']:
            supabase_client.table("chat_sessions").delete().in_("id", cleanup_data['chat_sessions']).execute()

        if cleanup_data['rate_limit_usage']:
            supabase_client.table("rate_limit_usage").delete().in_("api_key", cleanup_data['rate_limit_usage']).execute()

        if cleanup_data['user_plans']:
            supabase_client.table("user_plans").delete().in_("user_id", cleanup_data['user_plans']).execute()

        if cleanup_data['api_keys_new']:
            supabase_client.table("api_keys_new").delete().in_("id", cleanup_data['api_keys_new']).execute()

        if cleanup_data['api_keys']:
            supabase_client.table("api_keys").delete().in_("user_id", cleanup_data['api_keys']).execute()

        if cleanup_data['users']:
            supabase_client.table("users").delete().in_("id", cleanup_data['users']).execute()

    except Exception as e:
        print(f"Cleanup error in isolated_test_data: {e}")


@pytest.fixture(autouse=True)
def skip_if_no_database(request):
    """Skip tests that require database if credentials are not available"""
    # Check if this is a database or integration test
    if 'db' in str(request.fspath) or 'integration' in str(request.fspath):
        try:
            client = get_supabase_client()
            # Quick connection test
            client.table("users").select("id").limit(1).execute()
        except Exception as e:
            pytest.skip(f"Database not available: {e}")


@pytest.fixture
def mock_env_vars(monkeypatch):
    """Mock environment variables for testing"""
    test_env = {
        'SUPABASE_URL': os.getenv('SUPABASE_URL', 'https://test.supabase.co'),
        'SUPABASE_KEY': os.getenv('SUPABASE_KEY', 'test-key'),
        'OPENROUTER_API_KEY': os.getenv('OPENROUTER_API_KEY', 'test-openrouter-key'),
        'PORTKEY_API_KEY': os.getenv('PORTKEY_API_KEY', 'test-portkey-key'),
        'ENCRYPTION_KEY': os.getenv('ENCRYPTION_KEY', 'test-encryption-key-32-bytes-long!'),
        'ADMIN_API_KEY': os.getenv('ADMIN_API_KEY', 'test-admin-key'),
    }

    for key, value in test_env.items():
        monkeypatch.setenv(key, value)

    return test_env


# Pytest configuration
def pytest_configure(config):
    """Configure pytest"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "db: marks tests as database tests"
    )
