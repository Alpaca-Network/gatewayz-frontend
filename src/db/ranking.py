import logging
from typing import List, Dict, Any, Optional
from src.supabase_config import get_supabase_client

logger = logging.getLogger(__name__)


def get_all_latest_models() -> List[Dict[str, Any]]:
    """Get all data from latest_models table for ranking page"""
    try:
        client = get_supabase_client()
        
        result = client.table('latest_models').select('*').execute()
        
        if not result.data:
            logger.info("No models found in latest_models table")
            return []
        
        logger.info(f"Retrieved {len(result.data)} models from latest_models table")
        return result.data
        
    except Exception as e:
        logger.error(f"Failed to get latest models: {e}")
        raise RuntimeError(f"Failed to get latest models: {e}")


def get_all_latest_apps() -> List[Dict[str, Any]]:
    """Get all data from latest_apps table for ranking page"""
    try:
        client = get_supabase_client()
        
        result = client.table('latest_apps').select('*').execute()
        
        if not result.data:
            logger.info("No apps found in latest_apps table")
            return []
        
        logger.info(f"Retrieved {len(result.data)} apps from latest_apps table")
        return result.data
        
    except Exception as e:
        logger.error(f"Failed to get latest apps: {e}")
        raise RuntimeError(f"Failed to get latest apps: {e}")
