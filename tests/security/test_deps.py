# tests/security/test_deps.py
import importlib
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

MODULE_PATH = "src.security.deps"  # change if needed


@pytest.fixture
def mod():
    m = importlib.import_module(MODULE_PATH)
    return m


# ---- helpers ----

def make_request(path="/v1/test", referer="https://example.com", user_agent="UA/1.0", client_ip="1.2.3.4"):
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "query_string": b"",
        "headers": [
            (b"referer", referer.encode()),
            (b"user-agent", user_agent.encode()),
        ],
        "client": (client_ip, 12345),
        "server": ("testserver", 80),
    }
    return Request(scope)


class FakeAuditLogger:
    def __init__(self):
        self.api_usage_calls = []
        self.violation_calls = []

    def log_api_key_usage(self, **kwargs):
        self.api_usage_calls.append(kwargs)

    def log_security_violation(self, **kwargs):
        self.violation_calls.append(kwargs)


# ---------------- get_api_key ----------------

@pytest.mark.anyio
async def test_get_api_key_missing_credentials(mod):
    with pytest.raises(HTTPException) as ei:
        await mod.get_api_key(credentials=None, request=None)
    assert ei.value.status_code == 422
    assert "Authorization header" in ei.value.detail


@pytest.mark.anyio
async def test_get_api_key_missing_token(mod):
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="")
    with pytest.raises(HTTPException) as ei:
        await mod.get_api_key(credentials=creds, request=None)
    assert ei.value.status_code == 401
    assert "API key is required" in ei.value.detail


@pytest.mark.anyio
async def test_get_api_key_valid_logs_usage(monkeypatch, mod):
    # arrange
    fake_audit = FakeAuditLogger()
    monkeypatch.setattr(mod, "audit_logger", fake_audit)
    # validate -> returns same key
    monkeypatch.setattr(mod, "validate_api_key_security", lambda api_key, client_ip=None, referer=None: api_key)
    # user lookup
    monkeypatch.setattr(mod, "get_user", lambda key: {"id": 42, "key_id": 7, "credits": 1.23})

    req = make_request(path="/v1/completions", referer="https://app.example", user_agent="TestUA", client_ip="9.9.9.9")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="sk-valid-123")

    # act
    out = await mod.get_api_key(credentials=creds, request=req)

    # assert
    assert out == "sk-valid-123"
    assert len(fake_audit.api_usage_calls) == 1
    call = fake_audit.api_usage_calls[0]
    assert call["user_id"] == 42
    assert call["key_id"] == 7
    assert call["endpoint"] == "/v1/completions"
    assert call["ip_address"] == "9.9.9.9"
    assert call["user_agent"] == "TestUA"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "msg, expected",
    [
        ("inactive key", 401),
        ("expired token", 401),
        ("limit reached for today", 429),
        ("not allowed for this referrer", 403),
        ("IP address blocked", 403),
        ("Domain not allowed", 403),
    ],
)
async def test_get_api_key_valueerror_mapped(monkeypatch, mod, msg, expected):
    fake_audit = FakeAuditLogger()
    monkeypatch.setattr(mod, "audit_logger", fake_audit)
    # make validator raise value error with our message
    def _raise(*a, **k):
        raise ValueError(msg)
    monkeypatch.setattr(mod, "validate_api_key_security", _raise)
    # user lookup not used in this path
    monkeypatch.setattr(mod, "get_user", lambda key: {"id": 1})

    req = make_request(client_ip="5.6.7.8")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="sk-bad")

    with pytest.raises(HTTPException) as ei:
        await mod.get_api_key(credentials=creds, request=req)

    assert ei.value.status_code == expected
    assert msg in ei.value.detail
    # violation logged with IP
    assert fake_audit.violation_calls
    assert fake_audit.violation_calls[0]["violation_type"] == "INVALID_API_KEY"
    assert "5.6.7.8" in fake_audit.violation_calls[0]["ip_address"]


@pytest.mark.anyio
async def test_get_api_key_unexpected(monkeypatch, mod):
    def boom(*a, **k):
        raise RuntimeError("boom")
    monkeypatch.setattr(mod, "validate_api_key_security", boom)

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="sk-any")
    with pytest.raises(HTTPException) as ei:
        await mod.get_api_key(credentials=creds, request=None)
    assert ei.value.status_code == 500
    assert "Internal authentication error" in ei.value.detail


# ---------------- get_current_user ----------------

@pytest.mark.anyio
async def test_get_current_user_happy(monkeypatch, mod):
    monkeypatch.setattr(mod, "get_user", lambda key: {"id": 99, "is_admin": False})
    out = await mod.get_current_user(api_key="sk-ok")
    assert out["id"] == 99


@pytest.mark.anyio
async def test_get_current_user_404(monkeypatch, mod):
    monkeypatch.setattr(mod, "get_user", lambda key: None)
    with pytest.raises(HTTPException) as ei:
        await mod.get_current_user(api_key="missing")
    assert ei.value.status_code == 404


# ---------------- require_admin ----------------

