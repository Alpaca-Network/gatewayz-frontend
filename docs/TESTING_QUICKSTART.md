# Testing Quick Start Guide

Get started with testing in 5 minutes.

---

## Setup (One-time)

1. **Install test dependencies:**

```bash
pip install -r requirements-dev.txt
```

2. **Verify setup:**

```bash
pytest --version
```

---

## Running Your First Coverage Report

```bash
# Make script executable (first time only)
chmod +x scripts/coverage_report.sh

# Run coverage report
./scripts/coverage_report.sh
```

This will:
- ✅ Run all tests
- ✅ Generate coverage report
- ✅ Show coverage by module
- ✅ Identify untested files
- ✅ Create HTML report

**View detailed report:**
```bash
open htmlcov/index.html
```

---

## Analyze Coverage Gaps

```bash
python scripts/coverage_analysis.py
```

This shows:
- Total files vs test files
- Untested modules by category
- Prioritized recommendations

---

## Writing Your First Test

### Step 1: Choose a Template

Pick the appropriate template from `docs/TEST_TEMPLATES.md`:
- **Route Test** - for API endpoints
- **Service Test** - for business logic
- **Database Test** - for database operations
- **Integration Test** - for end-to-end flows
- **Security Test** - for security validation

### Step 2: Create Test File

Example: Testing `src/routes/admin.py`

```bash
# Create test file
touch tests/routes/test_admin.py
```

### Step 3: Copy Template

Copy the relevant template from `TEST_TEMPLATES.md` to your new file.

### Step 4: Customize

```python
"""
Tests for Admin endpoints

Covers:
- Authentication
- User management
- System operations
"""

import pytest
from fastapi.testclient import TestClient
from src.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestAdminAuthentication:
    def test_admin_endpoint_requires_auth(self, client):
        """Admin endpoints require authentication"""
        response = client.get('/admin/users')
        assert response.status_code == 401
```

### Step 5: Run Test

```bash
pytest tests/routes/test_admin.py -v
```

### Step 6: Check Coverage

```bash
pytest tests/routes/test_admin.py --cov=src/routes/admin --cov-report=term
```

---

## Common Test Patterns

### Testing Routes

```python
from fastapi.testclient import TestClient
from src.main import app

def test_endpoint():
    client = TestClient(app)
    response = client.get('/api/endpoint')
    assert response.status_code == 200
```

### Mocking Database

```python
from unittest.mock import patch

@patch('src.db.users.get_user_by_id')
def test_with_mock_db(mock_get_user):
    mock_get_user.return_value = {'id': 1, 'name': 'Test'}
    # Your test here
```

### Testing Async Functions

```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    result = await async_function()
    assert result is not None
```

### Testing Exceptions

```python
import pytest

def test_raises_error():
    with pytest.raises(ValueError):
        function_that_should_raise()
```

---

## Test Organization

```
tests/
├── conftest.py          # Shared fixtures
├── routes/              # Route tests
│   ├── test_admin.py
│   ├── test_auth.py
│   └── test_users.py
├── services/            # Service tests
│   ├── test_pricing.py
│   └── test_analytics.py
├── db/                  # Database tests
│   ├── test_users.py
│   └── test_payments.py
├── integration/         # Integration tests
│   └── test_e2e_flow.py
└── security/            # Security tests
    └── test_auth_bypass.py
```

---

## Daily Workflow

### Morning

```bash
# Check current coverage
./scripts/coverage_report.sh

# Analyze gaps
python scripts/coverage_analysis.py
```

### During Development

```bash
# Run tests in watch mode (requires pytest-watch)
ptw tests/

# Run specific tests
pytest tests/routes/test_admin.py -v

# Run tests in parallel (faster)
pytest tests/ -n auto
```

### Before Commit

```bash
# Run all tests
pytest tests/

# Check coverage
pytest tests/ --cov=src --cov-report=term

# Run linting (optional)
ruff check src/
black --check src/
```

---

## Coverage Goals

