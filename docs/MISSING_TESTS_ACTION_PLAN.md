# Missing Tests - Action Plan

## Priority Order to Implement

Based on the coverage analysis, here's the order to write missing tests:

---

## Phase 1: Critical Blockers (MUST HAVE) 🚨

### 1. Payment Processing Tests

**File:** `tests/services/test_payment_processing.py`

```python
"""Test Stripe payment processing - CRITICAL"""

import pytest
from unittest.mock import patch, Mock
from src.services.payments import (
    create_checkout_session,
    handle_successful_payment,
    calculate_credit_amount
)

class TestPaymentProcessing:
    """Payment processing must work perfectly"""

    def test_calculate_credit_amount_standard():
        assert calculate_credit_amount(10.00) == 1000  # $10 = 1000 credits

    def test_calculate_credit_amount_minimum():
        assert calculate_credit_amount(1.00) == 100

    def test_calculate_credit_amount_large():
        assert calculate_credit_amount(100.00) == 10000

    def test_calculate_credit_amount_invalid():
        with pytest.raises(ValueError):
            calculate_credit_amount(0)
        with pytest.raises(ValueError):
            calculate_credit_amount(-10)

    @patch('stripe.checkout.Session.create')
    def test_create_checkout_session(self, mock_stripe):
        mock_stripe.return_value = Mock(id="cs_123", url="https://checkout.stripe.com/123")

        session = create_checkout_session(
            user_id=1,
            amount=10.00,
            email="test@example.com"
        )

        assert session["id"] == "cs_123"
        assert session["url"]
        mock_stripe.assert_called_once()

    @patch('src.db.users.add_credits_to_user')
    @patch('src.db.payments.record_payment')
    def test_handle_successful_payment(self, mock_record, mock_add_credits):
        """Test payment success flow"""

        handle_successful_payment(
            session_id="cs_123",
            user_id=1,
            amount=10.00,
            payment_intent="pi_123"
        )

        # Verify credits added
        mock_add_credits.assert_called_once_with(
            user_id=1,
            credits=1000,
            reason="Stripe payment cs_123"
        )

        # Verify payment recorded
        mock_record.assert_called_once()

    def test_payment_idempotency():
        """Ensure duplicate webhooks don't duplicate credits"""
        # Process payment once
        handle_successful_payment(session_id="cs_123", ...)

        # Process same payment again (duplicate webhook)
        handle_successful_payment(session_id="cs_123", ...)

        # Credits should only be added once
        user = get_user(user_id)
        assert user.credits == 1000  # Not 2000!
```

---

### 2. Messages Endpoint Tests (Anthropic/Claude API)

**File:** `tests/routes/test_messages.py`

```python
"""Test /v1/messages endpoint for Claude API"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock

class TestMessagesEndpoint:
    """Test Anthropic/Claude messages API endpoint"""

    @patch('src.db.users.get_user')
    @patch('src.services.anthropic_transformer.transform_request')
    @patch('src.services.anthropic_transformer.call_anthropic_api')
    def test_messages_endpoint_success(
        self,
        mock_call_api,
        mock_transform,
        mock_get_user,
        client,
        test_user
    ):
        """Test successful Claude API call"""

        mock_get_user.return_value = test_user
        mock_transform.return_value = {"model": "claude-3", "messages": [...]}
        mock_call_api.return_value = {
            "id": "msg_123",
            "content": [{"text": "Hello!"}],
            "usage": {"input_tokens": 10, "output_tokens": 5}
        }

        response = client.post(
            "/v1/messages",
            headers={"Authorization": f"Bearer {test_user['api_key']}"},
            json={
                "model": "claude-3-opus",
                "messages": [{"role": "user", "content": "Hello"}],
                "max_tokens": 100
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["content"][0]["text"] == "Hello!"

    @patch('src.db.users.get_user')
    def test_messages_endpoint_requires_auth(self, mock_get_user, client):
        """Test auth requirement"""

        mock_get_user.return_value = None

        response = client.post(
            "/v1/messages",
            json={"model": "claude-3-opus", "messages": [...]}
        )

        assert response.status_code in [401, 403]

    @patch('src.db.users.get_user')
    def test_messages_endpoint_insufficient_credits(self, mock_get_user, client):
        """Test insufficient credits handling"""

        test_user = {"id": 1, "credits": 0, "api_key": "key"}
        mock_get_user.return_value = test_user

        response = client.post(
            "/v1/messages",
            headers={"Authorization": "Bearer key"},
            json={"model": "claude-3-opus", "messages": [...]}
        )

        assert response.status_code == 402
```

