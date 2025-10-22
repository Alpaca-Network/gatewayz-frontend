"""
Configuration module for Gatewayz backend.
Consolidates all configuration-related modules.
"""

# Re-export main Config class for backward compatibility
from src.config.config import Config

# Re-export database configuration
from src.config.db_config import (
    DatabaseConfig,
    get_db_config,
    get_db_connection,
    test_db_connection,
    close_db_connections,
    is_db_available
)

# Re-export Supabase configuration
from src.config.supabase_config import (
    get_supabase_client,
    get_client,
    init_db,
    test_connection
)

# Re-export Redis configuration (if needed)
# from src.config.redis_config import ...

__all__ = [
    # Main config
    "Config",

    # Database config
    "DatabaseConfig",
    "get_db_config",
    "get_db_connection",
    "test_db_connection",
    "close_db_connections",
    "is_db_available",

    # Supabase config
    "get_supabase_client",
    "get_client",
    "init_db",
    "test_connection",
]
