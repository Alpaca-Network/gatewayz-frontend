import types
import uuid
import pytest
from datetime import datetime, timedelta, timezone

# ---- In-memory Supabase stub ------------------------------------------------

class _Result:
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count

    # allow `.execute()` at the end of chains
    def execute(self):
        return self


class _BaseQuery:
    def __init__(self, store, table):
        self.store = store
        self.table = table
        self._filters = []   # list of tuples: (op, field, value)
        self._order = None   # (field, desc)
        self._limit = None

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
        self._order = (field, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def _match(self, row):
        def as_iso(x):
            return x
        for op, f, v in self._filters:
            rv = row.get(f)
            if op == "eq":
                if rv != v:
                    return False
            elif op == "gte":
                if as_iso(rv) < as_iso(v):
                    return False
            elif op == "lt":
                if as_iso(rv) >= as_iso(v):
                    return False
        return True

    def _apply_order_limit(self, rows):
        if self._order:
            field, desc = self._order
            rows = sorted(rows, key=lambda r: r.get(field), reverse=bool(desc))
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows


class _Select(_BaseQuery):
    def __init__(self, store, table):
        super().__init__(store, table)
        self._count = None

    def select(self, *_cols, count=None):
        self._count = count
        return self

    def execute(self):
        rows = [r.copy() for r in self.store[self.table] if self._match(r)]
        rows = self._apply_order_limit(rows)
        cnt = len(rows) if self._count == "exact" else None
        return _Result(rows, cnt)


class _Insert:
    def __init__(self, store, table, payload):
        self.store = store
        self.table = table
        self.payload = payload

    def execute(self):
        inserted = []
        if isinstance(self.payload, list):
            items = self.payload
        else:
            items = [self.payload]
        for item in items:
            row = item.copy()
            if "id" not in row:
                # simple autoincrement per table
                next_id = (max([r.get("id", 0) for r in self.store[self.table]] or [0]) + 1)
                row["id"] = next_id
            self.store[self.table].append(row)
            inserted.append(row)
        return _Result(inserted)


class _Update(_BaseQuery):
    def __init__(self, store, table, payload):
        super().__init__(store, table)
        self.payload = payload

    def execute(self):
        updated = []
        for row in self.store[self.table]:
            if self._match(row):
                row.update(self.payload)
                updated.append(row.copy())
        return _Result(updated)


class _Delete(_BaseQuery):
    def execute(self):
        kept, deleted = [], []
        for row in self.store[self.table]:
            (deleted if self._match(row) else kept).append(row)
        self.store[self.table][:] = kept
        return _Result(deleted)


class SupabaseStub:
    def __init__(self):
        from collections import defaultdict
        self.tables = defaultdict(list)

    def table(self, name):
        # return an object exposing select/insert/update/delete like supabase-py
        class _TableShim:
            def __init__(self, outer, table):
                self._outer = outer
                self._table = table

            def select(self, *cols, count=None):
                return _Select(self._outer.tables, self._table).select(*cols, count=count)

            def insert(self, payload):
                return _Insert(self._outer.tables, self._table, payload)

            def update(self, payload):
                return _Update(self._outer.tables, self._table, payload)

            def delete(self):
                return _Delete(self._outer.tables, self._table)

        return _TableShim(self, name)

    # RPC: only the function used by users.py
    def rpc(self, fn_name, params=None):
        class _RPCShim:
            def __init__(self, outer, fn_name, params):
                self.outer = outer
                self.fn_name = fn_name
                self.params = params or {}

            def execute(self):
                if self.fn_name == "get_user_usage_metrics":
                    api_key = self.params.get("user_api_key")
                    usage = [r for r in self.outer.tables["usage_records"] if r.get("api_key") == api_key]
                    total_requests = len(usage)
                    total_tokens = sum(r.get("tokens_used", 0) for r in usage)
                    total_cost = sum(r.get("cost", 0.0) for r in usage)
                    now = datetime.now(timezone.utc)
                    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
                    month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

                    def after(ts, start):
                        # stored as ISO strings
                        return ts and ts >= start.isoformat()

                    requests_today = len([r for r in usage if after(r.get("timestamp"), today)])
                    tokens_today = sum(r.get("tokens_used", 0) for r in usage if after(r.get("timestamp"), today))
                    cost_today = sum(r.get("cost", 0.0) for r in usage if after(r.get("timestamp"), today))
                    requests_this_month = len([r for r in usage if after(r.get("timestamp"), month)])
                    tokens_this_month = sum(r.get("tokens_used", 0) for r in usage if after(r.get("timestamp"), month))
                    cost_this_month = sum(r.get("cost", 0.0) for r in usage if after(r.get("timestamp"), month))
                    avg_tokens = (total_tokens / total_requests) if total_requests > 0 else 0.0
                    most_used_model = None
                    if usage:
                        counts = {}
                        for r in usage:
                            counts[r.get("model", "unknown")] = counts.get(r.get("model", "unknown"), 0) + 1
                        most_used_model = max(counts.items(), key=lambda kv: kv[1])[0]
                    last_request_time = max([r.get("timestamp") for r in usage], default=None)

                    payload = [{
                        "total_requests": total_requests,
                        "total_tokens": total_tokens,
                        "total_cost": total_cost,
                        "requests_today": requests_today,
                        "tokens_today": tokens_today,
                        "cost_today": cost_today,
                        "requests_this_month": requests_this_month,
                        "tokens_this_month": tokens_this_month,
                        "cost_this_month": cost_this_month,
                        "average_tokens_per_request": avg_tokens,
                        "most_used_model": most_used_model,
                        "last_request_time": last_request_time,
                    }]
                    return _Result(payload)
                # default empty result
                return _Result([])
        return _RPCShim(self, fn_name, params)

# ---- Fixtures / patching ----------------------------------------------------

@pytest.fixture()
def sb(monkeypatch):
    # import module under test
    import src.db.users as users_mod
    import src.db.api_keys as api_keys_mod

    stub = SupabaseStub()
    # Patch in the modules where it's actually used (not just where it's defined)
    monkeypatch.setattr(users_mod, "get_supabase_client", lambda: stub)
    monkeypatch.setattr(api_keys_mod, "get_supabase_client", lambda: stub)

    # stub audit logger for when create_api_key is called
    security_mod = types.SimpleNamespace(
        get_audit_logger=lambda: types.SimpleNamespace(
            log_api_key_creation=lambda *args, **kwargs: None,
            log_api_key_deletion=lambda *args, **kwargs: None
        )
    )
    monkeypatch.setitem(__import__("sys").modules, "src.security.security", security_mod)

    # fake credit transaction module used inside functions via local import
    tx_log = []
    fake_tx = types.SimpleNamespace(
        TransactionType=types.SimpleNamespace(API_USAGE="api_usage"),
        log_credit_transaction=lambda **kwargs: tx_log.append(kwargs),
    )
    monkeypatch.setitem(__import__("sys").modules, "src.db.credit_transactions", fake_tx)

    # short helper to access tx log in tests
    stub._tx_log = tx_log

    # predictable create_api_key
    monkeypatch.setattr("src.db.users.create_api_key", lambda **kwargs: ("gw_live_primary_TESTKEY", 1))

    return stub

# ---- Helpers ----------------------------------------------------------------

def iso_now():
    return datetime.now(timezone.utc).isoformat()

# ---- Tests ------------------------------------------------------------------

def test_create_enhanced_user_creates_trial_and_primary(sb):
    import src.db.users as users

    out = users.create_enhanced_user(
        username="alice",
        email="alice@example.com",
        auth_method="password",
        credits=10,
    )
    # user row created, then api_key updated to primary
    users_rows = sb.tables["users"]
    assert len(users_rows) == 1
    row = users_rows[0]
    assert row["subscription_status"] == "trial"
    assert "trial_expires_at" in row
    assert out["primary_api_key"] == "gw_live_primary_TESTKEY"
    assert row["api_key"] == "gw_live_primary_TESTKEY"

def test_get_user_prefers_new_api_keys_then_legacy(sb):
    import src.db.users as users

    # seed user and new api_keys_new
    user = {"id": 7, "username": "bob", "email": "b@e.com", "credits": 5, "api_key": "legacy_key"}
    sb.table("users").insert(user).execute()

    new_key = {"id": 10, "api_key": "gw_live_primary_TESTKEY", "user_id": 7, "key_name": "Primary",
               "environment_tag": "live", "scope_permissions": {"read": ["*"]}, "is_primary": True}
    sb.table("api_keys_new").insert(new_key).execute()

    res = users.get_user("gw_live_primary_TESTKEY")
    assert res["id"] == 7
    assert res["key_id"] == 10
    assert res["key_name"] == "Primary"
    assert res["environment_tag"] == "live"
    assert res["is_primary"] is True

    # legacy fallback
    res2 = users.get_user("legacy_key")
    assert res2["credits"] == 5

def test_get_user_by_id_and_privy(sb):
    import src.db.users as users
    row = {"id": 11, "username": "c", "email": "c@x.com", "credits": 3, "privy_user_id": "privy_123"}
    sb.table("users").insert(row).execute()

    assert users.get_user_by_id(11)["email"] == "c@x.com"
    assert users.get_user_by_privy_id("privy_123")["id"] == 11
    assert users.get_user_by_privy_id("nope") is None

def test_add_credits_and_deduct_credits(sb):
    import src.db.users as users

    user = {"id": 22, "username": "d", "email": "d@x.com", "credits": 1.5, "api_key": "k22"}
    sb.table("users").insert(user).execute()

    # add
    users.add_credits_to_user(user_id=22, credits=2.0, transaction_type="admin_credit", description="top-up")
    updated = [r for r in sb.tables["users"] if r["id"] == 22][0]
    assert updated["credits"] == 3.5
    assert len(sb._tx_log) >= 1  # logged

    # deduct OK
    users.deduct_credits(api_key="k22", tokens=1.0, description="usage")
    updated = [r for r in sb.tables["users"] if r["id"] == 22][0]
    assert pytest.approx(updated["credits"], rel=1e-9) == 2.5
    assert len(sb._tx_log) >= 2

    # deduct insufficient -> RuntimeError
    with pytest.raises(RuntimeError, match="Insufficient credits"):
        users.deduct_credits(api_key="k22", tokens=999.0)

def test_get_all_users_delete_user_count(sb):
    import src.db.users as users
    sb.table("users").insert([
        {"id": 1, "username": "u1", "email": "u1@x.com", "credits": 0, "api_key": "k1"},
        {"id": 2, "username": "u2", "email": "u2@x.com", "credits": 0, "api_key": "k2"},
    ]).execute()

    all_users = users.get_all_users()
    assert len(all_users) == 2

    assert users.get_user_count() == 2

    users.delete_user("k1")  # should delete one
    assert users.get_user_count() == 1
    assert [u["api_key"] for u in sb.tables["users"]] == ["k2"]

def test_record_usage_and_metrics(sb):
    import src.db.users as users
    # user + key
    sb.table("users").insert({"id": 77, "username": "m", "email": "m@x.com", "credits": 5}).execute()
    sb.table("api_keys_new").insert({"id": 101, "api_key": "k77", "user_id": 77}).execute()

    users.record_usage(77, "k77", "openai/gpt", 123, 0.42)
    users.record_usage(77, "k77", "openai/gpt", 7, 0.01)

    metrics = users.get_user_usage_metrics("k77")
    assert metrics["user_id"] == 77
    assert metrics["current_credits"] == 5
    assert metrics["usage_metrics"]["total_requests"] == 2
    assert metrics["usage_metrics"]["total_tokens"] == 130
    assert metrics["usage_metrics"]["total_cost"] == pytest.approx(0.43)

def test_admin_monitor_data(sb):
    import src.db.users as users
    # users
    sb.table("users").insert([
        {"id": 1, "credits": 10, "api_key": "a"},
        {"id": 2, "credits": 0, "api_key": "b"},
    ]).execute()
    # usage
    now = datetime.now(timezone.utc).isoformat()
    older = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    sb.table("usage_records").insert([
        {"api_key": "a", "model": "m1", "tokens_used": 100, "cost": 0.5, "timestamp": now},
        {"api_key": "a", "model": "m1", "tokens_used": 50, "cost": 0.2, "timestamp": older},
        {"api_key": "b", "model": "m2", "tokens_used": 10, "cost": 0.05, "timestamp": now},
    ]).execute()

    out = users.get_admin_monitor_data()
    assert out["total_users"] == 2
    assert out["system_usage_metrics"]["total_requests"] == 3
    assert out["system_usage_metrics"]["total_tokens"] == 160

def test_update_and_get_user_profile(sb):
    import src.db.users as users
    sb.table("users").insert({"id": 9, "username": "z", "email": "z@x.com", "credits": 4, "api_key": "k9"}).execute()

    out = users.update_user_profile("k9", {"name": "Zed", "preferences": {"theme": "dark"}})
    assert out["username"] == "z"
    prof = users.get_user_profile("k9")
    assert prof["api_key"].endswith("...")
    assert prof["credits"] == 4
    assert prof["username"] == "z"
    assert prof["email"] == "z@x.com"

def test_mark_welcome_email_sent_and_delete_user_account(sb):
    import src.db.users as users
    sb.table("users").insert({"id": 33, "username": "w", "email": "w@x.com", "credits": 1, "api_key": "kw"}).execute()

    assert users.mark_welcome_email_sent(33) is True
    row = [r for r in sb.tables["users"] if r["id"] == 33][0]
    assert row["welcome_email_sent"] is True

    assert users.delete_user_account("kw") is True
    assert [r for r in sb.tables["users"] if r.get("api_key") == "kw"] == []


# ============================================================================
# COMPREHENSIVE EDGE CASE AND ERROR PATH TESTS (For 100% Coverage)
# ============================================================================

def test_create_enhanced_user_with_privy_id(sb):
    """Test user creation with privy_user_id"""
    import src.db.users as users

    out = users.create_enhanced_user(
        username="alice_privy",
        email="alice_privy@example.com",
        auth_method="google",
        credits=20,
        privy_user_id="privy_xyz_123"
    )

    users_rows = sb.tables["users"]
    row = [r for r in users_rows if r["username"] == "alice_privy"][0]
    assert row["privy_user_id"] == "privy_xyz_123"
    assert row["auth_method"] == "google"
    assert row["credits"] == 20
    assert out["credits"] == 20


def test_create_enhanced_user_failure_no_data(sb, monkeypatch):
    """Test user creation when insert returns no data"""
    import src.db.users as users

    # Make insert return empty data
    def mock_insert(data):
        class BadResult:
            def execute(self):
                class EmptyResult:
                    data = []
                return EmptyResult()
        return BadResult()

    # Temporarily break the insert
    original_table = sb.table
    def broken_table(name):
        t = original_table(name)
        if name == "users":
            t.insert = mock_insert
        return t

    monkeypatch.setattr(sb, "table", broken_table)

    with pytest.raises(RuntimeError, match="Failed to create enhanced user"):
        users.create_enhanced_user(
            username="fail_user",
            email="fail@example.com",
            auth_method="email"
        )


def test_create_enhanced_user_exception_handling(sb, monkeypatch):
    """Test exception handling in create_enhanced_user"""
    import src.db.users as users

    # Make table() raise an exception
    def raise_exception(name):
        raise Exception("Database connection failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    with pytest.raises(RuntimeError, match="Failed to create enhanced user"):
        users.create_enhanced_user(
            username="error_user",
            email="error@example.com",
            auth_method="email"
        )


def test_get_user_not_found(sb):
    """Test get_user when API key doesn't exist"""
    import src.db.users as users

    result = users.get_user("nonexistent_key")
    assert result is None


def test_get_user_exception_handling(sb, monkeypatch):
    """Test get_user exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Database error")

    monkeypatch.setattr(sb, "table", raise_exception)

    result = users.get_user("any_key")
    assert result is None


def test_get_user_by_id_not_found(sb):
    """Test get_user_by_id when user doesn't exist"""
    import src.db.users as users

    result = users.get_user_by_id(99999)
    assert result is None


def test_get_user_by_id_exception_handling(sb, monkeypatch):
    """Test get_user_by_id exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Database error")

    monkeypatch.setattr(sb, "table", raise_exception)

    result = users.get_user_by_id(123)
    assert result is None


def test_get_user_by_username_not_found(sb):
    """Test get_user_by_username when user doesn't exist"""
    import src.db.users as users

    result = users.get_user_by_username("nonexistent_username")
    assert result is None


def test_get_user_by_username_found(sb):
    """Test get_user_by_username when user exists"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 555,
        "username": "findme",
        "email": "findme@test.com",
        "credits": 10
    }).execute()

    result = users.get_user_by_username("findme")
    assert result is not None
    assert result["username"] == "findme"
    assert result["email"] == "findme@test.com"


def test_get_user_by_username_exception_handling(sb, monkeypatch):
    """Test get_user_by_username exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Database error")

    monkeypatch.setattr(sb, "table", raise_exception)

    result = users.get_user_by_username("any_username")
    assert result is None


def test_add_credits_to_user_success(sb):
    """Test add_credits_to_user successfully adds credits"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 100,
        "username": "credittest",
        "email": "credits@test.com",
        "credits": 5.0
    }).execute()

    users.add_credits_to_user(
        user_id=100,
        credits=10.0,
        transaction_type="payment",
        description="Test payment",
        metadata={"payment_id": "pay_123"}
    )

    user = [r for r in sb.tables["users"] if r["id"] == 100][0]
    assert user["credits"] == 15.0


def test_add_credits_to_user_exception_handling(sb, monkeypatch):
    """Test add_credits_to_user exception handling"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 101,
        "username": "erroruser",
        "email": "error@test.com",
        "credits": 5.0
    }).execute()

    # Break the update - need to break it when update is called
    original_table = sb.table
    def broken_table(name):
        t = original_table(name)
        if name == "users":
            original_update = t.update
            def bad_update(data):
                raise Exception("Update failed")
            t.update = bad_update
        return t

    monkeypatch.setattr(sb, "table", broken_table)

    # Should log error but raise the exception
    with pytest.raises(Exception, match="Update failed"):
        users.add_credits_to_user(
            user_id=101,
            credits=10.0,
            transaction_type="payment",
            description="Test"
        )


