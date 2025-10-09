import os
from dotenv import load_dotenv

# Load environment variables from ..env file
load_dotenv()

class Config:
    """Configuration class for the application"""
    
    # Supabase Configuration
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    
    # OpenRouter Configuration
    OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
    OPENROUTER_SITE_URL = os.environ.get("OPENROUTER_SITE_URL", "https://your-site.com")
    OPENROUTER_SITE_NAME = os.environ.get("OPENROUTER_SITE_NAME", "Openrouter AI Gateway")

    # Portkey Configuration
    PORTKEY_API_KEY = os.environ.get("PORTKEY_API_KEY")

    # Provider API Keys (for use with Portkey)
    PROVIDER_OPENAI_API_KEY = os.environ.get("PROVIDER_OPENAI_API_KEY")
    PROVIDER_ANTHROPIC_API_KEY = os.environ.get("PROVIDER_ANTHROPIC_API_KEY")

    # DeepInfra Configuration (for direct API access)
    DEEPINFRA_API_KEY = os.environ.get("DEEPINFRA_API_KEY")

    # Featherless.ai Configuration
    FEATHERLESS_API_KEY = os.environ.get("FEATHERLESS_API_KEY")

    # Chutes.ai Configuration
    CHUTES_API_KEY = os.environ.get("CHUTES_API_KEY")
    
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