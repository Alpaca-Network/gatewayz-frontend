"""
Health monitoring and availability endpoints

Provides comprehensive monitoring of model availability, performance,
and health status across all providers and gateways.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime, timezone

from src.models.health_models import (
    ModelHealthResponse,
    ProviderHealthResponse,
    SystemHealthResponse,
    HealthSummaryResponse,
    ModelAvailabilityRequest,
    ProviderAvailabilityRequest,
    HealthCheckRequest,
    UptimeMetricsResponse,
    ModelStatusResponse,
    ProviderStatusResponse,
    HealthDashboardResponse,
    HealthStatus,
    ProviderStatus
)
from src.services.model_health_monitor import health_monitor
from src.services.model_availability import availability_service
from src.security.deps import get_api_key

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/health", tags=["health"])
async def health_check():
    """
    Simple health check endpoint

    Returns basic health status for monitoring and load balancing
    """
    return {"status": "healthy"}

@router.get("/health/system", response_model=SystemHealthResponse, tags=["health"])
async def get_system_health(api_key: str = Depends(get_api_key)):
    """
    Get overall system health metrics
    
    Returns comprehensive system health information including:
    - Overall system status
    - Provider counts and statuses
    - Model counts and statuses
    - System uptime percentage
    """
    try:
        system_health = health_monitor.get_system_health()
        if not system_health:
            raise HTTPException(status_code=503, detail="System health data not available")
        
        return system_health
    except Exception as e:
        logger.error(f"Failed to get system health: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system health")

@router.get("/health/providers", response_model=List[ProviderHealthResponse], tags=["health"])
async def get_providers_health(
    gateway: Optional[str] = Query(None, description="Filter by specific gateway"),
    api_key: str = Depends(get_api_key)
):
    """
    Get health metrics for all providers
    
    Returns health information for all providers including:
    - Provider status and availability
    - Model counts per provider
    - Response times and uptime
    - Error information
    """
    try:
        providers_health = health_monitor.get_all_providers_health(gateway)
        return providers_health
    except Exception as e:
        logger.error(f"Failed to get providers health: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve providers health")

@router.get("/health/models", response_model=List[ModelHealthResponse], tags=["health"])
async def get_models_health(
    gateway: Optional[str] = Query(None, description="Filter by specific gateway"),
    provider: Optional[str] = Query(None, description="Filter by specific provider"),
    status: Optional[str] = Query(None, description="Filter by health status"),
    api_key: str = Depends(get_api_key)
):
    """
    Get health metrics for all models
    
    Returns health information for all models including:
    - Model status and availability
    - Response times and success rates
    - Error counts and uptime
    - Last check timestamps
    """
    try:
        models_health = health_monitor.get_all_models_health(gateway)
        
        # Apply filters
        if provider:
            models_health = [m for m in models_health if m.provider == provider]
        
        if status:
            models_health = [m for m in models_health if m.status == status]
        
        return models_health
    except Exception as e:
        logger.error(f"Failed to get models health: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve models health")

@router.get("/health/model/{model_id}", response_model=ModelHealthResponse, tags=["health"])
async def get_model_health(
    model_id: str,
    gateway: Optional[str] = Query(None, description="Specific gateway to check"),
    api_key: str = Depends(get_api_key)
):
    """
    Get health metrics for a specific model
    
    Returns detailed health information for the specified model including:
    - Current status and availability
    - Response time metrics
    - Success rate and uptime
    - Error information and timestamps
    """
    try:
        model_health = health_monitor.get_model_health(model_id, gateway)
        if not model_health:
            raise HTTPException(status_code=404, detail=f"Model {model_id} not found or no health data available")
        
        return model_health
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get model health for {model_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve model health")

@router.get("/health/provider/{provider}", response_model=ProviderHealthResponse, tags=["health"])
async def get_provider_health(
    provider: str,
    gateway: Optional[str] = Query(None, description="Specific gateway to check"),
    api_key: str = Depends(get_api_key)
):
    """
    Get health metrics for a specific provider
    
    Returns detailed health information for the specified provider including:
    - Provider status and availability
    - Model counts and health distribution
    - Response time metrics
    - Overall uptime and error information
    """
    try:
        provider_health = health_monitor.get_provider_health(provider, gateway)
        if not provider_health:
            raise HTTPException(status_code=404, detail=f"Provider {provider} not found or no health data available")
        
        return provider_health
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get provider health for {provider}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve provider health")

@router.get("/health/summary", response_model=HealthSummaryResponse, tags=["health"])
async def get_health_summary(api_key: str = Depends(get_api_key)):
    """
    Get comprehensive health summary
    
    Returns a complete health overview including:
    - System health metrics
    - All provider health data
    - All model health data
    - Monitoring status
    """
    try:
        summary = health_monitor.get_health_summary()
        return summary
    except Exception as e:
        logger.error(f"Failed to get health summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve health summary")

@router.post("/health/check", response_model=Dict[str, Any], tags=["health"])
async def perform_health_check(
    request: HealthCheckRequest,
    background_tasks: BackgroundTasks,
    api_key: str = Depends(get_api_key)
):
    """
    Perform immediate health check
    
    Triggers an immediate health check for specified models, providers, or gateways.
    Can be used to force refresh health data.
    """
    try:
        # Start health check in background
        background_tasks.add_task(health_monitor._perform_health_checks)
        
        return {
            "message": "Health check initiated",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "force_refresh": request.force_refresh
        }
    except Exception as e:
        logger.error(f"Failed to initiate health check: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate health check")

@router.post("/health/check/now", response_model=Dict[str, Any], tags=["health", "admin"])
async def perform_immediate_health_check(api_key: str = Depends(get_api_key)):
    """
    Perform immediate health check and return results
    
    This endpoint performs health checks immediately and returns the results.
    Useful for testing and debugging.
    """
    try:
        logger.info("Performing immediate health check...")
        
        # Perform health check synchronously
        await health_monitor._perform_health_checks()
        
        # Get updated data
        system_health = health_monitor.get_system_health()
        models_count = len(health_monitor.health_data)
        providers_count = len(health_monitor.get_all_providers_health())
        
        return {
            "message": "Health check completed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "models_checked": models_count,
            "providers_checked": providers_count,
            "system_status": system_health.overall_status.value if system_health else "unknown",
            "monitoring_active": health_monitor.monitoring_active
        }
    except Exception as e:
        logger.error(f"Failed to perform immediate health check: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to perform health check: {str(e)}")

@router.get("/health/uptime", response_model=UptimeMetricsResponse, tags=["health", "uptime"])
async def get_uptime_metrics(api_key: str = Depends(get_api_key)):
    """
    Get uptime metrics for frontend integration
    
    Returns uptime metrics suitable for frontend status pages including:
    - Current status and uptime percentage
    - Response time averages
    - Request counts and error rates
    - Last incident information
    """
    try:
        system_health = health_monitor.get_system_health()
        if not system_health:
            raise HTTPException(status_code=503, detail="Uptime metrics not available")
        
        # Calculate uptime metrics
        total_requests = sum(m.total_requests for m in health_monitor.get_all_models_health())
        successful_requests = sum(m.total_requests - m.error_count for m in health_monitor.get_all_models_health())
        failed_requests = sum(m.error_count for m in health_monitor.get_all_models_health())
        
        error_rate = (failed_requests / total_requests * 100) if total_requests > 0 else 0.0
        
        # Get average response time
        response_times = [m.avg_response_time_ms for m in health_monitor.get_all_models_health() if m.avg_response_time_ms]
        avg_response_time = sum(response_times) / len(response_times) if response_times else None
        
        # Determine status
        if system_health.overall_status == HealthStatus.HEALTHY:
            status = "operational"
        elif system_health.overall_status == HealthStatus.DEGRADED:
            status = "degraded"
        else:
            status = "outage"
        
        return UptimeMetricsResponse(
            status=status,
            uptime_percentage=system_health.system_uptime,
            response_time_avg=avg_response_time,
            last_incident=None,  # Could be enhanced to track incidents
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            error_rate=error_rate,
            last_updated=system_health.last_updated or datetime.now(timezone.utc)
        )
    except Exception as e:
        logger.error(f"Failed to get uptime metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve uptime metrics")

@router.get("/health/dashboard", response_model=HealthDashboardResponse, tags=["health", "dashboard"])
async def get_health_dashboard(api_key: str = Depends(get_api_key)):
    """
    Get complete health dashboard data for frontend
    
    Returns comprehensive health data formatted for frontend dashboard including:
    - System status with color indicators
    - Provider statuses with counts and metrics
    - Model statuses with response times and uptime
    - Uptime metrics for status page integration
    """
    try:
        logger.info("Starting health dashboard request")
        
        # Import required models at the top
        from src.models.health_models import SystemHealthResponse, HealthStatus, UptimeMetricsResponse
        from datetime import datetime, timezone
        
        # Get system health
        system_health_metrics = health_monitor.get_system_health()
        logger.info(f"System health retrieved: {system_health_metrics is not None}")
        if not system_health_metrics:
            # Create default system health if no data available
            system_health = SystemHealthResponse(
                overall_status=HealthStatus.UNKNOWN,
                total_providers=0,
                healthy_providers=0,
                degraded_providers=0,
                unhealthy_providers=0,
                total_models=0,
                healthy_models=0,
                degraded_models=0,
                unhealthy_models=0,
                system_uptime=0.0,
                last_updated=datetime.now(timezone.utc)
            )
        else:
            # Convert SystemHealthMetrics to SystemHealthResponse
            system_health = SystemHealthResponse(
                overall_status=system_health_metrics.overall_status,
                total_providers=system_health_metrics.total_providers,
                healthy_providers=system_health_metrics.healthy_providers,
                degraded_providers=system_health_metrics.degraded_providers,
                unhealthy_providers=system_health_metrics.unhealthy_providers,
                total_models=system_health_metrics.total_models,
                healthy_models=system_health_metrics.healthy_models,
                degraded_models=system_health_metrics.degraded_models,
                unhealthy_models=system_health_metrics.unhealthy_models,
                system_uptime=system_health_metrics.system_uptime,
                last_updated=system_health_metrics.last_updated or datetime.now(timezone.utc)
            )
        
        # Get providers health
        providers_health = health_monitor.get_all_providers_health()
        logger.info(f"Providers health retrieved: {len(providers_health)} providers")
        providers_status = []
        
        for provider in providers_health:
            # Determine status color
            if provider.status == ProviderStatus.ONLINE:
                status_color = "green"
                status_text = "Online"
            elif provider.status == ProviderStatus.DEGRADED:
                status_color = "yellow"
                status_text = "Degraded"
            else:
                status_color = "red"
                status_text = "Offline"
            
            # Format response time
            response_time_display = None
            if provider.avg_response_time_ms:
                if provider.avg_response_time_ms < 1000:
                    response_time_display = f"{provider.avg_response_time_ms:.0f}ms"
                else:
                    response_time_display = f"{provider.avg_response_time_ms/1000:.1f}s"
            
            providers_status.append(ProviderStatusResponse(
                provider=provider.provider,
                gateway=provider.gateway,
                status=status_text,
                status_color=status_color,
                models_count=provider.total_models,
                healthy_count=provider.healthy_models,
                uptime=f"{provider.overall_uptime:.1f}%",
                avg_response_time=response_time_display
            ))
        
        # Get models health
        models_health = health_monitor.get_all_models_health()
        logger.info(f"Models health retrieved: {len(models_health)} models")
        models_status = []
        
        for model in models_health:
            # Determine status color
            if model.status == HealthStatus.HEALTHY:
                status_color = "green"
                status_text = "Healthy"
            elif model.status == HealthStatus.DEGRADED:
                status_color = "yellow"
                status_text = "Degraded"
            else:
                status_color = "red"
                status_text = "Unhealthy"
            
            # Format response time
            response_time_display = None
            if model.response_time_ms:
                if model.response_time_ms < 1000:
                    response_time_display = f"{model.response_time_ms:.0f}ms"
                else:
                    response_time_display = f"{model.response_time_ms/1000:.1f}s"
            
            # Format last checked
            last_checked_display = None
            if model.last_checked:
                last_checked_display = model.last_checked.strftime("%H:%M:%S")
            
            models_status.append(ModelStatusResponse(
                model_id=model.model_id,
                name=model.model_id.split("/")[-1] if "/" in model.model_id else model.model_id,
                provider=model.provider,
                status=status_text,
                status_color=status_color,
                response_time=response_time_display,
                uptime=f"{model.uptime_percentage:.1f}%",
                last_checked=last_checked_display
            ))
        
        # Get uptime metrics
        logger.info("Getting uptime metrics")
        try:
            uptime_metrics = await get_uptime_metrics(api_key)
            logger.info("Uptime metrics retrieved successfully")
        except HTTPException as e:
            logger.warning(f"Uptime metrics not available (HTTP {e.status_code}), using defaults")
            # Create default uptime metrics if not available
            uptime_metrics = UptimeMetricsResponse(
                status="unknown",
                uptime_percentage=0.0,
                response_time_avg=None,
                last_incident=None,
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                error_rate=0.0,
                last_updated=datetime.now(timezone.utc)
            )
        except Exception as e:
            logger.warning(f"Failed to get uptime metrics, using defaults: {e}")
            # Create default uptime metrics if not available
            uptime_metrics = UptimeMetricsResponse(
                status="unknown",
                uptime_percentage=0.0,
                response_time_avg=None,
                last_incident=None,
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                error_rate=0.0,
                last_updated=datetime.now(timezone.utc)
            )
        
        logger.info("Creating HealthDashboardResponse")
        logger.info(f"System health: {system_health}")
        logger.info(f"Providers count: {len(providers_status)}")
        logger.info(f"Models count: {len(models_status)}")
        logger.info(f"Uptime metrics: {uptime_metrics}")
        
        response = HealthDashboardResponse(
            system_status=system_health,
            providers=providers_status,
            models=models_status,
            uptime_metrics=uptime_metrics,
            last_updated=system_health.last_updated or datetime.now(timezone.utc),
            monitoring_active=health_monitor.monitoring_active
        )
        
        logger.info("HealthDashboardResponse created successfully")
        return response
    except Exception as e:
        logger.error(f"Failed to get health dashboard: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve health dashboard: {str(e)}")

@router.get("/health/status", response_model=Dict[str, Any], tags=["health", "status"])
async def get_health_status(api_key: str = Depends(get_api_key)):
    """
    Get simple health status for quick checks
    
    Returns a simple status response suitable for health checks and monitoring tools.
    """
    try:
        system_health = health_monitor.get_system_health()
        if not system_health:
            return {
                "status": "unknown",
                "message": "Health data not available - monitoring may not be started",
                "monitoring_active": health_monitor.monitoring_active,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        return {
            "status": system_health.overall_status.value,
            "uptime": system_health.system_uptime,
            "healthy_models": system_health.healthy_models,
            "total_models": system_health.total_models,
            "monitoring_active": health_monitor.monitoring_active,
            "timestamp": system_health.last_updated.isoformat() if system_health.last_updated else datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get health status: {e}")
        return {
            "status": "error",
            "message": "Failed to retrieve health status",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

@router.get("/health/monitoring/status", response_model=Dict[str, Any], tags=["health", "admin"])
async def get_monitoring_status(api_key: str = Depends(get_api_key)):
    """
    Get monitoring service status
    
    Returns the status of health and availability monitoring services.
    """
    try:
        return {
            "health_monitoring_active": health_monitor.monitoring_active,
            "availability_monitoring_active": availability_service.monitoring_active,
            "health_data_available": health_monitor.get_system_health() is not None,
            "availability_data_available": len(availability_service.availability_cache) > 0,
            "health_models_count": len(health_monitor.health_data),
            "availability_models_count": len(availability_service.availability_cache),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get monitoring status: {e}")
        return {
            "error": "Failed to retrieve monitoring status",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

@router.post("/health/monitoring/start", response_model=Dict[str, Any], tags=["health", "admin"])
async def start_health_monitoring(api_key: str = Depends(get_api_key)):
    """
    Start health monitoring service
    
    Starts the background health monitoring service.
    """
    try:
        await health_monitor.start_monitoring()
        return {
            "message": "Health monitoring started",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to start health monitoring: {e}")
        raise HTTPException(status_code=500, detail="Failed to start health monitoring")

@router.post("/health/monitoring/stop", response_model=Dict[str, Any], tags=["health", "admin"])
async def stop_health_monitoring(api_key: str = Depends(get_api_key)):
    """
    Stop health monitoring service
    
    Stops the background health monitoring service.
    """
    try:
        await health_monitor.stop_monitoring()
        return {
            "message": "Health monitoring stopped",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to stop health monitoring: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop health monitoring")