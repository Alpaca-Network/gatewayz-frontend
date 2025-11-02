# tests/db/test_api_keys_module.py
import sys
import types
import importlib
from datetime import datetime, timedelta, timezone
import pytest

MODULE_PATH = "src.db.api_keys"  # <-- change if your file lives elsewhere


# ------------------------ Minimal in-memory Supabase double ------------------------

class _Result:
    def __init__(self, data):
        self.data = data


class _Table:
    def __init__(self, store, name):
        self.store = store
        self.name = name
        self._filters = []   # list of (field, op, value)
        self._select = None
        self._order = None
        self._desc = False

    # query builders (chainable)
    def select(self, _cols="*"):
        self._select = _cols
        return self

    def eq(self, field, value):
        self._filters.append((field, "eq", value))
        return self

    def neq(self, field, value):
        self._filters.append((field, "neq", value))
        return self

    def order(self, field, desc=False):
        self._order = field
        self._desc = desc
        return self

    def _match(self, row):
        for field, op, val in self._filters:
            if op == "eq" and row.get(field) != val:
                return False
            if op == "neq" and row.get(field) == val:
                return False
        return True

    def _rows(self):
        return [r for r in self.store[self.name]]

    def _filtered(self):
        return [r for r in self._rows() if self._match(r)]

    def insert(self, data):
        # accept dict or list[dict]
        rows = data if isinstance(data, list) else [data]
        for r in rows:
            if "id" not in r:
                r["id"] = len(self.store[self.name]) + 1
            if "created_at" not in r:
                r["created_at"] = datetime.now(timezone.utc).isoformat()
            self.store[self.name].append(r)
        return self

    def update(self, patch):
        out = []
        for r in self._filtered():
            r.update(patch)
            out.append(r)
        self._last_update = out
        return self

    def delete(self):
        to_delete = self._filtered()
        self.store[self.name] = [r for r in self._rows() if r not in to_delete]
        self._last_delete = to_delete
        return self

    def execute(self):
        if hasattr(self, "_last_update"):
            return _Result(self._last_update)
        if hasattr(self, "_last_delete"):
            return _Result(self._last_delete)
        rows = self._filtered()
        if self._order:
            rows.sort(key=lambda r: r.get(self._order), reverse=self._desc)
        return _Result(rows)


class FakeSupabase:
    def __init__(self):
        self.store = {
            "api_keys_new": [],
            "api_keys": [],
            "rate_limit_configs": [],
            "api_key_audit_logs": [],
        }

    def table(self, name):
        if name not in self.store:
            self.store[name] = []
        return _Table(self.store, name)


# ------------------------ Shared fixtures ------------------------

@pytest.fixture
def fake_supabase():
    return FakeSupabase()


@pytest.fixture
def mod(fake_supabase, monkeypatch):
    # stub out get_supabase_client
    supabase_mod = types.SimpleNamespace(get_supabase_client=lambda: fake_supabase)
    monkeypatch.setitem(sys.modules, "src.config.supabase_config", supabase_mod)

    # stub plan entitlements
    plans_mod = types.SimpleNamespace(check_plan_entitlements=lambda user_id: {"monthly_request_limit": 5000})
    monkeypatch.setitem(sys.modules, "src.db.plans", plans_mod)

    # stub audit logger
    security_mod = types.SimpleNamespace(
        get_audit_logger=lambda: types.SimpleNamespace(
            log_api_key_creation=lambda *args, **kwargs: None,
            log_api_key_deletion=lambda *args, **kwargs: None
        )
    )
    monkeypatch.setitem(sys.modules, "src.security.security", security_mod)

    # ensure deterministic secrets.token_urlsafe
    import secrets as real_secrets
    monkeypatch.setattr(real_secrets, "token_urlsafe", lambda n=32: "TOK", raising=True)

    # preload a default users module targetable by the code's late imports
    fake_users_mod = types.SimpleNamespace(get_user=lambda api_key: None)
    monkeypatch.setitem(sys.modules, "src.db.users", fake_users_mod)

    # import the module fresh
    m = importlib.import_module(MODULE_PATH)
    importlib.reload(m)
    return m


