import logging
import os
import secrets

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from prometheus_client import REGISTRY, CollectorRegistry, generate_latest

from src.config import Config

# Initialize logging with Loki integration
from src.config.logging_config import configure_logging
from src.constants import FRONTEND_BETA_URL, FRONTEND_STAGING_URL
from src.services.startup import lifespan
from src.utils.validators import ensure_api_key_like, ensure_non_empty_string

configure_logging()
logger = logging.getLogger(__name__)

# Initialize Sentry for error monitoring
if Config.SENTRY_ENABLED and Config.SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=Config.SENTRY_DSN,
        # Add data like request headers and IP for users
        send_default_pii=True,
        # Enable sending logs to Sentry
        enable_logs=True,
        # Set environment (development, staging, production)
        environment=Config.SENTRY_ENVIRONMENT,
        # Set traces_sample_rate to capture transactions for tracing
        traces_sample_rate=Config.SENTRY_TRACES_SAMPLE_RATE,
        # Set profiles_sample_rate to capture profiling data
        profiles_sample_rate=Config.SENTRY_PROFILES_SAMPLE_RATE,
        # Set profile_lifecycle to "trace" to run profiler during transactions
        profile_lifecycle="trace",
    )
    logger.info(f"✅ Sentry initialized (environment: {Config.SENTRY_ENVIRONMENT})")
else:
    logger.info("⏭️  Sentry disabled (SENTRY_ENABLED=false or SENTRY_DSN not set)")

# Constants
ERROR_INVALID_ADMIN_API_KEY = "Invalid admin API key"

# Cache dictionaries for models and providers
_models_cache = {"data": None, "timestamp": None, "ttl": 3600}  # 1 hour TTL

_huggingface_cache = {"data": {}, "timestamp": None, "ttl": 3600}  # 1 hour TTL

_provider_cache = {"data": None, "timestamp": None, "ttl": 3600}  # 1 hour TTL


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
        raise HTTPException(status_code=401, detail=ERROR_INVALID_ADMIN_API_KEY) from None

    # Get expected key from environment
    expected_key = os.environ.get("ADMIN_API_KEY")

    # Ensure admin key is configured
    if not expected_key:
        raise HTTPException(status_code=401, detail=ERROR_INVALID_ADMIN_API_KEY)

    # Use constant-time comparison to prevent timing attacks
    if not secrets.compare_digest(admin_key, expected_key):
        raise HTTPException(status_code=401, detail=ERROR_INVALID_ADMIN_API_KEY)

    return admin_key


