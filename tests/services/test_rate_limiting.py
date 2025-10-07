# tests/services/test_rate_limiting_adv.py
import time
import importlib
import pytest
from dataclasses import asdict

MODULE_PATH = "src.services.rate_limiting"  # change if your file is elsewhere


@pytest.fixture
def mod():
    m = importlib.import_module(MODULE_PATH)
    # ensure clean singletons / caches across tests
    if hasattr(m.get_rate_limiter, "cache_clear"):
        m.get_rate_limiter.cache_clear()
    if hasattr(m.get_rate_limit_manager, "cache_clear"):
        m.get_rate_limit_manager.cache_clear()
    if hasattr(m, "_rate_limiter"):
        m._rate_limiter = None
    if hasattr(m, "_rate_limit_manager"):
        m._rate_limit_manager = None
    return m


# --------- Fake fallback rate limiting service ---------
class _FallbackResult:
    def __init__(self, allowed=True, remaining_requests=59, remaining_tokens=9990,
                 reset_time=None, retry_after=None, reason=None):
        self.allowed = allowed
        self.remaining_requests = remaining_requests
        self.remaining_tokens = remaining_tokens
        # router expects epoch seconds or None
        self.reset_time = int(time.time()) + 60 if reset_time is None else reset_time
        self.retry_after = retry_after
        self.reason = reason


class _FakeFallback:
    def __init__(self):
        self.calls = []
        self.next_result = _FallbackResult()

    async def check_rate_limit(self, api_key, config, tokens_used=0):
        # record minimal info
        self.calls.append(("check", api_key, tokens_used, asdict(config)))
        return self.next_result

    async def increment_request(self, api_key, config, tokens_used=0):
        self.calls.append(("incr", api_key, tokens_used, asdict(config)))

    async def get_rate_limit_status(self, api_key, config):
        self.calls.append(("status", api_key, 0, asdict(config)))
        return {
            "requests_remaining": config.requests_per_minute,
            "tokens_remaining": config.tokens_per_minute,
            "reset_time": int(time.time()) + 60,
        }


@pytest.fixture
def fake_fallback(monkeypatch, mod):
    fb = _FakeFallback()
    # SlidingWindowRateLimiter and RateLimitManager both call this at __init__
    monkeypatch.setattr(mod, "get_fallback_rate_limit_manager", lambda: fb)
    return fb


# -------------------- SlidingWindowRateLimiter happy path --------------------

@pytest.mark.anyio
async def test_check_rate_limit_happy_path_local(monkeypatch, mod, fake_fallback):
    limiter = mod.SlidingWindowRateLimiter(redis_client=None)
    cfg = mod.RateLimitConfig(  # generous limits so only fallback is consulted
        requests_per_minute=60, tokens_per_minute=10000, burst_limit=50, concurrency_limit=10
    )

    res = await limiter.check_rate_limit("keyA", cfg, tokens_used=25)

    assert res.allowed is True
    assert fake_fallback.calls and fake_fallback.calls[0][0] == "check"
    assert fake_fallback.calls[0][1] == "keyA"
    assert fake_fallback.calls[0][2] == 25
    assert res.retry_after is None or isinstance(res.retry_after, int)


# -------------------- Concurrency limit --------------------

@pytest.mark.anyio
async def test_concurrency_limit_exceeded(mod, fake_fallback):
    limiter = mod.SlidingWindowRateLimiter(redis_client=None)
    cfg = mod.RateLimitConfig(concurrency_limit=1, burst_limit=50, requests_per_minute=60, tokens_per_minute=10000)

    # Simulate 1 in-flight request already
    limiter.concurrent_requests["keyC"] = 1
    res = await limiter.check_rate_limit("keyC", cfg, tokens_used=0)

    assert res.allowed is False
    assert "Concurrency" in res.reason
    assert res.retry_after == 60


# -------------------- Burst limit (local path) --------------------

@pytest.mark.anyio
async def test_burst_limit_local(mod, fake_fallback):
    limiter = mod.SlidingWindowRateLimiter(redis_client=None)
    cfg = mod.RateLimitConfig(burst_limit=2, requests_per_minute=60, tokens_per_minute=10000)

    # 1st ok
    r1 = await limiter.check_rate_limit("keyB", cfg, tokens_used=0)
    # 2nd ok
    r2 = await limiter.check_rate_limit("keyB", cfg, tokens_used=0)
    # 3rd should hit burst cap (local path returns retry_after 60)
    r3 = await limiter.check_rate_limit("keyB", cfg, tokens_used=0)

    assert r1.allowed and r2.allowed
    assert r3.allowed is False
    assert "Burst" in r3.reason
    assert r3.retry_after == 60
    # Fallback should have been consulted only on first two
    checks = [c for c in fake_fallback.calls if c[0] == "check"]
    assert len(checks) == 2


# -------------------- Sliding window minute request limit --------------------

@pytest.mark.anyio
async def test_minute_request_limit_local(mod, fake_fallback):
    limiter = mod.SlidingWindowRateLimiter(redis_client=None)
    cfg = mod.RateLimitConfig(
        requests_per_minute=2, tokens_per_minute=10_000, burst_limit=50, concurrency_limit=10
    )

    # 1st + 2nd ok
    _ = await limiter.check_rate_limit("keyR", cfg, tokens_used=0)
    _ = await limiter.check_rate_limit("keyR", cfg, tokens_used=0)
    # 3rd should fail on minute request cap
    r3 = await limiter.check_rate_limit("keyR", cfg, tokens_used=0)

    assert r3.allowed is False
    assert "Minute request limit" in r3.reason
    assert r3.retry_after == 60
    assert r3.remaining_requests == 0


