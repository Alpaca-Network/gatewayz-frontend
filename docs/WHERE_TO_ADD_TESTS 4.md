# Where to Add Tests - Priority Guide

**Last Updated**: October 31, 2025
**Current Coverage**: 25% → **Target**: 90%

This guide shows exactly where you need to add tests, organized by priority and impact.

---

## 📊 Quick Summary

| Category | Total Files | Tested | Missing | Priority |
|----------|-------------|--------|---------|----------|
| **Routes** | 21 files | 14 ✅ | 7 ❌ | 🔴 HIGH |
| **Services** | 30+ files | 15 ✅ | 15+ ❌ | 🔴 HIGH |
| **Database** | 12 files | 12 ✅ | 0 ✅ | ✅ DONE |
| **Security** | 3 files | 3 ✅ | 0 ✅ | ✅ DONE |
| **Utils** | 4 files | 0 ❌ | 4 ❌ | 🟡 MEDIUM |
| **Config** | 5 files | 0 ❌ | 5 ❌ | 🟡 MEDIUM |

---

## 🎯 Priority 1: CRITICAL (Do First!)

These are business-critical routes and services with **0% coverage**:

### Routes (Missing 7 test files)

Create these test files in `tests/routes/`:

| File to Create | Tests | Source File | Priority | Estimated Tests |
|----------------|-------|-------------|----------|-----------------|
| `test_availability.py` | ❌ Missing | `src/routes/availability.py` | 🔴 CRITICAL | 15-20 |
| `test_coupons.py` | ❌ Missing | `src/routes/coupons.py` | 🔴 HIGH | 20-25 |
| `test_health.py` | ❌ Missing | `src/routes/health.py` | 🔴 CRITICAL | 10-15 |
| `test_notifications.py` | ❌ Missing | `src/routes/notifications.py` | 🔴 HIGH | 15-20 |
| `test_optimization_monitor.py` | ❌ Missing | `src/routes/optimization_monitor.py` | 🟡 MEDIUM | 10-15 |
| `test_ping.py` | ❌ Missing | `src/routes/ping.py` | 🟢 LOW | 5-10 |
| `test_ranking.py` | ❌ Missing | `src/routes/ranking.py` | 🟡 MEDIUM | 15-20 |

**Total Missing Route Tests**: ~95 test cases

### Services (Missing 15+ test files)

Create these test files in `tests/services/`:

| File to Create | Tests | Source File | Priority | Estimated Tests |
|----------------|-------|-------------|----------|-----------------|
| `test_aimo_client.py` | ❌ Missing | `src/services/aimo_client.py` | 🟡 MEDIUM | 15-20 |
| `test_chutes_client.py` | ❌ Missing | `src/services/chutes_client.py` | 🟡 MEDIUM | 15-20 |
| `test_deepinfra_client.py` | ❌ Missing | `src/services/deepinfra_client.py` | 🟡 MEDIUM | 15-20 |
| `test_image_generation_client.py` | ❌ Missing | `src/services/image_generation_client.py` | 🔴 HIGH | 20-25 |
| `test_model_availability.py` | ❌ Missing | `src/services/model_availability.py` | 🔴 CRITICAL | 15-20 |
| `test_modelz_client.py` | ❌ Missing | `src/services/modelz_client.py` | 🟡 MEDIUM | 15-20 |
| `test_near_client.py` | ❌ Missing | `src/services/near_client.py` | 🟡 MEDIUM | 15-20 |
| `test_portkey_providers.py` | ❌ Missing | `src/services/portkey_providers.py` | 🔴 HIGH | 20-25 |
| `test_posthog_service.py` | ❌ Missing | `src/services/posthog_service.py` | 🟡 MEDIUM | 10-15 |
| `test_pricing_lookup.py` | ❌ Missing | `src/services/pricing_lookup.py` | 🔴 HIGH | 15-20 |
| `test_rate_limiting_fallback.py` | ❌ Missing | `src/services/rate_limiting_fallback.py` | 🔴 HIGH | 15-20 |
| `test_request_prioritization.py` | ❌ Missing | `src/services/request_prioritization.py` | 🔴 HIGH | 15-20 |
| `test_startup.py` | ❌ Missing | `src/services/startup.py` | 🔴 CRITICAL | 10-15 |
| `test_statsig_service.py` | ❌ Missing | `src/services/statsig_service.py` | 🟡 MEDIUM | 10-15 |
| `test_xai_client.py` | ❌ Missing | `src/services/xai_client.py` | 🟡 MEDIUM | 15-20 |

**Total Missing Service Tests**: ~230 test cases

---

## 🎯 Priority 2: IMPORTANT (Do Second)

### Utils (Missing 4 test files)

Create these test files in `tests/utils/`:

| File to Create | Tests | Source File | Priority | Estimated Tests |
|----------------|-------|-------------|----------|-----------------|
| `test_braintrust_tracing.py` | ❌ Missing | `src/utils/braintrust_tracing.py` | 🟡 MEDIUM | 10-15 |
| `test_crypto.py` | ❌ Missing | `src/utils/crypto.py` | 🔴 HIGH | 15-20 |
| `test_reset_welcome_emails.py` | ❌ Missing | `src/utils/reset_welcome_emails.py` | 🟢 LOW | 5-10 |
| `test_validators.py` | ❌ Missing | `src/utils/validators.py` | 🔴 HIGH | 20-25 |

