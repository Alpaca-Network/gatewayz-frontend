# tests/db/test_plans.py
import sys
import types
import importlib
from datetime import datetime, timedelta, timezone
import pytest

MODULE_PATH = "src.db.plans"  # change if your file lives elsewhere


# ------------------------ Minimal in-memory Supabase double ------------------------

class _Result:
    def __init__(self, data):
        self.data = data


def _parse_dt(val):
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        s = val.replace("Z", "+00:00") if "Z" in val else val
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return None
    return None


class _Table:
    def __init__(self, store, name):
        self.store = store
        self.name = name
        self._filters = []   # list of (field, op, value)
        self._order = None
        self._desc = False
        self._last_update = None
        self._last_delete = None

    # query builders
    def select(self, _cols="*"):
        return self

    def eq(self, field, value):
        self._filters.append((field, "eq", value))
        return self

    def gte(self, field, value):
        self._filters.append((field, "gte", value))
        return self

    def order(self, field, desc=False):
        self._order = field
        self._desc = desc
        return self

    def _rows(self):
        return list(self.store[self.name])

    def _match(self, row):
        for field, op, val in self._filters:
            if op == "eq":
                if row.get(field) != val:
                    return False
            elif op == "gte":
                rv = row.get(field)
                if isinstance(rv, (int, float)) and isinstance(val, (int, float)):
                    if rv < val:
                        return False
                else:
                    # try datetime compare (ISO-8601)
                    rd, vd = _parse_dt(rv), _parse_dt(val)
                    if rd is not None and vd is not None:
                        if rd < vd:
                            return False
                    else:
                        # fallback to string compare (ISO sorts ok)
                        if str(rv) < str(val):
                            return False
        return True

    def insert(self, data):
        rows = data if isinstance(data, list) else [data]
        for r in rows:
            if "id" not in r:
                r["id"] = len(self.store[self.name]) + 1
            if "created_at" not in r and self.name in {"users", "user_plans", "usage_records", "plans", "subscription_plans"}:
                r["created_at"] = datetime.now(timezone.utc).isoformat()
            self.store[self.name].append(r)
        return self

    def update(self, patch):
        out = []
        for r in self._rows():
            if self._match(r):
                r.update(patch)
                out.append(r)
        self._last_update = out
        return self

    def delete(self):
        to_delete = [r for r in self._rows() if self._match(r)]
        self.store[self.name] = [r for r in self._rows() if r not in to_delete]
        self._last_delete = to_delete
        return self

    def execute(self):
        if self._last_update is not None:
            return _Result(self._last_update)
        if self._last_delete is not None:
            return _Result(self._last_delete)
        rows = [r for r in self._rows() if self._match(r)]
        if self._order:
            rows.sort(key=lambda r: r.get(self._order), reverse=self._desc)
        return _Result(rows)


class FakeSupabase:
    def __init__(self):
        self.store = {
            "plans": [],
            "user_plans": [],
            "users": [],
            "usage_records": [],
            "subscription_plans": [],
        }

    def table(self, name):
        if name not in self.store:
            self.store[name] = []
        return _Table(self.store, name)


# ------------------------ Fixtures ------------------------

@pytest.fixture
def fake_supabase():
    return FakeSupabase()


@pytest.fixture
def mod(fake_supabase, monkeypatch):
    # stub out get_supabase_client
    supabase_mod = types.SimpleNamespace(get_supabase_client=lambda: fake_supabase)
    monkeypatch.setitem(sys.modules, "src.config.supabase_config", supabase_mod)

    # import the module fresh
    m = importlib.import_module(MODULE_PATH)
    importlib.reload(m)
    return m


# ------------------------ Tests ------------------------