# ------------------------ Tests ------------------------

def test_check_key_name_uniqueness(mod, fake_supabase):
    # no keys yet -> unique
    assert mod.check_key_name_uniqueness(user_id=1, key_name="A") is True

    # add one
    fake_supabase.table("api_keys_new").insert({"user_id": 1, "key_name": "A"}).execute()
    assert mod.check_key_name_uniqueness(1, "A") is False
    # exclude this key id -> becomes unique for rename on self
    key_id = fake_supabase.store["api_keys_new"][0]["id"]
    assert mod.check_key_name_uniqueness(1, "A", exclude_key_id=key_id) is True


def test_create_api_key_primary_sets_trial_and_prefix_and_audit(monkeypatch, mod, fake_supabase):
    # user 99, enforce plan limit, deterministic token -> "gw_live_TOK"
    api_key, key_id = mod.create_api_key(
        user_id=99,
        key_name="Main",
        environment_tag="live",
        scope_permissions=None,   # uses defaults
        expiration_days=2,
        max_requests=999999,      # will be clamped to plan's monthly_request_limit (5000)
        ip_allowlist=["1.2.3.4"],
        domain_referrers=["https://x.y"],
        is_primary=True,
    )
    assert api_key.startswith("gw_live_") and "TOK" in api_key

    # row exists in api_keys_new
    rows = fake_supabase.store["api_keys_new"]
    assert len(rows) == 1
    row = rows[0]
    assert row["user_id"] == 99
    assert row["is_primary"] is True
    assert row["scope_permissions"]["read"] == ["*"]
    assert row["max_requests"] == 5000  # clamped
    assert "trial_end_date" in row and row["subscription_status"] == "trial"

    # rate limit config created
    rlc = fake_supabase.store["rate_limit_configs"]
    assert len(rlc) == 1
    assert rlc[0]["api_key_id"] == row["id"]

    # audit log created
    logs = fake_supabase.store["api_key_audit_logs"]
    assert logs and logs[0]["action"] == "create"


def test_get_user_api_keys_builds_fields(mod, fake_supabase):
    # load 2 keys
    now = datetime.now(timezone.utc)
    fake_supabase.table("api_keys_new").insert([
        {
            "user_id": 7,
            "key_name": "K1",
            "api_key": "gw_live_A",
            "is_active": True,
            "requests_used": 10,
            "max_requests": 100,
            "environment_tag": "live",
            "expiration_date": (now + timedelta(days=5)).isoformat(),
            "scope_permissions": {"read": ["*"]},
            "last_used_at": now.isoformat(),
        },
        {
            "user_id": 7,
            "key_name": "K2",
            "api_key": "gw_live_B",
            "is_active": False,
            "requests_used": 0,
            "max_requests": None,
            "environment_tag": "test",
            "expiration_date": None,
            "scope_permissions": {},
            "last_used_at": None,
        }
    ]).execute()

    out = mod.get_user_api_keys(7)
    assert len(out) == 2
    k1 = next(k for k in out if k["key_name"] == "K1")
    assert k1["requests_remaining"] == 90
    assert 0 < k1["days_remaining"] <= 5


def test_delete_api_key_new_and_legacy(mod, fake_supabase):
    # new key
    fake_supabase.table("api_keys_new").insert({
        "user_id": 2, "key_name": "New", "api_key": "gw_live_X", "is_active": True, "requests_used": 0
    }).execute()
    # legacy key
    fake_supabase.table("api_keys").insert({
        "user_id": 2, "key_name": "Legacy", "api_key": "legacy_X", "is_active": True, "requests_used": 0
    }).execute()

    assert mod.delete_api_key("gw_live_X", user_id=2) is True
    assert not fake_supabase.store["api_keys_new"]  # deleted
    # audit log for delete created
    assert fake_supabase.store["api_key_audit_logs"]
    # legacy path
    assert mod.delete_api_key("legacy_X", user_id=2) is True
    assert not fake_supabase.store["api_keys"]