**Total Missing Utils Tests**: ~55 test cases

### Config (Missing 5 test files)

Create these test files in `tests/config/`:

| File to Create | Tests | Source File | Priority | Estimated Tests |
|----------------|-------|-------------|----------|-----------------|
| `test_config.py` | ❌ Missing | `src/config/config.py` | 🔴 HIGH | 20-25 |
| `test_db_config.py` | ❌ Missing | `src/config/db_config.py` | 🟡 MEDIUM | 10-15 |
| `test_redis_config.py` | ❌ Missing | `src/config/redis_config.py` | 🟡 MEDIUM | 10-15 |
| `test_supabase_config.py` | ❌ Missing | `src/config/supabase_config.py` | 🔴 HIGH | 15-20 |
| `test_init.py` | ❌ Missing | `src/config/__init__.py` | 🟢 LOW | 5-10 |

**Total Missing Config Tests**: ~65 test cases

---

## ✅ What You Already Have (Good Coverage)

### Database (12/12 files - 100% ✅)

All database modules have tests:
- ✅ `tests/db/test_activity.py`
- ✅ `tests/db/test_api_keys.py`
- ✅ `tests/db/test_chat_history.py`
- ✅ `tests/db/test_coupons.py`
- ✅ `tests/db/test_credit_transactions.py`
- ✅ `tests/db/test_payments.py`
- ✅ `tests/db/test_plans.py`
- ✅ `tests/db/test_rate_limits.py`
- ✅ `tests/db/test_referral.py`
- ✅ `tests/db/test_roles.py`
- ✅ `tests/db/test_trials.py`
- ✅ `tests/db/test_users.py`

**Database Coverage: COMPLETE** 🎉

### Security (3/3 files - 100% ✅)

All security modules have tests:
- ✅ `tests/security/test_admin_security.py`
- ✅ `tests/security/test_db_security.py`
- ✅ `tests/security/test_deps.py`
- ✅ `tests/security/test_injection.py` (just created!)
- ✅ `tests/security/test_security.py` (just created!)

**Security Coverage: COMPLETE** 🎉

### Routes (14/21 files - 67% coverage)

Existing route tests:
- ✅ `tests/routes/test_activity.py`
- ✅ `tests/routes/test_admin.py` (just created!)
- ✅ `tests/routes/test_analytics.py`
- ✅ `tests/routes/test_api_keys.py`
- ✅ `tests/routes/test_audit.py`
- ✅ `tests/routes/test_auth_v2.py`
- ✅ `tests/routes/test_catalog_endpoints.py`
- ✅ `tests/routes/test_catalog_utils.py`
- ✅ `tests/routes/test_chat.py`
- ✅ `tests/routes/test_chat_comprehensive.py`
- ✅ `tests/routes/test_chat_history.py`
- ✅ `tests/routes/test_images.py`
- ✅ `tests/routes/test_messages.py`
- ✅ `tests/routes/test_payments.py`
- ✅ `tests/routes/test_referral.py`
- ✅ `tests/routes/test_responses.py`
- ✅ `tests/routes/test_roles.py`
- ✅ `tests/routes/test_system.py`
- ✅ `tests/routes/test_transaction_analytics.py`
- ✅ `tests/routes/test_users.py`

### Services (15/30+ files - 50% coverage)

Existing service tests:
- ✅ `tests/services/test_analytics.py`
- ✅ `tests/services/test_deepinfra_normalization.py`
- ✅ `tests/services/test_fal_image_client.py`
- ✅ `tests/services/test_featherless_client.py`
- ✅ `tests/services/test_fireworks_client.py`
- ✅ `tests/services/test_google_vertex_client.py`
- ✅ `tests/services/test_huggingface_client.py`
- ✅ `tests/services/test_model_health_monitor.py` (just created!)
- ✅ `tests/services/test_model_transformations.py`
- ✅ `tests/services/test_models.py`
- ✅ `tests/services/test_notification.py`
- ✅ `tests/services/test_openrouter_client.py`
- ✅ `tests/services/test_payment_processing.py`
- ✅ `tests/services/test_portkey_client.py`
- ✅ `tests/services/test_pricing.py`
- ✅ `tests/services/test_provider_failover.py`
- ✅ `tests/services/test_rate_limiting.py`
- ✅ `tests/services/test_response_cache.py` (just created!)
- ✅ `tests/services/test_roles.py`
- ✅ `tests/services/test_subscription_usage_credits.py`
- ✅ `tests/services/test_together_client.py`
- ✅ `tests/services/test_trial_service.py`
- ✅ `tests/services/test_trial_validation.py`

---

## 📅 Recommended Test Creation Order

### Week 1-2: Critical Routes & Services (Target: 35% → 40%)

**Day 1-2: Critical Routes**
1. Create `tests/routes/test_health.py`
2. Create `tests/routes/test_availability.py`
3. Create `tests/routes/test_coupons.py`

