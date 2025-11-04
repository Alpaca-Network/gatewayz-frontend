# Routes Testing Guide

**Goal:** Achieve 90%+ test coverage for all routes files using FastAPI TestClient with proper mocking.

**Current Status:**
- Overall routes coverage: **15.05%**
- Many existing tests are broken (30+ failures out of 320 tests)
- Need systematic approach to create comprehensive, working tests

---

## Key Challenges with Routes Testing

### 1. TestClient + Mocking Complexity
Unlike DB tests (which use in-memory stubs), routes tests require:
- Mocking multiple dependencies (DB, external services, auth)
- Proper FastAPI dependency injection override
- Correct import order (mock BEFORE importing app)

### 2. Coverage Measurement Issues
- TestClient doesn't always trigger coverage for route handlers
- Need to run tests without parallel execution for accurate coverage
- Use `pytest tests/routes/test_FILE.py --cov=src/routes/FILE -x` for single-file testing

### 3. Complex Dependencies
Routes depend on:
- Database functions (from `src/db/`)
- External services (OpenRouter, Stripe, etc.)
- Authentication (`get_api_key` dependency)
- Rate limiting, trials, plan enforcement

---

## The Proven Pattern (from test_auth_v2.py)

### Template Structure

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import src.config.supabase_config
import src.db.users as users_module
import src.db.api_keys as api_keys_module

# ==================================================
# IN-MEMORY SUPABASE STUB (reuse from DB tests)
# ==================================================

class _Result:
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count

    def execute(self):
        return self

class _BaseQuery:
    # ... (same as DB test stub)

class SupabaseStub:
    def __init__(self):
        self.tables = {}

    def table(self, name):
        return _Table(self, name)

# ==================================================
# TEST FIXTURES
# ==================================================

@pytest.fixture
def sb():
    """Provide in-memory Supabase stub"""
    stub = SupabaseStub()
    yield stub
    stub.tables.clear()

@pytest.fixture
def client(sb, monkeypatch):
    """Create TestClient with all necessary mocks"""
    # 1) Mock get_supabase_client BEFORE importing app
    monkeypatch.setattr(
        src.config.supabase_config,
        "get_supabase_client",
        lambda: sb
    )

    # 2) Mock all DB functions used by this route
    def mock_get_user(api_key):
        users = sb.table("users").select("*").eq("api_key", api_key).execute()
        return users.data[0] if users.data else None

    monkeypatch.setattr(users_module, "get_user", mock_get_user)

    # 3) Mock external services (Stripe, OpenRouter, etc.)
    # Use MagicMock or simple lambda functions

    # 4) NOW import app (after all mocks are in place)
    from src.main import app

    return TestClient(app)

# ==================================================
# TESTS
# ==================================================

def test_endpoint_success(client, sb):
    """Test happy path"""
    # Arrange: Set up test data
    sb.table("users").insert({
        "id": 1,
        "api_key": "test-key",
        "credits": 100.0
    }).execute()

    # Act: Call endpoint
    response = client.post(
        "/v1/endpoint",
        json={"param": "value"},
        headers={"Authorization": "Bearer test-key"}
    )

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["result"] == "expected"

def test_endpoint_unauthorized(client):
    """Test without valid API key"""
    response = client.post(
        "/v1/endpoint",
        json={"param": "value"}
    )
    assert response.status_code == 401

def test_endpoint_insufficient_credits(client, sb):
    """Test when user has no credits"""
    sb.table("users").insert({
        "id": 1,
        "api_key": "test-key",
        "credits": 0.0
    }).execute()

    response = client.post(
        "/v1/endpoint",
        json={"param": "value"},
        headers={"Authorization": "Bearer test-key"}
    )
    assert response.status_code == 402