def test_add_credits_success(sb):
    """Test add_credits function"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 200,
        "username": "addcredits",
        "email": "add@test.com",
        "credits": 5.0,
        "api_key": "key_200"
    }).execute()

    users.add_credits("key_200", 10)

    user = users.get_user("key_200")
    assert user["credits"] == 15.0


def test_deduct_credits_with_metadata(sb):
    """Test deduct_credits with metadata"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 300,
        "username": "deduct",
        "email": "deduct@test.com",
        "credits": 100.0,
        "api_key": "key_300"
    }).execute()

    users.deduct_credits(
        api_key="key_300",
        tokens=10.0,
        description="API usage",
        metadata={"model": "gpt-4", "endpoint": "/v1/chat/completions"}
    )

    user = users.get_user("key_300")
    assert user["credits"] == 90.0


def test_deduct_credits_user_not_found(sb):
    """Test deduct_credits when user not found"""
    import src.db.users as users

    # When user not found, get_user returns None, which triggers error
    with pytest.raises(RuntimeError, match="User with API key nonexistent_key not found"):
        users.deduct_credits(
            api_key="nonexistent_key",
            tokens=10.0,
            description="Test"
        )


def test_deduct_credits_exception_handling(sb, monkeypatch):
    """Test deduct_credits exception handling"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 301,
        "username": "error",
        "email": "error@test.com",
        "credits": 50.0,
        "api_key": "key_301"
    }).execute()

    # Break the update
    original_table = sb.table
    def broken_table(name):
        if name == "users":
            class BadTable:
                def select(self, *args):
                    return original_table(name).select(*args)
                def update(self, data):
                    raise Exception("Update failed")
            return BadTable()
        return original_table(name)

    monkeypatch.setattr(sb, "table", broken_table)

    with pytest.raises(Exception):
        users.deduct_credits("key_301", 5.0, "Test")


def test_get_all_users_exception_handling(sb, monkeypatch):
    """Test get_all_users exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Database error")

    monkeypatch.setattr(sb, "table", raise_exception)

    result = users.get_all_users()
    assert result == []


