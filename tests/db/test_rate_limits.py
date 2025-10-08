# tests/db/test_rate_limits_store.py
import types
import copy
from datetime import datetime, timedelta, timezone

import pytest

# Module under test
import importlib
rl_mod = importlib.import_module("src.db.rate_limits")


# ----------------------------
# Simple in-memory Supabase stub
# ----------------------------
class _Result:
    def __init__(self, data):
        self.data = data

class _TableQuery:
    def __init__(self, store, name):
        self._store = store
        self._name = name
        self._filters = []      # (op, field, value)
        self._order = None      # (field, desc)
        self._limit = None
        self._select = None

    # Query builders
    def select(self, *_):
        self._select = True
        return self

    def eq(self, field, value):
        self._filters.append(("eq", field, value))
        return self

    def gte(self, field, value):
        self._filters.append(("gte", field, value))
        return self

    def lt(self, field, value):
        self._filters.append(("lt", field, value))
        return self

    def order(self, field, desc=False):
        self._order = (field, bool(desc))
        return self

    def limit(self, n):
        self._limit = int(n)
        return self

    # Mutations
    def insert(self, rows):
        if isinstance(rows, dict):
            rows = [rows]
        table = self._store.setdefault(self._name, [])
        # auto id
        for r in rows:
            r = copy.deepcopy(r)
            if "id" not in r:
                r["id"] = len(table) + 1
            table.append(r)
        self._result_data = copy.deepcopy(rows)
        return self

    def update(self, data):
        table = self._store.setdefault(self._name, [])
        matched = []
        for i, row in enumerate(table):
            if _match(row, self._filters):
                newrow = copy.deepcopy(row)
                newrow.update(copy.deepcopy(data))
                table[i] = newrow
                matched.append(newrow)
        self._result_data = copy.deepcopy(matched)
        return self

    def delete(self):
        table = self._store.setdefault(self._name, [])
        keep = []
        deleted = []
        for row in table:
            if _match(row, self._filters):
                deleted.append(row)
            else:
                keep.append(row)
        self._store[self._name] = keep
        self._result_data = copy.deepcopy(deleted)
        return self

    # Read
    def execute(self):
        # If this is a mutation result, return that data
        if hasattr(self, '_result_data'):
            return _Result(self._result_data)

        # Otherwise, execute the query
        rows = copy.deepcopy(self._store.get(self._name, []))
        # filter
        rows = [r for r in rows if _match(r, self._filters)]
        # order
        if self._order:
            key, desc = self._order
            rows.sort(key=lambda x: x.get(key), reverse=desc)
        # limit
        if self._limit is not None:
            rows = rows[: self._limit]
        return _Result(rows)

def _match(row, filters):
    for op, field, value in filters:
        v = row.get(field)
        if op == "eq":
            if v != value:
                return False
        elif op == "gte":
            if v < value:
                return False
        elif op == "lt":
            if v >= value:
                return False
    return True

class SupabaseStub:
    def __init__(self):
        self._store = {}

    def table(self, name):
        return _TableQuery(self._store, name)

# Helpers
def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# ----------------------------
# Pytest fixtures
# ----------------------------
@pytest.fixture()
def sb():
    """Fresh supabase stub for each test."""
    return SupabaseStub()

@pytest.fixture(autouse=True)
def patch_supabase(monkeypatch, sb):
    monkeypatch.setattr(rl_mod, "get_supabase_client", lambda: sb)
    yield

@pytest.fixture()
def user_api_key():
    return "gw_live_ABC123"

@pytest.fixture()
def user(monkeypatch, user_api_key):
    user_obj = {"id": 42, "api_key": user_api_key}
    monkeypatch.setattr(rl_mod, "get_user", lambda k: user_obj if k == user_api_key else None)
    return user_obj


# ----------------------------
# Tests for get/set user rate limits
# ----------------------------
def test_get_user_rate_limits_new_path(sb, user_api_key, user):
    # api_keys_new + rate_limit_configs path
    sb.table("api_keys_new").insert({"id": 10, "api_key": user_api_key, "user_id": user["id"]}).execute()
    sb.table("rate_limit_configs").insert({
        "api_key_id": 10,
        "max_requests": 1200,     # per hour
        "max_tokens": 600000,     # per hour
    }).execute()

    out = rl_mod.get_user_rate_limits(user_api_key)
    assert out["requests_per_minute"] == 1200 // 60
    assert out["requests_per_hour"] == 1200
    assert out["requests_per_day"] == 1200 * 24
    assert out["tokens_per_minute"] == 600000 // 60

def test_get_user_rate_limits_legacy_fallback(sb, user_api_key):
    sb.table("rate_limits").insert({
        "api_key": user_api_key,
        "requests_per_minute": 5,
        "requests_per_hour": 100,
        "requests_per_day": 1000,
        "tokens_per_minute": 500,
        "tokens_per_hour": 10000,
        "tokens_per_day": 20000,
    }).execute()

    out = rl_mod.get_user_rate_limits(user_api_key)
    assert out["requests_per_minute"] == 5
    assert out["tokens_per_day"] == 20000