---

### 3. Credit Transaction Tests

**File:** `tests/db/test_credit_transactions.py`

```python
"""Test credit transaction tracking - CRITICAL for financial accuracy"""

import pytest
from src.db.credit_transactions import (
    record_transaction,
    get_user_transactions,
    get_transaction_summary
)

class TestCreditTransactions:
    """Test transaction recording and retrieval"""

    def test_record_deduction_transaction(self):
        """Test recording credit deduction"""

        transaction = record_transaction(
            user_id=1,
            amount=-10.50,
            type="api_usage",
            description="Chat completion",
            metadata={"model": "gpt-4", "tokens": 100}
        )

        assert transaction["amount"] == -10.50
        assert transaction["type"] == "api_usage"
        assert transaction["user_id"] == 1

    def test_record_addition_transaction(self):
        """Test recording credit addition"""

        transaction = record_transaction(
            user_id=1,
            amount=100.00,
            type="purchase",
            description="Stripe payment",
            metadata={"payment_id": "pi_123"}
        )

        assert transaction["amount"] == 100.00
        assert transaction["type"] == "purchase"

    def test_get_user_transactions_pagination(self):
        """Test transaction listing with pagination"""

        # Create 25 transactions
        for i in range(25):
            record_transaction(user_id=1, amount=-1, type="api_usage")

        # Get first page
        page1 = get_user_transactions(user_id=1, limit=10, offset=0)
        assert len(page1) == 10

        # Get second page
        page2 = get_user_transactions(user_id=1, limit=10, offset=10)
        assert len(page2) == 10

        # Verify different transactions
        assert page1[0]["id"] != page2[0]["id"]

    def test_get_transaction_summary(self):
        """Test transaction summary calculation"""

        # Record various transactions
        record_transaction(user_id=1, amount=100, type="purchase")
        record_transaction(user_id=1, amount=-10, type="api_usage")
        record_transaction(user_id=1, amount=-5, type="api_usage")
        record_transaction(user_id=1, amount=50, type="referral_bonus")

        summary = get_transaction_summary(user_id=1)

        assert summary["total_spent"] == 15.00
        assert summary["total_purchased"] == 100.00
        assert summary["total_bonus"] == 50.00
        assert summary["net_balance"] == 135.00

    def test_transaction_timestamps(self):
        """Test transactions have proper timestamps"""

        transaction = record_transaction(
            user_id=1,
            amount=-10,
            type="api_usage"
        )

        assert "created_at" in transaction
        assert transaction["created_at"] is not None
```

---

### 4. Provider Failover Tests

**File:** `tests/services/test_provider_failover.py`