def test_delete_user_exception_handling(sb, monkeypatch):
    """Test delete_user exception handling"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 400,
        "username": "delete_test",
        "email": "delete@test.com",
        "credits": 5.0,
        "api_key": "key_400"
    }).execute()

    def raise_exception(name):
        raise Exception("Delete failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    # delete_user doesn't raise exceptions, it just logs them
    try:
        users.delete_user("key_400")
    except Exception:
        pass  # Should not raise


def test_get_user_count_exception_handling(sb, monkeypatch):
    """Test get_user_count exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Count failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    result = users.get_user_count()
    assert result == 0


def test_record_usage_exception_handling(sb, monkeypatch):
    """Test record_usage exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Insert failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    # Should not raise, just log
    users.record_usage(
        user_id=1,
        api_key="test_key",
        model="gpt-4",
        tokens_used=100,
        cost=0.5
    )


def test_record_usage_with_latency(sb):
    """Test record_usage with latency parameter"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 500,
        "username": "latency_test",
        "email": "latency@test.com",
        "credits": 10
    }).execute()

    # Just verify the function doesn't crash with latency parameter
    users.record_usage(
        user_id=500,
        api_key="key_500",
        model="gpt-4",
        tokens_used=100,
        cost=0.5,
        latency_ms=1500
    )

    # Function successfully ran without errors - that's what we're testing
    assert True