| Week | Target | Focus |
|------|--------|-------|
| 1 | 35% | Security tests |
| 2 | 40% | Critical routes |
| 4 | 50% | Core services |
| 8 | 70% | All providers |
| 16 | 90% | Complete coverage |

---

## Weekly Checklist

- [ ] Run `./scripts/coverage_report.sh`
- [ ] Add 15-20 new test cases
- [ ] Review failing tests
- [ ] Update roadmap progress
- [ ] Commit tests with clear messages

---

## Useful Commands

```bash
# Run only failed tests
pytest tests/ --lf

# Stop on first failure
pytest tests/ -x

# Show test output
pytest tests/ -v -s

# Run tests by marker
pytest tests/ -m unit
pytest tests/ -m integration
pytest tests/ -m "not slow"

# Generate coverage badge
coverage-badge -o coverage.svg

# Coverage for specific module
pytest tests/routes/ --cov=src/routes --cov-report=html
```

---

## Debugging Failed Tests

### Show full output

```bash
pytest tests/test_file.py -v -s
```

### Use pdb debugger

```python
def test_something():
    import pdb; pdb.set_trace()
    # Your test code
```

### Print debug info

```python
def test_something():
    print(f"Debug: {variable}")
    assert something
```

Run with `-s` flag to see prints:
```bash
pytest tests/test_file.py -s
```

---

## CI Integration

Your tests run automatically on:
- ✅ Every push to main/staging/develop
- ✅ Every pull request
- ✅ Workflow dispatch (manual trigger)

**Check CI status:**
1. Go to GitHub Actions tab
2. View latest workflow run
3. Check test results and coverage

---

## Getting Help

1. **Check templates:** `docs/TEST_TEMPLATES.md`
2. **Check roadmap:** `docs/TESTING_ROADMAP.md`
3. **Run analysis:** `python scripts/coverage_analysis.py`
4. **Check existing tests:** Browse `tests/` directory for examples

---

## Pro Tips

1. **Write tests first** (TDD) - helps design better code
2. **One assertion per test** - easier to debug
3. **Use descriptive names** - `test_user_cannot_delete_others_data` > `test_delete`
4. **Mock external services** - tests should be fast and independent
5. **Clean up after tests** - prevent side effects
6. **Use fixtures** - reduce code duplication
7. **Test edge cases** - null, empty, large, negative values
8. **Keep tests simple** - tests should be easy to understand

---

## Example: Complete Test Workflow

```bash
# 1. Check what needs testing
python scripts/coverage_analysis.py

# 2. Pick a module with 0% coverage
# Let's say: src/routes/notifications.py

# 3. Create test file
touch tests/routes/test_notifications.py

# 4. Write tests (use template)
# ... edit tests/routes/test_notifications.py ...

# 5. Run your new tests
pytest tests/routes/test_notifications.py -v

# 6. Check coverage improvement
pytest tests/routes/test_notifications.py --cov=src/routes/notifications --cov-report=term

# 7. Run full test suite
pytest tests/ -n auto

# 8. Generate full coverage report
./scripts/coverage_report.sh

# 9. Commit
git add tests/routes/test_notifications.py
git commit -m "test: add notifications route tests (15 cases)"
git push

# 10. Watch CI pass! 🎉
```

---

## Keyboard Shortcuts (with pytest-watch)

```bash
# Install pytest-watch
pip install pytest-watch

# Run in watch mode
ptw tests/

# In watch mode:
# - Tests auto-run on file changes
# - Press Enter to re-run
# - Press Ctrl+C to exit
```

---

## Next Steps

1. ✅ Run your first coverage report
2. ✅ Pick a module from the roadmap
3. ✅ Write 5 tests using templates
4. ✅ Run tests and verify coverage increase
5. ✅ Commit and push
6. ✅ Repeat daily!

**Goal:** 15-20 tests per week = 90% coverage in 16 weeks

---

**Last Updated:** 2025-10-31
**Questions?** Check `docs/TESTING_ROADMAP.md` for detailed guidance
