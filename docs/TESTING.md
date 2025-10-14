# Testing Guide

This guide covers the comprehensive test suite for the Gatewayz backend, with a focus on endpoint regression testing to ensure no critical functionality is lost when adding new code.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Regression Tests](#regression-tests)
- [Continuous Integration](#continuous-integration)
- [Writing New Tests](#writing-new-tests)

## Overview

The Gatewayz backend has multiple test categories:

- **Unit Tests**: Fast tests with no external dependencies
- **Integration Tests**: Tests requiring database or external APIs
- **Regression Tests**: Tests ensuring existing endpoints continue working
- **Critical Tests**: Must-pass tests for core business functionality

## Test Structure

```
tests/
├── conftest.py                      # Pytest fixtures and configuration
├── test_endpoint_regression.py      # 🔴 CRITICAL: Endpoint regression tests
├── test_endpoints.py                # General endpoint tests
├── test_responses_endpoint.py       # /v1/responses endpoint tests
├── test_streaming.py                # Streaming functionality tests
├── test_chat_history_api.py        # Chat history tests
├── test_referral.py                 # Referral system tests
└── ... (other test files)
```

## Running Tests

### Quick Start

```bash
# Run all tests
pytest

# Run regression tests only
pytest tests/test_endpoint_regression.py -v

# Run critical tests only
pytest -m critical

# Run with coverage
pytest --cov=src --cov-report=html
```

### Using the Test Runner Script

```bash
# Run all regression tests
python run_regression_tests.py

# Run only critical endpoint tests
python run_regression_tests.py --critical

# Run only chat endpoints
python run_regression_tests.py --chat

# Run with coverage report
python run_regression_tests.py --coverage

# Stop on first failure
python run_regression_tests.py --failfast
```

### Run Specific Test Classes

```bash
# Test chat completions endpoints
pytest tests/test_endpoint_regression.py::TestChatCompletionsEndpoints -v

# Test unified responses endpoint
pytest tests/test_endpoint_regression.py::TestUnifiedResponsesEndpoint -v

# Test authentication endpoints
pytest tests/test_endpoint_regression.py::TestAuthenticationEndpoints -v

# Test payment endpoints
pytest tests/test_endpoint_regression.py::TestPaymentEndpoints -v
```

## Regression Tests

### What Are Regression Tests?

Regression tests ensure that existing functionality continues to work when new code is added. They act as a **contract** that prevents:

- Accidental endpoint removal
- Breaking changes to request/response formats
- Authentication bypass
- Critical business logic failures

### Critical Endpoints Covered

#### 1. Health & Status
- `GET /health` - Must always return 200
- `GET /ping` - Basic connectivity
- `GET /` - Root endpoint

#### 2. Chat Completions (CRITICAL)
- `POST /v1/chat/completions` - Legacy chat API
- `POST /v1/chat/completions?stream=true` - Streaming chat
- `POST /v1/responses` - Unified API (new)
- `POST /v1/responses?stream=true` - Unified streaming

#### 3. Authentication
- `GET /user/balance` - User balance check
- `GET /user/profile` - User profile
- `GET /user/monitor` - Usage monitoring

#### 4. API Key Management
- `GET /api-keys` - List keys
- `POST /api-keys` - Create key
- `DELETE /api-keys/{key_id}` - Delete key

#### 5. Payments
- `POST /api/stripe/checkout-session` - Create checkout
- `GET /api/stripe/payments` - Payment history
- `POST /api/stripe/webhook` - Stripe webhooks

#### 6. Chat History
- `GET /chat/sessions` - List sessions
- `POST /chat/sessions` - Create session
- `GET /chat/sessions/{id}` - Get session

#### 7. Admin Operations
- `GET /admin/users` - List users
- `POST /admin/users/{id}/credits` - Add credits

#### 8. Catalog
- `GET /catalog/models` - Available models
- `GET /catalog/providers` - Available providers

### Test Markers

Use pytest markers to run specific test categories:

```bash
# Run only regression tests
pytest -m regression

# Run only critical tests
pytest -m critical

# Run authentication tests
pytest -m auth

# Run payment tests
pytest -m payment

# Run chat endpoint tests
pytest -m chat
```

## Continuous Integration

### GitHub Actions

The test suite runs automatically on:
- Every push to `main` or `develop`
- Every pull request
- Manual workflow dispatch

### CI Jobs

#### 1. Main Test Suite
Runs on Python 3.10, 3.11, and 3.12:
- All endpoint tests
- Coverage reporting
- Codecov upload

#### 2. Critical Tests
Focused on business-critical endpoints:
- Chat completions
- Authentication
- Payments

#### 3. Regression Tests (NEW)
Ensures no endpoints are removed:
- All regression tests
- Critical chat endpoints
- Fails if any endpoint is missing

### Required Secrets

Configure these in GitHub Settings > Secrets:

```
SUPABASE_URL          # Your Supabase instance URL
SUPABASE_KEY          # Supabase service role key
OPENROUTER_API_KEY    # OpenRouter API key
PORTKEY_API_KEY       # Portkey API key
FEATHERLESS_API_KEY   # Featherless API key
ENCRYPTION_KEY        # 32-byte encryption key
ADMIN_API_KEY         # Admin API key
RESEND_API_KEY        # Email service key
```

## Writing New Tests

### Adding a New Endpoint Test

When you add a new endpoint, **always** add a regression test:

```python
# In tests/test_endpoint_regression.py

class TestYourNewEndpoints:
    """Test your new feature endpoints"""

    @patch('src.db.users.get_user')
    def test_your_new_endpoint_exists(
        self,
        mock_get_user,
        client,
        mock_user,
        auth_headers
    ):
        """Regression: POST /your/new/endpoint must exist"""
        mock_get_user.return_value = mock_user

        response = client.post(
            "/your/new/endpoint",
            headers=auth_headers,
            json={"param": "value"}
        )

        # Endpoint must exist
        assert response.status_code in [200, 201, 401, 500]
        # Add more specific assertions as needed
```

### Test Naming Conventions

- `test_*_endpoint_exists` - Tests that endpoint exists
- `test_*_requires_auth` - Tests authentication
- `test_*_validates_input` - Tests input validation
- `test_*_returns_expected_format` - Tests response structure

### Mocking Best Practices

1. **Mock database calls**: Use `@patch('src.db.users.get_user')`
2. **Mock external APIs**: Use `@patch('src.services.openrouter_client.*')`
3. **Mock rate limiters**: Use the `mock_rate_limiter` fixture
4. **Mock trial validation**: Use `@patch('src.services.trial_validation.validate_trial_access')`

### Example: Complete Endpoint Test

```python
@patch('src.db.users.get_user')
@patch('src.services.openrouter_client.make_openrouter_request_openai')
@patch('src.services.openrouter_client.process_openrouter_response')
@patch('src.services.rate_limiting.get_rate_limit_manager')
@patch('src.services.trial_validation.validate_trial_access')
@patch('src.db.plans.enforce_plan_limits')
def test_my_new_chat_feature(
    self,
    mock_enforce_limits,
    mock_trial,
    mock_rate_limiter,
    mock_process,
    mock_request,
    mock_get_user,
    client,
    mock_user,
    auth_headers,
    mock_rate_limiter as rate_limiter_fixture
):
    """Test new chat feature works correctly"""
    # Setup mocks
    mock_get_user.return_value = mock_user
    mock_trial.return_value = {'is_valid': True, 'is_trial': False}
    mock_enforce_limits.return_value = {'allowed': True}
    mock_rate_limiter.return_value = rate_limiter_fixture

    mock_request.return_value = {"id": "test", "usage": {"total_tokens": 10}}
    mock_process.return_value = {
        "id": "test",
        "choices": [{"message": {"content": "Response"}}],
        "usage": {"total_tokens": 10}
    }

    # Make request
    response = client.post(
        "/v1/your/new/feature",
        headers=auth_headers,
        json={"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hi"}]}
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "expected_field" in data
```

## Coverage Reports

### Generate Coverage Report

```bash
# Terminal report
pytest --cov=src --cov-report=term

# HTML report
pytest --cov=src --cov-report=html
open htmlcov/index.html

# XML report (for CI)
pytest --cov=src --cov-report=xml
```

### Coverage Goals

- **Overall**: > 70%
- **Critical paths**: > 90%
  - Authentication (`src/security/`)
  - Chat endpoints (`src/routes/chat.py`)
  - Payment processing (`src/routes/payments.py`)

## Troubleshooting

### Tests Failing Locally

1. **Missing environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your test credentials
   ```

2. **Database not accessible**:
   ```bash
   # Tests should mock DB calls
   # Check if TESTING env var is set
   export TESTING=true
   ```

3. **Import errors**:
   ```bash
   # Ensure src is in PYTHONPATH
   export PYTHONPATH="${PYTHONPATH}:."
   ```

### Tests Passing Locally But Failing in CI

1. Check GitHub Actions logs for specific errors
2. Ensure all secrets are configured
3. Verify Python version compatibility (3.10, 3.11, 3.12)
4. Check for OS-specific issues (Linux vs Windows)

### Slow Tests

```bash
# Run only fast tests
pytest -m "not slow"

# Show slowest tests
pytest --durations=10
```

## Best Practices

1. **Always add regression tests for new endpoints**
2. **Mock external dependencies** (database, APIs)
3. **Test both success and failure cases**
4. **Use descriptive test names** that explain what is being tested
5. **Keep tests independent** - no shared state
6. **Run tests before committing** - use pre-commit hooks
7. **Update tests when changing APIs** - keep tests in sync with code

## Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
echo "Running regression tests..."
python run_regression_tests.py --critical --failfast

if [ $? -ne 0 ]; then
    echo "❌ Tests failed! Commit aborted."
    exit 1
fi

echo "✅ Tests passed!"
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [GitHub Actions](https://docs.github.com/en/actions)

## Support

If you have questions about testing:
1. Check this documentation
2. Review existing tests in `tests/`
3. Ask in the team chat
4. Open an issue with the `testing` label

---

**Remember**: Tests are not just about catching bugs - they're about building confidence that your code works and will continue to work as the project grows.
