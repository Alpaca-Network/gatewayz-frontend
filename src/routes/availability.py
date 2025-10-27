"""
Model Availability Endpoints

Provides enhanced model availability checking with fallback mechanisms,
circuit breakers, and reliability features.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime, timezone

from src.models.health_models import (
    ModelHealthResponse,
    ProviderHealthResponse,
    SystemHealthResponse
)
from src.services.model_availability import availability_service, ModelAvailability, AvailabilityStatus
from src.security.deps import get_api_key

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/availability/models", response_model=List[ModelAvailability], tags=["availability"])
async def get_available_models(
    gateway: Optional[str] = Query(None, description="Filter by specific gateway"),
    provider: Optional[str] = Query(None, description="Filter by specific provider"),
    status: Optional[str] = Query(None, description="Filter by availability status"),
    api_key: str = Depends(get_api_key)
):
    """
    Get available models with enhanced reliability features
    
    Returns models with availability status including:
    - Circuit breaker state
    - Fallback model suggestions
    - Maintenance status
    - Success rates and response times
    """
    try:
        available_models = availability_service.get_available_models(gateway, provider)
        
        # Apply status filter
        if status:
            available_models = [m for m in available_models if m.status.value == status]
        
        return available_models
    except Exception as e:
        logger.error(f"Failed to get available models: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve available models")

@router.get("/availability/model/{model_id}", response_model=ModelAvailability, tags=["availability"])
async def get_model_availability(
    model_id: str,
    gateway: Optional[str] = Query(None, description="Specific gateway to check"),
    api_key: str = Depends(get_api_key)
):
    """
    Get availability status for a specific model
    
    Returns detailed availability information including:
    - Current availability status
    - Circuit breaker state
    - Fallback model suggestions
    - Maintenance information
    - Performance metrics
    """
    try:
        availability = availability_service.get_model_availability(model_id, gateway)
        if not availability:
            raise HTTPException(status_code=404, detail=f"Model {model_id} not found or no availability data")
        
        return availability
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get model availability for {model_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve model availability")

@router.get("/availability/check/{model_id}", response_model=Dict[str, Any], tags=["availability"])
async def check_model_availability(
    model_id: str,
    gateway: Optional[str] = Query(None, description="Specific gateway to check"),
    api_key: str = Depends(get_api_key)
):
    """
    Quick availability check for a model
    
    Returns a simple availability status suitable for quick checks.
    """
    try:
        is_available = availability_service.is_model_available(model_id, gateway)
        availability = availability_service.get_model_availability(model_id, gateway)
        
        if not availability:
            return {
                "model_id": model_id,
                "available": False,
                "status": "not_found",
                "message": "Model not found or no availability data"
            }
        
        return {
            "model_id": model_id,
            "available": is_available,
            "status": availability.status.value,
            "circuit_breaker_state": availability.circuit_breaker_state.value,
            "success_rate": availability.success_rate,
            "response_time_ms": availability.response_time_ms,
            "last_checked": availability.last_checked.isoformat(),
            "fallback_models": availability.fallback_models,
            "maintenance_until": availability.maintenance_until.isoformat() if availability.maintenance_until else None
        }
    except Exception as e:
        logger.error(f"Failed to check model availability for {model_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to check model availability")

@router.get("/availability/fallback/{model_id}", response_model=Dict[str, Any], tags=["availability"])
async def get_fallback_models(
    model_id: str,
    gateway: Optional[str] = Query(None, description="Specific gateway to check"),
    api_key: str = Depends(get_api_key)
):
    """
    Get fallback models for a given model
    
    Returns suggested fallback models when the primary model is unavailable.
    """
    try:
        fallback_models = availability_service.get_fallback_models(model_id)
        
        # Check which fallback models are actually available
        available_fallbacks = []
        for fallback in fallback_models:
            if availability_service.is_model_available(fallback, gateway):
                available_fallbacks.append({
                    "model_id": fallback,
                    "available": True,
                    "status": "available"
                })
            else:
                availability = availability_service.get_model_availability(fallback, gateway)
                available_fallbacks.append({
                    "model_id": fallback,
                    "available": False,
                    "status": availability.status.value if availability else "unknown"
                })
        
        return {
            "primary_model": model_id,
            "fallback_models": available_fallbacks,
            "best_available": availability_service.get_best_available_model(model_id, gateway)
        }
    except Exception as e:
        logger.error(f"Failed to get fallback models for {model_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve fallback models")

@router.get("/availability/best/{model_id}", response_model=Dict[str, Any], tags=["availability"])
async def get_best_available_model(
    model_id: str,
    gateway: Optional[str] = Query(None, description="Specific gateway to check"),
    api_key: str = Depends(get_api_key)
):
    """
    Get the best available model with fallbacks
    
    Returns the best available model, trying fallbacks if the primary is unavailable.
    """
    try:
        best_model = availability_service.get_best_available_model(model_id, gateway)
        
        if not best_model:
            return {
                "primary_model": model_id,
                "best_available": None,
                "message": "No available models found",
                "suggestions": availability_service.get_fallback_models(model_id)
            }
        
        # Get details of the best available model
        availability = availability_service.get_model_availability(best_model, gateway)
        
        return {
            "primary_model": model_id,
            "best_available": best_model,
            "is_primary": best_model == model_id,
            "availability": availability.status.value if availability else "unknown",
            "success_rate": availability.success_rate if availability else 0.0,
            "response_time_ms": availability.response_time_ms if availability else None
        }
    except Exception as e:
        logger.error(f"Failed to get best available model for {model_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get best available model")

@router.get("/availability/summary", response_model=Dict[str, Any], tags=["availability"])
async def get_availability_summary(api_key: str = Depends(get_api_key)):
    """
    Get availability summary across all models
    
    Returns comprehensive availability statistics including:
    - Total and available model counts
    - Gateway-wise breakdown
    - Overall availability percentage
    - Monitoring status
    """
    try:
        summary = availability_service.get_availability_summary()
        return summary
    except Exception as e:
        logger.error(f"Failed to get availability summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve availability summary")

@router.post("/availability/maintenance/{model_id}", response_model=Dict[str, Any], tags=["availability", "admin"])
async def set_maintenance_mode(
    model_id: str,
    gateway: str,
    until: datetime,
    api_key: str = Depends(get_api_key)
):
    """
    Set maintenance mode for a model
    
    Places a model in maintenance mode until the specified time.
    """
    try:
        availability_service.set_maintenance_mode(model_id, gateway, until)
        return {
            "message": f"Model {model_id} set to maintenance mode until {until.isoformat()}",
            "model_id": model_id,
            "gateway": gateway,
            "maintenance_until": until.isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to set maintenance mode for {model_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to set maintenance mode")

@router.delete("/availability/maintenance/{model_id}", response_model=Dict[str, Any], tags=["availability", "admin"])
async def clear_maintenance_mode(
    model_id: str,
    gateway: str,
    api_key: str = Depends(get_api_key)
):
    """
    Clear maintenance mode for a model
    
    Removes maintenance mode and allows normal availability checking.
    """
    try:
        availability_service.clear_maintenance_mode(model_id, gateway)
        return {
            "message": f"Maintenance mode cleared for model {model_id}",
            "model_id": model_id,
            "gateway": gateway
        }
    except Exception as e:
        logger.error(f"Failed to clear maintenance mode for {model_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear maintenance mode")

@router.post("/availability/monitoring/start", response_model=Dict[str, Any], tags=["availability", "admin"])
async def start_availability_monitoring(api_key: str = Depends(get_api_key)):
    """
    Start availability monitoring service
    
    Starts the background availability monitoring service.
    """
    try:
        await availability_service.start_monitoring()
        return {
            "message": "Availability monitoring started",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to start availability monitoring: {e}")
        raise HTTPException(status_code=500, detail="Failed to start availability monitoring")

@router.post("/availability/monitoring/stop", response_model=Dict[str, Any], tags=["availability", "admin"])
async def stop_availability_monitoring(api_key: str = Depends(get_api_key)):
    """
    Stop availability monitoring service
    
    Stops the background availability monitoring service.
    """
    try:
        await availability_service.stop_monitoring()
        return {
            "message": "Availability monitoring stopped",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to stop availability monitoring: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop availability monitoring")

@router.get("/availability/status", response_model=Dict[str, Any], tags=["availability", "status"])
async def get_availability_status(api_key: str = Depends(get_api_key)):
    """
    Get simple availability status for quick checks
    
    Returns a simple status response suitable for health checks and monitoring tools.
    """
    try:
        summary = availability_service.get_availability_summary()
        
        return {
            "status": "operational" if summary["availability_percentage"] > 90 else "degraded",
            "availability_percentage": summary["availability_percentage"],
            "total_models": summary["total_models"],
            "available_models": summary["available_models"],
            "monitoring_active": summary["monitoring_active"],
            "timestamp": summary["last_updated"]
        }
    except Exception as e:
        logger.error(f"Failed to get availability status: {e}")
        return {
            "status": "error",
            "message": "Failed to retrieve availability status",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
