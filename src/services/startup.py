"""
Startup service for initializing health monitoring, availability services, and connection pools
"""

import logging
from contextlib import asynccontextmanager

from src.services.connection_pool import clear_connection_pools, get_pool_stats
from src.services.model_availability import availability_service
from src.services.model_health_monitor import health_monitor
from src.services.response_cache import get_cache

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

        # Initialize connection pools (they're lazy-loaded, but log readiness)
        pool_stats = get_pool_stats()
        logger.info(f"Connection pool manager ready: {pool_stats}")

        # Initialize response cache
        get_cache()
        logger.info("Response cache initialized")

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

        # Clear connection pools
        clear_connection_pools()
        logger.info("Connection pools cleared")

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
