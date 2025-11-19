# tests/services/test_openrouter_client_unit.py
import importlib
import types
import pytest

MODULE_PATH = "src.services.openrouter_client"  # <- change if needed


@pytest.fixture
def mod():
    return importlib.import_module(MODULE_PATH)


class FakeCompletions:
    def __init__(self, parent):
        self.parent = parent
        self.calls = []
        self.return_value = object()  # sentinel

    def create(self, **kwargs):
        self.calls.append(kwargs)
        # Simulate OpenAI returning some object (the raw response)
        return self.return_value


class FakeChat:
    def __init__(self, parent):
        self.parent = parent
        self.completions = FakeCompletions(parent)


class FakeOpenAI:
    def __init__(self, base_url=None, api_key=None, default_headers=None):
        # record constructor args so tests can assert
        self.base_url = base_url
        self.api_key = api_key
        self.default_headers = default_headers or {}
        self.chat = FakeChat(self)


def test_get_openrouter_client_success(monkeypatch, mod):
    # Arrange config
    monkeypatch.setattr(mod.Config, "OPENROUTER_API_KEY", "sk-or-123")
    monkeypatch.setattr(mod.Config, "OPENROUTER_SITE_URL", "https://gatewayz.example")
    monkeypatch.setattr(mod.Config, "OPENROUTER_SITE_NAME", "Gatewayz")

    # Create a fake client with expected properties for OpenRouter
    fake_client = FakeOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key="sk-or-123",
        default_headers={
            "HTTP-Referer": "https://gatewayz.example",
            "X-TitleSection": "Gatewayz"
        }
    )

    # Patch the connection pool function to return our fake client
    monkeypatch.setattr(mod, "get_openrouter_pooled_client", lambda: fake_client)

    # Act
    client = mod.get_openrouter_client()

    # Assert
    assert isinstance(client, FakeOpenAI)
    assert client is fake_client
    assert client.base_url == "https://openrouter.ai/api/v1"
    assert client.api_key == "sk-or-123"
    # headers
    hdrs = client.default_headers
    assert hdrs["HTTP-Referer"] == "https://gatewayz.example"
    assert hdrs["X-TitleSection"] == "Gatewayz"


def test_get_openrouter_client_missing_key_raises(monkeypatch, mod):
    # Arrange: key not configured
    monkeypatch.setattr(mod.Config, "OPENROUTER_API_KEY", None)
    monkeypatch.setattr(mod.Config, "OPENROUTER_SITE_URL", "https://x")
    monkeypatch.setattr(mod.Config, "OPENROUTER_SITE_NAME", "X")

    called = {"n": 0}

    def _should_not_be_called(**kwargs):
        called["n"] += 1
        return FakeOpenAI(**kwargs)

    monkeypatch.setattr(mod, "OpenAI", _should_not_be_called)

    # Act + Assert
    with pytest.raises(ValueError):
        mod.get_openrouter_client()
    assert called["n"] == 0  # OpenAI() never called


def test_make_openrouter_request_openai_forwards_args(monkeypatch, mod):
    # Arrange: stub client with completions
    fake = FakeOpenAI()
    monkeypatch.setattr(mod, "get_openrouter_client", lambda: fake)

    messages = [{"role": "user", "content": "Hello"}]
    model = "openrouter/some-model"
    kwargs = {"temperature": 0.2, "max_tokens": 128, "top_p": 0.9}

    # Act
    resp = mod.make_openrouter_request_openai(messages, model, **kwargs)

    # Assert: got the raw return value
    assert resp is fake.chat.completions.return_value
    # Exactly one call with the merged args
    assert len(fake.chat.completions.calls) == 1
    call = fake.chat.completions.calls[0]
    assert call["model"] == model
    assert call["messages"] == messages
    for k, v in kwargs.items():
        assert call[k] == v


def test_process_openrouter_response_happy(monkeypatch, mod):
    # Build a dummy OpenAI-like response object
    class _Msg:
        def __init__(self, role, content):
            self.role = role
            self.content = content

    class _Choice:
        def __init__(self, index, role, content, finish_reason="stop"):
            self.index = index
            self.message = _Msg(role, content)
            self.finish_reason = finish_reason

    class _Usage:
        def __init__(self, p, c, t):
            self.prompt_tokens = p
            self.completion_tokens = c
            self.total_tokens = t

    class _Resp:
        id = "cmpl-123"
        object = "chat.completion"
        created = 1720000000
        model = "openrouter/some-model"
        choices = [
            _Choice(0, "assistant", "Hello world", "stop"),
            _Choice(1, "assistant", "Another", "length")
        ]
        usage = _Usage(10, 20, 30)

    out = mod.process_openrouter_response(_Resp)

    assert out["id"] == "cmpl-123"
    assert out["object"] == "chat.completion"
    assert out["created"] == 1720000000
    assert out["model"] == "openrouter/some-model"
    assert len(out["choices"]) == 2
    assert out["choices"][0]["index"] == 0
    assert out["choices"][0]["message"]["role"] == "assistant"
    assert out["choices"][0]["message"]["content"] == "Hello world"
    assert out["choices"][0]["finish_reason"] == "stop"
    assert out["usage"]["prompt_tokens"] == 10
    assert out["usage"]["completion_tokens"] == 20
    assert out["usage"]["total_tokens"] == 30


def test_process_openrouter_response_no_usage(monkeypatch, mod):
    # Response with usage = None should produce {}
    class _Msg:
        def __init__(self, role, content):
            self.role = role
            self.content = content

    class _Choice:
        def __init__(self, idx):
            self.index = idx
            self.message = _Msg("assistant", "ok")
            self.finish_reason = "stop"

    class _Resp:
        id = "cmpl-xyz"
        object = "chat.completion"
        created = 1720000101
        model = "openrouter/some-model"
        choices = [_Choice(0)]
        usage = None

    out = mod.process_openrouter_response(_Resp)
    assert out["usage"] == {}