# -------------------- Sliding window minute token limit --------------------

@pytest.mark.anyio
async def test_minute_token_limit_local(mod, fake_fallback):
    limiter = mod.SlidingWindowRateLimiter(redis_client=None)
    cfg = mod.RateLimitConfig(
        requests_per_minute=10, tokens_per_minute=50, burst_limit=50, concurrency_limit=10
    )

    # First call consumes 30, second call tries to consume 25 -> exceeds 50
    _ = await limiter.check_rate_limit("keyT", cfg, tokens_used=30)
    r2 = await limiter.check_rate_limit("keyT", cfg, tokens_used=25)

    assert r2.allowed is False
    assert "Minute token limit" in r2.reason
    assert r2.retry_after == 60
    assert r2.remaining_tokens == 0


# -------------------- Fail-open behavior on unexpected exception --------------------

@pytest.mark.anyio
async def test_fail_open_on_fallback_exception(monkeypatch, mod, fake_fallback):
    limiter = mod.SlidingWindowRateLimiter(redis_client=None)
    cfg = mod.RateLimitConfig(burst_limit=50, concurrency_limit=10, requests_per_minute=60, tokens_per_minute=10000)

    async def boom(*a, **k):
        raise RuntimeError("fallback exploded")
    fake_fallback.check_rate_limit = boom

    res = await limiter.check_rate_limit("keyZ", cfg, tokens_used=0)
    assert res.allowed is True
    assert "allowing request" in (res.reason or "").lower()


# -------------------- RateLimitManager: config load/save and integration --------------------

@pytest.mark.anyio
async def test_manager_get_key_config_from_db(monkeypatch, mod, fake_fallback):
    # return a custom config from DB
    def fake_get_config(api_key):
        return {
            "requests_per_minute": 5,
            "tokens_per_minute": 500,
            "burst_limit": 3,
            "concurrency_limit": 2,
            "requests_per_hour": 100,
            "requests_per_day": 1000,
            "tokens_per_hour": 5000,
            "tokens_per_day": 50000,
            "window_size_seconds": 60,
        }
    monkeypatch.setattr(mod, "get_rate_limit_config", fake_get_config)

    mgr = mod.RateLimitManager(redis_client=None)
    cfg = await mgr.get_key_config("keyDB")
    assert cfg.requests_per_minute == 5
    assert cfg.tokens_per_minute == 500
    assert cfg.burst_limit == 3
    assert cfg.concurrency_limit == 2

    # Manager + limiter integration still returns a result object
    res = await mgr.check_rate_limit("keyDB", tokens_used=10)
    assert res.allowed is True


@pytest.mark.anyio
async def test_manager_get_key_config_default_on_error(monkeypatch, mod, fake_fallback):
    def boom(api_key):
        raise RuntimeError("db failure")
    monkeypatch.setattr(mod, "get_rate_limit_config", boom)

    mgr = mod.RateLimitManager(redis_client=None)
    cfg = await mgr.get_key_config("x")
    # default config fallback
    assert cfg.requests_per_minute == mod.DEFAULT_CONFIG.requests_per_minute
    assert cfg.tokens_per_minute == mod.DEFAULT_CONFIG.tokens_per_minute


@pytest.mark.anyio
async def test_manager_update_key_config_calls_db(monkeypatch, mod, fake_fallback):
    captured = {"called": False, "args": None}

    def fake_update(api_key, cfg_dict):
        captured["called"] = True
        captured["args"] = (api_key, cfg_dict)

    monkeypatch.setattr(mod, "update_rate_limit_config", fake_update)

    mgr = mod.RateLimitManager(redis_client=None)
    cfg = mod.RateLimitConfig(
        requests_per_minute=7, tokens_per_minute=700, burst_limit=4, concurrency_limit=3
    )
    await mgr.update_key_config("keyU", cfg)

    assert captured["called"] is True
    api_key, cfg_dict = captured["args"]
    assert api_key == "keyU"
    # subset of fields
    assert cfg_dict["requests_per_minute"] == 7
    assert cfg_dict["tokens_per_minute"] == 700
    assert cfg_dict["burst_limit"] == 4
    assert cfg_dict["concurrency_limit"] == 3


# -------------------- Singletons and helpers --------------------

def test_get_rate_limiter_singleton(mod, fake_fallback):
    a = mod.get_rate_limiter()
    b = mod.get_rate_limiter()
    assert a is b

def test_get_rate_limit_manager_singleton(mod, fake_fallback):
    a = mod.get_rate_limit_manager()
    b = mod.get_rate_limit_manager()
    assert a is b

@pytest.mark.anyio
async def test_concurrency_increment_decrement_helpers(mod, fake_fallback):
    limiter = mod.SlidingWindowRateLimiter(redis_client=None)
    key = "conc"
    assert limiter.concurrent_requests.get(key, 0) == 0
    await limiter.increment_concurrent_requests(key)
    assert limiter.concurrent_requests[key] == 1
    await limiter.decrement_concurrent_requests(key)
    assert limiter.concurrent_requests[key] == 0