```

---

## Test Checklist Per Endpoint

For EACH endpoint in a routes file:

### ✅ Authentication & Authorization
- [ ] No API key (401 Unauthorized)
- [ ] Invalid API key (401)
- [ ] Valid API key but insufficient permissions (403 Forbidden)
- [ ] Admin-only endpoints without admin role (403)

### ✅ Happy Path
- [ ] Valid request with all required params
- [ ] Returns expected status code (200, 201, etc.)
- [ ] Returns correct response structure
- [ ] Database is updated correctly (if applicable)

### ✅ Input Validation
- [ ] Missing required fields (422 Unprocessable Entity)
- [ ] Invalid field types (422)
- [ ] Invalid field values (400 Bad Request)
- [ ] Boundary value tests (min/max)

### ✅ Business Logic Errors
- [ ] Insufficient credits (402 Payment Required)
- [ ] Rate limit exceeded (429 Too Many Requests)
- [ ] Plan limit exceeded (429)
- [ ] Trial expired (403)
- [ ] Resource not found (404)
- [ ] Duplicate resource (409 Conflict)

### ✅ Error Handling
- [ ] Database connection fails (500 Internal Server Error)
- [ ] External service timeout (502 Bad Gateway / 504 Gateway Timeout)
- [ ] External service error (502)
- [ ] Unexpected exceptions (500)

### ✅ Special Cases
- [ ] Streaming endpoints (if applicable)
- [ ] File uploads (if applicable)
- [ ] Webhooks (if applicable)
- [ ] Query parameters (pagination, filters)
- [ ] Optional parameters

---

## Priority Order (Based on Coverage & Importance)

### Phase 1: Critical API Endpoints (Week 1-2)
1. **routes/auth.py** (2.38% → 90%+)
   - ✅ test_auth_v2.py created (16 tests)
   - Still needs: streaming tests, more error scenarios
   - Estimated: 10 more tests

2. **routes/chat.py** (5.52% → 90%+) ⭐ **HIGHEST PRIORITY**
   - `/v1/chat/completions` - Main chat endpoint
   - `/v1/responses` - Unified responses API
   - Streaming and non-streaming paths
   - Multiple provider failover scenarios
   - **Estimated: 50-70 tests, 12-16 hours**

3. **routes/catalog.py** (7.41% → 90%+)
   - Model catalog endpoints
   - Provider model listings
   - Model search/filtering
   - **Estimated: 40-50 tests, 8-12 hours**

### Phase 2: Admin & Management (Week 3)
4. **routes/admin.py** (18.24% → 90%+)
   - User management
   - System monitoring
   - Analytics dashboards
   - **Estimated: 35-45 tests, 8-10 hours**

5. **routes/users.py** (19.12% → 90%+)
   - User profile management
   - Credit operations
   - Usage tracking
   - **Estimated: 30-40 tests, 6-8 hours**

### Phase 3: Payments & Features (Week 4)
6. **routes/payments.py** (24.35% → 90%+)
   - Stripe integration
   - Checkout sessions
   - Payment intents
   - **Estimated: 25-35 tests, 6-8 hours**

7. **routes/messages.py** (14.72% → 90%+)
   - Message handling
   - **Estimated: 25-30 tests, 5-7 hours**

---

## Mocking Strategy for Common Dependencies

### 1. Database Functions

```python
# Mock in fixture before importing app
import src.db.users as users_module

@pytest.fixture
def client(sb, monkeypatch):
    def mock_get_user(api_key):
        users = sb.table("users").select("*").eq("api_key", api_key).execute()
        return users.data[0] if users.data else None

    monkeypatch.setattr(users_module, "get_user", mock_get_user)

    def mock_deduct_credits(api_key, amount, description, metadata=None):
        # Implement using sb stub
        pass

    monkeypatch.setattr(users_module, "deduct_credits", mock_deduct_credits)
```

### 2. External Services (Stripe, OpenRouter, etc.)

```python
@pytest.fixture
def client(sb, monkeypatch):
    # Mock Stripe
    mock_stripe = MagicMock()
    mock_stripe.checkout.Session.create.return_value = MagicMock(
        id="sess_123",
        url="https://checkout.stripe.com/..."
    )
    monkeypatch.setattr("src.routes.payments.stripe", mock_stripe)

    # Mock OpenRouter client
    def mock_openrouter_request(messages, model, **kwargs):
        return {
            "id": "chatcmpl-123",
            "choices": [{
                "message": {"role": "assistant", "content": "Test response"},
                "finish_reason": "stop"
            }],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}
        }

    monkeypatch.setattr(
        "src.services.openrouter_client.make_openrouter_request_openai",
        mock_openrouter_request
    )
```

### 3. Rate Limiting

```python
@pytest.fixture
def client(sb, monkeypatch):
    # Mock rate limit manager
    class MockRateLimitManager:
        async def check_rate_limit(self, api_key, tokens_used=0):
            return MagicMock(allowed=True, remaining_requests=100)

        async def release_concurrency(self, api_key):
            pass

    monkeypatch.setattr(
        "src.services.rate_limiting.get_rate_limit_manager",
        lambda: MockRateLimitManager()
    )
```

### 4. Trial Validation

```python
@pytest.fixture
def client(sb, monkeypatch):
    def mock_validate_trial(api_key):
        # Check if user has trial status in stub
        users = sb.table("users").select("*").eq("api_key", api_key).execute()
        if users.data:
            user = users.data[0]
            return {
                "is_valid": True,
                "is_trial": user.get("is_trial", False),
                "is_expired": False
            }
        return {"is_valid": False, "error": "Invalid API key"}

    monkeypatch.setattr(
        "src.services.trial_validation.validate_trial_access",
        mock_validate_trial
    )
```

---

## Running Tests

### Single File (for development)
```bash
# Run with coverage
pytest tests/routes/test_FILE.py --cov=src/routes/FILE --cov-report=html -v

# Run without parallel (more accurate coverage)
pytest tests/routes/test_FILE.py --cov=src/routes/FILE -x -v --tb=short
```

### All Routes Tests
```bash
pytest tests/routes/ --cov=src/routes --cov-report=term -v
```

### Check Specific Endpoint
```bash
pytest tests/routes/test_FILE.py::test_endpoint_name -v
```

---

## Common Pitfalls & Solutions

### ❌ Problem: "Module not found" or import errors
**Solution:** Make sure to mock dependencies BEFORE importing app:
```python
# ✅ Correct order
monkeypatch.setattr(src.config.supabase_config, "get_supabase_client", lambda: sb)
from src.main import app  # Import AFTER patching

