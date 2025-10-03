import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from src.db.ranking import (
    get_all_latest_models, 
    get_all_latest_apps,
)

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/ranking/models", tags=["ranking"])
async def get_ranking_models():
    """Get all models from latest_models table for ranking page"""
    try:        
        # Get models based on filters
        models = get_all_latest_models()
        logger.info(f"Retrieved {len(models)} models")
        
        return {
            "success": True,
            "data": models,
            "count": len(models),
        }
        
    except Exception as e:
        logger.error(f"Failed to fetch models: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")


@router.get("/ranking/apps", tags=["ranking"])
async def get_ranking_apps():
    """Get all apps from latest_apps table for ranking page"""
    try:
        # Get apps based on filters
        apps = get_all_latest_apps()
        
        logger.info(f"Retrieved {len(apps)} apps")
        
        return {
            "success": True,
            "data": apps,
            "count": len(apps),
        }
        
    except Exception as e:
        logger.error(f"Failed to fetch apps: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch apps: {str(e)}")

