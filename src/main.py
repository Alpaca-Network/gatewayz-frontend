import os
import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Import configuration
from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache dictionaries for models and providers
_models_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600  # 1 hour TTL
}

_huggingface_cache = {
    "data": {},
    "timestamp": None,
    "ttl": 3600  # 1 hour TTL
}

_provider_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600  # 1 hour TTL
}


# Admin key validation
def get_admin_key(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    """Validate admin API key"""
    admin_key = credentials.credentials
    if admin_key != os.environ.get("ADMIN_API_KEY", "admin_key_placeholder"):
        raise HTTPException(status_code=401, detail="Invalid admin API key")
    return admin_key


def create_app() -> FastAPI:
    app = FastAPI(
        title="Gatewayz Universal Inference API",
        description="Gateway for AI model access powered by Gatewayz",
        version="2.0.1"
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security
    security = HTTPBearer()

    # ==================== Load All Routes ====================
    logger.info("🚀 Loading application routes...")

    # Define all routes to load
    routes_to_load = [
        ("health", "Health Check"),
        ("ping", "Ping Service"),
        ("catalog", "Model Catalog"),
        ("root", "Root/Home"),
        ("auth", "Authentication"),
        ("users", "User Management"),
        ("api_keys", "API Key Management"),
        ("admin", "Admin Operations"),
        ("audit", "Audit Logs"),
        ("notifications", "Notifications"),
        ("plans", "Subscription Plans"),
        ("rate_limits", "Rate Limiting"),
        ("payments", "Stripe Payments"),
        ("chat", "Chat Completions"),
        ("chat_history", "Chat History"),
        ("ranking", "Model Ranking"),
    ]

    loaded_count = 0
    failed_count = 0

    for module_name, display_name in routes_to_load:
        try:
            # Import the route module
            module = __import__(f"src.routes.{module_name}", fromlist=['router'])
            router = getattr(module, 'router')

            # Include the router
            app.include_router(router)

            # Log success
            logger.info(f"  ✅ {display_name} ({module_name})")
            loaded_count += 1

        except ImportError as e:
            logger.warning(f"  ⚠️  {display_name} ({module_name}) - Module not found: {e}")
            failed_count += 1

        except AttributeError as e:
            logger.error(f"  ❌ {display_name} ({module_name}) - No router found: {e}")
            failed_count += 1

        except Exception as e:
            logger.error(f"  ❌ {display_name} ({module_name}) - Error: {e}")
            failed_count += 1

    # Log summary
    logger.info(f"\n📊 Route Loading Summary:")
    logger.info(f"   ✅ Loaded: {loaded_count}")
    if failed_count > 0:
        logger.warning(f"   ❌ Failed: {failed_count}")
    logger.info(f"   📍 Total: {loaded_count + failed_count}")

    # ==================== Exception Handler ====================

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

    # ==================== Startup Event ====================

    @app.on_event("startup")
    async def on_startup():
        logger.info("\n🔧 Initializing application...")

        try:
            # Validate configuration
            logger.info("  ⚙️  Validating configuration...")
            Config.validate()
            logger.info("  ✅ Configuration validated")

            # Initialize database
            try:
                logger.info("  🗄️  Initializing database...")
                from src.supabase_config import init_db
                init_db()
                logger.info("  ✅ Database initialized")

            except Exception as db_e:
                logger.warning(f"  ⚠️  Database initialization warning: {db_e}")

        except Exception as e:
            logger.error(f"  ❌ Startup initialization failed: {e}")

        logger.info("\n🎉 Application startup complete!")
        logger.info(f"📍 API Documentation: http://localhost:8000/docs")
        logger.info(f"📍 Health Check: http://localhost:8000/health\n")

    # ==================== Shutdown Event ====================

    @app.on_event("shutdown")
    async def on_shutdown():
        logger.info("🛑 Shutting down application...")
        logger.info("✅ Application shutdown complete")

    return app


# Export a default app instance for environments that import `app`
app = create_app()

# Vercel/CLI entry point
if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 Starting Gatewayz API server...")
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)