def test_get_user_rate_limits_none_when_no_rows(sb, user_api_key):
    assert rl_mod.get_user_rate_limits(user_api_key) is None

def test_set_user_rate_limits_insert_then_update(sb, user_api_key, user):
    data = {
        "requests_per_minute": 7,
        "requests_per_hour": 100,
        "requests_per_day": 200,
        "tokens_per_minute": 50,
        "tokens_per_hour": 700,
        "tokens_per_day": 900,
    }
    # first call -> insert
    rl_mod.set_user_rate_limits(user_api_key, data)
    rows = sb.table("rate_limits").select("*").eq("api_key", user_api_key).execute().data
    assert len(rows) == 1
    assert rows[0]["requests_per_minute"] == 7

    # second call -> update (change one field)
    data2 = dict(data, requests_per_minute=9)
    rl_mod.set_user_rate_limits(user_api_key, data2)
    rows2 = sb.table("rate_limits").select("*").eq("api_key", user_api_key).execute().data
    assert len(rows2) == 1
    assert rows2[0]["requests_per_minute"] == 9


# ----------------------------
# check_rate_limit windows
# ----------------------------
def test_check_rate_limit_allowed_when_under(sb, user_api_key):
    # provide limits
    sb.table("rate_limits").insert({
        "api_key": user_api_key,
        "requests_per_minute": 2,
        "requests_per_hour": 5,
        "requests_per_day": 10,
        "tokens_per_minute": 200,
        "tokens_per_hour": 500,
        "tokens_per_day": 1000,
    }).execute()
    # no usage rows yet
    out = rl_mod.check_rate_limit(user_api_key, tokens_used=50)
    assert out["allowed"] is True

def test_check_rate_limit_blocks_on_request_minute(sb, user_api_key):
    sb.table("rate_limits").insert({
        "api_key": user_api_key,
        "requests_per_minute": 2,
        "requests_per_hour": 10,
        "requests_per_day": 100,
        "tokens_per_minute": 1000,
        "tokens_per_hour": 2000,
        "tokens_per_day": 3000,
    }).execute()

    # Seed 2 requests in current minute window so the next (implicit +1) exceeds
    now = datetime.now(timezone.utc)
    minute_start = now.replace(second=0, microsecond=0).isoformat()
    sb.table("rate_limit_usage").insert([
        {"api_key": user_api_key, "window_type": "minute", "window_start": minute_start, "requests_count": 2, "tokens_count": 0},
        {"api_key": user_api_key, "window_type": "hour",   "window_start": now.replace(minute=0, second=0, microsecond=0).isoformat(), "requests_count": 2, "tokens_count": 0},
        {"api_key": user_api_key, "window_type": "day",    "window_start": now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat(), "requests_count": 2, "tokens_count": 0},
    ]).execute()

    out = rl_mod.check_rate_limit(user_api_key, tokens_used=10)
    assert out["allowed"] is False
    assert "per minute" in out["reason"]

def test_check_rate_limit_blocks_on_tokens_minute(sb, user_api_key):
    sb.table("rate_limits").insert({
        "api_key": user_api_key,
        "requests_per_minute": 99,
        "requests_per_hour": 99,
        "requests_per_day": 999,
        "tokens_per_minute": 100,
        "tokens_per_hour": 1000,
        "tokens_per_day": 10000,
    }).execute()

    now = datetime.now(timezone.utc)
    minute_start = now.replace(second=0, microsecond=0).isoformat()
    sb.table("rate_limit_usage").insert([
        {"api_key": user_api_key, "window_type": "minute", "window_start": minute_start, "requests_count": 0, "tokens_count": 90},
        {"api_key": user_api_key, "window_type": "hour",   "window_start": now.replace(minute=0, second=0, microsecond=0).isoformat(), "requests_count": 0, "tokens_count": 90},
        {"api_key": user_api_key, "window_type": "day",    "window_start": now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat(), "requests_count": 0, "tokens_count": 90},
    ]).execute()

    out = rl_mod.check_rate_limit(user_api_key, tokens_used=20)  # 90 + 20 > 100
    assert out["allowed"] is False
    assert "Token limit exceeded" in out["reason"]


# ----------------------------
# update_rate_limit_usage creates/updates windows and bumps last_used_at
# ----------------------------
def test_update_rate_limit_usage_inserts_then_updates(sb, user_api_key, user):
    # mark as "new key" to trigger last_used_at update
    sb.table("api_keys_new").insert({"id": 10, "api_key": user_api_key, "user_id": user["id"], "last_used_at": None}).execute()

    rl_mod.update_rate_limit_usage(user_api_key, tokens_used=30)

    rows = sb.table("rate_limit_usage").select("*").eq("api_key", user_api_key).execute().data
    types_present = sorted({r["window_type"] for r in rows})
    assert types_present == ["day", "hour", "minute"]

    # Call again: should increment counts
    rl_mod.update_rate_limit_usage(user_api_key, tokens_used=20)
    rows2 = sb.table("rate_limit_usage").select("*").eq("api_key", user_api_key).execute().data
    # sum tokens must be >= 50 total across windows
    assert sum(r["tokens_count"] for r in rows2) >= 50

    # last_used_at updated
    key = sb.table("api_keys_new").select("*").eq("api_key", user_api_key).execute().data[0]
    assert key["last_used_at"] is not None


