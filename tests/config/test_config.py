"""
Comprehensive tests for src/config/config.py
"""
import os
import pytest


class TestConfigEnvironmentDetection:
    """Test environment detection logic"""

    def test_is_production_detection(self, monkeypatch):
        """Test production environment detection"""
        from src.config import config

        monkeypatch.setenv("APP_ENV", "production")
        # Reload module to pick up new env var
        import importlib
        importlib.reload(config)

        assert config.Config.APP_ENV == "production"
        assert config.Config.IS_PRODUCTION is True
        assert config.Config.IS_STAGING is False
        assert config.Config.IS_DEVELOPMENT is False

    def test_is_staging_detection(self, monkeypatch):
        """Test staging environment detection"""
        from src.config import config

        monkeypatch.setenv("APP_ENV", "staging")
        import importlib
        importlib.reload(config)

        assert config.Config.APP_ENV == "staging"
        assert config.Config.IS_PRODUCTION is False
        assert config.Config.IS_STAGING is True
        assert config.Config.IS_DEVELOPMENT is False

    def test_is_development_detection(self, monkeypatch):
        """Test development environment detection (default)"""
        from src.config import config

        monkeypatch.setenv("APP_ENV", "development")
        import importlib
        importlib.reload(config)

        assert config.Config.APP_ENV == "development"
        assert config.Config.IS_PRODUCTION is False
        assert config.Config.IS_STAGING is False
        assert config.Config.IS_DEVELOPMENT is True

    def test_is_testing_detection_with_testing_env(self, monkeypatch):
        """Test testing environment detection with APP_ENV=testing"""
        from src.config import config

        monkeypatch.setenv("APP_ENV", "testing")
        import importlib
        importlib.reload(config)

        assert config.Config.IS_TESTING is True

    def test_is_testing_detection_with_test_env(self, monkeypatch):
        """Test testing environment detection with APP_ENV=test"""
        from src.config import config

        monkeypatch.setenv("APP_ENV", "test")
        import importlib
        importlib.reload(config)

        assert config.Config.IS_TESTING is True

    def test_is_testing_detection_with_testing_flag_true(self, monkeypatch):
        """Test testing environment detection with TESTING=true"""
        from src.config import config

        monkeypatch.setenv("TESTING", "true")
        import importlib
        importlib.reload(config)

        assert config.Config.IS_TESTING is True

    def test_is_testing_detection_with_testing_flag_1(self, monkeypatch):
        """Test testing environment detection with TESTING=1"""
        from src.config import config

        monkeypatch.setenv("TESTING", "1")
        import importlib
        importlib.reload(config)

        assert config.Config.IS_TESTING is True

    def test_is_testing_detection_with_testing_flag_yes(self, monkeypatch):
        """Test testing environment detection with TESTING=yes"""
        from src.config import config

        monkeypatch.setenv("TESTING", "yes")
        import importlib
        importlib.reload(config)

        assert config.Config.IS_TESTING is True


