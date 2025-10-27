"""
Startup service for initializing health monitoring and availability services
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from src.services.model_health_monitor import health_monitor
from src.services.model_availability import availability_service

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app):
    """
    Application lifespan manager for startup and shutdown events
    """
    # Startup
    logger.info("Starting health monitoring and availability services...")
    
    try:
        # Start health monitoring
        await health_monitor.start_monitoring()
        logger.info("Health monitoring service started")
        
        # Start availability monitoring
        await availability_service.start_monitoring()
        logger.info("Availability monitoring service started")
        
        logger.info("All monitoring services started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start monitoring services: {e}")
        # Don't fail startup if monitoring fails
    
    yield
    
    # Shutdown
    logger.info("Shutting down monitoring services...")
    
    try:
        # Stop availability monitoring
        await availability_service.stop_monitoring()
        logger.info("Availability monitoring service stopped")
        
        # Stop health monitoring
        await health_monitor.stop_monitoring()
        logger.info("Health monitoring service stopped")
        
        logger.info("All monitoring services stopped successfully")
        
    except Exception as e:
        logger.error(f"Error stopping monitoring services: {e}")

async def initialize_services():
    """
    Initialize all monitoring services
    """
    try:
        logger.info("Initializing monitoring services...")
        
        # Start health monitoring
        await health_monitor.start_monitoring()
        
        # Start availability monitoring
        await availability_service.start_monitoring()
        
        logger.info("All services initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise

async def shutdown_services():
    """
    Shutdown all monitoring services
    """
    try:
        logger.info("Shutting down services...")
        
        # Stop availability monitoring
        await availability_service.stop_monitoring()
        
        # Stop health monitoring
        await health_monitor.stop_monitoring()
        
        logger.info("All services shut down successfully")
        
    except Exception as e:
        logger.error(f"Error shutting down services: {e}")
