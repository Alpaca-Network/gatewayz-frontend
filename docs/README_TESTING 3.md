# Testing Documentation - Gatewayz Backend

Complete testing infrastructure and roadmap for achieving 90% code coverage.

---

## 📊 Current Status

- **Test Files:** 92
- **Source Files:** 126
- **Test Functions:** ~1,226
- **Current Coverage:** 25%
- **Target Coverage:** 90%
- **Timeline:** 16 weeks

---

## 🚀 Quick Start

**New to testing? Start here:**

```bash
# 1. Install dependencies
pip install -r requirements-dev.txt

# 2. Run coverage report
./scripts/coverage_report.sh

# 3. View HTML report
open htmlcov/index.html

# 4. Read the quick start guide
cat docs/TESTING_QUICKSTART.md
```

---

## 📚 Documentation

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[TESTING_QUICKSTART.md](docs/TESTING_QUICKSTART.md)** | Get started in 5 minutes | First time testing |
| **[TESTING_ROADMAP.md](docs/TESTING_ROADMAP.md)** | 16-week plan to 90% coverage | Planning work |
| **[TEST_TEMPLATES.md](docs/TEST_TEMPLATES.md)** | Copy-paste test templates | Writing new tests |

---

## 🛠️ Tools

### Coverage Report Generator

```bash
./scripts/coverage_report.sh
```

**What it does:**
- ✅ Runs full test suite
- ✅ Generates coverage reports (HTML, XML, JSON)
- ✅ Shows coverage by module
- ✅ Identifies untested files
- ✅ Tracks progress toward goals

**Output:**
- `htmlcov/index.html` - Interactive coverage report
- `coverage.xml` - For CI/Codecov
- `coverage.json` - For analysis tools

### Coverage Analysis Tool

```bash
python scripts/coverage_analysis.py
```

**What it shows:**
- 📊 Module-by-module coverage
- 🔴 Untested modules (prioritized)
- 💡 Actionable recommendations
- 📈 Progress tracking

---

## 🎯 Testing Roadmap

### Phase 1: Critical Security & Admin (Weeks 1-4)
**Target:** 25% → 40%

Priority modules:
- 🔴 Admin routes (`src/routes/admin.py`)
- 🔴 Security module (`src/security/*`)
- 🔴 Health monitoring (`src/services/model_health_monitor.py`)
- 🔴 Response caching (`src/services/response_cache.py`)
- 🔴 Referral system (`src/routes/referral.py`)

### Phase 2: Core Routes & Services (Weeks 5-8)
**Target:** 40% → 55%

Focus areas:
- Missing provider clients (AIMO, xAI, Vercel, etc.)
- Image generation
- Model availability
- Pricing lookup
- Analytics services

### Phase 3: Integration & Providers (Weeks 9-12)
**Target:** 55% → 70%

Deliverables:
- End-to-end flow tests
- Provider contract tests
- Integration test suite

### Phase 4: Polish & Optimization (Weeks 13-16)
**Target:** 70% → 90%

Goals:
- Edge case coverage
- Performance tests
- Load testing
- Final optimization

**[Full Roadmap →](docs/TESTING_ROADMAP.md)**

---

## 📝 Test Templates

Ready-to-use templates for common test scenarios:

### Route Test
```python
from fastapi.testclient import TestClient
from src.main import app

def test_endpoint():
    client = TestClient(app)
    response = client.get('/api/endpoint')
    assert response.status_code == 200
```

### Service Test
```python
from unittest.mock import patch

@patch('src.services.service.external_call')
def test_service_function(mock_call):
    mock_call.return_value = {'status': 'success'}
    result = function()
    assert result is not None
```

**[More Templates →](docs/TEST_TEMPLATES.md)**

---

## 🏃 Common Commands

### Running Tests

```bash
# All tests
pytest tests/

# Specific module
pytest tests/routes/test_admin.py

# With coverage
pytest tests/ --cov=src --cov-report=html

# In parallel (faster)
pytest tests/ -n auto

# Only failed tests
pytest tests/ --lf

# Stop on first failure
pytest tests/ -x
```

### Coverage Reports

```bash
# Full coverage report
./scripts/coverage_report.sh

# Quick analysis
python scripts/coverage_analysis.py

# Specific module coverage
pytest tests/routes/ --cov=src/routes --cov-report=term

# View HTML report
open htmlcov/index.html
```

---

## 📈 Current Test Coverage

### By Category

```
✅ Integration Tests:  35 files  (38%)
✅ Service Tests:      21 files  (23%)
✅ Route Tests:        18 files  (20%)
✅ DB Tests:           12 files  (13%)
✅ Security Tests:      3 files  (3%)
✅ Health Tests:        1 file   (1%)
✅ Smoke Tests:         1 file   (1%)
```

### What's Well Tested

**Routes (67% coverage):**
- activity, analytics, api_keys, audit, auth
- catalog, chat, images, messages, payments
- users, roles, system