class TestConfigProviderKeys:
    """Test provider API key configuration"""

    def test_openrouter_keys(self, monkeypatch):
        """Test OpenRouter configuration"""
        from src.config import config

        monkeypatch.setenv("OPENROUTER_API_KEY", "test_openrouter_key")
        monkeypatch.setenv("OPENROUTER_SITE_URL", "https://test-site.com")
        monkeypatch.setenv("OPENROUTER_SITE_NAME", "Test Site")
        import importlib
        importlib.reload(config)

        assert config.Config.OPENROUTER_API_KEY == "test_openrouter_key"
        assert config.Config.OPENROUTER_SITE_URL == "https://test-site.com"
        assert config.Config.OPENROUTER_SITE_NAME == "Test Site"

    def test_openrouter_defaults(self, monkeypatch):
        """Test OpenRouter default values"""
        from src.config import config

        monkeypatch.delenv("OPENROUTER_SITE_URL", raising=False)
        monkeypatch.delenv("OPENROUTER_SITE_NAME", raising=False)
        import importlib
        importlib.reload(config)

        assert config.Config.OPENROUTER_SITE_URL == "https://your-site.com"
        assert config.Config.OPENROUTER_SITE_NAME == "Openrouter AI Gateway"

    def test_portkey_keys(self, monkeypatch):
        """Test Portkey configuration"""
        from src.config import config

        monkeypatch.setenv("PORTKEY_API_KEY", "test_portkey_key")
        monkeypatch.setenv("PORTKEY_VIRTUAL_KEY", "test_virtual_key")
        import importlib
        importlib.reload(config)

        assert config.Config.PORTKEY_API_KEY == "test_portkey_key"
        assert config.Config.PORTKEY_DEFAULT_VIRTUAL_KEY == "test_virtual_key"

    def test_all_provider_keys(self, monkeypatch):
        """Test all provider API keys are loaded"""
        from src.config import config

        providers = {
            "DEEPINFRA_API_KEY": "deepinfra_key",
            "XAI_API_KEY": "xai_key",
            "NOVITA_API_KEY": "novita_key",
            "NEBIUS_API_KEY": "nebius_key",
            "CEREBRAS_API_KEY": "cerebras_key",
            "HUG_API_KEY": "hug_key",
            "FEATHERLESS_API_KEY": "featherless_key",
            "CHUTES_API_KEY": "chutes_key",
            "FIREWORKS_API_KEY": "fireworks_key",
            "TOGETHER_API_KEY": "together_key",
            "GROQ_API_KEY": "groq_key",
            "AIMO_API_KEY": "aimo_key",
            "NEAR_API_KEY": "near_key",
            "VERCEL_AI_GATEWAY_API_KEY": "vercel_key",
            "HELICONE_API_KEY": "helicone_key",
            "AI_SDK_API_KEY": "ai_sdk_key",
            "AIHUBMIX_API_KEY": "aihubmix_key",
            "FAL_API_KEY": "fal_key",
            "ANANNAS_API_KEY": "anannas_key",
            "ALPACA_NETWORK_API_KEY": "alpaca_key",
            "ALIBABA_CLOUD_API_KEY": "alibaba_key",
            "CLARIFAI_API_KEY": "clarifai_key",
        }

        for key, value in providers.items():
            monkeypatch.setenv(key, value)

        import importlib
        importlib.reload(config)

        assert config.Config.DEEPINFRA_API_KEY == "deepinfra_key"
        assert config.Config.XAI_API_KEY == "xai_key"
        assert config.Config.CEREBRAS_API_KEY == "cerebras_key"
        assert config.Config.FEATHERLESS_API_KEY == "featherless_key"
        assert config.Config.CHUTES_API_KEY == "chutes_key"


class TestConfigGoogleVertex:
    """Test Google Vertex AI configuration"""

    def test_google_vertex_defaults(self, monkeypatch):
        """Test Google Vertex AI default configuration"""
        from src.config import config

        monkeypatch.delenv("GOOGLE_PROJECT_ID", raising=False)
        monkeypatch.delenv("GOOGLE_VERTEX_LOCATION", raising=False)
        monkeypatch.delenv("GOOGLE_VERTEX_ENDPOINT_ID", raising=False)
        import importlib
        importlib.reload(config)

        assert config.Config.GOOGLE_PROJECT_ID == "gatewayz-468519"
        assert config.Config.GOOGLE_VERTEX_LOCATION == "us-central1"
        assert config.Config.GOOGLE_VERTEX_ENDPOINT_ID == "6072619212881264640"

    def test_google_vertex_custom_values(self, monkeypatch):
        """Test Google Vertex AI custom configuration"""
        from src.config import config

        monkeypatch.setenv("GOOGLE_PROJECT_ID", "my-project")
        monkeypatch.setenv("GOOGLE_VERTEX_LOCATION", "us-west1")
        monkeypatch.setenv("GOOGLE_VERTEX_ENDPOINT_ID", "123456")
        monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/path/to/creds.json")
        import importlib
        importlib.reload(config)

        assert config.Config.GOOGLE_PROJECT_ID == "my-project"
        assert config.Config.GOOGLE_VERTEX_LOCATION == "us-west1"
        assert config.Config.GOOGLE_VERTEX_ENDPOINT_ID == "123456"
        assert config.Config.GOOGLE_APPLICATION_CREDENTIALS == "/path/to/creds.json"


