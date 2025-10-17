import importlib
import pytest

MODULE_PATH = "src.services.portkey_client"


@pytest.fixture
def mod():
    return importlib.import_module(MODULE_PATH)


class FakeCompletions:
    def __init__(self):
        self.calls = []
        self.return_value = object()

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


def test_get_portkey_client_adds_headers(monkeypatch, mod):
    monkeypatch.setattr(mod.Config, "PORTKEY_API_KEY", "pk_live_123")

    created = []

    def fake_openai(**kwargs):
        created.append(FakeOpenAI(**kwargs))
        return created[-1]

    monkeypatch.setattr(mod, "OpenAI", fake_openai)

    client = mod.get_portkey_client(provider="openai", virtual_key="vk_slug")

    assert isinstance(client, FakeOpenAI)
    assert client.base_url == mod.PORTKEY_BASE_URL
    assert client.api_key == "pk_live_123"
    assert client.default_headers["x-portkey-api-key"] == "pk_live_123"
    assert client.default_headers["x-portkey-virtual-key"] == "vk_slug"
    assert client.default_headers["x-portkey-provider"] == "openai"


def test_get_portkey_client_without_virtual_key(monkeypatch, mod):
    monkeypatch.setattr(mod.Config, "PORTKEY_API_KEY", "pk_live_123")
    monkeypatch.setattr(mod.Config, "get_portkey_virtual_key", lambda provider: None)

    created = []
    monkeypatch.setattr(mod, "OpenAI", lambda **kw: created.append(FakeOpenAI(**kw)) or created[-1])

    client = mod.get_portkey_client(provider="anthropic", virtual_key=None)

    assert "x-portkey-virtual-key" not in client.default_headers
    assert client.default_headers["x-portkey-provider"] == "anthropic"


def test_get_portkey_client_missing_api_key(monkeypatch, mod):
    monkeypatch.setattr(mod.Config, "PORTKEY_API_KEY", None)
    with pytest.raises(ValueError):
        mod.get_portkey_client()


def test_make_portkey_request_openai_formats_model(monkeypatch, mod):
    fake_client = FakeOpenAI()
    monkeypatch.setattr(mod, "get_portkey_client", lambda provider, virtual_key: fake_client)

    messages = [{"role": "user", "content": "Hi"}]
    response = mod.make_portkey_request_openai(
        messages,
        "gpt-3.5-turbo",
        provider="openai",
        virtual_key="vk-openai",
        temperature=0.7,
    )

    assert response is fake_client.chat.completions.return_value
    call = fake_client.chat.completions.calls[0]
    # When virtual_key is provided, it's used in the model format
    assert call["model"] == "@vk-openai/gpt-3.5-turbo"
    assert call["temperature"] == 0.7


def test_make_portkey_request_openai_keeps_prefixed_model(monkeypatch, mod):
    fake_client = FakeOpenAI()
    monkeypatch.setattr(mod, "get_portkey_client", lambda provider, virtual_key: fake_client)

    mod.make_portkey_request_openai(
        [{"role": "user", "content": "Hi"}],
        "@openrouter/openai/gpt-3.5-turbo",
        provider="openai",
    )

    call = fake_client.chat.completions.calls[0]
    assert call["model"] == "@openrouter/openai/gpt-3.5-turbo"


def test_make_portkey_request_openai_stream(monkeypatch, mod):
    fake_client = FakeOpenAI()
    monkeypatch.setattr(mod, "get_portkey_client", lambda provider, virtual_key: fake_client)

    stream = mod.make_portkey_request_openai_stream(
        [{"role": "user", "content": "Hi"}],
        "openai/gpt-4o-mini",
        provider="openai",
    )

    assert stream is fake_client.chat.completions.return_value
    call = fake_client.chat.completions.calls[0]
    assert call["model"] == "@openai/gpt-4o-mini"