def test_get_all_plans_returns_active_sorted(mod, fake_supabase):
    fake_supabase.table("plans").insert([
        {"id": 1, "name": "Basic", "price_per_month": 10, "is_active": True},
        {"id": 2, "name": "Pro", "price_per_month": 25, "is_active": True},
        {"id": 3, "name": "Old", "price_per_month": 5, "is_active": False},
    ]).execute()

    out = mod.get_all_plans()
    assert [p["id"] for p in out] == [1, 2]  # only active
    assert [p["price_per_month"] for p in out] == [10, 25]  # sorted asc


def test_get_plan_by_id_converts_features_dict_to_list(mod, fake_supabase):
    fake_supabase.table("plans").insert({
        "id": 7,
        "name": "Team",
        "description": "Team plan",
        "daily_request_limit": 1000,
        "monthly_request_limit": 30000,
        "daily_token_limit": 200000,
        "monthly_token_limit": 6000000,
        "price_per_month": 99,
        "features": {"basic_models": True, "priority_support": True},
        "is_active": True,
    }).execute()

    plan = mod.get_plan_by_id(7)
    assert plan is not None
    assert isinstance(plan["features"], list)
    assert set(plan["features"]) == {"basic_models", "priority_support"}


def test_get_user_plan_combines_user_and_plan(mod, fake_supabase):
    fake_supabase.table("plans").insert({
        "id": 42, "name": "Pro", "description": "Pro plan",
        "daily_request_limit": 2000, "monthly_request_limit": 50000,
        "daily_token_limit": 300000, "monthly_token_limit": 9000000,
        "price_per_month": 29, "features": ["basic_models", "advanced_models"], "is_active": True
    }).execute()
    now = datetime.now(timezone.utc)
    fake_supabase.table("user_plans").insert({
        "id": 1001, "user_id": 9, "plan_id": 42,
        "start_date": (now - timedelta(days=1)).isoformat(),
        "end_date": (now + timedelta(days=29)).isoformat(),
        "is_active": True
    }).execute()

    out = mod.get_user_plan(9)
    assert out["user_plan_id"] == 1001
    assert out["plan_name"] == "Pro"
    assert "advanced_models" in out["features"]