# ----------------------------
# env usage summary
# ----------------------------
def test_get_environment_usage_summary(sb, user):
    sb.table("api_keys_new").insert([
        {"user_id": user["id"], "api_key": "gw_live_a", "environment_tag": "live", "requests_used": 5, "max_requests": 100},
        {"user_id": user["id"], "api_key": "gw_live_b", "environment_tag": "live", "requests_used": 3, "max_requests": None},
        {"user_id": user["id"], "api_key": "gw_test_a", "environment_tag": "test", "requests_used": 2, "max_requests": 50},
    ]).execute()

    out = rl_mod.get_environment_usage_summary(user["id"])
    assert out["live"]["total_requests"] == 8
    assert out["live"]["key_count"] == 2
    assert out["test"]["total_max_requests"] == 50


# ----------------------------
# Advanced config CRUD helpers
# ----------------------------
def test_get_update_rate_limit_config_and_list(sb, user_api_key):
    # Initially returns default
    out_default = rl_mod.get_rate_limit_config(user_api_key)
    assert out_default["requests_per_minute"] == 60

    # Create an api_keys row and update config
    sb.table("api_keys").insert({"api_key": user_api_key, "user_id": 42, "key_name": "k1", "environment_tag": "live"}).execute()
    ok = rl_mod.update_rate_limit_config(user_api_key, {"requests_per_minute": 7})
    assert ok is True

    # Now get should return the updated
    got = rl_mod.get_rate_limit_config(user_api_key)
    assert got["requests_per_minute"] == 7

    # get_user_rate_limit_configs
    lst = rl_mod.get_user_rate_limit_configs(42)
    assert len(lst) == 1
    assert lst[0]["key_name"] == "k1"

def test_bulk_update_rate_limit_configs(sb):
    sb.table("api_keys").insert([
        {"api_key": "k1", "user_id": 99, "key_name": "a", "environment_tag": "live"},
        {"api_key": "k2", "user_id": 99, "key_name": "b", "environment_tag": "test"},
    ]).execute()
    count = rl_mod.bulk_update_rate_limit_configs(99, {"requests_per_minute": 11})
    assert count == 2
    rows = sb.table("api_keys").select("*").eq("user_id", 99).execute().data
    assert all(r.get("rate_limit_config", {}).get("requests_per_minute") == 11 for r in rows)


# ----------------------------
# Usage stats helpers
# ----------------------------
def test_get_rate_limit_usage_stats_minute(sb, user_api_key):
    now = datetime.now(timezone.utc)
    start = now.replace(second=0, microsecond=0)
    end = start + timedelta(minutes=1)

    # In-window rows
    sb.table("usage_records").insert([
        {"api_key": user_api_key, "tokens_used": 10, "created_at": start.isoformat()},
        {"api_key": user_api_key, "tokens_used": 15, "created_at": (start + timedelta(seconds=10)).isoformat()},
    ]).execute()
    # Out of window
    sb.table("usage_records").insert({"api_key": user_api_key, "tokens_used": 999, "created_at": (end + timedelta(seconds=1)).isoformat()}).execute()

    out = rl_mod.get_rate_limit_usage_stats(user_api_key, "minute")
    assert out["total_requests"] == 2
    assert out["total_tokens"] == 25

def test_get_system_rate_limit_stats(sb):
    now = datetime.now(timezone.utc)
    sb.table("usage_records").insert([
        {"api_key": "a", "tokens_used": 5, "created_at": (now - timedelta(seconds=10)).isoformat()},
        {"api_key": "b", "tokens_used": 15, "created_at": (now - timedelta(minutes=10)).isoformat()},
        {"api_key": "a", "tokens_used": 20, "created_at": (now - timedelta(hours=10)).isoformat()},
    ]).execute()
    out = rl_mod.get_system_rate_limit_stats()
    assert out["minute"]["requests"] >= 1
    assert out["hour"]["requests"] >= 2
    assert out["day"]["requests"] >= 3
    assert out["minute"]["active_keys"] >= 1


# ----------------------------
# Alerts
# ----------------------------
def test_create_and_get_rate_limit_alerts(sb, user_api_key):
    # Ensure alerts table exists
    # The function probes it with a select, so keep it present
    sb.table("rate_limit_alerts").insert([]).execute()

    ok = rl_mod.create_rate_limit_alert(user_api_key, "rate_limit_exceeded", {"foo": "bar"})
    assert ok is True

    alerts = rl_mod.get_rate_limit_alerts(api_key=user_api_key, resolved=False, limit=10)
    assert len(alerts) == 1
    assert alerts[0]["alert_type"] == "rate_limit_exceeded"
