# tests/services/test_trial_validation.py
import importlib
import math
import pytest

MODULE_PATH = "src.services.trial_validation"  # <- change if your module path differs


@pytest.fixture
def mod():
    return importlib.import_module(MODULE_PATH)


# ----------------- minimal fake Supabase client -----------------
class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, rows_by_key):
        # rows_by_key: dict[api_key] -> row dict
        self._rows = rows_by_key
        self._api_key = None
        self._update_values = None
        self._select_fields = None

    # select is ignored (we return whole rows), but we record that it was called
    def select(self, fields):
        self._select_fields = fields
        return self

    def update(self, values):
        self._update_values = values
        return self

    def eq(self, column, value):
        assert column == "api_key"
        self._api_key = value
        return self

    def execute(self):
        if self._update_values is None:
            # SELECT path
            row = self._rows.get(self._api_key)
            return _FakeResult([row] if row is not None else [])
        else:
            # UPDATE path
            row = self._rows.get(self._api_key)
            if row is None:
                return _FakeResult([])
            row.update(self._update_values)
            return _FakeResult([row])


class _FakeSupabase:
    def __init__(self, rows_by_key):
        self._rows = rows_by_key
        self._legacy_rows = {}  # For legacy users table

    def table(self, name):
        if name == "api_keys_new":
            return _FakeTable(self._rows)
        elif name == "users":
            return _FakeTable(self._legacy_rows)
        else:
            raise ValueError(f"Unexpected table: {name}")


# ----------------------------- tests: validate_trial_access -----------------------------

def test_validate_missing_key_returns_not_found(monkeypatch, mod):
    client = _FakeSupabase(rows_by_key={})
    monkeypatch.setattr(mod, "get_supabase_client", lambda: client)

    out = mod.validate_trial_access("sk-nope")
    assert out["is_valid"] is False
    assert out["is_trial"] is False
    assert "not found" in out["error"].lower()


def test_validate_non_trial_key(monkeypatch, mod):
    rows = {
        "sk-live": {"api_key": "sk-live", "is_trial": False}
    }
    monkeypatch.setattr(mod, "get_supabase_client", lambda: _FakeSupabase(rows))

    out = mod.validate_trial_access("sk-live")
    assert out["is_valid"] is True
    assert out["is_trial"] is False
    assert "full access" in out.get("message", "").lower()


def test_validate_expired_iso_z_marked_expired(monkeypatch, mod):
    # Past ISO date with Z should be expired, but current code makes trial_end naive and 'now' aware,
    # leading to a comparison TypeError and falling back to 'not expired'.
    rows = {
        "sk-trial-expired": {
            "api_key": "sk-trial-expired",
            "is_trial": True,
            "trial_end_date": "2000-01-01T00:00:00Z",
            "trial_used_tokens": 0,
            "trial_used_requests": 0,
            "trial_used_credits": 0.0,
            "trial_max_tokens": 100,
            "trial_max_requests": 10,
            "trial_credits": 1.0,
        }
    }
    monkeypatch.setattr(mod, "get_supabase_client", lambda: _FakeSupabase(rows))

    out = mod.validate_trial_access("sk-trial-expired")
    assert out["is_valid"] is False
    assert out["is_trial"] is True
    assert out["is_expired"] is True
    assert "expired" in out["error"].lower()

def test_validate_tokens_cap_exceeded(monkeypatch, mod):
    rows = {
        "sk-trial-tokens": {
            "api_key": "sk-trial-tokens",
            "is_trial": True,
            "trial_used_tokens": 1000,
            "trial_max_tokens": 1000,
            "trial_used_requests": 3,
            "trial_max_requests": 10,
            "trial_used_credits": 0.5,
            "trial_credits": 1.0,
        }
    }
    monkeypatch.setattr(mod, "get_supabase_client", lambda: _FakeSupabase(rows))

    out = mod.validate_trial_access("sk-trial-tokens")
    assert out["is_valid"] is False
    assert out["is_trial"] is True
    assert "token limit" in out["error"].lower()
    assert out["remaining_tokens"] == 0
    assert out["remaining_requests"] == 7
    assert math.isclose(out["remaining_credits"], 0.5)


