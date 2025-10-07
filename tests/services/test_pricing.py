# tests/services/test_pricing.py
import importlib
import math
import pytest

MODULE_PATH = "src.services.pricing"  # change if your module lives elsewhere


@pytest.fixture
def mod():
    return importlib.import_module(MODULE_PATH)


def _models_fixture():
    return [
        {
            "id": "openai/gpt-4o",
            "slug": "openai/gpt-4o",
            "pricing": {"prompt": "0.000005", "completion": "0.000015"},
        },
        {
            "id": "anthropic/claude-3-opus",
            "slug": "claude-3-opus",  # demonstrate id vs slug
            "pricing": {"prompt": "0.00003", "completion": "0.00006"},
        },
        {
            # bad/missing fields to ensure safe defaults to 0
            "id": "bad/model",
            "slug": "bad/model",
            "pricing": {"prompt": None, "completion": ""},
        },
    ]


# -------------------- get_model_pricing --------------------

def test_get_model_pricing_found_by_id(monkeypatch, mod):
    # Ensure get_cached_models("all") is called
    called = {"args": None}
    def fake_get_cached_models(arg):
        called["args"] = arg
        return _models_fixture()
    monkeypatch.setattr(mod, "get_cached_models", fake_get_cached_models)

    out = mod.get_model_pricing("openai/gpt-4o")
    assert called["args"] == "all"
    assert out["found"] is True
    assert math.isclose(out["prompt"], 0.000005)
    assert math.isclose(out["completion"], 0.000015)


def test_get_model_pricing_found_by_slug(monkeypatch, mod):
    monkeypatch.setattr(mod, "get_cached_models", lambda _: _models_fixture())
    out = mod.get_model_pricing("claude-3-opus")  # matches by slug
    assert out["found"] is True
    assert math.isclose(out["prompt"], 0.00003)
    assert math.isclose(out["completion"], 0.00006)


def test_get_model_pricing_model_not_found_uses_default(monkeypatch, mod):
    monkeypatch.setattr(mod, "get_cached_models", lambda _: _models_fixture())
    out = mod.get_model_pricing("totally/unknown-model")
    assert out["found"] is False
    assert math.isclose(out["prompt"], 0.00002)
    assert math.isclose(out["completion"], 0.00002)


def test_get_model_pricing_empty_cache_uses_default(monkeypatch, mod):
    monkeypatch.setattr(mod, "get_cached_models", lambda _: [])
    out = mod.get_model_pricing("anything")
    assert out["found"] is False
    assert math.isclose(out["prompt"], 0.00002)
    assert math.isclose(out["completion"], 0.00002)


def test_get_model_pricing_handles_missing_prices(monkeypatch, mod):
    # The "bad/model" entry has None/""; code should coerce to 0.0, still found=True
    monkeypatch.setattr(mod, "get_cached_models", lambda _: _models_fixture())
    out = mod.get_model_pricing("bad/model")
    assert out["found"] is True
    assert math.isclose(out["prompt"], 0.0)
    assert math.isclose(out["completion"], 0.0)


def test_get_model_pricing_exception_returns_default(monkeypatch, mod):
    def boom(_):
        raise RuntimeError("cache layer down")
    monkeypatch.setattr(mod, "get_cached_models", boom)
    out = mod.get_model_pricing("openai/gpt-4o")
    assert out["found"] is False
    assert math.isclose(out["prompt"], 0.00002)
    assert math.isclose(out["completion"], 0.00002)


# -------------------- calculate_cost --------------------

def test_calculate_cost_happy(monkeypatch, mod):
    # Force a specific pricing
    monkeypatch.setattr(
        mod, "get_model_pricing",
        lambda model_id: {"prompt": 0.00001, "completion": 0.00002, "found": True}
    )
    cost = mod.calculate_cost("any/model", prompt_tokens=1000, completion_tokens=500)
    # 1000*1e-5 + 500*2e-5 = 0.01 + 0.01 = 0.02
    assert math.isclose(cost, 0.02)


def test_calculate_cost_zero_tokens(monkeypatch, mod):
    monkeypatch.setattr(
        mod, "get_model_pricing",
        lambda _: {"prompt": 0.00003, "completion": 0.00006, "found": True}
    )
    assert mod.calculate_cost("m", 0, 0) == 0.0


def test_calculate_cost_uses_fallback_on_exception(monkeypatch, mod):
    # If pricing lookup explodes, fallback is (prompt+completion)*0.00002
    def boom(_):
        raise RuntimeError("err")
    monkeypatch.setattr(mod, "get_model_pricing", boom)

    cost = mod.calculate_cost("x", prompt_tokens=10, completion_tokens=5)
    # total_tokens = 15; 15 * 0.00002 = 0.0003
    assert math.isclose(cost, 0.0003)
