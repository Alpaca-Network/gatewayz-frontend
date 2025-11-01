# Test Templates - Gatewayz Backend

Quick-start templates for writing tests. Copy and modify these templates to create new tests.

---

## Table of Contents

1. [Route Test Template](#route-test-template)
2. [Service Test Template](#service-test-template)
3. [Database Test Template](#database-test-template)
4. [Integration Test Template](#integration-test-template)
5. [Security Test Template](#security-test-template)
6. [Provider Client Test Template](#provider-client-test-template)

---

## Route Test Template

Use this template for testing API routes.

```python
"""
Tests for <Route Name> endpoints

Covers:
- Authentication/authorization
- Request validation
- Response format
- Error handling
- Edge cases
"""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient

# Set test environment
os.environ['APP_ENV'] = 'testing'
os.environ['TESTING'] = 'true'

from src.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_user():
    """Mock authenticated user"""
    return {
        'id': 1,
        'user_id': 1,
        'email': 'test@example.com',
        'username': 'testuser',
        'credits': 100.0,
        'api_key': 'gw_test_key_123',
        'is_active': True,
        'role': 'user',
    }


@pytest.fixture
def auth_headers(mock_user):
    """Authentication headers"""
    return {
        'Authorization': f'Bearer {mock_user["api_key"]}',
        'Content-Type': 'application/json'
    }


class TestRouteAuthentication:
    """Test authentication for route endpoints"""

    def test_endpoint_requires_authentication(self, client):
        """Endpoint rejects requests without authentication"""
        response = client.get('/api/endpoint')
        assert response.status_code == 401

    def test_endpoint_rejects_invalid_auth(self, client):
        """Endpoint rejects invalid authentication"""
        headers = {'Authorization': 'Bearer invalid_key'}
        response = client.get('/api/endpoint', headers=headers)
        assert response.status_code == 401

    @patch('src.db.users.get_user_by_api_key')
    def test_endpoint_accepts_valid_auth(self, mock_get_user, client, mock_user, auth_headers):
        """Endpoint accepts valid authentication"""
        mock_get_user.return_value = mock_user
        response = client.get('/api/endpoint', headers=auth_headers)
        assert response.status_code in [200, 404]  # 404 if no data exists


class TestRouteValidation:
    """Test request validation"""

    @patch('src.db.users.get_user_by_api_key')
    def test_endpoint_validates_required_fields(self, mock_get_user, client, mock_user, auth_headers):
        """Endpoint validates required fields"""
        mock_get_user.return_value = mock_user

        # Missing required field
        response = client.post('/api/endpoint', json={}, headers=auth_headers)
        assert response.status_code == 422  # Validation error

    @patch('src.db.users.get_user_by_api_key')
    def test_endpoint_validates_field_types(self, mock_get_user, client, mock_user, auth_headers):
        """Endpoint validates field types"""
        mock_get_user.return_value = mock_user

        # Wrong type for field
        response = client.post(
            '/api/endpoint',
            json={'field': 'should_be_int'},
            headers=auth_headers
        )
        assert response.status_code == 422


class TestRouteResponses:
    """Test response format and content"""

    @patch('src.db.users.get_user_by_api_key')
    @patch('src.services.service.function')
    def test_endpoint_returns_expected_format(self, mock_function, mock_get_user, client, mock_user, auth_headers):
        """Endpoint returns expected response format"""
        mock_get_user.return_value = mock_user
        mock_function.return_value = {'data': 'test'}

        response = client.get('/api/endpoint', headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert 'data' in data

    @patch('src.db.users.get_user_by_api_key')
    def test_endpoint_returns_404_for_missing_resource(self, mock_get_user, client, mock_user, auth_headers):
        """Endpoint returns 404 for missing resource"""
        mock_get_user.return_value = mock_user

        response = client.get('/api/endpoint/99999', headers=auth_headers)
        assert response.status_code == 404


class TestRouteErrorHandling:
    """Test error handling"""

    @patch('src.db.users.get_user_by_api_key')
    @patch('src.services.service.function')
    def test_endpoint_handles_service_error(self, mock_function, mock_get_user, client, mock_user, auth_headers):
        """Endpoint handles service errors gracefully"""
        mock_get_user.return_value = mock_user
        mock_function.side_effect = Exception('Service error')

        response = client.post('/api/endpoint', json={'test': 'data'}, headers=auth_headers)
        assert response.status_code == 500

    @patch('src.db.users.get_user_by_api_key')
    @patch('src.services.service.function')
    def test_endpoint_handles_database_error(self, mock_function, mock_get_user, client, mock_user, auth_headers):
        """Endpoint handles database errors"""
        mock_get_user.return_value = mock_user
        mock_function.side_effect = Exception('Database connection failed')

        response = client.get('/api/endpoint', headers=auth_headers)
        assert response.status_code == 500


class TestRouteEdgeCases:
    """Test edge cases"""

    @patch('src.db.users.get_user_by_api_key')
    def test_endpoint_handles_large_payload(self, mock_get_user, client, mock_user, auth_headers):
        """Endpoint handles large payloads"""
        mock_get_user.return_value = mock_user

        large_data = {'field': 'x' * 10000}
        response = client.post('/api/endpoint', json=large_data, headers=auth_headers)
        assert response.status_code in [200, 413]  # Success or payload too large

    @patch('src.db.users.get_user_by_api_key')
    def test_endpoint_handles_concurrent_requests(self, mock_get_user, client, mock_user, auth_headers):
        """Endpoint handles concurrent requests"""
        # This is a placeholder - actual implementation would use threading/async
        mock_get_user.return_value = mock_user

        responses = [
            client.get('/api/endpoint', headers=auth_headers)
            for _ in range(10)
        ]

        assert all(r.status_code in [200, 404] for r in responses)
```

---

## Service Test Template

Use this template for testing service layer functions.

```python
"""
Tests for <Service Name>

Covers:
- Core functionality
- Error handling
- Edge cases
- Integration with dependencies
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from src.services.service_name import function_name


class TestServiceCoreFunctionality:
    """Test core service functionality"""

    def test_function_returns_expected_result():
        """Function returns expected result for valid input"""
        result = function_name(input_data)
        assert result == expected_output

    def test_function_handles_empty_input():
        """Function handles empty input gracefully"""
        result = function_name(None)
        assert result is None  # or appropriate default

    def test_function_validates_input():
        """Function validates input parameters"""
        with pytest.raises(ValueError):
            function_name(invalid_input)


class TestServiceExternalDependencies:
    """Test integration with external dependencies"""

    @patch('src.services.service_name.external_api_call')
    def test_function_calls_external_api(self, mock_api):
        """Function calls external API correctly"""
        mock_api.return_value = {'status': 'success'}

        result = function_name(input_data)

        mock_api.assert_called_once_with(expected_params)
        assert result is not None

    @patch('src.services.service_name.external_api_call')
    def test_function_handles_api_error(self, mock_api):
        """Function handles API errors gracefully"""
        mock_api.side_effect = Exception('API Error')

        with pytest.raises(Exception):
            function_name(input_data)


class TestServiceCaching:
    """Test caching behavior"""

    @patch('src.services.service_name.cache')
    def test_function_uses_cache(self, mock_cache):
        """Function uses cache when available"""
        mock_cache.get.return_value = cached_value

        result = function_name(input_data)

        mock_cache.get.assert_called_once()
        assert result == cached_value

    @patch('src.services.service_name.cache')
    def test_function_updates_cache(self, mock_cache):
        """Function updates cache on cache miss"""
        mock_cache.get.return_value = None

        result = function_name(input_data)

        mock_cache.set.assert_called_once()


class TestServiceErrorHandling:
    """Test error handling"""

    def test_function_handles_invalid_type():
        """Function handles invalid input types"""
        with pytest.raises(TypeError):
            function_name('wrong_type')

    def test_function_handles_null_reference():
        """Function handles null references"""
        result = function_name(None)
        assert result is None  # or raises appropriate error


class TestServicePerformance:
    """Test performance characteristics"""

    def test_function_completes_quickly():
        """Function completes within acceptable time"""
        import time

        start = time.time()
        function_name(input_data)
        duration = time.time() - start

        assert duration < 1.0  # Should complete in under 1 second
```

---

## Database Test Template

```python
"""
Tests for <Database Model> operations

Covers:
- CRUD operations
- Data validation
- Constraints
- Relationships
"""

import pytest
from unittest.mock import Mock, patch
from src.db.model_name import (
    create_model,
    get_model_by_id,
    update_model,
    delete_model
)


@pytest.fixture
def mock_supabase():
    """Mock Supabase client"""
    mock = Mock()
    mock.table.return_value = mock
    mock.select.return_value = mock
    mock.insert.return_value = mock
    mock.update.return_value = mock
    mock.delete.return_value = mock
    mock.eq.return_value = mock
    mock.execute.return_value = Mock(data=[])
    return mock


class TestModelCreation:
    """Test model creation"""

    @patch('src.db.model_name.supabase')
    def test_create_model_success(self, mock_supabase_func, mock_supabase):
        """Successfully create a new model"""
        mock_supabase_func.return_value = mock_supabase
        mock_supabase.execute.return_value = Mock(
            data=[{'id': 1, 'field': 'value'}]
        )

        result = create_model({'field': 'value'})

        assert result is not None
        assert result['id'] == 1

    @patch('src.db.model_name.supabase')
    def test_create_model_validates_required_fields(self, mock_supabase_func):
        """Create fails without required fields"""
        with pytest.raises(ValueError):
            create_model({})


class TestModelRetrieval:
    """Test model retrieval"""

    @patch('src.db.model_name.supabase')
    def test_get_model_by_id_found(self, mock_supabase_func, mock_supabase):
        """Get model by ID when exists"""
        mock_supabase_func.return_value = mock_supabase
        mock_supabase.execute.return_value = Mock(
            data=[{'id': 1, 'field': 'value'}]
        )

        result = get_model_by_id(1)

        assert result is not None
        assert result['id'] == 1

    @patch('src.db.model_name.supabase')
    def test_get_model_by_id_not_found(self, mock_supabase_func, mock_supabase):
        """Get model by ID when doesn't exist"""
        mock_supabase_func.return_value = mock_supabase
        mock_supabase.execute.return_value = Mock(data=[])

        result = get_model_by_id(99999)

        assert result is None


class TestModelUpdate:
    """Test model updates"""

    @patch('src.db.model_name.supabase')
    def test_update_model_success(self, mock_supabase_func, mock_supabase):
        """Successfully update a model"""
        mock_supabase_func.return_value = mock_supabase
        mock_supabase.execute.return_value = Mock(
            data=[{'id': 1, 'field': 'new_value'}]
        )

        result = update_model(1, {'field': 'new_value'})

        assert result is not None
        assert result['field'] == 'new_value'


class TestModelDeletion:
    """Test model deletion"""

    @patch('src.db.model_name.supabase')
    def test_delete_model_success(self, mock_supabase_func, mock_supabase):
        """Successfully delete a model"""
        mock_supabase_func.return_value = mock_supabase
        mock_supabase.execute.return_value = Mock(data=[{'id': 1}])

        result = delete_model(1)

        assert result is True
```

---

## Integration Test Template

```python
"""
End-to-end integration test for <Feature Name>

Tests complete user flow from request to response.
"""

import pytest
from fastapi.testclient import TestClient
from src.main import app


@pytest.fixture
def client():
    """Test client"""
    return TestClient(app)


@pytest.fixture
def test_user_data():
    """Test user data"""
    return {
        'email': 'integration_test@example.com',
        'username': 'integration_test_user',
        'password': 'SecurePassword123!'
    }


class TestEndToEndFlow:
    """Test complete end-to-end user flow"""

    def test_complete_user_journey(self, client, test_user_data):
        """Test complete user journey from signup to feature usage"""

        # Step 1: User signup
        signup_response = client.post('/auth/signup', json=test_user_data)
        assert signup_response.status_code == 201
        user_data = signup_response.json()
        assert 'api_key' in user_data

        api_key = user_data['api_key']
        headers = {'Authorization': f'Bearer {api_key}'}

        # Step 2: Verify user can access protected endpoint
        profile_response = client.get('/users/me', headers=headers)
        assert profile_response.status_code == 200

        # Step 3: User performs main action
        action_response = client.post(
            '/api/action',
            json={'data': 'test'},
            headers=headers
        )
        assert action_response.status_code == 200

        # Step 4: Verify action was recorded
        history_response = client.get('/api/history', headers=headers)
        assert history_response.status_code == 200
        assert len(history_response.json()) > 0

        # Cleanup: Delete test user
        client.delete(f'/users/{user_data["id"]}', headers=headers)
```

---

## Security Test Template

```python
"""
Security tests for <Module Name>

Tests security vulnerabilities:
- Injection attacks
- Authentication bypass
- Authorization issues
- Data exposure
"""

import pytest
from fastapi.testclient import TestClient
from src.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestSQLInjection:
    """Test SQL injection prevention"""

    def test_sql_injection_in_query_params(self, client):
        """SQL injection in query parameters is prevented"""
        malicious_input = "' OR '1'='1"

        response = client.get(f'/api/search?q={malicious_input}')

        # Should not expose database errors
        assert response.status_code in [200, 400, 422]
        if response.status_code == 200:
            # Should return empty or sanitized results
            assert 'error' not in response.json()


class TestXSS:
    """Test XSS prevention"""

    def test_xss_in_user_input(self, client):
        """XSS in user input is sanitized"""
        xss_payload = "<script>alert('XSS')</script>"

        response = client.post('/api/input', json={'content': xss_payload})

        # Response should not contain unsanitized script
        assert '<script>' not in str(response.json())


class TestAuthenticationBypass:
    """Test authentication bypass attempts"""

    def test_missing_auth_header(self, client):
        """Missing auth header is rejected"""
        response = client.get('/api/protected')
        assert response.status_code == 401

    def test_malformed_auth_header(self, client):
        """Malformed auth header is rejected"""
        headers = {'Authorization': 'NotBearer invalid'}
        response = client.get('/api/protected', headers=headers)
        assert response.status_code == 401

    def test_expired_token(self, client):
        """Expired tokens are rejected"""
        expired_token = 'expired_token_here'
        headers = {'Authorization': f'Bearer {expired_token}'}
        response = client.get('/api/protected', headers=headers)
        assert response.status_code == 401


class TestAuthorizationIssues:
    """Test authorization bypass attempts"""

    def test_user_cannot_access_admin_endpoint(self, client, user_headers):
        """Regular user cannot access admin endpoints"""
        response = client.get('/admin/users', headers=user_headers)
        assert response.status_code == 403

    def test_user_cannot_access_others_data(self, client, user_headers):
        """User cannot access another user's data"""
        response = client.get('/users/999999', headers=user_headers)
        assert response.status_code == 403


class TestDataExposure:
    """Test sensitive data exposure"""

    def test_error_messages_dont_expose_internals(self, client):
        """Error messages don't expose internal details"""
        response = client.get('/api/nonexistent')

        error_data = response.json()
        # Should not expose stack traces, file paths, etc.
        assert 'traceback' not in str(error_data).lower()
        assert '/src/' not in str(error_data)
```

---

## Provider Client Test Template

```python
"""
Tests for <Provider Name> Client

Covers:
- Authentication
- Request/response handling
- Error handling
- Retry logic
"""

import pytest
from unittest.mock import Mock, patch
from src.services.provider_client import ProviderClient


@pytest.fixture
def provider_client():
    """Provider client instance"""
    return ProviderClient(api_key='test_key_123')


@pytest.fixture
def mock_httpx_response():
    """Mock httpx response"""
    mock = Mock()
    mock.status_code = 200
    mock.json.return_value = {'status': 'success'}
    return mock


class TestProviderClientAuthentication:
    """Test client authentication"""

    def test_client_requires_api_key(self):
        """Client initialization requires API key"""
        with pytest.raises(ValueError):
            ProviderClient(api_key=None)

    def test_client_validates_api_key_format(self):
        """Client validates API key format"""
        with pytest.raises(ValueError):
            ProviderClient(api_key='invalid')


class TestProviderClientRequests:
    """Test request handling"""

    @patch('httpx.AsyncClient.post')
    async def test_send_chat_completion_request(self, mock_post, provider_client, mock_httpx_response):
        """Send chat completion request"""
        mock_post.return_value = mock_httpx_response

        result = await provider_client.create_completion(
            model='test-model',
            messages=[{'role': 'user', 'content': 'test'}]
        )

        assert result is not None
        mock_post.assert_called_once()

    @patch('httpx.AsyncClient.post')
    async def test_request_includes_auth_header(self, mock_post, provider_client, mock_httpx_response):
        """Request includes authentication header"""
        mock_post.return_value = mock_httpx_response

        await provider_client.create_completion(
            model='test-model',
            messages=[{'role': 'user', 'content': 'test'}]
        )

        call_kwargs = mock_post.call_args.kwargs
        assert 'headers' in call_kwargs
        assert 'Authorization' in call_kwargs['headers']


class TestProviderClientErrorHandling:
    """Test error handling"""

    @patch('httpx.AsyncClient.post')
    async def test_handles_timeout(self, mock_post, provider_client):
        """Handle request timeout"""
        import httpx
        mock_post.side_effect = httpx.TimeoutException('Timeout')

        with pytest.raises(Exception):
            await provider_client.create_completion(
                model='test-model',
                messages=[{'role': 'user', 'content': 'test'}]
            )

    @patch('httpx.AsyncClient.post')
    async def test_handles_rate_limit(self, mock_post, provider_client):
        """Handle rate limit errors"""
        mock_response = Mock()
        mock_response.status_code = 429
        mock_post.return_value = mock_response

        with pytest.raises(Exception):  # Should raise rate limit error
            await provider_client.create_completion(
                model='test-model',
                messages=[{'role': 'user', 'content': 'test'}]
            )


class TestProviderClientRetry:
    """Test retry logic"""

    @patch('httpx.AsyncClient.post')
    async def test_retries_on_failure(self, mock_post, provider_client, mock_httpx_response):
        """Retry failed requests"""
        # First call fails, second succeeds
        mock_post.side_effect = [
            Exception('Network error'),
            mock_httpx_response
        ]

        result = await provider_client.create_completion(
            model='test-model',
            messages=[{'role': 'user', 'content': 'test'}]
        )

        assert result is not None
        assert mock_post.call_count == 2
```

---

## Quick Reference

### Running Tests

```bash
# Run all tests
pytest tests/

# Run specific test file
pytest tests/routes/test_admin.py

# Run specific test class
pytest tests/routes/test_admin.py::TestAdminAuthentication

# Run specific test
pytest tests/routes/test_admin.py::TestAdminAuthentication::test_admin_requires_auth

# Run with coverage
pytest tests/ --cov=src --cov-report=html

# Run in parallel
pytest tests/ -n auto
```

### Common Assertions

```python
# Equality
assert result == expected

# Status codes
assert response.status_code == 200
assert response.status_code in [200, 201]

# Contains
assert 'key' in dictionary
assert item in list

# Type checks
assert isinstance(result, dict)

# Exceptions
with pytest.raises(ValueError):
    function_that_raises()

# None checks
assert result is not None
assert result is None
```

### Useful Fixtures

```python
@pytest.fixture
def mock_db():
    """Mock database connection"""
    pass

@pytest.fixture
def test_data():
    """Test data"""
    return {'test': 'data'}

@pytest.fixture(autouse=True)
def cleanup():
    """Auto cleanup after each test"""
    yield
    # Cleanup code here
```

---

**Last Updated:** 2025-10-31
**Next Review:** As needed
