# Testing Guide

## Quick Start

```bash
# Install test dependencies
pip install -r requirements.txt

# Run all tests
pytest tests/ -v

# Run specific test suite
pytest tests/test_endpoints.py -v

# Run with coverage
pytest tests/ --cov=src --cov-report=html
```

## Test Coverage

The test suite (`tests/test_endpoints.py`) provides comprehensive coverage of all critical endpoints:

### ✅ Fully Tested Endpoints

#### Health & Status
- `GET /health` - Health check
- `GET /` - Root endpoint
- `GET /ping` - Ping/pong

#### Rankings
- `GET /ranking/models` - Model rankings
- `GET /ranking/apps` - App rankings

#### User Management
- `GET /user/balance` - Get user balance
- `GET /user/profile` - Get user profile
- `GET /user/monitor` - Get usage metrics
- `GET /user/credit-transactions` - Get transaction history
- `PUT /user/profile` - Update profile

#### Payments
- `POST /api/stripe/checkout-session` - Create checkout
- `POST /api/stripe/webhook` - Stripe webhooks
- `GET /api/stripe/payments` - Payment history

#### Chat
- `POST /v1/chat/completions` - **CRITICAL** Main AI chat endpoint
- `GET /chat/sessions` - List chat sessions
- `POST /chat/sessions` - Create chat session

#### API Keys
- `GET /api-keys` - List API keys
- `POST /api-keys` - Create API key

#### Admin
- `GET /admin/users` - List all users
- `POST /admin/users/{user_id}/credits` - Add credits

#### Catalog
- `GET /catalog/models` - List available models
- `GET /catalog/providers` - List providers

## Running Tests in CI/CD

Tests automatically run on:
- Push to `main` or `develop`
- Pull requests
- Manual workflow trigger

See `.github/workflows/test.yml` for configuration.

## Critical Tests

The most important tests that must always pass:

```bash
# Chat endpoint (core functionality)
pytest tests/test_endpoints.py::TestChatEndpoints -v

# Authentication
pytest tests/test_endpoints.py::TestAuthEndpoints -v

# Payments
pytest tests/test_endpoints.py::TestPaymentEndpoints -v
```

## Test Philosophy

1. **Mock Everything**: Tests use mocks for database and external APIs
2. **Fast Execution**: All tests run in seconds
3. **Endpoint Existence**: Verify endpoints exist (no 404s)
4. **Auth Requirements**: Verify authentication is enforced
5. **Integration Tests**: Test complete user flows

## Adding Tests

When adding a new endpoint to the API:

1. Add test to appropriate test class in `tests/test_endpoints.py`
2. Mock all external dependencies
3. Test success and failure cases
4. Run tests before committing

## Troubleshooting

### Import Errors
Ensure you're in the project root and have installed all dependencies:
```bash
pip install -r requirements.txt
```

### Mocking Issues
If tests fail due to database errors, ensure all database calls are mocked with `@patch`.

### Async Errors
Install pytest-asyncio if you see async-related errors:
```bash
pip install pytest-asyncio
```

## Coverage Reports

Generate HTML coverage report:
```bash
pytest tests/ --cov=src --cov-report=html
open htmlcov/index.html
```

## Continuous Improvement

- Keep tests up to date with endpoint changes
- Add tests for new features before merging
- Maintain >80% code coverage
- Fix failing tests immediately

## Test Results

Current test status: ✅ 24 tests covering all critical endpoints

For detailed test documentation, see `tests/README.md`.