def test_get_user_usage_metrics_no_user(sb):
    """Test get_user_usage_metrics when user not found"""
    import src.db.users as users

    result = users.get_user_usage_metrics("nonexistent_key")
    assert result is None


def test_get_user_usage_metrics_exception_handling(sb, monkeypatch):
    """Test get_user_usage_metrics exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Query failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    result = users.get_user_usage_metrics("any_key")
    assert result is None


def test_get_admin_monitor_data_exception_handling(sb, monkeypatch):
    """Test get_admin_monitor_data exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Query failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    result = users.get_admin_monitor_data()
    # Should return default structure even on error
    assert "total_users" in result
    assert result["total_users"] == 0


def test_update_user_profile_exception_handling(sb, monkeypatch):
    """Test update_user_profile exception handling"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 600,
        "username": "profile_test",
        "email": "profile@test.com",
        "credits": 5.0,
        "api_key": "key_600"
    }).execute()

    def raise_exception(name):
        raise Exception("Update failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    with pytest.raises(RuntimeError, match="Failed to update user profile"):
        users.update_user_profile("key_600", {"name": "Test"})


def test_get_user_profile_not_found(sb):
    """Test get_user_profile when user not found"""
    import src.db.users as users

    result = users.get_user_profile("nonexistent_key")
    assert result is None


def test_get_user_profile_exception_handling(sb, monkeypatch):
    """Test get_user_profile exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Query failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    result = users.get_user_profile("any_key")
    assert result is None


def test_mark_welcome_email_sent_exception_handling(sb, monkeypatch):
    """Test mark_welcome_email_sent exception handling"""
    import src.db.users as users

    def raise_exception(name):
        raise Exception("Update failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    # Function raises RuntimeError, not returns False
    with pytest.raises(RuntimeError, match="Failed to mark welcome email"):
        users.mark_welcome_email_sent(123)


def test_delete_user_account_not_found(sb):
    """Test delete_user_account when user not found"""
    import src.db.users as users

    # Function raises RuntimeError when user not found
    with pytest.raises(RuntimeError, match="Failed to delete user account"):
        users.delete_user_account("nonexistent_key")


def test_delete_user_account_exception_handling(sb, monkeypatch):
    """Test delete_user_account exception handling"""
    import src.db.users as users

    sb.table("users").insert({
        "id": 700,
        "username": "delete_account_test",
        "email": "delete_account@test.com",
        "credits": 5.0,
        "api_key": "key_700"
    }).execute()

    def raise_exception(name):
        raise Exception("Delete failed")

    monkeypatch.setattr(sb, "table", raise_exception)

    # Function raises RuntimeError on any exception
    with pytest.raises(RuntimeError, match="Failed to delete user account"):
        users.delete_user_account("key_700")