# ❌ Wrong order
from src.main import app
monkeypatch.setattr(...)  # Too late!
```

### ❌ Problem: Tests return 404 Not Found
**Solution:** Router didn't load because of initialization errors. Check:
- All required config is mocked
- No exceptions during app startup
- Router is actually included in `src/main.py`

### ❌ Problem: Tests pass individually but fail when run together
**Solution:** Test isolation issue. Fix with:
```python
@pytest.fixture
def sb():
    stub = SupabaseStub()
    yield stub
    stub.tables.clear()  # Clean up after each test
```

### ❌ Problem: Coverage not improving despite tests passing
**Solution:**
- TestClient doesn't always trigger coverage for async routes
- Run without xdist: `pytest -p no:xdist`
- Check HTML report to see what's actually missing

### ❌ Problem: Flaky tests in parallel execution
**Solution:**
- Add proper cleanup in fixtures
- Avoid shared state between tests
- Use separate stub instances

---

## Success Metrics

### Per Routes File:
- ✅ 90%+ line coverage
- ✅ All endpoints have at least 5 tests each
- ✅ All error paths tested
- ✅ All auth scenarios tested
- ✅ All tests passing consistently

### Overall Goals:
- ✅ All 25 routes files at 90%+ coverage
- ✅ Total routes/ folder coverage: 90%+
- ✅ 500+ comprehensive tests
- ✅ Zero broken tests in main branch

---

## Time Estimates

Based on complexity and current coverage:

| File | Lines | Current | Target | Estimated Tests | Time |
|------|-------|---------|--------|----------------|------|
| chat.py | 1372 | 5.52% | 90%+ | 60-70 | 12-16h |
| catalog.py | 1797 | 7.41% | 90%+ | 45-55 | 10-14h |
| admin.py | 695 | 18.24% | 90%+ | 35-45 | 8-10h |
| users.py | 339 | 19.12% | 90%+ | 30-40 | 6-8h |
| payments.py | 489 | 24.35% | 90%+ | 25-35 | 6-8h |
| messages.py | 458 | 14.72% | 90%+ | 25-30 | 5-7h |
| system.py | 627 | 15.54% | 90%+ | 30-40 | 7-9h |
| api_keys.py | 388 | 12.30% | 90%+ | 25-30 | 5-7h |

**Total Estimated: 300-400 tests, 60-80 hours**

---

## Example: Complete Test File

See `tests/routes/test_auth_v2.py` as reference implementation:
- 16 comprehensive tests
- In-memory Supabase stub
- Proper dependency mocking
- 14-16 tests passing
- Good coverage of auth flows

**Copy this pattern for every routes file!**

---

## Daily Workflow

### 1. Pick ONE routes file to test
Choose based on priority list above.

### 2. Analyze the file
```bash
# List all endpoints
grep -n "@router\." src/routes/FILE.py

# Count lines
wc -l src/routes/FILE.py
```

### 3. Create test file from template
- Copy test_auth_v2.py structure
- Update imports for specific route's dependencies
- Create fixture with necessary mocks

### 4. Write tests systematically
- Start with authentication tests (401, 403)
- Then happy path (200, 201)
- Then validation errors (400, 422)
- Then business logic errors (402, 429)
- Then error handling (500, 502)

### 5. Run and iterate
```bash
# Run tests
pytest tests/routes/test_FILE.py -v

# Check coverage
pytest tests/routes/test_FILE.py --cov=src/routes/FILE --cov-report=html
open htmlcov/index.html

# Add tests for missing lines, repeat
```

### 6. Commit when done
```bash
git add tests/routes/test_FILE.py
git commit -m "test(routes): add comprehensive tests for FILE.py - 90%+ coverage"
```

---

## Reference Files

- ✅ `tests/routes/test_auth_v2.py` - Working example (16 tests)
- ✅ `tests/db/test_users.py` - DB stub pattern (39 tests, 91% coverage)
- ✅ `DB_TESTING_GUIDE.md` - DB testing approach
- ✅ `ROUTES_TESTING_GUIDE.md` - This guide

---

## Next Steps

1. ✅ Create Routes Testing Guide (this file)
2. 🔄 Test routes/chat.py (highest priority)
3. ⏳ Test routes/catalog.py
4. ⏳ Test routes/admin.py
5. ⏳ Continue through priority list

**Remember:** Routes testing is harder than DB testing because of:
- More dependencies to mock
- External service integration
- FastAPI TestClient quirks
- Coverage measurement challenges

**But it's doable!** Follow this guide, one file at a time, and you'll hit 90%+ routes coverage.

---

**Last Updated:** 2025-10-24
**Next Priority:** routes/chat.py (5.52% → 90%+)
