import datetime
import logging

from src.config import Config

from src.db.rate_limits import set_user_rate_limits, get_user_rate_limits
from src.db.trials import get_trial_analytics
from src.db.users import create_enhanced_user, get_user, add_credits_to_user, get_all_users, get_admin_monitor_data
from src.enhanced_notification_service import enhanced_notification_service
from src.cache import _provider_cache, _huggingface_cache, _models_cache
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

import httpx

from src.schemas import UserRegistrationResponse, UserRegistrationRequest, AddCreditsRequest, SetRateLimitRequest
from src.security.deps import require_admin, get_current_user

from src.services.models import fetch_huggingface_model, get_cached_models, enhance_model_with_provider_info
from src.services.providers import get_cached_providers, fetch_providers_from_openrouter

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/create", response_model=UserRegistrationResponse, tags=["authentication"])
async def create_api_key(request: UserRegistrationRequest):
    """Create an API key for the user after dashboard login"""
    try:
        # Validate input
        if request.environment_tag not in ['test', 'staging', 'live', 'development']:
            raise HTTPException(status_code=400, detail="Invalid environment tag")

        # Create a user account and generate an API key for a dashboard user
        user_data = create_enhanced_user(
            username=request.username,
            email=request.email,
            auth_method=request.auth_method,
            credits=10  # $10 worth of credits (500,000 tokens)
        )

        # Send a welcome email with API key information
        try:
            enhanced_notification_service.send_welcome_email(
                user_id=user_data['user_id'],
                username=user_data['username'],
                email=user_data['email'],
                credits=user_data['credits']
            )
        except Exception as e:
            logger.warning(f"Failed to send welcome email: {e}")

        return UserRegistrationResponse(
            user_id=user_data['user_id'],
            username=user_data['username'],
            email=user_data['email'],
            api_key=user_data['primary_api_key'],
            credits=user_data['credits'],
            environment_tag=request.environment_tag,
            scope_permissions={
                "read": ["models", "usage", "profile"],
                "write": ["chat", "completions", "profile_update"]
            },
            auth_method=request.auth_method,
            subscription_status="trial",
            message="API key created successfully!",
            timestamp=datetime.now(timezone.utc)
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"API key creation failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Admin endpoints
@router.post("/admin/add_credits", tags=["admin"])
async def admin_add_credits(req: AddCreditsRequest, admin_user: dict = Depends(require_admin)):
    try:
        user = get_user(req.api_key)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Add credits to a user account (not a specific key)
        add_credits_to_user(user['id'], req.credits)

        updated_user = get_user(req.api_key)

        return {
            "status": "success",
            "message": f"Added {req.credits} credits to user {user.get('username', user['id'])}",
            "new_balance": updated_user["credits"],
            "user_id": user['id']
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Add credits failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/admin/balance", tags=["admin"])
async def admin_get_all_balances(admin_user: dict = Depends(require_admin)):
    try:
        users = get_all_users()

        user_balances = []
        for user in users:
            user_balances.append({
                "api_key": user["api_key"],
                "credits": user["credits"],
                "created_at": user.get("created_at"),
                "updated_at": user.get("updated_at")
            })

        return {
            "status": "success",
            "total_users": len(user_balances),
            "users": user_balances
        }

    except Exception as e:
        logger.error(f"Error getting all user balances: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/admin/monitor", tags=["admin"])
async def admin_monitor(admin_user: dict = Depends(require_admin)):
    try:
        monitor_data = get_admin_monitor_data()

        if not monitor_data:
            raise HTTPException(status_code=500, detail="Failed to retrieve monitoring data")

        # Check if there's an error in the response
        if "error" in monitor_data:
            logger.error(f"Admin monitor data contains error: {monitor_data['error']}")
            # Still return the data but log the error
            return {
                "status": "success",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": monitor_data,
                "warning": "Data retrieved with errors, some information may be incomplete"
            }

        return {
            "status": "success",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": monitor_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting admin monitor data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/admin/limit", tags=["admin"])
async def admin_set_rate_limit(req: SetRateLimitRequest, admin_user: dict = Depends(require_admin)):
    try:
        set_user_rate_limits(req.api_key, req.rate_limits.model_dump())

        rate_limits = get_user_rate_limits(req.api_key)

        if not rate_limits:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "status": "success",
            "message": f"Rate limits updated for user {req.api_key[:10]}...",
            "rate_limits": {
                "requests_per_minute": rate_limits["requests_per_minute"],
                "requests_per_hour": rate_limits["requests_per_hour"],
                "requests_per_day": rate_limits["requests_per_day"],
                "tokens_per_minute": rate_limits["tokens_per_minute"],
                "tokens_per_hour": rate_limits["tokens_per_hour"],
                "tokens_per_day": rate_limits["tokens_per_day"]
            }
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting rate limits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Admin cache management endpoints
@router.post("/admin/refresh-providers", tags=["admin"])
async def admin_refresh_providers(admin_user: dict = Depends(require_admin)):
    try:
        # Invalidate provider cache to force refresh
        _provider_cache["data"] = None
        _provider_cache["timestamp"] = None

        providers = get_cached_providers()

        return {
            "status": "success",
            "message": "Provider cache refreshed successfully",
            "total_providers": len(providers) if providers else 0,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to refresh provider cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh provider cache")


@router.get("/admin/cache-status", tags=["admin"])
async def admin_cache_status(admin_user: dict = Depends(require_admin)):
    try:
        cache_age = None
        if _provider_cache["timestamp"]:
            cache_age = (datetime.now(timezone.utc) - _provider_cache["timestamp"]).total_seconds()

        return {
            "status": "success",
            "cache_info": {
                "has_data": _provider_cache["data"] is not None,
                "cache_age_seconds": cache_age,
                "ttl_seconds": _provider_cache["ttl"],
                "is_valid": cache_age is not None and cache_age < _provider_cache["ttl"],
                "total_cached_providers": len(_provider_cache["data"]) if _provider_cache["data"] else 0
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get cache status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cache status")


@router.get("/admin/huggingface-cache-status", tags=["admin"])
async def admin_huggingface_cache_status(admin_user: dict = Depends(require_admin)):
    """Get Hugging Face cache status and statistics"""
    try:
        cache_age = None
        if _huggingface_cache["timestamp"]:
            cache_age = (datetime.now(timezone.utc) - _huggingface_cache["timestamp"]).total_seconds()

        return {
            "huggingface_cache": {
                "age_seconds": cache_age,
                "is_valid": cache_age is not None and cache_age < _huggingface_cache["ttl"],
                "total_cached_models": len(_huggingface_cache["data"]),
                "cached_model_ids": list(_huggingface_cache["data"].keys())
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get Hugging Face cache status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get Hugging Face cache status")


@router.post("/admin/refresh-huggingface-cache", tags=["admin"])
async def admin_refresh_huggingface_cache(admin_user: dict = Depends(require_admin)):
    """Clear Hugging Face cache to force refresh on the next request"""
    try:
        _huggingface_cache["data"] = {}
        _huggingface_cache["timestamp"] = None

        return {
            "message": "Hugging Face cache cleared successfully",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to clear Hugging Face cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear Hugging Face cache")


@router.get("/admin/test-huggingface/{hugging_face_id}", tags=["admin"])
async def admin_test_huggingface(hugging_face_id: str = "openai/gpt-oss-120b", admin_user: dict = Depends(require_admin)):
    """Test Hugging Face API response for debugging"""
    try:
        hf_data = fetch_huggingface_model(hugging_face_id)
        if not hf_data:
            raise HTTPException(status_code=404, detail=f"Hugging Face model {hugging_face_id} not found")

        return {
            "hugging_face_id": hugging_face_id,
            "raw_response": hf_data,
            "author_data_extracted": {
                "has_author_data": bool(hf_data.get('author_data')),
                "author_data": hf_data.get('author_data'),
                "author": hf_data.get('author'),
                "extracted_author_data": {
                    "name": hf_data.get('author_data', {}).get('name') if hf_data.get('author_data') else None,
                    "fullname": hf_data.get('author_data', {}).get('fullname') if hf_data.get('author_data') else None,
                    "avatar_url": hf_data.get('author_data', {}).get('avatarUrl') if hf_data.get(
                        'author_data') else None,
                    "follower_count": hf_data.get('author_data', {}).get('followerCount', 0) if hf_data.get(
                        'author_data') else 0
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test Hugging Face API for {hugging_face_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to test Hugging Face API: {str(e)}")


@router.get("/admin/debug-models", tags=["admin"])
async def admin_debug_models(admin_user: dict = Depends(require_admin)):
    """Debug models and providers data for troubleshooting"""
    try:
        # Get raw data
        models = get_cached_models()
        providers = get_cached_providers()

        # Sample some models and providers
        sample_models = models[:3] if models else []
        sample_providers = providers[:3] if providers else []

        # Test provider matching for a sample model
        provider_matching_test = []
        if sample_models and sample_providers:
            for model in sample_models[:2]:
                model_id = model.get('id', '')
                provider_slug = model_id.split('/')[0] if '/' in model_id else None

                matching_provider = None
                if provider_slug:
                    for provider in providers:
                        if provider.get('slug') == provider_slug:
                            matching_provider = provider
                            break

                provider_matching_test.append({
                    "model_id": model_id,
                    "provider_slug": provider_slug,
                    "found_provider": bool(matching_provider),
                    "provider_site_url": matching_provider.get('site_url') if matching_provider else None,
                    "provider_data": matching_provider
                })

        return {
            "models_cache": {
                "total_models": len(models) if models else 0,
                "sample_models": sample_models,
                "cache_timestamp": _models_cache.get("timestamp"),
                "cache_age_seconds": (
                            datetime.now(timezone.utc) - _models_cache["timestamp"]).total_seconds() if _models_cache.get(
                    "timestamp") else None
            },
            "providers_cache": {
                "total_providers": len(providers) if providers else 0,
                "sample_providers": sample_providers,
                "cache_timestamp": _provider_cache.get("timestamp"),
                "cache_age_seconds": (
                            datetime.now(timezone.utc) - _provider_cache["timestamp"]).total_seconds() if _provider_cache.get(
                    "timestamp") else None
            },
            "provider_matching_test": provider_matching_test,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to debug models and providers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to debug: {str(e)}")


@router.get("/test-provider-matching", tags=["debug"])
async def test_provider_matching():
    """Test provider matching logic without authentication"""
    try:
        # Get raw data
        models = get_cached_models()
        providers = get_cached_providers()

        if not models or not providers:
            return {
                "error": "No models or providers data available",
                "models_count": len(models) if models else 0,
                "providers_count": len(providers) if providers else 0
            }

        # Test with a specific model
        test_model = None
        for model in models:
            if 'openai' in model.get('id', '').lower():
                test_model = model
                break

        if not test_model:
            test_model = models[0]  # Use first model as fallback

        model_id = test_model.get('id', '')
        provider_slug = model_id.split('/')[0] if '/' in model_id else None

        # Find a matching provider
        matching_provider = None
        if provider_slug:
            for provider in providers:
                if provider.get('slug') == provider_slug:
                    matching_provider = provider
                    break

        # Test the enhancement function
        enhanced_model = enhance_model_with_provider_info(test_model, providers)

        return {
            "test_model": {
                "id": model_id,
                "provider_slug": provider_slug
            },
            "matching_provider": {
                "found": bool(matching_provider),
                "slug": matching_provider.get('slug') if matching_provider else None,
                "site_url": matching_provider.get('site_url') if matching_provider else None,
                "name": matching_provider.get('name') if matching_provider else None,
                "privacy_policy_url": matching_provider.get('privacy_policy_url') if matching_provider else None,
                "terms_of_service_url": matching_provider.get('terms_of_service_url') if matching_provider else None,
                "status_page_url": matching_provider.get('status_page_url') if matching_provider else None
            },
            "enhanced_model": {
                "provider_slug": enhanced_model.get('provider_slug'),
                "provider_site_url": enhanced_model.get('provider_site_url'),
                "model_logo_url": enhanced_model.get('model_logo_url')
            },
            "available_providers": [
                {
                    "slug": p.get('slug'),
                    "name": p.get('name'),
                    "site_url": p.get('site_url'),
                    "privacy_policy_url": p.get('privacy_policy_url'),
                    "terms_of_service_url": p.get('terms_of_service_url'),
                    "status_page_url": p.get('status_page_url')
                } for p in providers[:5]
            ],
            "cache_info": {
                "provider_cache_timestamp": _provider_cache.get("timestamp"),
                "provider_cache_age": (
                            datetime.now(timezone.utc) - _provider_cache["timestamp"]).total_seconds() if _provider_cache.get(
                    "timestamp") else None
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to test provider matching: {e}")
        return {"error": str(e)}


@router.post("/test-refresh-providers", tags=["debug"])
async def test_refresh_providers():
    """Refresh providers cache and test again"""
    try:
        # Clear provider cache
        _provider_cache["data"] = None
        _provider_cache["timestamp"] = None

        # Fetch fresh data
        fresh_providers = fetch_providers_from_openrouter()

        if not fresh_providers:
            return {"error": "Failed to fetch fresh providers data"}

        # Test the enhancement on fresh data
        test_model = {"id": "openai/gpt-4", "name": "GPT-4"}
        enhanced_model = enhance_model_with_provider_info(test_model, fresh_providers)

        return {
            "fresh_providers_count": len(fresh_providers),
            "sample_providers": [
                {
                    "slug": p.get('slug'),
                    "name": p.get('name'),
                    "privacy_policy_url": p.get('privacy_policy_url'),
                    "terms_of_service_url": p.get('terms_of_service_url'),
                    "status_page_url": p.get('status_page_url')
                } for p in fresh_providers[:3]
            ],
            "enhanced_model": {
                "provider_slug": enhanced_model.get('provider_slug'),
                "provider_site_url": enhanced_model.get('provider_site_url'),
                "model_logo_url": enhanced_model.get('model_logo_url')
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to refresh providers: {e}")
        return {"error": str(e)}


@router.get("/test-openrouter-providers", tags=["debug"])
async def test_openrouter_providers():
    """Test what OpenRouter actually returns for providers"""
    try:
        if not Config.OPENROUTER_API_KEY:
            return {"error": "OpenRouter API key not configured"}

        headers = {
            "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }

        response = httpx.get("https://openrouter.ai/api/v1/providers", headers=headers)
        response.raise_for_status()

        raw_data = response.json()
        providers = raw_data.get("data", [])

        # Find OpenAI provider
        openai_provider = None
        for provider in providers:
            if provider.get('slug') == 'openai':
                openai_provider = provider
                break

        return {
            "total_providers": len(providers),
            "openai_provider_raw": openai_provider,
            "sample_providers": [
                {
                    "slug": p.get('slug'),
                    "name": p.get('name'),
                    "privacy_policy_url": p.get('privacy_policy_url'),
                    "terms_of_service_url": p.get('terms_of_service_url'),
                    "status_page_url": p.get('status_page_url')
                } for p in providers[:5]
            ],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to test OpenRouter providers: {e}")
        return {"error": str(e)}




@router.post("/admin/clear-rate-limit-cache", tags=["admin"])
async def admin_clear_rate_limit_cache(admin_user: dict = Depends(require_admin)):
    """Clear rate limit configuration cache to force reload from database"""
    try:
        from src.services.rate_limiting import get_rate_limit_manager, _rate_limit_manager, _rate_limiter

        # Clear the cached rate limit manager
        manager = get_rate_limit_manager()
        if manager:
            manager.key_configs.clear()
            logger.info("Cleared rate limit manager key_configs cache")

        # Clear the LRU cache by clearing the function cache
        get_rate_limit_manager.cache_clear()

        return {
            "status": "success",
            "message": "Rate limit cache cleared successfully. New requests will reload configuration.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to clear rate limit cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear rate limit cache: {str(e)}")


@router.get("/admin/trial/analytics", tags=["admin"])
async def get_trial_analytics_admin(admin_user: dict = Depends(require_admin)):
    """Get trial analytics and conversion metrics for admin"""
    try:
        analytics = get_trial_analytics()
        return {"success": True, "analytics": analytics}
    except Exception as e:
        logger.error(f"Error getting trial analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get trial analytics")


@router.get("/admin/users", tags=["admin"])
async def get_all_users_info(admin_user: dict = Depends(require_admin)):
    """Get all users information from users table (Admin only)"""
    try:
        from src.config.supabase_config import get_supabase_client
        
        client = get_supabase_client()
        
        # Get all users with their information
        result = client.table('users').select(
            'id, username, email, credits, is_active, role, registration_date, '
            'auth_method, subscription_status, trial_expires_at, created_at, updated_at'
        ).execute()
        
        if not result.data:
            return {
                "status": "success",
                "total_users": 0,
                "users": [],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        users = result.data
        
        # Get additional statistics
        total_users = len(users)
        active_users = len([u for u in users if u.get('is_active', True)])
        admin_users = len([u for u in users if u.get('role') == 'admin'])
        developer_users = len([u for u in users if u.get('role') == 'developer'])
        regular_users = len([u for u in users if u.get('role') == 'user' or u.get('role') is None])
        
        # Calculate total credits across all users
        total_credits = sum(float(u.get('credits', 0)) for u in users)
        
        # Get subscription status breakdown
        subscription_stats = {}
        for user in users:
            status = user.get('subscription_status', 'unknown')
            subscription_stats[status] = subscription_stats.get(status, 0) + 1
        
        return {
            "status": "success",
            "total_users": total_users,
            "statistics": {
                "active_users": active_users,
                "inactive_users": total_users - active_users,
                "admin_users": admin_users,
                "developer_users": developer_users,
                "regular_users": regular_users,
                "total_credits": round(total_credits, 2),
                "average_credits": round(total_credits / total_users, 2) if total_users > 0 else 0,
                "subscription_breakdown": subscription_stats
            },
            "users": users,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting all users info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get users information")


@router.get("/admin/users/{user_id}", tags=["admin"])
async def get_user_info_by_id(user_id: int, admin_user: dict = Depends(require_admin)):
    """Get detailed information for a specific user (Admin only)"""
    try:
        from src.config.supabase_config import get_supabase_client
        
        client = get_supabase_client()
        
        # Get user information
        user_result = client.table('users').select('*').eq('id', user_id).execute()
        
        if not user_result.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = user_result.data[0]
        
        # Get user's API keys
        api_keys_result = client.table('api_keys_new').select('*').eq('user_id', user_id).execute()
        api_keys = api_keys_result.data if api_keys_result.data else []
        
        # Get user's usage records (if available)
        try:
            usage_result = client.table('usage_records').select('*').eq('user_id', user_id).order('created_at', desc=True).limit(10).execute()
            recent_usage = usage_result.data if usage_result.data else []
        except:
            recent_usage = []
        
        # Get user's activity log (if available)
        try:
            activity_result = client.table('activity_log').select('*').eq('user_id', user_id).order('created_at', desc=True).limit(10).execute()
            recent_activity = activity_result.data if activity_result.data else []
        except:
            recent_activity = []
        
        return {
            "status": "success",
            "user": user,
            "api_keys": api_keys,
            "recent_usage": recent_usage,
            "recent_activity": recent_activity,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user info for ID {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user information")