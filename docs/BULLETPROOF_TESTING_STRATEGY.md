# Bulletproof Testing Strategy

## Goal: Prevent Buggy/Incomplete Deployments

This document outlines a comprehensive testing strategy to ensure **only production-ready code** reaches your users.

---

## Testing Philosophy

```
Every commit → CI tests
Every PR → Integration tests
Every staging deploy → Smoke tests
Every production deploy → Health checks + Monitoring
```

**Principle:** If it's not tested, it's broken.

---

## The 6-Layer Defense

### Layer 1: Pre-Commit Hooks (Local) ⚡

**When:** Before git commit
**Speed:** < 5 seconds
**Blocks:** Commit

**What runs:**
- Code formatting (auto-fix)
- Import sorting
- Basic linting
- Security scan for secrets

**Example:**
```bash
git commit -m "Add feature"
# ✅ Formatting...
# ✅ Linting...
# ✅ No secrets found
# ✅ Commit successful
```

---

### Layer 2: Unit Tests (CI) 🧪

**When:** Every push/PR
**Speed:** < 30 seconds
**Blocks:** Merge

**Coverage target:** 80%+

**What to test:**
```python
# Every function, every edge case
def test_deduct_credits_success():
    user = {"credits": 100}
    deduct_credits(user, 10)
    assert user["credits"] == 90

def test_deduct_credits_insufficient_funds():
    user = {"credits": 5}
    with pytest.raises(InsufficientCreditsError):
        deduct_credits(user, 10)

def test_deduct_credits_negative_amount():
    user = {"credits": 100}
    with pytest.raises(ValueError):
        deduct_credits(user, -10)

def test_deduct_credits_zero_amount():
    user = {"credits": 100}
    deduct_credits(user, 0)
    assert user["credits"] == 100
```

---

### Layer 3: Integration Tests (CI) 🔗

**When:** Every push/PR
**Speed:** < 2 minutes
**Blocks:** Merge

**What to test:**
- API endpoint → Database → Response
- Service integrations
- Authentication flows

**Example:**
```python
def test_chat_completion_flow():
    """Test complete chat completion: auth → credits → API → deduct"""

    # 1. Authenticate user
    response = client.post("/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": "Hello"}]
        }
    )

    # 2. Verify response
    assert response.status_code == 200
    data = response.json()
    assert "choices" in data
    assert data["choices"][0]["message"]["content"]

    # 3. Verify credits deducted
    user = get_user(user_id)
    assert user["credits"] < original_credits

    # 4. Verify transaction recorded
    transactions = get_transactions(user_id)
    assert len(transactions) > 0
    assert transactions[0]["amount"] > 0
```

---

### Layer 4: Contract Tests (CI/Nightly) 📋

**When:** Before deployment, nightly
**Speed:** ~5 minutes
**Blocks:** Staging deployment

**Purpose:** Verify external APIs haven't changed

**Example:**
```python
@pytest.mark.contract
def test_openrouter_api_contract():
    """Verify OpenRouter API structure hasn't changed"""

    response = openrouter_client.chat_completion({
        "model": "openai/gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "test"}]
    })

    # Verify expected structure
    assert "id" in response
    assert "choices" in response
    assert isinstance(response["choices"], list)
    assert "message" in response["choices"][0]
    assert "content" in response["choices"][0]["message"]
    assert "usage" in response
    assert "total_tokens" in response["usage"]

@pytest.mark.contract
def test_stripe_api_contract():
    """Verify Stripe API structure"""

    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'usd',
                'product_data': {'name': 'Credits'},
                'unit_amount': 1000
            },
            'quantity': 1
        }],
        mode='payment'
    )

    assert session.id
    assert session.url
    assert session.status == "open"
```

---

### Layer 5: Smoke Tests (Post-Deploy) 💨

**When:** After every deployment
**Speed:** < 30 seconds
**Blocks:** Production traffic (if fails)

**What to test:**
```python
@pytest.mark.smoke
def test_deployment_health():
    """Verify deployment succeeded"""

    # 1. App is running
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200

    # 2. Database connected
    health = response.json()
    assert health["database"] == "connected"
    assert health["redis"] == "connected"

    # 3. Critical endpoints respond
    assert requests.get(f"{BASE_URL}/catalog/models").status_code == 200
    assert requests.get(f"{BASE_URL}/catalog/providers").status_code == 200

@pytest.mark.smoke
def test_critical_user_flow():
    """Test most critical path works"""

    # Simulate chat completion with test API key
    response = requests.post(
        f"{BASE_URL}/v1/chat/completions",
        headers={"Authorization": f"Bearer {TEST_API_KEY}"},
        json={
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": "test"}]
        }
    )

    assert response.status_code in [200, 402]  # OK or insufficient credits
```

---

### Layer 6: Continuous Monitoring (Production) 📊

**When:** 24/7 in production
**Alerts:** Real-time

**What to monitor:**
```
1. Error rate < 1%
2. Response time p95 < 2s
3. Success rate > 99%
4. Database queries < 100ms
5. External API failures < 5%
```

**Tools:**
- Sentry (error tracking)
- Datadog/New Relic (APM)
- Uptime Robot (availability)
- Custom health checks

---

## Critical Test Coverage Requirements

### **Must Have 100% Coverage:**

1. **Payment processing** - Can't lose money
2. **Credit deduction** - Financial accuracy
3. **Authentication** - Security critical
4. **Rate limiting** - Prevent abuse
5. **API key validation** - Security critical

### **Must Have 80%+ Coverage:**

1. **All routes** - Endpoint functionality
2. **All services** - Business logic
3. **All database operations** - Data integrity

### **Can Have < 80% Coverage:**

