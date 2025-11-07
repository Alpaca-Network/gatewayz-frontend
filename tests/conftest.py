"""
Pytest configuration and fixtures for test database setup
"""
import os
import pytest
import random
import string
from datetime import datetime

# Set test environment variables before any imports
# NOTE: These are MOCK/FAKE placeholder credentials for testing only
os.environ.setdefault('TESTING', 'true')
os.environ.setdefault('APP_ENV', 'testing')
os.environ.setdefault('SUPABASE_URL', 'https://xxxxxxxxxxxxx.supabase.co')
os.environ.setdefault('SUPABASE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
os.environ.setdefault('OPENROUTER_API_KEY', 'sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
os.environ.setdefault('PORTKEY_API_KEY', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
os.environ.setdefault('ADMIN_API_KEY', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
os.environ.setdefault('ENCRYPTION_KEY', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
os.environ.setdefault('AI_SDK_API_KEY', 'sk-xxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
os.environ.setdefault('STRIPE_SECRET_KEY', 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
os.environ.setdefault('STRIPE_WEBHOOK_SECRET', 'whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
os.environ.setdefault('FRONTEND_URL', 'http://localhost:3000')

# Disable monitoring services during tests to avoid network calls and async task issues
os.environ.setdefault('PROMETHEUS_ENABLED', 'false')
os.environ.setdefault('TEMPO_ENABLED', 'false')
os.environ.setdefault('LOKI_ENABLED', 'false')

from src.config.supabase_config import get_supabase_client
from tests.factories import (
    UserFactory,
    ApiKeyFactory,
    ChatCompletionFactory,
    ModelFactory,
    PaymentFactory,
    ReferralFactory,
)


@pytest.fixture
def user_factory():
    """Provide UserFactory for tests"""
    return UserFactory


@pytest.fixture
def api_key_factory():
    """Provide ApiKeyFactory for tests"""
    return ApiKeyFactory


@pytest.fixture
def chat_factory():
    """Provide ChatCompletionFactory for tests"""
    return ChatCompletionFactory


@pytest.fixture
def model_factory():
    """Provide ModelFactory for tests"""
    return ModelFactory


@pytest.fixture
def payment_factory():
    """Provide PaymentFactory for tests"""
    return PaymentFactory


@pytest.fixture
def referral_factory():
    """Provide ReferralFactory for tests"""
    return ReferralFactory


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
        # Quick connection test with reduced timeout
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

        if cleanup_data['users']:
            supabase_client.table("users").delete().in_("id", cleanup_data['users']).execute()

    except Exception as e:
        print(f"Cleanup error in isolated_test_data: {e}")


@pytest.fixture(autouse=True)
def skip_if_no_database(request):
    """Skip tests that require database if credentials are not available"""
    # Skip if test uses in-memory stub (sb fixture or fake_supabase fixture)
    if 'sb' in request.fixturenames or 'fake_supabase' in request.fixturenames:
        return  # Don't skip tests that use the in-memory stub

    # Don't skip health check and ping tests - they don't require a database
    if 'TestHealthEndpoints' in str(request.cls) or 'test_ping' in str(request.function):
        return

    # Check if this is a database or integration test
    if 'db' in str(request.fspath) or 'integration' in str(request.fspath):
        # Cache the database check result
        if not hasattr(skip_if_no_database, '_db_available'):
            try:
                client = get_supabase_client()
                # Quick connection test
                client.table("users").select("id").limit(1).execute()
                skip_if_no_database._db_available = True
            except Exception as e:
                skip_if_no_database._db_available = False
                skip_if_no_database._db_error = str(e)

        if not skip_if_no_database._db_available:
            pytest.skip(f"Database not available: {skip_if_no_database._db_error}")


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
