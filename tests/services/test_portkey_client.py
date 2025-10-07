# tests/services/test_portkey_client_unit.py
import importlib
import pytest

MODULE_PATH = "src.services.portkey_client"  # change if needed


@pytest.fixture
def mod():
    return importlib.import_module(MODULE_PATH)


# ---------- Fakes to avoid network ----------
class FakeCompletions:
    def __init__(self):
        self.calls = []
        self.return_value = object()  # sentinel

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.return_value


class FakeChat:
    def __init__(self):
        self.completions = FakeCompletions()


class FakeOpenAI:
    def __init__(self, base_url=None, api_key=None, default_headers=None):
        self.base_url = base_url
        self.api_key = api_key
        self.default_headers = default_headers or {}
        self.chat = FakeChat()


# ----------------- get_portkey_client -----------------

def test_get_portkey_client_virtual_key_success(monkeypatch, mod):
    # Arrange config
    monkeypatch.setattr(mod.Config, "PORTKEY_API_KEY", "pk_live_123")
    monkeypatch.setattr(mod.Config, "PROVIDER_OPENAI_API_KEY", None, raising=False)
    monkeypatch.setattr(mod.Config, "PROVIDER_ANTHROPIC_API_KEY", None, raising=False)

    created = []
    monkeypatch.setattr(mod, "OpenAI", lambda **kw: created.append(FakeOpenAI(**kw)) or created[-1])

    # Act
    client = mod.get_portkey_client(provider="openai", virtual_key="vk_abc")

    # Assert
    assert isinstance(client, FakeOpenAI)
    assert client.base_url == "https://api.portkey.ai/v1"
    assert client.api_key == "portkey"  # dummy key in virtual-key mode
    hdrs = client.default_headers
    assert hdrs["x-portkey-api-key"] == "pk_live_123"
    assert hdrs["x-portkey-virtual-key"] == "vk_abc"
    assert "x-portkey-provider" not in hdrs  # not used in virtual-key mode


def test_get_portkey_client_direct_openai_success(monkeypatch, mod):
    monkeypatch.setattr(mod.Config, "PORTKEY_API_KEY", "pk_live_123")
    monkeypatch.setattr(mod.Config, "PROVIDER_OPENAI_API_KEY", "sk-openai-xxx", raising=False)

    created = []
    monkeypatch.setattr(mod, "OpenAI", lambda **kw: created.append(FakeOpenAI(**kw)) or created[-1])

    client = mod.get_portkey_client(provider="openai", virtual_key=None)

    assert isinstance(client, FakeOpenAI)
    assert client.base_url == "https://api.portkey.ai/v1"
    assert client.api_key == "sk-openai-xxx"
    hdrs = client.default_headers
    assert hdrs["x-portkey-api-key"] == "pk_live_123"
    assert hdrs["x-portkey-provider"] == "openai"
    assert "x-portkey-virtual-key" not in hdrs


def test_get_portkey_client_direct_anthropic_success(monkeypatch, mod):
    monkeypatch.setattr(mod.Config, "PORTKEY_API_KEY", "pk_live_123")
    monkeypatch.setattr(mod.Config, "PROVIDER_ANTHROPIC_API_KEY", "sk-anthropic-xyz", raising=False)

    created = []
    monkeypatch.setattr(mod, "OpenAI", lambda **kw: created.append(FakeOpenAI(**kw)) or created[-1])

    client = mod.get_portkey_client(provider="anthropic", virtual_key=None)

    assert isinstance(client, FakeOpenAI)
    assert client.api_key == "sk-anthropic-xyz"
    assert client.default_headers["x-portkey-provider"] == "anthropic"


def test_get_portkey_client_missing_portkey_key_raises(monkeypatch, mod):
    monkeypatch.setattr(mod.Config, "PORTKEY_API_KEY", None)
    with pytest.raises(ValueError):
        mod.get_portkey_client(provider="openai", virtual_key="vk_abc")


def test_get_portkey_client_missing_provider_key_raises(monkeypatch, mod):
    # Direct provider mode without provider key -> error
    monkeypatch.setattr(mod.Config, "PORTKEY_API_KEY", "pk_live_123")
    monkeypatch.setattr(mod.Config, "PROVIDER_OPENAI_API_KEY", None, raising=False)

    with pytest.raises(ValueError) as ei:
        mod.get_portkey_client(provider="openai", virtual_key=None)
    assert "PROVIDER_OPENAI_API_KEY" in str(ei.value)


# ----------------- make_portkey_request_openai -----------------

def test_make_portkey_request_openai_forwards_args_virtual(monkeypatch, mod):
    fake = FakeOpenAI()
    monkeypatch.setattr(mod, "get_portkey_client", lambda provider, virtual_key: fake)

    messages = [{"role": "user", "content": "Hello"}]
    model = "provider/model"
    kwargs = {"temperature": 0.7, "max_tokens": 256, "top_p": 0.9}

    resp = mod.make_portkey_request_openai(messages, model, provider="openai", virtual_key="vk_abc", **kwargs)

    assert resp is fake.chat.completions.return_value
    assert len(fake.chat.completions.calls) == 1
    call = fake.chat.completions.calls[0]
    assert call["model"] == model
    assert call["messages"] == messages
    for k, v in kwargs.items():
        assert call[k] == v


# ----------------- process_portkey_response -----------------

def test_process_portkey_response_happy(mod):
    class _Msg:
        def __init__(self, role, content):
            self.role = role
            self.content = content

    class _Choice:
        def __init__(self, idx, role, content, finish):
            self.index = idx
            self.message = _Msg(role, content)
            self.finish_reason = finish

    class _Usage:
        def __init__(self, p, c, t):
            self.prompt_tokens = p
            self.completion_tokens = c
            self.total_tokens = t

    class _Resp:
        id = "cmpl-1"
        object = "chat.completion"
        created = 1720000123
        model = "provider/model"
        choices = [
            _Choice(0, "assistant", "hi", "stop"),
            _Choice(1, "assistant", "more", "length"),
        ]
        usage = _Usage(11, 22, 33)

    out = mod.process_portkey_response(_Resp)
    assert out["id"] == "cmpl-1"
    assert out["choices"][0]["message"]["content"] == "hi"
    assert out["usage"]["total_tokens"] == 33


def test_process_portkey_response_no_usage(mod):
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
        id = "cmpl-2"
        object = "chat.completion"
        created = 1720000456
        model = "m"
        choices = [_Choice(0)]
        usage = None

    out = mod.process_portkey_response(_Resp)
    assert out["usage"] == {}
