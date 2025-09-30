import os
import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Import models directly

# Import Phase 4 security modules
# Phase 4 security features integrated into existing endpoints

# Import database functions directly

# Import new rate limiting module

# Import notification modules

# Import configuration
from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# Admin key validation
def get_admin_key(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    """Validate admin API key"""
    admin_key = credentials.credentials
    # You should replace this with your actual admin key validation logic
    # For now, using a simple check - replace with proper validation
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

    # Include API routes
    try:
        from src.routes import root as root_routes
        app.include_router(root_routes.router)
    except Exception as e:
        logger.error(f"Failed to include root routes: {e}")

    try:
        from src.routes import health as health_routes
        app.include_router(health_routes.router)
    except Exception as e:
        logger.error(f"Failed to include health routes: {e}")

    try:
        from src.routes import catalog as catalog_routes
        app.include_router(catalog_routes.router)
    except Exception as e:
        logger.error(f"Failed to include catalog routes: {e}")

    # Exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

    # Startup initialization
    @app.on_event("startup")
    async def on_startup():
        try:
            # Validate configuration and initialize database lazily at startup
            Config.validate()
            try:
                from src.supabase_config import init_db
                init_db()
            except Exception as db_e:
                # Log and continue to allow tests/mocks to override
                logger.error(f"Database initialization failed at startup: {db_e}")
        except Exception as e:
            logger.error(f"Startup initialization failed: {e}")

    return app


# Export a default app instance for environments that import `app`
app = create_app()

# Vercel/CLI entry point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000)