@pytest.mark.anyio
async def test_require_admin_via_flag(monkeypatch, mod):
    fake_audit = FakeAuditLogger()
    monkeypatch.setattr(mod, "audit_logger", fake_audit)
    user = {"id": 1, "is_admin": True}
    out = await mod.require_admin(user=user)
    assert out["id"] == 1
    assert not fake_audit.violation_calls  # no violation


@pytest.mark.anyio
async def test_require_admin_via_role(monkeypatch, mod):
    fake_audit = FakeAuditLogger()
    monkeypatch.setattr(mod, "audit_logger", fake_audit)
    user = {"id": 2, "role": "admin"}
    out = await mod.require_admin(user=user)
    assert out["id"] == 2


@pytest.mark.anyio
async def test_require_admin_denied_logs_violation(monkeypatch, mod):
    fake_audit = FakeAuditLogger()
    monkeypatch.setattr(mod, "audit_logger", fake_audit)
    user = {"id": 3, "is_admin": False, "role": "user"}
    with pytest.raises(HTTPException) as ei:
        await mod.require_admin(user=user)
    assert ei.value.status_code == 403
    assert fake_audit.violation_calls
    assert fake_audit.violation_calls[0]["violation_type"] == "UNAUTHORIZED_ADMIN_ACCESS"


# ---------------- get_optional_user ----------------

@pytest.mark.anyio
async def test_get_optional_user_no_credentials_returns_none(mod):
    out = await mod.get_optional_user(credentials=None, request=None)
    assert out is None


@pytest.mark.anyio
async def test_get_optional_user_invalid_returns_none(monkeypatch, mod):
    # Make inner get_api_key raise HTTPException
    async def _raise(creds, request=None):
        raise HTTPException(status_code=401, detail="bad key")
    monkeypatch.setattr(mod, "get_api_key", _raise)

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="sk-bad")
    out = await mod.get_optional_user(credentials=creds, request=None)
    assert out is None


@pytest.mark.anyio
async def test_get_optional_user_valid_returns_user(monkeypatch, mod):
    # normal flow
    async def _ok(creds, request=None):
        return creds.credentials
    monkeypatch.setattr(mod, "get_api_key", _ok)
    monkeypatch.setattr(mod, "get_user", lambda key: {"id": 11, "credits": 3.14})

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="sk-good")
    out = await mod.get_optional_user(credentials=creds, request=None)
    assert out["id"] == 11


# ---------------- require_active_subscription ----------------

@pytest.mark.anyio
@pytest.mark.parametrize("status", ["active", "trial"])
async def test_require_active_subscription_ok(mod, status):
    user = {"id": 1, "subscription_status": status}
    out = await mod.require_active_subscription(user=user)
    assert out["id"] == 1


@pytest.mark.anyio
async def test_require_active_subscription_forbidden(mod):
    user = {"id": 1, "subscription_status": "inactive"}
    with pytest.raises(HTTPException) as ei:
        await mod.require_active_subscription(user=user)
    assert ei.value.status_code == 403


# ---------------- check_credits ----------------

@pytest.mark.anyio
async def test_check_credits_ok(mod):
    user = {"id": 1, "credits": 1.5}
    out = await mod.check_credits(user=user, min_credits=1.0)
    assert out["id"] == 1


@pytest.mark.anyio
async def test_check_credits_402(mod):
    user = {"id": 1, "credits": 0.5}
    with pytest.raises(HTTPException) as ei:
        await mod.check_credits(user=user, min_credits=1.0)
    assert ei.value.status_code == 402


# ---------------- get_user_id ----------------

@pytest.mark.anyio
async def test_get_user_id(mod):
    uid = await mod.get_user_id(user={"id": 77})
    assert uid == 77


# ---------------- verify_key_permissions ----------------

@pytest.mark.anyio
async def test_verify_key_permissions_none_required_returns_key(mod):
    out = await mod.verify_key_permissions(api_key="sk-1", required_permissions=None)
    assert out == "sk-1"


@pytest.mark.anyio
async def test_verify_key_permissions_ok(monkeypatch, mod):
    # user has wildcard for 'read'
    monkeypatch.setattr(mod, "get_user", lambda k: {"id": 9, "scope_permissions": {"read": ["*"]}})
    out = await mod.verify_key_permissions(api_key="sk-9", required_permissions=["read"])
    assert out == "sk-9"


@pytest.mark.anyio
async def test_verify_key_permissions_user_missing(monkeypatch, mod):
    monkeypatch.setattr(mod, "get_user", lambda k: None)
    with pytest.raises(HTTPException) as ei:
        await mod.verify_key_permissions(api_key="sk-x", required_permissions=["read"])
    assert ei.value.status_code == 401


@pytest.mark.anyio
async def test_verify_key_permissions_forbidden(monkeypatch, mod):
    # has some specific resource but not '*' or same-name permission
    monkeypatch.setattr(mod, "get_user", lambda k: {"id": 3, "scope_permissions": {"write": ["dataset1"]}})
    with pytest.raises(HTTPException) as ei:
        await mod.verify_key_permissions(api_key="sk-3", required_permissions=["write"])
    assert ei.value.status_code == 403
    assert "lacks 'write' permission" in ei.value.detail