def create_app() -> FastAPI:
    app = FastAPI(
        title="Gatewayz Universal Inference API",
        description="Gateway for AI model access powered by Gatewayz",
        version="2.0.3",  # Multi-sort strategy for 1204 HuggingFace models + auto :hf-inference suffix
        lifespan=lifespan,
    )

    # Add CORS middleware
    # Note: When allow_credentials=True, allow_origins cannot be ["*"]
    # Must specify exact origins for security

    # Environment-aware CORS origins
    # Always include beta.gatewayz.ai for frontend access
    base_origins = [
        FRONTEND_BETA_URL,
        FRONTEND_STAGING_URL,
        "https://api.gatewayz.ai",  # Added for chat API access from frontend
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
    logger.info("🌐 CORS Configuration:")
    logger.info(f"   Environment: {Config.APP_ENV}")
    logger.info(f"   Allowed Origins: {allowed_origins}")

    # OPTIMIZED: Add trace context middleware first (for distributed tracing)
    # Middleware order matters! Last added = first executed
    from src.middleware.trace_context_middleware import TraceContextMiddleware

    app.add_middleware(TraceContextMiddleware)
    logger.info("  🔗 Trace context middleware enabled (log-to-trace correlation)")

    # Add CORS middleware second (must be early for OPTIONS requests)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Accept", "Origin"],
    )

    # Add observability middleware for automatic metrics collection
    from src.middleware.observability_middleware import ObservabilityMiddleware

    app.add_middleware(ObservabilityMiddleware)
    logger.info("  📊 Observability middleware enabled (automatic metrics tracking)")

    # OPTIMIZED: Add GZip compression last (larger threshold = 10KB for better CPU efficiency)
    # Only compress large responses (model catalogs, large JSON payloads)
    # This significantly reduces payload size while avoiding compression overhead for small responses
    app.add_middleware(GZipMiddleware, minimum_size=10000)
    logger.info("  🗜  GZip compression middleware enabled (threshold: 10KB, optimized)")

    # Security
    HTTPBearer()

    # ==================== Prometheus Metrics ====================
    logger.info("Setting up Prometheus metrics...")

    # Import metrics module to initialize all metrics
    from fastapi.responses import Response

    # Add Prometheus metrics endpoint
    from prometheus_client import generate_latest

    from src.services import prometheus_metrics  # noqa: F401

    @app.get("/metrics", tags=["monitoring"], include_in_schema=False)
    async def metrics():
        """
        Prometheus metrics endpoint for monitoring.

        Exposes metrics in Prometheus text format including:
        - HTTP request counts and durations
        - Model inference metrics (requests, latency, tokens)
        - Database query metrics
        - Cache hit/miss rates
        - Rate limiting metrics
        - Provider health metrics
        - Business metrics (credits, tokens, subscriptions)
        """
        return Response(generate_latest(REGISTRY), media_type="text/plain; charset=utf-8")

    logger.info("  [OK] Prometheus metrics endpoint at /metrics")

    # ==================== Sentry Debug Endpoint ====================
    if Config.SENTRY_ENABLED and Config.SENTRY_DSN:
        @app.get("/sentry-debug", tags=["monitoring"], include_in_schema=False)
        async def trigger_sentry_error():
            """
            Test endpoint to verify Sentry error tracking is working.
            This will intentionally trigger a division by zero error.
            """
            import sentry_sdk

            # Send test logs to Sentry
            sentry_sdk.logger.info("Testing Sentry logging integration")
            sentry_sdk.logger.warning("This is a test warning message")
            sentry_sdk.logger.error("This is a test error message")

            # Trigger an error to test error tracking
            division_by_zero = 1 / 0  # This will raise ZeroDivisionError
            return {"status": "This line will never execute"}

        logger.info("  [OK] Sentry debug endpoint at /sentry-debug")

    # ==================== Load All Routes ====================
    logger.info("Loading application routes...")

    # Write to file for debugging in CI
    try:
        with open("/tmp/route_loading_debug.txt", "w") as f:
            f.write("Starting route loading...\n")
            f.flush()
    except Exception:
        pass

    # Define all routes to load
    # IMPORTANT: chat & messages must be before catalog to avoid /v1/* being caught by /model/{provider}/{model}
    routes_to_load = [
        ("health", "Health Check"),
        ("availability", "Model Availability"),
        ("ping", "Ping Service"),
        ("chat", "Chat Completions"),  # Moved before catalog
        ("messages", "Anthropic Messages API"),  # Claude-compatible endpoint
        ("ai_sdk", "Vercel AI SDK"),  # AI SDK compatibility endpoint
        ("images", "Image Generation"),  # Image generation endpoints
        ("catalog", "Model Catalog"),
        ("system", "System & Health"),  # Cache management and health monitoring
        (
            "optimization_monitor",
            "Optimization Monitoring",
        ),  # Connection pool, cache, and priority stats
        ("error_monitor", "Error Monitoring"),  # Error detection and auto-fix system
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
            logger.debug(f"  [LOADING] Importing src.routes.{module_name}...")
            module = __import__(f"src.routes.{module_name}", fromlist=["router"])

            if not hasattr(module, "router"):
                raise AttributeError(f"Module 'src.routes.{module_name}' has no 'router' attribute")

            router = module.router
            logger.debug(f"  [LOADING] Router found for {module_name}")

            # Include the router (all routes now follow clean REST patterns)
            app.include_router(router)
            logger.debug(f"  [LOADING] Router included for {module_name}")

            # Log success
            success_msg = f"  [OK] {display_name} ({module_name})"
            logger.info(success_msg)
            loaded_count += 1

        except ImportError as e:
            error_msg = f"  [FAIL] {display_name} ({module_name}) - Import failed"
            logger.error(error_msg)
            logger.error(f"       Error: {str(e)}")
            logger.error(f"       Type: {type(e).__name__}")
            import traceback

            tb = traceback.format_exc()
            logger.error(f"       Traceback:\n{tb}")
            failed_count += 1

            # For critical routes, log more details
            if module_name in ["chat", "messages", "catalog", "health"]:
                logger.error(f"       [CRITICAL] Failed to load critical route: {module_name}")

        except AttributeError as e:
            error_msg = f"  [FAIL] {display_name} ({module_name}) - No router found"
            logger.error(error_msg)
            logger.error(f"       Error: {str(e)}")
            import traceback

            logger.error(f"       Traceback:\n{traceback.format_exc()}")
            failed_count += 1

        except Exception as e:
            error_msg = f"  [FAIL] {display_name} ({module_name}) - Unexpected error"
            logger.error(error_msg)
            logger.error(f"       Error: {str(e)}")
            logger.error(f"       Type: {type(e).__name__}")
            import traceback

            logger.error(f"       Traceback:\n{traceback.format_exc()}")
            failed_count += 1

    # Log summary
    logger.info("\nRoute Loading Summary:")
    logger.info(f"   [OK] Loaded: {loaded_count}")
    if failed_count > 0:
        logger.warning(f"   [FAIL] Failed: {failed_count}")
    logger.info(f"   Total: {loaded_count + failed_count}")

    # ==================== Exception Handler ====================

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)

        # Capture exception in PostHog for error tracking
        try:
            from src.services.posthog_service import posthog_service

            # Extract user info from request if available
            distinct_id = "system"
            properties = {
                "path": request.url.path,
                "method": request.method,
                "error_type": type(exc).__name__,
                "error_message": str(exc),
            }

            # Try to get user ID from request state or headers
            if hasattr(request.state, "user_id"):
                distinct_id = request.state.user_id
            elif "authorization" in request.headers:
                # Use a hash of the auth header as distinct_id if no user_id available
                import hashlib
                auth_hash = hashlib.sha256(
                    request.headers["authorization"].encode()
                ).hexdigest()[:16]
                distinct_id = f"user_{auth_hash}"

            posthog_service.capture_exception(
                exception=exc,
                distinct_id=distinct_id,
                properties=properties
            )
        except Exception as posthog_error:
            logger.warning(f"Failed to capture exception in PostHog: {posthog_error}")

        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    # ==================== Startup Event ====================

    # In the on_startup event, add this after database initialization:

    @app.on_event("startup")
    async def on_startup():
        logger.info("\n🔧 Initializing application...")

        try:
            # Initialize OpenTelemetry tracing
            try:
                from src.config.opentelemetry_config import OpenTelemetryConfig

                OpenTelemetryConfig.initialize()
                OpenTelemetryConfig.instrument_fastapi(app)
            except Exception as otel_e:
                logger.warning(f"    OpenTelemetry initialization warning: {otel_e}")

            # Validate configuration
            logger.info("    Validating configuration...")
            Config.validate()
            logger.info("  [OK] Configuration validated")

            # Warn if admin key is missing in production (don't fail startup)
            if Config.IS_PRODUCTION and not os.environ.get("ADMIN_API_KEY"):
                logger.warning(
                    "  [WARN] ADMIN_API_KEY is not set in production. Admin endpoints will be inaccessible."
                )
                logger.warning(
                    "        Set ADMIN_API_KEY environment variable to enable admin functionality."
                )

            # Initialize database
            try:
                logger.info("    Initializing database...")
                from src.config.supabase_config import init_db

                init_db()
                logger.info("   Database initialized")

            except Exception as db_e:
                logger.warning(f"    Database initialization warning: {db_e}")

            # Set default admin user
            try:
                from src.config.supabase_config import get_supabase_client
                from src.db.roles import UserRole, update_user_role

                ADMIN_EMAIL = Config.ADMIN_EMAIL

                if not ADMIN_EMAIL:
                    logger.warning("    ADMIN_EMAIL not configured in environment variables")
                else:
                    client = get_supabase_client()
                    result = (
                        client.table("users").select("id, role").eq("email", ADMIN_EMAIL).execute()
                    )

                    if result.data:
                        user = result.data[0]
                        current_role = user.get("role", "user")

                        if current_role != UserRole.ADMIN:
                            update_user_role(
                                user_id=user["id"],
                                new_role=UserRole.ADMIN,
                                reason="Default admin setup on startup",
                            )
                            logger.info(f"   Set {ADMIN_EMAIL} as admin")
                        else:
                            logger.info(f"  ℹ  {ADMIN_EMAIL} is already admin")

            except Exception as admin_e:
                logger.warning(f"    Admin setup warning: {admin_e}")

            # Initialize analytics services (Statsig, PostHog, and Braintrust)
            try:
                logger.info("   Initializing analytics services...")

                # Initialize Statsig
                from src.services.statsig_service import statsig_service

                await statsig_service.initialize()
                logger.info("   Statsig analytics initialized")

                # Initialize PostHog
                from src.services.posthog_service import posthog_service

                posthog_service.initialize()
                logger.info("   PostHog analytics initialized")

                # Initialize Braintrust
                try:
                    from braintrust import init_logger

                    init_logger(project="Gatewayz Backend")
                    logger.info("   Braintrust tracing initialized")
                except Exception as bt_e:
                    logger.warning(f"    Braintrust initialization warning: {bt_e}")

            except Exception as analytics_e:
                logger.warning(f"    Analytics initialization warning: {analytics_e}")

            # OPTIMIZED: Warm model caches asynchronously (non-blocking startup)
            async def warm_caches_async():
                """Background task to warm model caches without blocking startup."""
                try:
                    logger.info("  🔥 Warming model caches asynchronously...")
                    from src.services.models import get_cached_models

                    # Warm critical provider caches
                    await asyncio.to_thread(get_cached_models, "hug")
                    logger.info("   ✅ HuggingFace models cache warmed")

                except Exception as cache_e:
                    logger.warning(f"    Cache warming warning: {cache_e}")

            # Start cache warming in background (don't block startup)
            asyncio.create_task(warm_caches_async())
            logger.info("  🔥 Cache warming started in background (non-blocking)")

        except Exception as e:
            logger.error(f"   Startup initialization failed: {e}")

        logger.info("\n🎉 Application startup complete!")
        logger.info(" API Documentation: http://localhost:8000/docs")
        logger.info(" Health Check: http://localhost:8000/health\n")

    # ==================== Shutdown Event ====================

    @app.on_event("shutdown")
    async def on_shutdown():
        logger.info("🛑 Shutting down application...")

        # Shutdown OpenTelemetry
        try:
            from src.config.opentelemetry_config import OpenTelemetryConfig

            OpenTelemetryConfig.shutdown()
        except Exception as e:
            logger.warning(f"    OpenTelemetry shutdown warning: {e}")

        # Shutdown analytics services gracefully
        try:
            from src.services.statsig_service import statsig_service

            await statsig_service.shutdown()
            logger.info("   Statsig shutdown complete")
        except Exception as e:
            logger.warning(f"    Statsig shutdown warning: {e}")

        try:
            from src.services.posthog_service import posthog_service

            posthog_service.shutdown()
            logger.info("   PostHog shutdown complete")
        except Exception as e:
            logger.warning(f"    PostHog shutdown warning: {e}")

    return app


# Export a default app instance for environments that import `app`
app = create_app()

# Vercel/CLI entry point
if __name__ == "__main__":
    import uvicorn

    logger.info(" Starting Gatewayz API server...")
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