def test_validate_api_key_prefers_api_keys_then_fallback(monkeypatch, mod, fake_supabase):
    # 1) Found in api_keys (legacy table) and active with not-expired
    now = datetime.now(timezone.utc)
    fake_supabase.table("api_keys").insert({
        "id": 11,
        "user_id": 777,
        "key_name": "L1",
        "api_key": "legacy_1",
        "is_active": True,
        "expiration_date": (now + timedelta(days=1)).isoformat(),
        "max_requests": 100,
        "requests_used": 0
    }).execute()

    # Late-imported get_user must exist and return the user for a key
    users_mod = sys.modules["src.db.users"]
    users_mod.get_user = lambda api_key: {"id": 777} if api_key == "legacy_1" else None

    out = mod.validate_api_key("legacy_1")
    assert out and out["user_id"] == 777 and out["key_id"] == 11

    # 2) Not in api_keys -> fallback create legacy entry if get_user returns a user
    users_mod.get_user = lambda api_key: {"id": 888} if api_key == "legacy_2" else None
    out2 = mod.validate_api_key("legacy_2")
    assert out2 and out2["user_id"] == 888 and out2["key_name"] == "Legacy Key"
    # ensure an entry was inserted
    rows = [r for r in fake_supabase.store["api_keys"] if r["api_key"] == "legacy_2"]
    assert rows


def test_increment_api_key_usage_updates_new_or_legacy(monkeypatch, mod, fake_supabase):
    # new
    fake_supabase.table("api_keys_new").insert({
        "api_key": "gw_live_Y", "requests_used": 1, "is_active": True
    }).execute()
    mod.increment_api_key_usage("gw_live_Y")
    row = fake_supabase.store["api_keys_new"][0]
    assert row["requests_used"] == 2 and row.get("last_used_at")

    # legacy update path: existing row present -> increments requests_count
    fake_supabase.table("api_keys").insert({
        "api_key": "legacy_Y", "requests_used": 5, "requests_count": 5, "is_active": True
    }).execute()
    mod.increment_api_key_usage("legacy_Y")
    row2 = [r for r in fake_supabase.store["api_keys"] if r["api_key"] == "legacy_Y"][0]
    assert row2["requests_count"] == 6

    # legacy insert path: missing row, but get_user returns a user -> inserts new row
    users_mod = sys.modules["src.db.users"]
    users_mod.get_user = lambda k: {"id": 999} if k == "legacy_insert" else None
    mod.increment_api_key_usage("legacy_insert")
    ins = [r for r in fake_supabase.store["api_keys"] if r["api_key"] == "legacy_insert"]
    assert ins and ins[0]["requests_count"] == 1


def test_get_api_key_usage_stats_new_vs_legacy(mod, fake_supabase):
    fake_supabase.table("api_keys_new").insert({
        "api_key": "gw_live_S", "key_name": "SKey", "is_active": True,
        "requests_used": 10, "max_requests": 100, "environment_tag": "live",
        "last_used_at": "2025-01-01T00:00:00+00:00"
    }).execute()
    out_new = mod.get_api_key_usage_stats("gw_live_S")
    assert out_new["requests_remaining"] == 90
    assert out_new["usage_percentage"] == 10.0

    fake_supabase.table("api_keys").insert({
        "api_key": "legacy_S", "key_name": "LKey", "is_active": True,
        "requests_count": 7, "max_requests": 100, "created_at": "2025-01-02T00:00:00+00:00",
        "updated_at": "2025-01-03T00:00:00+00:00"
    }).execute()
    out_legacy = mod.get_api_key_usage_stats("legacy_S")
    assert out_legacy["requests_used"] == 7
    assert out_legacy["usage_percentage"] == 7.0
    assert out_legacy["environment_tag"] == "legacy"


