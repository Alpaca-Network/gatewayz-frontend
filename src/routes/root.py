from fastapi import APIRouter

router = APIRouter()

# Root endpoint
@router.get("/", tags=["authentication"])
async def root():
    return {
        "name": "Gatewayz Inference API",
        "version": "2.0.0",
        "description": "A production-ready API gateway for Gatewayz with credit management and monitoring",
        "status": "active",
        "endpoints": {
            "public": [
                "GET /health - Health check with system status",
                "GET /models - Get available AI models from Gatewayz",
                "GET /models/providers - Get provider statistics for available models",
                "GET / - API information (this endpoint)"
            ],
            "admin": [
                "POST /admin/add_credits - Add credits to existing user",
                "GET /admin/balance - Get all user balances and API keys",
                "GET /admin/monitor - System-wide monitoring dashboard",
                "POST /admin/limit - Set rate limits for users",
                "POST /admin/refresh-models - Force refresh model cache",
                "GET /admin/cache-status - Get cache status information"
            ],
            "protected": [
                "GET /user/balance - Get current user balance",
                "GET /user/monitor - User-specific usage metrics",
                "GET /user/limit - Get current user rate limits",
                "GET /user/profile - Get user profile information",
                "PUT /user/profile - Update user profile/settings",
                "DELETE /user/account - Delete user account",
                "POST /user/api-keys - Create new API key",
                "GET /user/api-keys - List all user API keys with security status",
                "PUT /user/api-keys/{key_id} - Update/rotate specific API key (Phase 4)",
                "DELETE /user/api-keys/{key_id} - Delete specific API key",
                "GET /user/api-keys/usage - Get API key usage statistics with audit info",
                "GET /user/api-keys/audit-logs - Get audit logs for security monitoring (Phase 4)",
                "POST /v1/chat/completions - Chat completion with Gatewayz"
            ]
        },
        "features": [
            "Multi-model AI access via Gatewayz",
            "Enhanced model information with pricing and capabilities",
            "Available providers listing with model counts",
            "Smart caching for improved performance",
            "Advanced filtering and search options",
            "Credit-based usage tracking",
            "Real-time rate limiting",
            "Comprehensive monitoring and analytics",
            "Secure API key authentication",
            "Production-ready error handling"
        ],
        "model_endpoint_features": [
            "Pricing information (input/output costs)",
            "Context length and capabilities",
            "Provider information with multiple providers per model",
            "Performance metrics",
            "Usage recommendations",
            "Filtering by category, provider, and features",
            "Caching for fast response times",
            "Provider-specific pricing when available"
        ],
        "documentation": {
            "swagger_ui": "/docs",
            "redoc": "/redoc",
            "openapi_spec": "/openapi.json"
        }
    }
