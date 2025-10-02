import datetime
import logging

from src.db.users import  get_user_count
from fastapi import APIRouter
from datetime import datetime, timezone

from src.services.openrouter_client import get_openrouter_client
from src.services.providers import get_cached_providers


# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()
# Health check endpoint
@router.get("/health")
async def health_check():
    try:
        user_count = get_user_count()

        try:
            _ = get_openrouter_client()
            # Test connection by trying to get providers
            test_providers = get_cached_providers()
            openrouter_status = "connected" if test_providers else "error"
        except Exception:
            openrouter_status = "unavailable"

        return {
            "status": "healthy",
            "database": "connected",
            "openrouter": openrouter_status,
            "user_count": user_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "openrouter": "unknown",
            "error": str(e)
        }

