import logging

from src.config.config import Config
from supabase import Client, create_client

from typing import Optional
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    try:
        Config.validate()

        _supabase_client = create_client(
            supabase_url=Config.SUPABASE_URL, supabase_key=Config.SUPABASE_KEY
        )

        test_connection()

        return _supabase_client

    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        raise RuntimeError(f"Supabase client initialization failed: {e}") from e


def test_connection() -> bool:
    try:
        client = get_supabase_client()
        client.table("users").select("*").limit(1).execute()
        return True
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        raise RuntimeError(f"Database connection failed: {e}") from e


def init_db():
    try:
        test_connection()
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


def get_client() -> Client:
    return get_supabase_client()


supabase = property(get_client)
