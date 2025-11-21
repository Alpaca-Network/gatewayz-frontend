"""
Comprehensive tests for Cerebras Client service
"""
from unittest.mock import MagicMock



class TestCerebrasClient:
    """Test Cerebras Client service functionality"""

    def test_module_imports(self):
        """Test that module imports successfully"""
        import src.services.cerebras_client
        assert src.services.cerebras_client is not None

    def test_module_has_expected_attributes(self):
        """Test module exports"""
        from src.services import cerebras_client
        assert hasattr(cerebras_client, '__name__')

    def test_fetch_models_from_cerebras_normalizes_sdk_response(self, monkeypatch):
        """Ensure fetch_models_from_cerebras returns normalized entries when SDK responds."""
        from src.services import cerebras_client

        fake_model = MagicMock()
        fake_model.model_dump.return_value = {
            "id": "@cerebras/llama3.1-8b",
            "owned_by": "@cerebras",
            "pricing": {"prompt": "0.1", "completion": "0.2"},
            "capabilities": {"inference": ["temperature", "max_tokens"]},
        }

        fake_page = MagicMock()
        fake_page.data = [fake_model]

        fake_client = MagicMock()
        fake_client.models.list.return_value = fake_page

        cache = {"data": None, "timestamp": None, "ttl": 60, "stale_ttl": 120}

        monkeypatch.setattr(cerebras_client, "get_cerebras_client", lambda: fake_client)
        monkeypatch.setattr(cerebras_client, "_cerebras_models_cache", cache, raising=False)

        models = cerebras_client.fetch_models_from_cerebras()

        assert models, "Expected normalized models from SDK response"
        assert models[0]["id"] == "llama3.1-8b"
        assert models[0]["provider_slug"] == "cerebras"
        assert models[0]["pricing"]["prompt"] == "0.1"
        assert cache["data"] == models

    def test_fetch_models_from_cerebras_uses_fallback_on_error(self, monkeypatch):
        """Ensure fallback catalog is used when client initialization fails."""
        from src.services import cerebras_client

        cache = {"data": None, "timestamp": None, "ttl": 60, "stale_ttl": 120}

        monkeypatch.setattr(
            cerebras_client,
            "get_cerebras_client",
            MagicMock(side_effect=RuntimeError("boom")),
        )
        monkeypatch.setattr(
            cerebras_client,
            "DEFAULT_CEREBRAS_MODELS",
            [{"id": "llama3.1-8b"}],
            raising=False,
        )
        monkeypatch.setattr(cerebras_client, "_cerebras_models_cache", cache, raising=False)

        models = cerebras_client.fetch_models_from_cerebras()

        assert models, "Fallback catalog should provide at least one model"
        assert models[0]["id"] == "llama3.1-8b"
        assert cache["data"] == models
