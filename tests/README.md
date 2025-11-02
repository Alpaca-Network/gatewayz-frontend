# Gatewayz Backend Test Suite

Comprehensive test coverage for the Gatewayz API Gateway platform.

---

## 📁 Test Organization

```
tests/
├── conftest.py                  # Global pytest fixtures
├── README.md                    # This file
│
├── db/                          # Database Layer (12 files)
├── routes/                      # API Routes (14 files)
├── services/                    # Service Layer (13 files)
├── security/                    # Security (2 files)
├── integration/                 # Integration Tests (21 files)
└── smoke/                       # Smoke Tests (2 files)
```

### Database Layer Tests (`tests/db/`)
- `test_activity.py` - Activity logging
- `test_api_keys.py` - API key CRUD
- `test_chat_history.py` - Chat storage
- `test_coupons.py` - Coupon system (60+ tests) ✨
- `test_credit_transactions.py` - Credit ledger
- `test_payments.py` - Payment records
- `test_plans.py` - Subscription plans
- `test_rate_limits.py` - Rate limits
- `test_roles.py` - RBAC
- `test_trials.py` - Trial management (40+ tests) ✨
- `test_users.py` - User management

### API Route Tests (`tests/routes/`)
- `test_activity.py` - Activity endpoints
- `test_analytics.py` - Analytics
- `test_api_keys.py` - **API key mgmt (40+ tests, 941 lines)** ✨
- `test_audit.py` - Audit logs
- `test_auth.py` - **Authentication (55+ tests, 1078 lines)** ✨
- `test_chat.py` - Chat completions
- `test_chat_history.py` - Chat history
- `test_images.py` - Image generation
- `test_messages.py` - Messages API
- `test_payments.py` - **Stripe payments (30+ tests, 630 lines)** ✨
- `test_responses.py` - Response handling
- `test_roles.py` - Role management
- `test_system.py` - System & cache
- `test_transaction_analytics.py` - TX analytics
- `test_users.py` - **User endpoints (40+ tests, 1026 lines)** ✨

---

## 🚀 Quick Start

### Run All Tests
```bash
pytest tests/
```

### Run by Category
```bash
pytest tests/db/           # Database tests
pytest tests/routes/       # Route tests
pytest tests/services/     # Service tests
pytest tests/integration/  # Integration tests
```

### Run with Coverage
```bash
pytest tests/ --cov=src --cov-report=html --cov-report=term
```

### Run Specific File
```bash
pytest tests/routes/test_auth.py -v
```

---

## 📊 Test Coverage Status

| Category | Files | Tests | Lines | Status |
|----------|-------|-------|-------|--------|
| Phase 1 (Critical) | 6 | ~155 | ~2,500 | ✅ Complete |
| Phase 2 (High Priority) | 10 | ~280 | ~5,200 | ✅ Complete |
| Phase 3A (Routes) | 4 | ~165 | ~3,675 | ✅ Complete |
| Phase 3 (DB) | 2 | ~100 | ~900 | ✅ Complete |
| **TOTAL** | **22** | **~700** | **~12,275** | **36% Complete** |

**Target**: 90% coverage across all modules

---

## 🧪 Test Patterns

### Fixtures
```python
@pytest.fixture
def mock_user():
    return {'id': '1', 'username': 'test', 'credits': 100.0}
```

### Supabase Mocking
```python
@pytest.fixture
def mock_supabase_client():
    client = Mock()
    table_mock = Mock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = Mock(data=[])
    client.table.return_value = table_mock
    return client, table_mock
```

---

## 📝 Writing Tests

### ⚠️ Location Requirements
**ALL test files MUST be placed in the `tests/` directory**. Test files in the root directory will NOT be discovered by pytest.

Proper file location is enforced by the pytest configuration (`testpaths = tests` in `pytest.ini`).

### Important: Ad-hoc Testing Scripts vs. Automated Tests
- **Automated tests** (pytest): Should be in `tests/` directory with proper test structure
- **Ad-hoc scripts** (manual testing): Should be in `scripts/integration-tests/` for manual provider validation
  - See `/scripts/integration-tests/README.md` for details

### Location Guide
- `tests/db/` - Database CRUD
- `tests/routes/` - API endpoints
- `tests/services/` - Business logic
- `tests/integration/` - Multi-component integration tests (proper pytest tests only)
- `tests/security/` - Security features
- `tests/health/` - Health check tests
- `tests/smoke/` - Post-deployment validation tests
- `scripts/integration-tests/` - Manual ad-hoc testing scripts (NOT run by pytest)

### Test Structure
```python
class TestFeature:
    """Test specific feature"""
    
    def test_success_case(self):
        """Test successful operation"""
        pass
    
    def test_error_case(self):
        """Test error handling"""
        pass
```

---

## 🏆 Best Practices

✅ Independent tests (no dependencies)
✅ Clear, descriptive names
✅ Test success, errors, and edge cases
✅ Mock external services
✅ Reuse fixtures
✅ Fast execution
✅ Clear docstrings

---

## 📚 Documentation

- **Coverage Plan**: `docs/PHASE_3_COVERAGE_PLAN.md`
- **Progress Update**: `docs/PHASE_3_PROGRESS_UPDATE.md`
- **Reorganization**: `docs/TEST_FOLDER_REORGANIZATION.md`

---

## 🎯 Next Steps

**Phase 3B** (High Priority):
- [ ] `routes/admin.py` (~35 tests)
- [ ] `routes/coupons.py` (~25 tests)
- [ ] `routes/plans.py` (~20 tests)

**Phase 3C** (Services):
- [ ] `services/trial_service.py` (~30 tests)
- [ ] `services/statsig_service.py` (~20 tests)
- [ ] `services/posthog_service.py` (~20 tests)

---

**Last Updated**: January 2025  
**Total Tests**: ~700 methods across 58 files