```python
"""Test provider failover logic - CRITICAL"""

import pytest
from unittest.mock import patch, Mock
from src.services.provider_failover import (
    get_next_provider,
    execute_with_failover,
    mark_provider_failed
)

class TestProviderFailover:
    """Test provider failover mechanisms"""

    def test_get_next_provider_order(self):
        """Test providers are tried in priority order"""

        providers = ["openrouter", "fireworks", "together"]
        failover = ProviderFailover(providers)

        assert failover.get_next_provider() == "openrouter"
        failover.mark_failed("openrouter")

        assert failover.get_next_provider() == "fireworks"
        failover.mark_failed("fireworks")

        assert failover.get_next_provider() == "together"

    def test_execute_with_failover_success_first_try(self):
        """Test successful call on first provider"""

        @execute_with_failover(providers=["openrouter", "fireworks"])
        def make_call(provider):
            if provider == "openrouter":
                return {"success": True}
            raise ProviderError()

        result = make_call()
        assert result["success"] == True

    def test_execute_with_failover_success_second_try(self):
        """Test failover to second provider works"""

        call_count = {"openrouter": 0, "fireworks": 0}

        @execute_with_failover(providers=["openrouter", "fireworks"])
        def make_call(provider):
            call_count[provider] += 1
            if provider == "openrouter":
                raise ProviderError("openrouter down")
            return {"success": True, "provider": "fireworks"}

        result = make_call()

        assert result["provider"] == "fireworks"
        assert call_count["openrouter"] == 1
        assert call_count["fireworks"] == 1

    def test_execute_with_failover_all_fail(self):
        """Test when all providers fail"""

        @execute_with_failover(providers=["openrouter", "fireworks"])
        def make_call(provider):
            raise ProviderError(f"{provider} failed")

        with pytest.raises(AllProvidersFailed):
            make_call()

    def test_circuit_breaker_opens_after_failures(self):
        """Test circuit breaker prevents repeated calls to failed provider"""

        failover = ProviderFailover(["openrouter"])

        # Fail 5 times (threshold)
        for _ in range(5):
            failover.mark_failed("openrouter")

        # Circuit should be open
        assert failover.is_circuit_open("openrouter") == True

        # Should not try this provider
        with pytest.raises(CircuitBreakerOpen):
            failover.get_provider("openrouter")
```

---

### 5. Image Generation Tests

**File:** `tests/routes/test_images.py`

```python
"""Test image generation endpoint"""

import pytest
from unittest.mock import patch, Mock

class TestImageGeneration:
    """Test /v1/images/generations endpoint"""

    @patch('src.db.users.get_user')
    @patch('src.services.image_generation_client.generate_image')
    @patch('src.db.users.deduct_credits')
    def test_image_generation_success(
        self,
        mock_deduct,
        mock_generate,
        mock_get_user,
        client,
        test_user
    ):
        """Test successful image generation"""

        mock_get_user.return_value = test_user
        mock_generate.return_value = {
            "url": "https://cdn.example.com/image.png",
            "revised_prompt": "A cat"
        }

        response = client.post(
            "/v1/images/generations",
            headers={"Authorization": f"Bearer {test_user['api_key']}"},
            json={
                "prompt": "A cat",
                "size": "1024x1024",
                "n": 1
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "url" in data["data"][0]
        assert data["data"][0]["url"].startswith("https://")

        # Verify credits deducted
        mock_deduct.assert_called_once()

    @patch('src.db.users.get_user')
    def test_image_generation_requires_auth(self, mock_get_user, client):
        """Test auth requirement"""

        mock_get_user.return_value = None

        response = client.post(
            "/v1/images/generations",
            json={"prompt": "A cat"}
        )

        assert response.status_code in [401, 403]

    def test_image_generation_invalid_size(self, client, test_user):
        """Test invalid size rejection"""

        response = client.post(
            "/v1/images/generations",
            headers={"Authorization": f"Bearer {test_user['api_key']}"},
            json={
                "prompt": "A cat",
                "size": "invalid"  # Invalid size
            }
        )

        assert response.status_code == 422  # Validation error
```

---

## Phase 2: High Priority (SHOULD HAVE) ⚠️

### 6. System Endpoint Tests
### 7. Notification Tests
### 8. Analytics Tests
### 9. DB Payment Records Tests
### 10. Role Management Tests

---

## Phase 3: Smoke Tests (Post-Deploy Validation) 💨