**Day 3-4: Critical Services**
4. Create `tests/services/test_model_availability.py`
5. Create `tests/services/test_startup.py`
6. Create `tests/services/test_request_prioritization.py`

**Day 5: High-Priority Routes**
7. Create `tests/routes/test_notifications.py`

### Week 3-4: High-Value Services (Target: 40% → 50%)

**Week 3:**
8. Create `tests/services/test_image_generation_client.py`
9. Create `tests/services/test_portkey_providers.py`
10. Create `tests/services/test_pricing_lookup.py`
11. Create `tests/services/test_rate_limiting_fallback.py`

**Week 4:**
12. Create `tests/config/test_config.py`
13. Create `tests/config/test_supabase_config.py`
14. Create `tests/utils/test_crypto.py`
15. Create `tests/utils/test_validators.py`

### Week 5-8: Provider Clients (Target: 50% → 70%)

**Provider client tests:**
- `test_aimo_client.py`
- `test_chutes_client.py`
- `test_deepinfra_client.py`
- `test_modelz_client.py`
- `test_near_client.py`
- `test_xai_client.py`
- `test_posthog_service.py`
- `test_statsig_service.py`

### Week 9-12: Remaining Tests (Target: 70% → 85%)

**Medium priority:**
- Remaining routes
- Remaining config
- Remaining utils

### Week 13-16: Polish (Target: 85% → 90%)

- Edge cases
- Integration tests
- E2E tests
- Performance tests

---

## 🎨 Test Template

Use this template when creating new test files:

```python
"""
Tests for [Module Name]

Covers:
- [Feature 1]
- [Feature 2]
- [Feature 3]
"""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient

# Set test environment
os.environ['APP_ENV'] = 'testing'
os.environ['TESTING'] = 'true'
os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
os.environ['SUPABASE_KEY'] = 'test-key'

# Import after setting environment
from src.main import app
from src.[module_path] import [functions_to_test]


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_data():
    """Sample test data"""
    return {
        'key': 'value'
    }


class TestBasicFunctionality:
    """Test basic functionality"""

    def test_basic_case(self, client):
        """Test basic case"""
        response = client.get('/endpoint')
        assert response.status_code == 200


class TestEdgeCases:
    """Test edge cases"""

    def test_edge_case(self, client):
        """Test edge case"""
        # Test implementation
        pass


class TestErrorHandling:
    """Test error handling"""

    def test_error_case(self, client):
        """Test error case"""
        # Test implementation
        pass
```

---

## 📊 Impact Calculation

### If you add ALL missing tests:

| Category | Tests to Add | Estimated Coverage Gain |
|----------|--------------|------------------------|
| Routes (7 files) | ~95 tests | +8% |
| Services (15 files) | ~230 tests | +20% |
| Utils (4 files) | ~55 tests | +5% |
| Config (5 files) | ~65 tests | +7% |
| **TOTAL** | **~445 tests** | **+40%** |

**Current**: 25%
**After all tests**: 65%
**With edge cases & integration**: 90%+

---

## 🚀 Quick Start Command

```bash
# Create a new test file
mkdir -p tests/routes
touch tests/routes/test_health.py

# Copy template
cat << 'EOF' > tests/routes/test_health.py
"""
Tests for Health Check Route

Covers:
- Basic health check
- Database connectivity
- Service status
"""

import os
import pytest
from fastapi.testclient import TestClient

os.environ['APP_ENV'] = 'testing'
os.environ['TESTING'] = 'true'

from src.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


class TestHealthCheck:
    """Test health check endpoint"""

    def test_health_check_success(self, client):
        """Health check returns 200"""
        response = client.get('/health')
        assert response.status_code == 200

    def test_health_check_format(self, client):
        """Health check returns correct format"""
        response = client.get('/health')
        data = response.json()
        assert 'status' in data
EOF

# Run the new test
pytest tests/routes/test_health.py -v
```

---

## 🎯 Focus Areas by Role

### If you're focused on **API Stability**:
Priority: Routes → Config → Utils

### If you're focused on **Provider Integration**:
Priority: Services (clients) → Routes → Integration

### If you're focused on **Security**:
✅ Already complete! (Security & DB tests exist)

### If you're focused on **Business Logic**:
Priority: Services → Routes → Utils

---

## Summary

**Total Missing Tests**: ~445 test cases
**Current Coverage**: 25%
**Target Coverage**: 90%
**Gap to Close**: 65%

**Highest Priority** (Do First):
1. `tests/routes/test_health.py` - CRITICAL
2. `tests/routes/test_availability.py` - CRITICAL
3. `tests/services/test_model_availability.py` - CRITICAL
4. `tests/services/test_startup.py` - CRITICAL
5. `tests/config/test_config.py` - HIGH

**Recommended Approach**:
- Add 3-5 test files per week
- Run tests after each file: `pytest tests/[category]/test_[name].py -v`
- Check coverage improvement: `pytest tests/ --cov=src --cov-report=term | grep TOTAL`
- Commit when coverage increases

Start with the critical routes and services above, and you'll see immediate coverage gains!