class TestConfigMonitoring:
    """Test monitoring and observability configuration"""

    def test_prometheus_enabled_by_default(self, monkeypatch):
        """Test Prometheus is enabled by default"""
        from src.config import config

        monkeypatch.delenv("PROMETHEUS_ENABLED", raising=False)
        import importlib
        importlib.reload(config)

        assert config.Config.PROMETHEUS_ENABLED is True

    def test_prometheus_enabled_explicit_true(self, monkeypatch):
        """Test Prometheus enabled with explicit true values"""
        from src.config import config

        for value in ["true", "1", "yes", "True", "YES"]:
            monkeypatch.setenv("PROMETHEUS_ENABLED", value)
            import importlib
            importlib.reload(config)
            assert config.Config.PROMETHEUS_ENABLED is True

    def test_prometheus_disabled(self, monkeypatch):
        """Test Prometheus can be disabled"""
        from src.config import config

        monkeypatch.setenv("PROMETHEUS_ENABLED", "false")
        import importlib
        importlib.reload(config)

        assert config.Config.PROMETHEUS_ENABLED is False

    def test_prometheus_scrape_enabled_by_default(self, monkeypatch):
        """Test Prometheus scrape is enabled by default"""
        from src.config import config

        monkeypatch.delenv("PROMETHEUS_SCRAPE_ENABLED", raising=False)
        import importlib
        importlib.reload(config)

        assert config.Config.PROMETHEUS_SCRAPE_ENABLED is True

    def test_tempo_disabled_by_default(self, monkeypatch):
        """Test Tempo is disabled by default"""
        from src.config import config

        monkeypatch.delenv("TEMPO_ENABLED", raising=False)
        import importlib
        importlib.reload(config)

        assert config.Config.TEMPO_ENABLED is False

    def test_tempo_enabled(self, monkeypatch):
        """Test Tempo can be enabled"""
        from src.config import config

        for value in ["true", "1", "yes"]:
            monkeypatch.setenv("TEMPO_ENABLED", value)
            import importlib
            importlib.reload(config)
            assert config.Config.TEMPO_ENABLED is True

    def test_loki_disabled_by_default(self, monkeypatch):
        """Test Loki is disabled by default"""
        from src.config import config

        monkeypatch.delenv("LOKI_ENABLED", raising=False)
        import importlib
        importlib.reload(config)

        assert config.Config.LOKI_ENABLED is False

    def test_loki_enabled(self, monkeypatch):
        """Test Loki can be enabled"""
        from src.config import config

        monkeypatch.setenv("LOKI_ENABLED", "true")
        import importlib
        importlib.reload(config)

        assert config.Config.LOKI_ENABLED is True

    def test_otel_service_name_default(self, monkeypatch):
        """Test OTEL service name default"""
        from src.config import config

        monkeypatch.delenv("OTEL_SERVICE_NAME", raising=False)
        import importlib
        importlib.reload(config)

        assert config.Config.OTEL_SERVICE_NAME == "gatewayz-api"