def test_update_api_key_name_uniqueness_and_expiration_and_rate_limit(mod, fake_supabase):
    # seed two keys for same user
    fake_supabase.table("api_keys_new").insert([
        {"id": 1, "user_id": 5, "key_name": "A", "api_key": "gw_live_A", "is_active": True},
        {"id": 2, "user_id": 5, "key_name": "B", "api_key": "gw_live_B", "is_active": True, "max_requests": 100}
    ]).execute()
    # a rate_limit_config row for id=2
    fake_supabase.table("rate_limit_configs").insert({"api_key_id": 2, "max_requests": 100}).execute()

    # try to rename B -> A (should fail uniqueness)
    with pytest.raises(RuntimeError):
        mod.update_api_key("gw_live_B", user_id=5, updates={"key_name": "A"})

    # update expiration_days and max_requests
    assert mod.update_api_key("gw_live_B", user_id=5, updates={"expiration_days": 2, "max_requests": 250}) is True

    # check updated key and rate_limit_config
    k = [r for r in fake_supabase.store["api_keys_new"] if r["id"] == 2][0]
    assert k["max_requests"] == 250 and "expiration_date" in k
    rlc = [r for r in fake_supabase.store["rate_limit_configs"] if r["api_key_id"] == 2][0]
    assert rlc["max_requests"] == 250

    # audit log recorded
    assert fake_supabase.store["api_key_audit_logs"]


def test_validate_api_key_permissions(mod, fake_supabase):
    # gw_temp => always true
    assert mod.validate_api_key_permissions("gw_temp_abcd", "read", "anything") is True

    # new key with explicit scope
    fake_supabase.table("api_keys_new").insert({
        "api_key": "gw_live_perm",
        "is_active": True,
        "scope_permissions": {"read": ["*"], "write": ["dataset1"]}
    }).execute()
    assert mod.validate_api_key_permissions("gw_live_perm", "read", "x") is True
    assert mod.validate_api_key_permissions("gw_live_perm", "write", "dataset1") is True
    assert mod.validate_api_key_permissions("gw_live_perm", "write", "dataset2") is False

    # inactive key -> false
    fake_supabase.table("api_keys_new").insert({
        "api_key": "gw_live_inact",
        "is_active": False,
        "scope_permissions": {"read": ["*"]}
    }).execute()
    assert mod.validate_api_key_permissions("gw_live_inact", "read", "x") is False


def test_get_api_key_by_id(mod, fake_supabase):
    exp = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    fake_supabase.table("api_keys_new").insert({
        "id": 123, "user_id": 4, "key_name": "K",
        "api_key": "gw_live_K", "is_active": True, "max_requests": 100,
        "requests_used": 10, "expiration_date": exp, "environment_tag": "live"
    }).execute()

    out = mod.get_api_key_by_id(123, user_id=4)
    assert out and out["id"] == 123 and out["requests_remaining"] == 90
    assert out["days_remaining"] is not None and out["days_remaining"] >= 2


def test_get_user_all_api_keys_usage(mod, fake_supabase):
    fake_supabase.table("api_keys_new").insert([
        {"user_id": 10, "api_key": "gw_live_1", "key_name": "K1", "is_active": True,
         "requests_used": 5, "max_requests": 100, "environment_tag": "live"},
        {"user_id": 10, "api_key": "gw_test_2", "key_name": "K2", "is_active": False,
         "requests_used": 0, "max_requests": None, "environment_tag": "test"},
    ]).execute()

    out = mod.get_user_all_api_keys_usage(10)
    assert out["user_id"] == 10
    assert out["total_keys"] == 2
    by_name = {k["key_name"]: k for k in out["keys"]}
    assert by_name["K1"]["requests_remaining"] == 95
    assert by_name["K2"]["max_requests"] is None
