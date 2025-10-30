import os
import logging
import secrets

from fastapi import Depends, FastAPI, HTTPException, Request
from src.services.startup import lifespan
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Import configuration
from src.config import Config
from src.utils.validators import ensure_non_empty_string, ensure_api_key_like

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
    """Validate admin API key with security improvements"""
    admin_key = credentials.credentials
    
    # Input validation
    try:
        ensure_non_empty_string(admin_key, "admin API key")
        ensure_api_key_like(admin_key, field_name="admin API key", min_length=10)
    except ValueError:
        # Do not leak details; preserve current response contract
        raise HTTPException(status_code=401, detail="Invalid admin API key")

    # Get expected key from environment
    expected_key = os.environ.get("ADMIN_API_KEY", "admin_key_placeholder")
    
    # Use constant-time comparison to prevent timing attacks
    if not secrets.compare_digest(admin_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid admin API key")
    
    return admin_key


def create_app() -> FastAPI:
    app = FastAPI(
        title="Gatewayz Universal Inference API",
        description="Gateway for AI model access powered by Gatewayz",
        version="2.0.3",  # Multi-sort strategy for 1204 HuggingFace models + auto :hf-inference suffix
        lifespan=lifespan
    )

    # Add CORS middleware
    # Note: When allow_credentials=True, allow_origins cannot be ["*"]
    # Must specify exact origins for security

    # Environment-aware CORS origins
    # Always include beta.gatewayz.ai for frontend access
    base_origins = [
        "https://beta.gatewayz.ai",
        "https://staging.gatewayz.ai",
    ]
    
    if Config.IS_PRODUCTION:
        allowed_origins = [
            "https://gatewayz.ai",
            "https://www.gatewayz.ai",
        ] + base_origins
    elif Config.IS_STAGING:
        allowed_origins = [
            "http://localhost:3000",  # For testing against staging
            "http://localhost:3001",
        ] + base_origins
    else:  # development
        allowed_origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        ] + base_origins

    # Log CORS configuration for debugging
    logger.info(f"🌐 CORS Configuration:")
    logger.info(f"   Environment: {Config.APP_ENV}")
    logger.info(f"   Allowed Origins: {allowed_origins}")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security
    security = HTTPBearer()

    # ==================== Load All Routes ====================
    logger.info("🚀 Loading application routes...")
    print("🚀 Loading application routes...", flush=True)  # Force output for debugging

    # Write to file for debugging in CI
    try:
        with open("/tmp/route_loading_debug.txt", "w") as f:
            f.write("Starting route loading...\n")
            f.flush()
    except:
        pass

    # Define all routes to load
    # IMPORTANT: chat & messages must be before catalog to avoid /v1/* being caught by /model/{provider}/{model}
    routes_to_load = [
        ("health", "Health Check"),
        ("availability", "Model Availability"),
        ("ping", "Ping Service"),
        ("chat", "Chat Completions"),  # Moved before catalog
        ("messages", "Anthropic Messages API"),  # Claude-compatible endpoint
        ("images", "Image Generation"),  # Image generation endpoints
        ("catalog", "Model Catalog"),
        ("system", "System & Health"),  # Cache management and health monitoring
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
        ("chat_history", "Chat History"),
        ("ranking", "Model Ranking"),
        ("activity", "Activity Tracking"),
        ("coupons", "Coupon Management"),
        ("referral", "Referral System"),
        ("roles", "Role Management"),
        ("transaction_analytics", "Transaction Analytics"),
        ("analytics", "Analytics Events"),  # Server-side Statsig integration

    ]

    loaded_count = 0
    failed_count = 0

    for module_name, display_name in routes_to_load:
        try:
            # Import the route module
            module = __import__(f"src.routes.{module_name}", fromlist=['router'])
            router = getattr(module, 'router')

            # Include the router (all routes now follow clean REST patterns)
            app.include_router(router)

            # Log success
            success_msg = f"  ✅ {display_name} ({module_name})"
            logger.info(success_msg)
            print(success_msg, flush=True)  # Force output for debugging
            loaded_count += 1

        except ImportError as e:
            error_msg = f"  ⚠️  {display_name} ({module_name}) - Module not found: {e}"
            logger.error(error_msg)
            print(error_msg, flush=True)  # Force output for debugging
            logger.error(f"       Full error details: {repr(e)}")
            print(f"       Full error details: {repr(e)}", flush=True)
            import traceback
            tb = traceback.format_exc()
            logger.error(f"       Traceback:\n{tb}")
            print(f"       Traceback:\n{tb}", flush=True)
            failed_count += 1

        except AttributeError as e:
            error_msg = f"  ❌ {display_name} ({module_name}) - No router found: {e}"
            logger.error(error_msg)
            print(error_msg, flush=True)  # Force output for debugging
            failed_count += 1

        except Exception as e:
            error_msg = f"  ❌ {display_name} ({module_name}) - Error: {e}"
            logger.error(error_msg)
            print(error_msg, flush=True)  # Force output for debugging
            import traceback
            print(f"       Traceback:\n{traceback.format_exc()}", flush=True)
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

    # In the on_startup event, add this after database initialization:

    @app.on_event("startup")
    async def on_startup():
        logger.info("\n🔧 Initializing application...")

        try:
            # Validate configuration
            logger.info("  ⚙️  Validating configuration...")
            Config.validate()
            logger.info("  ✅ Configuration validated")

            # Enforce admin key presence in production
            if Config.IS_PRODUCTION and not os.environ.get("ADMIN_API_KEY"):
                logger.error("  ❌ ADMIN_API_KEY is not set in production. Aborting startup.")
                raise RuntimeError("ADMIN_API_KEY is required in production")

            # Initialize database
            try:
                logger.info("  🗄️  Initializing database...")
                from src.config.supabase_config import init_db
                init_db()
                logger.info("  ✅ Database initialized")

            except Exception as db_e:
                logger.warning(f"  ⚠️  Database initialization warning: {db_e}")

            # Set default admin user
            try:
                from src.db.roles import update_user_role, get_user_role, UserRole
                from src.config.supabase_config import get_supabase_client

                ADMIN_EMAIL = Config.ADMIN_EMAIL

                if not ADMIN_EMAIL:
                    logger.warning("  ⚠️  ADMIN_EMAIL not configured in environment variables")
                else:
                    client = get_supabase_client()
                    result = client.table('users').select('id, role').eq('email', ADMIN_EMAIL).execute()

                    if result.data:
                        user = result.data[0]
                        current_role = user.get('role', 'user')

                        if current_role != UserRole.ADMIN:
                            update_user_role(
                                user_id=user['id'],
                                new_role=UserRole.ADMIN,
                                reason="Default admin setup on startup"
                            )
                            logger.info(f"  ✅ Set {ADMIN_EMAIL} as admin")
                        else:
                            logger.info(f"  ℹ️  {ADMIN_EMAIL} is already admin")

            except Exception as admin_e:
                logger.warning(f"  ⚠️  Admin setup warning: {admin_e}")

            # Initialize analytics services (Statsig, PostHog, and Braintrust)
            try:
                logger.info("  📊 Initializing analytics services...")

                # Initialize Statsig
                from src.services.statsig_service import statsig_service
                await statsig_service.initialize()
                logger.info("  ✅ Statsig analytics initialized")

                # Initialize PostHog
                from src.services.posthog_service import posthog_service
                posthog_service.initialize()
                logger.info("  ✅ PostHog analytics initialized")

                # Initialize Braintrust
                try:
                    from braintrust import init_logger
                    braintrust_logger = init_logger(project="Gatewayz Backend")
                    logger.info("  ✅ Braintrust tracing initialized")
                except Exception as bt_e:
                    logger.warning(f"  ⚠️  Braintrust initialization warning: {bt_e}")

            except Exception as analytics_e:
                logger.warning(f"  ⚠️  Analytics initialization warning: {analytics_e}")

            # Warm model caches on startup
            try:
                logger.info("  🔥 Warming model caches...")
                from src.services.models import get_cached_models

                # Warm critical provider caches
                get_cached_models("hug")
                logger.info("  ✅ HuggingFace models cache warmed")

            except Exception as cache_e:
                logger.warning(f"  ⚠️  Cache warming warning: {cache_e}")

        except Exception as e:
            logger.error(f"  ❌ Startup initialization failed: {e}")

        logger.info("\n🎉 Application startup complete!")
        logger.info(f"📍 API Documentation: http://localhost:8000/docs")
        logger.info(f"📍 Health Check: http://localhost:8000/health\n")

    # ==================== Shutdown Event ====================

    @app.on_event("shutdown")
    async def on_shutdown():
        logger.info("🛑 Shutting down application...")

        # Shutdown analytics services gracefully
        try:
            from src.services.statsig_service import statsig_service
            await statsig_service.shutdown()
            logger.info("  ✅ Statsig shutdown complete")
        except Exception as e:
            logger.warning(f"  ⚠️  Statsig shutdown warning: {e}")

        try:
            from src.services.posthog_service import posthog_service
            posthog_service.shutdown()
            logger.info("  ✅ PostHog shutdown complete")
        except Exception as e:
            logger.warning(f"  ⚠️  PostHog shutdown warning: {e}")

    return app


# Export a default app instance for environments that import `app`
app = create_app()

# Vercel/CLI entry point
if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 Starting Gatewayz API server...")
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