class TestConfigPortkeyVirtualKey:
    """Test get_portkey_virtual_key method"""

    def test_get_portkey_virtual_key_no_provider(self, monkeypatch):
        """Test get_portkey_virtual_key with no provider specified"""
        from src.config.config import Config

        monkeypatch.setenv("PORTKEY_VIRTUAL_KEY", "default_key")
        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        result = config_mod.Config.get_portkey_virtual_key(None)
        assert result == "default_key"

    def test_get_portkey_virtual_key_with_provider_specific(self, monkeypatch):
        """Test get_portkey_virtual_key with provider-specific key"""
        from src.config.config import Config

        monkeypatch.setenv("PORTKEY_VIRTUAL_KEY", "default_key")
        monkeypatch.setenv("PORTKEY_VIRTUAL_KEY_OPENAI", "openai_specific_key")
        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        result = config_mod.Config.get_portkey_virtual_key("openai")
        assert result == "openai_specific_key"

    def test_get_portkey_virtual_key_fallback_to_default(self, monkeypatch):
        """Test get_portkey_virtual_key falls back to default"""
        from src.config.config import Config

        monkeypatch.setenv("PORTKEY_VIRTUAL_KEY", "default_key")
        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        result = config_mod.Config.get_portkey_virtual_key("anthropic")
        assert result == "default_key"

    def test_get_portkey_virtual_key_normalizes_provider_name(self, monkeypatch):
        """Test get_portkey_virtual_key normalizes provider names"""
        from src.config.config import Config

        monkeypatch.setenv("PORTKEY_VIRTUAL_KEY", "default_key")
        monkeypatch.setenv("PORTKEY_VIRTUAL_KEY_MY_PROVIDER_123", "normalized_key")
        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        result = config_mod.Config.get_portkey_virtual_key("my-provider.123")
        assert result == "normalized_key"


class TestConfigValidation:
    """Test validate and validate_critical_env_vars methods"""

    def test_validate_success_with_all_vars(self, monkeypatch):
        """Test validate succeeds with all required variables"""
        from src.config.config import Config

        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_KEY", "test_key")
        monkeypatch.setenv("OPENROUTER_API_KEY", "test_openrouter")
        monkeypatch.setenv("PORTKEY_API_KEY", "test_portkey")
        monkeypatch.delenv("VERCEL", raising=False)

        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        result = config_mod.Config.validate()
        assert result is True

    def test_validate_skips_in_vercel_environment(self, monkeypatch):
        """Test validate skips validation in Vercel environment"""
        from src.config.config import Config

        monkeypatch.setenv("VERCEL", "1")
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_KEY", raising=False)

        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        result = config_mod.Config.validate()
        assert result is True

    def test_validate_raises_on_missing_supabase_url(self, monkeypatch):
        """Test validate raises error on missing SUPABASE_URL"""
        from src.config.config import Config

        monkeypatch.delenv("VERCEL", raising=False)
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.setenv("SUPABASE_KEY", "test_key")
        monkeypatch.setenv("OPENROUTER_API_KEY", "test_openrouter")
        monkeypatch.setenv("PORTKEY_API_KEY", "test_portkey")

        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        with pytest.raises(RuntimeError, match="Missing required environment variables"):
            config_mod.Config.validate()

    def test_validate_raises_on_missing_multiple_vars(self, monkeypatch):
        """Test validate raises error listing all missing variables"""
        from src.config.config import Config

        monkeypatch.delenv("VERCEL", raising=False)
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_KEY", raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        monkeypatch.delenv("PORTKEY_API_KEY", raising=False)

        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        with pytest.raises(RuntimeError) as exc_info:
            config_mod.Config.validate()

        error_message = str(exc_info.value)
        assert "SUPABASE_URL" in error_message
        assert "SUPABASE_KEY" in error_message
        assert "OPENROUTER_API_KEY" in error_message
        assert "PORTKEY_API_KEY" in error_message

    def test_validate_critical_env_vars_success(self, monkeypatch):
        """Test validate_critical_env_vars with all variables present"""
        from src.config.config import Config

        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_KEY", "test_key")
        monkeypatch.setenv("OPENROUTER_API_KEY", "test_openrouter")
        monkeypatch.setenv("PORTKEY_API_KEY", "test_portkey")
        monkeypatch.delenv("VERCEL", raising=False)

        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        is_valid, missing = config_mod.Config.validate_critical_env_vars()
        assert is_valid is True
        assert missing == []

    def test_validate_critical_env_vars_missing_vars(self, monkeypatch):
        """Test validate_critical_env_vars with missing variables"""
        from src.config.config import Config

        monkeypatch.delenv("VERCEL", raising=False)
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.setenv("SUPABASE_KEY", "test_key")
        monkeypatch.setenv("OPENROUTER_API_KEY", "test_openrouter")
        monkeypatch.delenv("PORTKEY_API_KEY", raising=False)

        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        is_valid, missing = config_mod.Config.validate_critical_env_vars()
        assert is_valid is False
        assert "SUPABASE_URL" in missing
        assert "PORTKEY_API_KEY" in missing
        assert len(missing) == 2

    def test_validate_critical_env_vars_skips_in_vercel(self, monkeypatch):
        """Test validate_critical_env_vars skips in Vercel environment"""
        from src.config.config import Config

        monkeypatch.setenv("VERCEL", "1")
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_KEY", raising=False)

        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        is_valid, missing = config_mod.Config.validate_critical_env_vars()
        assert is_valid is True
        assert missing == []