def test_validate_requests_cap_exceeded(monkeypatch, mod):
    rows = {
        "sk-trial-reqs": {
            "api_key": "sk-trial-reqs",
            "is_trial": True,
            "trial_used_tokens": 100,
            "trial_max_tokens": 1000,
            "trial_used_requests": 10,
            "trial_max_requests": 10,
            "trial_used_credits": 0.2,
            "trial_credits": 1.0,
        }
    }
    monkeypatch.setattr(mod, "get_supabase_client", lambda: _FakeSupabase(rows))

    out = mod.validate_trial_access("sk-trial-reqs")
    assert out["is_valid"] is False
    assert out["is_trial"] is True
    assert "request limit" in out["error"].lower()
    assert out["remaining_requests"] == 0
    assert out["remaining_tokens"] == 900
    assert math.isclose(out["remaining_credits"], 0.8)


def test_validate_credits_cap_exceeded(monkeypatch, mod):
    rows = {
        "sk-trial-credits": {
            "api_key": "sk-trial-credits",
            "is_trial": True,
            "trial_used_tokens": 100,
            "trial_max_tokens": 1000,
            "trial_used_requests": 1,
            "trial_max_requests": 10,
            "trial_used_credits": 1.0,
            "trial_credits": 1.0,
        }
    }
    monkeypatch.setattr(mod, "get_supabase_client", lambda: _FakeSupabase(rows))

    out = mod.validate_trial_access("sk-trial-credits")
    assert out["is_valid"] is False
    assert out["is_trial"] is True
    assert "credit limit" in out["error"].lower()
    assert out["remaining_tokens"] == 900
    assert out["remaining_requests"] == 9
    assert out["remaining_credits"] == 0


def test_validate_valid_trial(monkeypatch, mod):
    rows = {
        "sk-trial-ok": {
            "api_key": "sk-trial-ok",
            "is_trial": True,
            "trial_used_tokens": 100,
            "trial_max_tokens": 1000,
            "trial_used_requests": 3,
            "trial_max_requests": 10,
            "trial_used_credits": 0.4,
            "trial_credits": 1.0,
            "trial_end_date": "2100-12-31",  # future
        }
    }
    monkeypatch.setattr(mod, "get_supabase_client", lambda: _FakeSupabase(rows))

    out = mod.validate_trial_access("sk-trial-ok")
    assert out["is_valid"] is True
    assert out["is_trial"] is True
    assert out["is_expired"] is False
    assert out["remaining_tokens"] == 900
    assert out["remaining_requests"] == 7
    assert math.isclose(out["remaining_credits"], 0.6)
    assert out["trial_end_date"] == "2100-12-31"


def test_validate_handles_exception(monkeypatch, mod):
    def boom():
        raise RuntimeError("supabase down")
    monkeypatch.setattr(mod, "get_supabase_client", boom)

    out = mod.validate_trial_access("sk-any")
    assert out["is_valid"] is False
    assert out["is_trial"] is False
    assert "validation error" in out["error"].lower()


# ----------------------------- tests: track_trial_usage -----------------------------

def test_track_usage_success_updates(monkeypatch, mod):
    rows = {
        "sk-trial": {
            "api_key": "sk-trial",
            "trial_used_tokens": 10,
            "trial_used_requests": 1,
            "trial_used_credits": 0.0002,
        }
    }
    client = _FakeSupabase(rows)
    monkeypatch.setattr(mod, "get_supabase_client", lambda: client)

    ok = mod.track_trial_usage("sk-trial", tokens_used=100, requests_used=2)
    assert ok is True

    # Credits: 100 * 0.00002 = 0.002
    updated = rows["sk-trial"]
    assert updated["trial_used_tokens"] == 10 + 100
    assert updated["trial_used_requests"] == 1 + 2
    assert math.isclose(updated["trial_used_credits"], 0.0002 + 0.002, rel_tol=1e-9)


def test_track_usage_key_not_found(monkeypatch, mod):
    client = _FakeSupabase(rows_by_key={})
    monkeypatch.setattr(mod, "get_supabase_client", lambda: client)

    ok = mod.track_trial_usage("sk-missing", tokens_used=50, requests_used=1)
    assert ok is False


def test_track_usage_handles_exception(monkeypatch, mod):
    def boom():
        raise RuntimeError("supabase down")
    monkeypatch.setattr(mod, "get_supabase_client", boom)

    ok = mod.track_trial_usage("sk-any", tokens_used=10, requests_used=1)
    assert ok is False