1. **Email templates** - Visual, manually tested
2. **Admin scripts** - One-off utilities
3. **Migration scripts** - Run once

---

## Test Pyramid Strategy

```
        /\
       /  \       E2E Tests (10%)
      /    \      - Slow, comprehensive
     /------\     - Real user flows
    /        \
   /Integration\  Integration Tests (30%)
  /   Tests     \ - API + DB + Services
 /--------------\
/   Unit Tests   \ Unit Tests (60%)
/________________\ - Fast, isolated
                   - High coverage
```

**Rationale:**
- **Many unit tests** - Fast feedback, high coverage
- **Some integration tests** - Verify components work together
- **Few E2E tests** - Validate critical paths only (slow, flaky)

---

## Deployment Gates

### **Can Deploy to Staging IF:**

✅ All unit tests pass (100%)
✅ All integration tests pass (100%)
✅ Code coverage ≥ 80%
✅ Security scan passes
✅ Linting passes

### **Can Deploy to Production IF:**

✅ All staging requirements met
✅ Smoke tests pass on staging
✅ Contract tests pass
✅ Manual QA approval (for major changes)
✅ Staging has been stable for 24+ hours

### **Auto-Rollback IF:**

❌ Smoke tests fail after deployment
❌ Error rate > 5% in first 5 minutes
❌ Health check fails
❌ Critical endpoint returns 5xx

---

## Test Data Management

### **Development:**
```python
# Use factories for test data
@pytest.fixture
def test_user():
    return UserFactory(
        email="test@example.com",
        credits=100,
        api_key="test_key"
    )
```

### **Staging:**
- Separate database
- Synthetic test data
- Reset weekly

### **Production:**
- Never test in production!
- Use observability instead

---

## Testing Checklist (Before Every Deploy)

### **Pre-Deployment:**

```
[ ] All tests passing?
[ ] Coverage ≥ 80%?
[ ] No security vulnerabilities?
[ ] Database migrations tested?
[ ] Environment variables updated?
[ ] Rollback plan documented?
[ ] Smoke tests ready?
[ ] On-call engineer notified?
```

### **Post-Deployment:**

```
[ ] Smoke tests passed?
[ ] Health checks green?
[ ] Error rate normal?
[ ] Response times normal?
[ ] No alerts firing?
[ ] User flows working?
[ ] Rollback plan confirmed?
```

---

## Example: Full Testing for New Feature

**Feature:** Add referral bonus credits

### **1. Unit Tests (Write First)**

```python
# tests/unit/services/test_referral.py
def test_calculate_referral_bonus():
    assert calculate_bonus(tier="bronze") == 10
    assert calculate_bonus(tier="silver") == 25
    assert calculate_bonus(tier="gold") == 50

def test_apply_referral_bonus():
    user = User(credits=100)
    apply_bonus(user, amount=10)
    assert user.credits == 110

def test_apply_referral_bonus_creates_transaction():
    user = User(id=1)
    apply_bonus(user, amount=10)
    transaction = get_latest_transaction(user.id)
    assert transaction.type == "referral_bonus"
    assert transaction.amount == 10
```

### **2. Integration Tests**

```python
# tests/integration/test_referral_flow.py
def test_complete_referral_flow():
    # 1. User A refers User B
    referral_link = generate_referral_link(user_a.id)

    # 2. User B signs up via link
    user_b = signup_via_referral(referral_link)

    # 3. User A gets bonus credits
    user_a_updated = get_user(user_a.id)
    assert user_a_updated.credits > user_a.credits

    # 4. Transaction recorded
    transactions = get_transactions(user_a.id)
    assert any(t.type == "referral_bonus" for t in transactions)
```

### **3. Smoke Test**

```python
# tests/smoke/test_referral_deployed.py
@pytest.mark.smoke
def test_referral_endpoint_exists():
    response = requests.get(f"{BASE_URL}/referral/link")
    assert response.status_code in [200, 401]  # Not 404!
```

### **4. Deploy**

```
1. Run all tests locally ✅
2. Push to staging ✅
3. CI runs all tests ✅
4. Smoke tests on staging ✅
5. Manual QA test ✅
6. Deploy to production ✅
7. Smoke tests on production ✅
8. Monitor for 1 hour ✅
```

---

## Tools & Libraries

### **Testing:**
```
pytest - Test framework
pytest-cov - Coverage reporting
pytest-mock - Mocking
pytest-asyncio - Async tests
httpx - Async HTTP client
faker - Test data generation
factory-boy - Test fixtures
```

### **Quality:**
```
ruff - Fast linting
black - Code formatting
mypy - Type checking
bandit - Security scanning
```

### **Monitoring:**
```
sentry - Error tracking
datadog - APM
prometheus - Metrics
grafana - Dashboards
```

---

## Summary: Preventing Bad Deployments

### **Your 6-Layer Defense:**

1. **Pre-commit hooks** - Stop bad code locally
2. **Unit tests** - Verify logic works
3. **Integration tests** - Verify components work together
4. **Contract tests** - Verify external APIs unchanged
5. **Smoke tests** - Verify deployment succeeded
6. **Continuous monitoring** - Detect issues in real-time

### **CI/CD Gates:**

```
Code pushed
    ↓
Pre-commit hooks ✅
    ↓
CI: Unit + Integration tests ✅
    ↓
Contract tests ✅
    ↓
Deploy to staging
    ↓
Smoke tests ✅
    ↓
Manual QA ✅
    ↓
Deploy to production
    ↓
Smoke tests ✅
    ↓
Continuous monitoring 📊
```

**If ANY step fails → Deployment BLOCKED!**

This ensures **only tested, validated, production-ready code** reaches your users. 🛡️