class TestConfigGetSupabaseConfig:
    """Test get_supabase_config method"""

    def test_get_supabase_config_returns_tuple(self, monkeypatch):
        """Test get_supabase_config returns URL and key as tuple"""
        from src.config.config import Config

        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_KEY", "test_key_123")

        import importlib
        import src.config.config as config_mod
        importlib.reload(config_mod)

        url, key = config_mod.Config.get_supabase_config()
        assert url == "https://test.supabase.co"
        assert key == "test_key_123"


class TestConfigClarifai:
    """Test Clarifai configuration"""

    def test_clarifai_configuration(self, monkeypatch):
        """Test Clarifai API configuration"""
        from src.config import config

        monkeypatch.setenv("CLARIFAI_API_KEY", "test_clarifai_key")
        monkeypatch.setenv("CLARIFAI_USER_ID", "test_user_id")
        monkeypatch.setenv("CLARIFAI_APP_ID", "test_app_id")

        import importlib
        importlib.reload(config)

        assert config.Config.CLARIFAI_API_KEY == "test_clarifai_key"
        assert config.Config.CLARIFAI_USER_ID == "test_user_id"
        assert config.Config.CLARIFAI_APP_ID == "test_app_id"


class TestConfigAiHubMix:
    """Test AiHubMix configuration"""

    def test_aihubmix_configuration(self, monkeypatch):
        """Test AiHubMix API configuration"""
        from src.config import config

        monkeypatch.setenv("AIHUBMIX_API_KEY", "test_aihubmix_key")
        monkeypatch.setenv("AIHUBMIX_APP_CODE", "test_app_code")

        import importlib
        importlib.reload(config)

        assert config.Config.AIHUBMIX_API_KEY == "test_aihubmix_key"
        assert config.Config.AIHUBMIX_APP_CODE == "test_app_code"


class TestConfigAdminAndAnalytics:
    """Test admin and analytics configuration"""

    def test_admin_email_configuration(self, monkeypatch):
        """Test admin email configuration"""
        from src.config import config

        monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")

        import importlib
        importlib.reload(config)

        assert config.Config.ADMIN_EMAIL == "admin@example.com"

    def test_openrouter_cookie_configuration(self, monkeypatch):
        """Test OpenRouter cookie configuration"""
        from src.config import config

        monkeypatch.setenv("OPENROUTER_COOKIE", "test_cookie_value")

        import importlib
        importlib.reload(config)

        assert config.Config.OPENROUTER_COOKIE == "test_cookie_value"
