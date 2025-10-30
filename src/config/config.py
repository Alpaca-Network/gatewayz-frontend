import os

from dotenv import load_dotenv

# Load environment variables from ..env file
load_dotenv()

class Config:
    """Configuration class for the application"""

    # Environment Detection
    APP_ENV = os.environ.get("APP_ENV", "development")  # development, staging, production
    IS_PRODUCTION = APP_ENV == "production"
    IS_STAGING = APP_ENV == "staging"
    IS_DEVELOPMENT = APP_ENV == "development"
    IS_TESTING = APP_ENV in {"testing", "test"} or os.environ.get("TESTING", "").lower() in {"1", "true", "yes"}

    # Supabase Configuration
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

    # OpenRouter Configuration
    OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
    OPENROUTER_SITE_URL = os.environ.get("OPENROUTER_SITE_URL", "https://your-site.com")
    OPENROUTER_SITE_NAME = os.environ.get("OPENROUTER_SITE_NAME", "Openrouter AI Gateway")

    # Portkey Configuration
    PORTKEY_API_KEY = os.environ.get("PORTKEY_API_KEY")
    PORTKEY_DEFAULT_VIRTUAL_KEY = os.environ.get("PORTKEY_VIRTUAL_KEY")

    # Provider API Keys (for use with Portkey)
    PROVIDER_OPENAI_API_KEY = os.environ.get("PROVIDER_OPENAI_API_KEY")
    PROVIDER_ANTHROPIC_API_KEY = os.environ.get("PROVIDER_ANTHROPIC_API_KEY")

    # DeepInfra Configuration (for direct API access)
    DEEPINFRA_API_KEY = os.environ.get("DEEPINFRA_API_KEY")
    XAI_API_KEY = os.environ.get("XAI_API_KEY")
    NOVITA_API_KEY = os.environ.get("NOVITA_API_KEY")
    NEBIUS_API_KEY = os.environ.get("NEBIUS_API_KEY")
    CEREBRAS_API_KEY = os.environ.get("CEREBRAS_API_KEY")
    HUG_API_KEY = os.environ.get("HUG_API_KEY")

    # Featherless.ai Configuration
    FEATHERLESS_API_KEY = os.environ.get("FEATHERLESS_API_KEY")

    # Chutes.ai Configuration
    CHUTES_API_KEY = os.environ.get("CHUTES_API_KEY")

    # Fireworks.ai Configuration
    FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY")

    # Together.ai Configuration
    TOGETHER_API_KEY = os.environ.get("TOGETHER_API_KEY")

    # Groq Configuration
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

    # AIMO Configuration
    AIMO_API_KEY = os.environ.get("AIMO_API_KEY")

    # Near AI Configuration
    NEAR_API_KEY = os.environ.get("NEAR_API_KEY")

    # Google Generative AI Configuration (for language models)
    GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

    # Google Vertex AI Configuration (for image generation)
    GOOGLE_PROJECT_ID = os.environ.get("GOOGLE_PROJECT_ID", "gatewayz-468519")
    GOOGLE_VERTEX_LOCATION = os.environ.get("GOOGLE_VERTEX_LOCATION", "us-central1")
    GOOGLE_VERTEX_ENDPOINT_ID = os.environ.get("GOOGLE_VERTEX_ENDPOINT_ID", "6072619212881264640")
    GOOGLE_APPLICATION_CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    # OpenRouter Analytics Cookie (for transaction analytics API)
    OPENROUTER_COOKIE = os.environ.get("OPENROUTER_COOKIE")

    # Admin Configuration
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")

    @classmethod
    def get_portkey_virtual_key(cls, provider: str | None = None) -> str | None:
        """
        Resolve Portkey virtual key for a provider.

        Order of precedence:
        1. Explicit provider-specific env: PORTKEY_VIRTUAL_KEY_<PROVIDER>
           (provider name uppercased with non-alphanumeric replaced by underscores)
        2. PORTKEY_VIRTUAL_KEY (generic default)
        """
        if not provider:
            return cls.PORTKEY_DEFAULT_VIRTUAL_KEY

        normalized = "".join(
            ch if ch.isalnum() else "_"
            for ch in provider.upper()
        )
        env_name = f"PORTKEY_VIRTUAL_KEY_{normalized}"
        provider_specific = os.environ.get(env_name)
        return provider_specific or cls.PORTKEY_DEFAULT_VIRTUAL_KEY

    @classmethod
    def validate(cls):
        """Validate that all required environment variables are set"""
        # Skip validation in Vercel environment to prevent startup failures
        if os.environ.get("VERCEL"):
            return True

        missing_vars = []

        if not cls.SUPABASE_URL:
            missing_vars.append("SUPABASE_URL")
        if not cls.SUPABASE_KEY:
            missing_vars.append("SUPABASE_KEY")
        if not cls.OPENROUTER_API_KEY:
            missing_vars.append("OPENROUTER_API_KEY")
        if not cls.PORTKEY_API_KEY:
            missing_vars.append("PORTKEY_API_KEY")

        if missing_vars:
            raise RuntimeError(
                f"Missing required environment variables: {', '.join(missing_vars)}\n"
                "Please create a ..env file with the following variables:\n"
                "SUPABASE_URL=your_supabase_project_url\n"
                "SUPABASE_KEY=your_supabase_anon_key\n"
                "OPENROUTER_API_KEY=your_openrouter_api_key\n"
                "OPENROUTER_SITE_URL=your_site_url (optional)\n"
                "OPENROUTER_SITE_NAME=your_site_name (optional)\n"
                "PORTKEY_API_KEY=your_portkey_api_key"
            )
        
        return True
    
    @classmethod
    def get_supabase_config(cls):
        """Get Supabase configuration as a tuple"""
        return cls.SUPABASE_URL, cls.SUPABASE_KEY 
