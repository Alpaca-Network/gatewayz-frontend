import datetime
import logging

from src.config import Config
from src.db.api_keys import increment_api_key_usage
from src.db.plans import enforce_plan_limits
from src.db.rate_limits import set_user_rate_limits, get_user_rate_limits, create_rate_limit_alert, \
    update_rate_limit_usage
from src.db.trials import get_trial_analytics
from src.db.users import create_enhanced_user, get_user, add_credits_to_user, get_all_users, get_admin_monitor_data, \
    deduct_credits, record_usage
from src.enhanced_notification_service import enhanced_notification_service
from src.main import _provider_cache, _huggingface_cache, _models_cache
from fastapi import APIRouter
from datetime import datetime

import httpx
from fastapi import Depends, HTTPException

from src.models import UserRegistrationResponse, UserRegistrationRequest, AddCreditsRequest, SetRateLimitRequest, \
    ProxyRequest
from src.security.deps import get_api_key

from src.services.models import fetch_huggingface_model, get_cached_models, enhance_model_with_provider_info
from src.services.openrouter_client import make_openrouter_request_openai, process_openrouter_response
from src.services.providers import get_cached_providers, fetch_providers_from_openrouter
from src.services.rate_limiting import get_rate_limit_manager

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
            timestamp=datetime.now(datetime.UTC)
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"API key creation failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Admin endpoints
@router.post("/admin/add_credits", tags=["admin"])
async def admin_add_credits(req: AddCreditsRequest):
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
async def admin_get_all_balances():
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
async def admin_monitor():
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
                "timestamp": datetime.now(datetime.UTC).isoformat(),
                "data": monitor_data,
                "warning": "Data retrieved with errors, some information may be incomplete"
            }

        return {
            "status": "success",
            "timestamp": datetime.now(datetime.UTC).isoformat(),
            "data": monitor_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting admin monitor data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/admin/limit", tags=["admin"])
async def admin_set_rate_limit(req: SetRateLimitRequest):
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


# Chat completion endpoint
@router.post("/v1/chat/completions", tags=["chat"])
async def proxy_chat(req: ProxyRequest, api_key: str = Depends(get_api_key)):
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Get environment tag from an API key
        environment_tag = user.get('environment_tag', 'live')

        # Check plan limits first
        plan_check = enforce_plan_limits(user['id'], 0, environment_tag)  # Check with 0 tokens first
        if not plan_check['allowed']:
            raise HTTPException(
                status_code=429,
                detail=f"Plan limit exceeded: {plan_check['reason']}"
            )

        # Check trial status first (simplified)
        from src.services.trial_validation import validate_trial_access
        trial_validation = validate_trial_access(api_key)

        if not trial_validation['is_valid']:
            if trial_validation.get('is_trial') and trial_validation.get('is_expired'):
                raise HTTPException(
                    status_code=403,
                    detail=trial_validation['error'],
                    headers={"X-Trial-Expired": "true", "X-Trial-End-Date": trial_validation.get('trial_end_date', '')}
                )
            elif trial_validation.get('is_trial'):
                headers = {}
                if 'remaining_tokens' in trial_validation:
                    headers["X-Trial-Remaining-Tokens"] = str(trial_validation['remaining_tokens'])
                if 'remaining_requests' in trial_validation:
                    headers["X-Trial-Remaining-Requests"] = str(trial_validation['remaining_requests'])
                if 'remaining_credits' in trial_validation:
                    headers["X-Trial-Remaining-Credits"] = str(trial_validation['remaining_credits'])

                raise HTTPException(
                    status_code=429,
                    detail=trial_validation['error'],
                    headers=headers
                )
            else:
                raise HTTPException(
                    status_code=403,
                    detail=trial_validation.get('error',
                                                'Access denied. Please start a trial or subscribe to a paid plan.')
                )

        # Skip rate limiting for trial users - they have their own limits
        if not trial_validation.get('is_trial', False):
            rate_limit_manager = get_rate_limit_manager()
            rate_limit_check = await rate_limit_manager.check_rate_limit(api_key, tokens_used=0)
            if not rate_limit_check.allowed:
                # Create rate limit alert
                create_rate_limit_alert(api_key, "rate_limit_exceeded", {
                    "reason": rate_limit_check.reason,
                    "retry_after": rate_limit_check.retry_after,
                    "remaining_requests": rate_limit_check.remaining_requests,
                    "remaining_tokens": rate_limit_check.remaining_tokens
                })

                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: {rate_limit_check.reason}",
                    headers={"Retry-After": str(rate_limit_check.retry_after)} if rate_limit_check.retry_after else None
                )

        if user['credits'] <= 0:
            raise HTTPException(status_code=402, detail="Insufficient credits")

        try:
            messages = [msg.model_dump() for msg in req.messages]
            model = req.model

            optional_params = {}
            if req.max_tokens is not None:
                optional_params['max_tokens'] = req.max_tokens
            if req.temperature is not None:
                optional_params['temperature'] = req.temperature
            if req.top_p is not None:
                optional_params['top_p'] = req.top_p
            if req.frequency_penalty is not None:
                optional_params['frequency_penalty'] = req.frequency_penalty
            if req.presence_penalty is not None:
                optional_params['presence_penalty'] = req.presence_penalty

            response = make_openrouter_request_openai(messages, model, **optional_params)
            processed_response = process_openrouter_response(response)

            usage = processed_response.get('usage', {})
            total_tokens = usage.get('total_tokens', 0)

            # Check plan limits with actual token usage
            plan_check_final = enforce_plan_limits(user['id'], total_tokens, environment_tag)
            if not plan_check_final['allowed']:
                raise HTTPException(
                    status_code=429,
                    detail=f"Plan limit exceeded: {plan_check_final['reason']}"
                )

            # Track trial usage BEFORE generating a response
            if trial_validation.get('is_trial') and not trial_validation.get('is_expired'):
                try:
                    from src.services.trial_validation import track_trial_usage
                    logger.info(f"Tracking trial usage: {total_tokens} tokens, 1 request")
                    success = track_trial_usage(api_key, total_tokens, 1)
                    if success:
                        logger.info("Trial usage tracked successfully")
                    else:
                        logger.warning("Failed to track trial usage")
                except Exception as e:
                    logger.warning(f"Failed to track trial usage: {e}")

            # Final rate limit check with actual token usage

            # Skip final rate limiting for trial users - they have their own limits
            if not trial_validation.get('is_trial', False):
                rate_limit_check_final = await rate_limit_manager.check_rate_limit(api_key, tokens_used=total_tokens)
                if not rate_limit_check_final.allowed:
                    # Create rate limit alert
                    create_rate_limit_alert(api_key, "rate_limit_exceeded", {
                        "reason": rate_limit_check_final.reason,
                        "retry_after": rate_limit_check_final.retry_after,
                        "remaining_requests": rate_limit_check_final.remaining_requests,
                        "remaining_tokens": rate_limit_check_final.remaining_tokens,
                        "tokens_requested": total_tokens
                    })

                    raise HTTPException(
                        status_code=429,
                        detail=f"Rate limit exceeded: {rate_limit_check_final.reason}",
                        headers={"Retry-After": str(
                            rate_limit_check_final.retry_after)} if rate_limit_check_final.retry_after else None
                    )

            # Only check user credits for non-trial users
            if not trial_validation.get('is_trial', False):
                if user['credits'] < total_tokens:
                    raise HTTPException(
                        status_code=402,
                        detail=f"Insufficient credits. Required: {total_tokens}, Available: {user['credits']}"
                    )

            try:
                # Only deduct credits for non-trial users
                if not trial_validation.get('is_trial', False):
                    deduct_credits(api_key, total_tokens)
                    cost = total_tokens * 0.02 / 1000
                    record_usage(user['id'], api_key, req.model, total_tokens, cost)
                update_rate_limit_usage(api_key, total_tokens)

                # Increment API key usage count
                increment_api_key_usage(api_key)

            except ValueError as e:
                logger.error(f"Failed to deduct credits: {e}")
            except Exception as e:
                logger.error(f"Error in usage recording process: {e}")

            # Calculate balance after usage
            if trial_validation.get('is_trial', False):
                # For trial users, show trial credits remaining
                trial_remaining_credits = trial_validation.get('remaining_credits', 0.0)
                processed_response['gateway_usage'] = {
                    'tokens_charged': total_tokens,
                    'trial_credits_remaining': trial_remaining_credits,
                    'user_api_key': f"{api_key[:10]}..."
                }
            else:
                # For non-trial users, show user credits remaining
                processed_response['gateway_usage'] = {
                    'tokens_charged': total_tokens,
                    'user_balance_after': user['credits'] - total_tokens,
                    'user_api_key': f"{api_key[:10]}..."
                }

            return processed_response

        except httpx.HTTPStatusError as e:
            logger.error(f"OpenRouter HTTP error: {e.response.status_code} - {e.response.text}")
            if e.response.status_code == 429:
                raise HTTPException(status_code=429, detail="OpenRouter rate limit exceeded")
            elif e.response.status_code == 401:
                raise HTTPException(status_code=500, detail="OpenRouter authentication error")
            elif e.response.status_code == 400:
                raise HTTPException(status_code=400, detail=f"Invalid request: {e.response.text}")
            else:
                raise HTTPException(status_code=e.response.status_code, detail=f"OpenRouter error: {e.response.text}")

        except httpx.RequestError as e:
            logger.error(f"OpenRouter request error: {e}")
            raise HTTPException(status_code=503, detail=f"OpenRouter service unavailable: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat completion: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Admin cache management endpoints
@router.post("/admin/refresh-providers", tags=["admin"])
async def admin_refresh_providers():
    try:
        # Invalidate provider cache to force refresh
        _provider_cache["data"] = None
        _provider_cache["timestamp"] = None

        providers = get_cached_providers()

        return {
            "status": "success",
            "message": "Provider cache refreshed successfully",
            "total_providers": len(providers) if providers else 0,
            "timestamp": datetime.now(datetime.UTC).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to refresh provider cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh provider cache")


@router.get("/admin/cache-status", tags=["admin"])
async def admin_cache_status():
    try:
        cache_age = None
        if _provider_cache["timestamp"]:
            cache_age = (datetime.now(datetime.UTC) - _provider_cache["timestamp"]).total_seconds()

        return {
            "status": "success",
            "cache_info": {
                "has_data": _provider_cache["data"] is not None,
                "cache_age_seconds": cache_age,
                "ttl_seconds": _provider_cache["ttl"],
                "is_valid": cache_age is not None and cache_age < _provider_cache["ttl"],
                "total_cached_providers": len(_provider_cache["data"]) if _provider_cache["data"] else 0
            },
            "timestamp": datetime.now(datetime.UTC).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get cache status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cache status")


@router.get("/admin/huggingface-cache-status", tags=["admin"])
async def admin_huggingface_cache_status():
    """Get Hugging Face cache status and statistics"""
    try:
        cache_age = None
        if _huggingface_cache["timestamp"]:
            cache_age = (datetime.now(datetime.UTC) - _huggingface_cache["timestamp"]).total_seconds()

        return {
            "huggingface_cache": {
                "age_seconds": cache_age,
                "is_valid": cache_age is not None and cache_age < _huggingface_cache["ttl"],
                "total_cached_models": len(_huggingface_cache["data"]),
                "cached_model_ids": list(_huggingface_cache["data"].keys())
            },
            "timestamp": datetime.now(datetime.UTC).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get Hugging Face cache status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get Hugging Face cache status")


@router.post("/admin/refresh-huggingface-cache", tags=["admin"])
async def admin_refresh_huggingface_cache():
    """Clear Hugging Face cache to force refresh on the next request"""
    try:
        _huggingface_cache["data"] = {}
        _huggingface_cache["timestamp"] = None

        return {
            "message": "Hugging Face cache cleared successfully",
            "timestamp": datetime.now(datetime.UTC).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to clear Hugging Face cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear Hugging Face cache")


@router.get("/admin/test-huggingface/{hugging_face_id}", tags=["admin"])
async def admin_test_huggingface( hugging_face_id: str = "openai/gpt-oss-120b"):
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
            "timestamp": datetime.now(datetime.UTC).isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test Hugging Face API for {hugging_face_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to test Hugging Face API: {str(e)}")


@router.get("/admin/debug-models", tags=["admin"])
async def admin_debug_models():
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
                            datetime.now(datetime.UTC) - _models_cache["timestamp"]).total_seconds() if _models_cache.get(
                    "timestamp") else None
            },
            "providers_cache": {
                "total_providers": len(providers) if providers else 0,
                "sample_providers": sample_providers,
                "cache_timestamp": _provider_cache.get("timestamp"),
                "cache_age_seconds": (
                            datetime.now(datetime.UTC) - _provider_cache["timestamp"]).total_seconds() if _provider_cache.get(
                    "timestamp") else None
            },
            "provider_matching_test": provider_matching_test,
            "timestamp": datetime.now(datetime.UTC).isoformat()
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
                            datetime.now(datetime.UTC) - _provider_cache["timestamp"]).total_seconds() if _provider_cache.get(
                    "timestamp") else None
            },
            "timestamp": datetime.now(datetime.UTC).isoformat()
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
            "timestamp": datetime.now(datetime.UTC).isoformat()
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
            "timestamp": datetime.now(datetime.UTC).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to test OpenRouter providers: {e}")
        return {"error": str(e)}




@router.get("/admin/trial/analytics", tags=["admin"])
async def get_trial_analytics_admin():
    """Get trial analytics and conversion metrics for admin"""
    try:
        analytics = get_trial_analytics()
        return {"success": True, "analytics": analytics}
    except Exception as e:
        logger.error(f"Error getting trial analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get trial analytics")