**Services (46% coverage):**
- Provider clients (OpenRouter, Portkey, Fireworks, etc.)
- Pricing, analytics, rate limiting
- Provider failover, trial service

**Database (75% coverage):**
- Users, API keys, payments, plans
- Referrals, roles, trials

### Critical Gaps 🔴

**Missing Tests:**
- `src/routes/admin.py` - Admin endpoints ⚠️ CRITICAL
- `src/security/*` - Security validation ⚠️ CRITICAL
- `src/services/model_health_monitor.py` - Health monitoring
- `src/services/response_cache.py` - Caching layer
- `src/routes/referral.py` - Referral system
- 26 provider clients without tests

**[Full Gap Analysis →](docs/TESTING_ROADMAP.md#critical-gaps)**

---

## 🎓 Testing Best Practices

### Test Organization

```python
class TestFeatureAuthentication:
    """Test authentication for feature"""

    def test_requires_auth(self):
        """Feature requires authentication"""
        pass

class TestFeatureValidation:
    """Test input validation"""

    def test_validates_required_fields(self):
        """Required fields are validated"""
        pass
```

### Naming Convention

```python
def test_<function>_<scenario>_<expected_result>():
    """
    Test that <function> with <scenario> returns <expected_result>
    """
    # Arrange - Set up test data
    # Act - Execute the function
    # Assert - Verify the result
```

### Mocking

```python
from unittest.mock import patch, Mock

@patch('src.db.users.get_user')
def test_with_mock(mock_get_user):
    mock_get_user.return_value = {'id': 1}
    # Test code here
```

---

## 📊 CI/CD Integration

Tests run automatically on:
- ✅ Every push to main/staging/develop
- ✅ Every pull request
- ✅ Manual workflow dispatch

**CI Workflow:**
1. Linting (Ruff, Black, isort, MyPy)
2. Security scanning (Bandit, Safety)
3. Tests (4-way parallel sharding)
4. Coverage reporting (Codecov)
5. Build verification

**View CI Status:**
- GitHub Actions → Latest workflow run
- Check test results and coverage reports

---

## 🎯 Weekly Goals

| Week | Tests Added | Coverage Increase | Focus |
|------|-------------|-------------------|-------|
| 1 | 15-20 | +5% | Admin & Security |
| 2 | 15-20 | +5% | Health & Cache |
| 3 | 15-20 | +5% | Referrals & Plans |
| 4 | 15-20 | +5% | Notifications |

**Track your progress:**
```bash
# Monday morning
./scripts/coverage_report.sh

# Friday evening
./scripts/coverage_report.sh
# Compare coverage increase!
```

---

## 🆘 Getting Help

### Documentation
1. **Quick Start** - [TESTING_QUICKSTART.md](docs/TESTING_QUICKSTART.md)
2. **Roadmap** - [TESTING_ROADMAP.md](docs/TESTING_ROADMAP.md)
3. **Templates** - [TEST_TEMPLATES.md](docs/TEST_TEMPLATES.md)

### Tools
1. **Coverage Report** - `./scripts/coverage_report.sh`
2. **Gap Analysis** - `python scripts/coverage_analysis.py`

### Examples
- Browse existing tests in `tests/` directory
- Check `tests/routes/test_chat.py` for route examples
- Check `tests/services/test_pricing.py` for service examples

---

## 📦 Required Dependencies

```bash
# Install test dependencies
pip install pytest pytest-cov pytest-asyncio pytest-xdist pytest-mock

# Or use requirements file
pip install -r requirements-dev.txt
```

---

## 🏆 Success Criteria

- ✅ **90% code coverage** across all modules
- ✅ **Test suite < 5 minutes** (parallel execution)
- ✅ **< 1% flaky tests** (consistent results)
- ✅ **All critical paths tested** (auth, payment, chat)
- ✅ **Security tests passing** (injection, bypass, etc.)

---

## 📅 Next Steps

1. ✅ Read [TESTING_QUICKSTART.md](docs/TESTING_QUICKSTART.md)
2. ✅ Run `./scripts/coverage_report.sh`
3. ✅ Review [TESTING_ROADMAP.md](docs/TESTING_ROADMAP.md)
4. ✅ Pick a module from the roadmap
5. ✅ Use [TEST_TEMPLATES.md](docs/TEST_TEMPLATES.md) to write tests
6. ✅ Run tests and verify coverage increase
7. ✅ Commit and push
8. ✅ Repeat!

---

## 🎉 Let's Build Great Tests!

**Target:** 90% coverage in 16 weeks
**Strategy:** 15-20 tests per week
**Approach:** Security first, then core features

**Start now:**
```bash
./scripts/coverage_report.sh
```

---

**Last Updated:** 2025-10-31
**Maintained by:** Engineering Team
**Questions?** See documentation above or check existing tests for examples.