**File:** `tests/smoke/test_deployment.py`

```python
"""Smoke tests to run after every deployment"""

import pytest
import requests
import os

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
TEST_API_KEY = os.getenv("TEST_API_KEY")

@pytest.mark.smoke
class TestDeploymentSmoke:
    """Quick checks that deployment succeeded"""

    def test_app_is_running(self):
        """Test app responds"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200

    def test_database_connected(self):
        """Test database connectivity"""
        response = requests.get(f"{BASE_URL}/health")
        health = response.json()
        assert health.get("database") in ["connected", "healthy"]

    def test_critical_endpoints_exist(self):
        """Test critical endpoints respond (not 404)"""

        endpoints = [
            "/",
            "/health",
            "/catalog/models",
            "/catalog/providers",
        ]

        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code != 404, f"{endpoint} returned 404"

    def test_auth_endpoint_exists(self):
        """Test auth endpoint responds"""
        response = requests.post(
            f"{BASE_URL}/v1/chat/completions",
            json={"model": "gpt-3.5-turbo", "messages": []}
        )
        # Should reject (no auth), but endpoint should exist
        assert response.status_code in [401, 403, 422], "Auth endpoint missing"

    @pytest.mark.skipif(not TEST_API_KEY, reason="No test API key")
    def test_can_make_authenticated_request(self):
        """Test authenticated request works"""

        response = requests.get(
            f"{BASE_URL}/user/balance",
            headers={"Authorization": f"Bearer {TEST_API_KEY}"}
        )

        # Should return balance or error, but not 404/500
        assert response.status_code in [200, 401, 402]
```

---

## Implementation Order

### Week 1: Critical Blockers
```
Day 1-2: Payment processing tests
Day 3: Credit transaction tests
Day 4: Messages endpoint tests
Day 5: Provider failover tests
```

### Week 2: High Priority
```
Day 1: Image generation tests
Day 2: System & notification tests
Day 3: Analytics tests
Day 4: DB layer tests (payments, roles)
Day 5: Smoke tests
```

### Week 3: Coverage Improvement
```
Day 1-2: Fill remaining route gaps
Day 3-4: Fill remaining service gaps
Day 5: Contract tests for all providers
```

### Week 4: Quality & Optimization
```
Day 1: Add edge case tests
Day 2: Add error scenario tests
Day 3: Performance tests
Day 4: E2E tests for critical flows
Day 5: Documentation & CI integration
```

---

## How to Run These Tests

```bash
# Run all tests
pytest tests/

# Run only critical tests
pytest tests/ -m critical

# Run only smoke tests
pytest tests/smoke/

# Run with coverage
pytest tests/ --cov=src --cov-report=html

# Run specific test file
pytest tests/services/test_payment_processing.py -v

# Run failing tests first
pytest tests/ --failed-first
```

---

## CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Run critical tests
  run: |
    pytest tests/ -m critical -v
  # These MUST pass

- name: Run all tests
  run: |
    pytest tests/ -v --cov=src --cov-fail-under=80
  # Coverage must be 80%+

- name: Generate coverage report
  run: |
    pytest tests/ --cov=src --cov-report=html
    pytest tests/ --cov=src --cov-report=xml

- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: ./coverage.xml
```

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Run smoke tests
  run: |
    BASE_URL=${{ secrets.STAGING_URL }} pytest tests/smoke/ -v
  # Run after deployment
```

---

## Success Metrics

### After Phase 1:
- ✅ Coverage: 60% → 70%
- ✅ Critical paths: 100% covered
- ✅ Payment bugs: 0

### After Phase 2:
- ✅ Coverage: 70% → 80%
- ✅ All endpoints: Tested
- ✅ Deployment confidence: High

### After Phase 3:
- ✅ Coverage: 80%+
- ✅ Post-deploy validation: Automated
- ✅ Production incidents: < 1/month

Want me to generate the complete test files for Phase 1?
