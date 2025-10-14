# Gatewayz Backend Test Suite

Comprehensive test suite for the Gatewayz API Gateway backend to ensure all endpoints are functional and working correctly.

## Test Structure

### ⭐ `test_endpoint_regression.py` (NEW - CRITICAL)
**Regression tests to prevent breaking changes**. This is the most important test file - it ensures all critical endpoints continue working when new code is added:
- **Health & Status**: `/health`, `/ping`, root endpoint
- **Chat Completions**: `/v1/chat/completions` (legacy API)
- **Unified Responses**: `/v1/responses` (new unified API)
- **Streaming**: Both streaming endpoints
- **Authentication**: User balance, profile, monitoring
- **API Keys**: Create, list, delete keys
- **Payments**: Stripe checkout, webhooks, payment history
- **Chat History**: Session management
- **Admin**: User management, credit operations
- **Catalog**: Model and provider listings
- **Ranking**: Model and app rankings

### `test_endpoints.py`
General endpoint tests covering:
- **Health Endpoints**: `/health`, `/ping`, root endpoint
- **Authentication**: `/auth`, `/user/balance`, user profile
- **Chat Completions**: `/v1/chat/completions` (most critical)
- **User Management**: credit transactions, profile, monitoring
- **Payments**: Stripe checkout, webhooks, payment history
- **Rankings**: Models and apps rankings
- **API Keys**: Creation, listing, management
- **Admin**: User management, credit operations
- **Catalog**: Model and provider catalogs
- **Chat History**: Session management

### `test_app.py`
Legacy tests for basic functionality (maintained for compatibility)

## Quick Start

```bash
# Run regression tests (most important)
pytest tests/test_endpoint_regression.py -v

# Or use the test runner script
python run_regression_tests.py
```

## Running Tests

### Regression Tests (RECOMMENDED)
```bash
# All regression tests
pytest tests/test_endpoint_regression.py -v

# Only critical endpoints (chat, auth, payments)
python run_regression_tests.py --critical

# Only chat endpoints
python run_regression_tests.py --chat

# With coverage
python run_regression_tests.py --coverage
```

### Run All Tests
```bash
pytest tests/ -v
```

### Run Specific Test File
```bash
pytest tests/test_endpoints.py -v
pytest tests/test_endpoint_regression.py -v
```

### Run Specific Test Class
```bash
pytest tests/test_endpoints.py::TestChatEndpoints -v
```

### Run Specific Test
```bash
pytest tests/test_endpoints.py::TestChatEndpoints::test_chat_completions_endpoint_exists -v
```

### Run Critical Tests Only
```bash
# Run only chat endpoint tests
pytest tests/test_endpoints.py::TestChatEndpoints -v

# Run auth tests
pytest tests/test_endpoints.py::TestAuthEndpoints -v

# Run payment tests
pytest tests/test_endpoints.py::TestPaymentEndpoints -v
```

### Run with Coverage
```bash
pytest tests/ --cov=src --cov-report=html
```

View coverage report at `htmlcov/index.html`

### Run with Markers
```bash
# Run only critical tests
pytest tests/ -m critical -v

# Run only integration tests
pytest tests/ -m integration -v

# Skip slow tests
pytest tests/ -m "not slow" -v
```

## Environment Setup

Tests require these environment variables (automatically set in CI/CD):
```bash
export SUPABASE_URL=https://test.supabase.co
export SUPABASE_KEY=test-key
export OPENROUTER_API_KEY=test-openrouter-key
export ENCRYPTION_KEY=test-encryption-key-32-bytes-long!
```

## Test Philosophy

1. **Endpoint Existence**: Every test ensures the endpoint exists (no 404)
2. **Authentication**: Tests verify auth requirements are enforced
3. **Mock External Services**: OpenRouter, Stripe, and database calls are mocked
4. **Fast Execution**: Tests run quickly without real API calls
5. **Comprehensive Coverage**: All critical user flows are tested

## Adding New Tests

When adding a new endpoint:

1. Add a test in the appropriate test class
2. Mock all external dependencies
3. Test both success and failure cases
4. Verify authentication requirements
5. Run tests locally before committing

Example:
```python
@patch('src.db.users.get_user')
def test_new_endpoint(self, mock_get_user, client, mock_user):
    """Test GET /new-endpoint exists"""
    mock_get_user.return_value = mock_user

    response = client.get(
        "/new-endpoint",
        headers={"Authorization": f"Bearer {mock_user['api_key']}"}
    )

    assert response.status_code in [200, 401, 500]
```

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Manual workflow dispatch

See `.github/workflows/test.yml` for CI/CD configuration.

## Troubleshooting

### Import Errors
```bash
# Ensure you're in the project root
cd /path/to/gatewayz-backend

# Install test dependencies
pip install pytest pytest-cov pytest-asyncio httpx
```

### Database Errors
Tests use mocks, so database connection errors mean mocking isn't working correctly. Check that all database functions are properly patched with `@patch`.

### Async Errors
Some tests may require `pytest-asyncio`. Install it:
```bash
pip install pytest-asyncio
```

## Test Maintenance

- Run tests before every commit
- Update tests when endpoints change
- Keep mocks in sync with actual implementations
- Add tests for every new feature
- Remove tests for deprecated endpoints

## Contact

For questions about tests, see the main project README or open an issue.