def test_assign_user_plan_deactivates_existing_and_updates_user(mod, fake_supabase):
    # existing plan
    fake_supabase.table("user_plans").insert({
        "id": 1, "user_id": 5, "plan_id": 1,
        "start_date": datetime.now(timezone.utc).isoformat(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
        "is_active": True
    }).execute()
    # target plan exists
    fake_supabase.table("plans").insert({
        "id": 2, "name": "Business", "is_active": True,
        "daily_request_limit": 3000, "monthly_request_limit": 70000,
        "daily_token_limit": 500000, "monthly_token_limit": 15000000,
        "price_per_month": 49, "features": ["basic_models", "priority_support"]
    }).execute()
    # user row
    fake_supabase.table("users").insert({"id": 5, "subscription_status": "inactive"}).execute()

    ok = mod.assign_user_plan(5, 2, duration_months=1)
    assert ok is True

    # old is inactive
    old = fake_supabase.table("user_plans").select("*").eq("id", 1).execute().data[0]
    assert old["is_active"] is False

    # user set active
    user = fake_supabase.table("users").select("*").eq("id", 5).execute().data[0]
    assert user["subscription_status"] == "active"

    # new assignment exists
    ups = fake_supabase.table("user_plans").select("*").eq("user_id", 5).execute().data
    assert any(up["is_active"] and up["plan_id"] == 2 for up in ups)


def test_check_plan_entitlements_no_plan_defaults(mod, fake_supabase):
    # Ensure database is clean (no leftover plans from other tests)
    fake_supabase.store["plans"].clear()
    fake_supabase.store["user_plans"].clear()

    out = mod.check_plan_entitlements(user_id=111)
    assert out["has_plan"] is False
    assert out["daily_request_limit"] == 25000
    assert out["daily_token_limit"] == 500_000
    assert out["monthly_token_limit"] == 15_000_000
    assert "basic_models" in out["features"]


def test_check_plan_entitlements_expired_plan_marks_inactive_and_user_expired(mod, fake_supabase):
    # plan + expired user_plan
    fake_supabase.table("plans").insert({
        "id": 55, "name": "Basic", "is_active": True,
        "daily_request_limit": 100, "monthly_request_limit": 2000,
        "daily_token_limit": 10000, "monthly_token_limit": 200000,
        "price_per_month": 9, "features": ["basic_models"]
    }).execute()
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    fake_supabase.table("user_plans").insert({
        "id": 501, "user_id": 77, "plan_id": 55,
        "start_date": (yesterday - timedelta(days=29)).isoformat(),
        "end_date": yesterday.isoformat(),
        "is_active": True,
    }).execute()
    fake_supabase.table("users").insert({"id": 77, "subscription_status": "active"}).execute()

    out = mod.check_plan_entitlements(77)
    assert out["has_plan"] is False
    assert out.get("plan_expired") is True

    # DB side-effects
    up = fake_supabase.table("user_plans").select("*").eq("id", 501).execute().data[0]
    assert up["is_active"] is False
    user = fake_supabase.table("users").select("*").eq("id", 77).execute().data[0]
    assert user["subscription_status"] == "expired"


def test_check_plan_entitlements_active_plan_allows_feature(mod, fake_supabase):
    fake_supabase.table("plans").insert({
        "id": 7, "name": "Pro", "is_active": True,
        "daily_request_limit": 1000, "monthly_request_limit": 30000,
        "daily_token_limit": 200000, "monthly_token_limit": 6000000,
        "price_per_month": 29, "features": ["basic_models", "advanced_models"]
    }).execute()
    now = datetime.now(timezone.utc)
    fake_supabase.table("user_plans").insert({
        "id": 700, "user_id": 123, "plan_id": 7,
        "start_date": (now - timedelta(days=1)).isoformat(),
        "end_date": (now + timedelta(days=10)).isoformat(),
        "is_active": True
    }).execute()

    out = mod.check_plan_entitlements(123, required_feature="advanced_models")
    assert out["has_plan"] is True
    assert out["can_access_feature"] is True

    out2 = mod.check_plan_entitlements(123, required_feature="priority_support")
    assert out2["can_access_feature"] is False


def test_get_user_usage_within_plan_limits_aggregates(mod, fake_supabase):
    # plan + user_plan
    fake_supabase.table("plans").insert({
        "id": 9, "name": "Team", "is_active": True,
        "daily_request_limit": 10, "monthly_request_limit": 100,
        "daily_token_limit": 1000, "monthly_token_limit": 10000,
        "price_per_month": 19, "features": ["basic_models"]
    }).execute()
    now = datetime.now(timezone.utc)
    fake_supabase.table("user_plans").insert({
        "id": 900, "user_id": 9, "plan_id": 9,
        "start_date": (now - timedelta(days=1)).isoformat(),
        "end_date": (now + timedelta(days=5)).isoformat(),
        "is_active": True
    }).execute()

    # usage: today -> 3 records (100 + 200 + 50 tokens)
    today = now.replace(hour=1, minute=0, second=0, microsecond=0)
    fake_supabase.table("usage_records").insert([
        {"user_id": 9, "timestamp": today.isoformat(), "tokens_used": 100},
        {"user_id": 9, "timestamp": (today + timedelta(hours=1)).isoformat(), "tokens_used": 200},
        {"user_id": 9, "timestamp": (today + timedelta(hours=2)).isoformat(), "tokens_used": 50},
    ]).execute()

    # earlier this month (should count toward monthly but not daily)
    earlier = now.replace(day=1, hour=2, minute=0, second=0, microsecond=0)
    fake_supabase.table("usage_records").insert([
        {"user_id": 9, "timestamp": earlier.isoformat(), "tokens_used": 300},
    ]).execute()

    out = mod.get_user_usage_within_plan_limits(9)
    assert out["usage"]["daily_requests"] == 3
    assert out["usage"]["daily_tokens"] == 350
    assert out["usage"]["monthly_requests"] == 4
    assert out["usage"]["monthly_tokens"] == 650
    # remaining
    assert out["remaining"]["daily_requests"] == 7
    assert out["remaining"]["daily_tokens"] == 650
    assert out["remaining"]["monthly_requests"] == 96
    assert out["remaining"]["monthly_tokens"] == 9350


def test_enforce_plan_limits_checks_and_env_multiplier(mod, fake_supabase):
    # Ensure database is clean (no leftover data from other tests)
    fake_supabase.store["plans"].clear()
    fake_supabase.store["user_plans"].clear()
    fake_supabase.store["usage_records"].clear()
    fake_supabase.store["users"].clear()

    # Use trial (no user plan) first: daily 100 req, 10k tokens
    out_ok = mod.enforce_plan_limits(user_id=404, tokens_requested=10, environment_tag="live")
    assert out_ok["allowed"] is True

    # Create a real plan with low limits, and record usage right at the edge
    fake_supabase.table("plans").insert({
        "id": 66, "name": "Low", "is_active": True,
        "daily_request_limit": 10, "monthly_request_limit": 50,
        "daily_token_limit": 100, "monthly_token_limit": 2000,
        "price_per_month": 1, "features": ["basic_models"]
    }).execute()
    now = datetime.now(timezone.utc)
    fake_supabase.table("user_plans").insert({
        "id": 660, "user_id": 606, "plan_id": 66,
        "start_date": (now - timedelta(days=1)).isoformat(),
        "end_date": (now + timedelta(days=10)).isoformat(),
        "is_active": True
    }).execute()

    # Current usage: 2 requests today, tokens 90 today (request limit not exceeded, token limit will be)
    today = now.replace(hour=3, minute=0, second=0, microsecond=0)
    fake_supabase.table("usage_records").insert([
        {"user_id": 606, "timestamp": today.isoformat(), "tokens_used": 40},
        {"user_id": 606, "timestamp": (today + timedelta(hours=1)).isoformat(), "tokens_used": 50},
    ]).execute()

    # test env: plan daily_token_limit is 100, multiplier 0.5 -> effective 50; we have 90 used, adding 15 would exceed
    not_ok = mod.enforce_plan_limits(606, tokens_requested=15, environment_tag="test")
    assert not_ok["allowed"] is False
    assert "Daily token limit exceeded" in not_ok["reason"]

    # test env halves limits -> 10 req/day -> effective 5; we already have 2 -> should still be OK
    # But let's add 4 more requests to hit the limit
    for i in range(4):
        fake_supabase.table("usage_records").insert({
            "user_id": 606, "timestamp": (today + timedelta(hours=2+i)).isoformat(), "tokens_used": 1
        }).execute()
    # Now we have 6 requests, test env limit is 5 (10/2), so next request should fail
    not_ok2 = mod.enforce_plan_limits(606, tokens_requested=1, environment_tag="test")
    assert not_ok2["allowed"] is False
    assert "Daily request limit exceeded" in not_ok2["reason"]


def test_get_subscription_plans_active_only(mod, fake_supabase):
    fake_supabase.table("subscription_plans").insert([
        {"id": 1, "name": "SubA", "is_active": True},
        {"id": 2, "name": "SubB", "is_active": False},
        {"id": 3, "name": "SubC", "is_active": True},
    ]).execute()
    out = mod.get_subscription_plans()
    assert [p["id"] for p in out] == [1, 3]


def test_get_all_plans_error_returns_empty(monkeypatch):
    # Force get_supabase_client to raise
    bad_supabase_mod = types.SimpleNamespace(get_supabase_client=lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    monkeypatch.setitem(sys.modules, "src.supabase_config", bad_supabase_mod)

    m = importlib.import_module(MODULE_PATH)
    importlib.reload(m)

    out = m.get_all_plans()
    assert out == []
