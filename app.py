import os
import secrets
import logging
import json
import uuid
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Dict, Any, List, Optional

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI

from db import (
    create_enhanced_user, deduct_credits, get_user, get_user_count, 
    get_all_users, record_usage, get_user_usage_metrics, get_admin_monitor_data, 
    get_user_rate_limits, set_user_rate_limits, check_rate_limit, update_rate_limit_usage,
    get_user_profile, update_user_profile, delete_user_account,
    create_api_key, get_user_api_keys, delete_api_key, increment_api_key_usage, get_api_key_usage_stats,
    add_credits_to_user, get_api_key_by_id, update_api_key, validate_api_key_permissions
)
from supabase_config import init_db, get_supabase_client, test_connection
from config import Config
from models import (
    AddCreditsRequest, CreateUserRequest, CreateUserResponse, ProxyRequest,
    SetRateLimitRequest, RateLimitResponse, UserMonitorResponse, AdminMonitorResponse,
    UserProfileResponse, UserProfileUpdate, DeleteAccountRequest, DeleteAccountResponse,
    CreateApiKeyRequest, ApiKeyResponse, ListApiKeysResponse, DeleteApiKeyRequest, DeleteApiKeyResponse, ApiKeyUsageResponse,
    UserRegistrationRequest, UserRegistrationResponse, AuthMethod, UpdateApiKeyRequest, UpdateApiKeyResponse
)

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

security = HTTPBearer()

async def get_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=422, detail="Authorization header is required")
    
    api_key = credentials.credentials
    if not api_key:
        raise HTTPException(status_code=401, detail="API key is required")
    
    # Simple validation: check if the API key exists in either system
    try:
        # First try to get user from the old system
        user = get_user(api_key)
        if user:
            return api_key
        
        # If not found in old system, check new system
        client = get_supabase_client()
        key_result = client.table('api_keys').select('*').eq('api_key', api_key).execute()
        
        if key_result.data:
            key_data = key_result.data[0]
            
            # Check if key is active
            if not key_data.get('is_active', True):
                raise HTTPException(status_code=401, detail="API key is inactive")
            
            # Check expiration date
            if key_data.get('expiration_date'):
                try:
                    expiration_str = key_data['expiration_date']
                    if expiration_str:
                        if 'Z' in expiration_str:
                            expiration_str = expiration_str.replace('Z', '+00:00')
                        elif not expiration_str.endswith('+00:00'):
                            expiration_str = expiration_str + '+00:00'
                        
                        expiration = datetime.fromisoformat(expiration_str)
                        now = datetime.utcnow().replace(tzinfo=expiration.tzinfo)
                        
                        if expiration < now:
                            raise HTTPException(status_code=401, detail="API key has expired")
                except Exception as date_error:
                    logger.warning(f"Error checking expiration for key {api_key}: {date_error}")
                    # Continue if we can't parse the date
            
            # Check request limits
            if key_data.get('max_requests'):
                if key_data['requests_used'] >= key_data['max_requests']:
                    raise HTTPException(status_code=429, detail="API key request limit reached")
            
            return api_key
        
        # If not found in either system, reject
        raise HTTPException(status_code=401, detail="Invalid API key")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating API key {api_key}: {e}")
        raise HTTPException(status_code=401, detail="Invalid API key")

def create_openrouter_client():
    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=Config.OPENROUTER_API_KEY,
        )
        return client
    except Exception as e:
        logger.error(f"Failed to create OpenRouter client: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize OpenRouter client")

_model_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 300
}

def get_cached_models():
    now = datetime.utcnow()
    
    if (_model_cache["data"] is not None and 
        _model_cache["timestamp"] is not None and
        (now - _model_cache["timestamp"]).total_seconds() < _model_cache["ttl"]):
        return _model_cache["data"]
    
    try:
        fresh_data = get_openrouter_models()
        _model_cache["data"] = fresh_data
        _model_cache["timestamp"] = now
        return fresh_data
    except Exception as e:
        logger.error(f"Failed to refresh model cache: {e}")
        return _model_cache["data"] if _model_cache["data"] else []

def invalidate_model_cache():
    _model_cache["data"] = None
    _model_cache["timestamp"] = None

@lru_cache(maxsize=1)
def get_openrouter_models_cached():
    return get_openrouter_models()

def get_openrouter_models():
    try:
        client = create_openrouter_client()
        models_page = client.models.list()
        models = list(models_page)
        
        formatted_models = []
        for model in models:
            provider_info = {}
            model_id = model.id
            if '/' in model_id:
                provider_id = model_id.split('/')[0]
                provider_info = {
                    'id': provider_id,
                    'name': provider_id.title()
                }
            else:
                provider_info = {
                    'id': 'unknown',
                    'name': 'Unknown'
                }
            
            pricing_info = {}
            if hasattr(model, 'pricing') and model.pricing:
                if hasattr(model.pricing, 'prompt'):
                    pricing_info['input'] = model.pricing.prompt
                if hasattr(model.pricing, 'completion'):
                    pricing_info['output'] = model.pricing.completion
                if hasattr(model.pricing, 'image'):
                    pricing_info['image'] = model.pricing.image
                if hasattr(model.pricing, 'audio'):
                    pricing_info['audio'] = model.pricing.audio
            
            features = []
            if hasattr(model, 'supported_parameters') and model.supported_parameters:
                features = list(model.supported_parameters)
            
            suggested = False
            model_name = getattr(model, 'name', '').lower()
            if any(keyword in model_name for keyword in ['gpt-4', 'claude', 'gemini', 'opus']):
                suggested = True
            
            deprecated = False
            
            formatted_models.append({
                "id": model.id,
                "name": getattr(model, 'name', model.id),
                "description": getattr(model, 'description', ''),
                "context_length": getattr(model, 'context_length', None),
                "pricing": pricing_info,
                "architecture": getattr(model, 'architecture', {}),
                "top_provider": provider_info,
                "providers": [provider_info],
                "per_request_limits": getattr(model, 'per_request_limits', {}),
                "parameter_limits": {},
                "features": features,
                "suggested": suggested,
                "deprecated": deprecated,
                "supported_parameters": getattr(model, 'supported_parameters', [])
            })
        
        return formatted_models
        
    except Exception as e:
        logger.error(f"Failed to fetch models from OpenRouter: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")

def make_openrouter_request_openai(messages, model="deepseek/deepseek-r1-0528", **kwargs):
    try:
        client = create_openrouter_client()
        
        completion_params = {
            "model": model,
            "messages": messages,
            "extra_headers": {
                "HTTP-Referer": Config.OPENROUTER_SITE_URL,
                "X-Title": Config.OPENROUTER_SITE_NAME,
            },
            "extra_body": {}
        }
        
        for key, value in kwargs.items():
            if value is not None:
                if isinstance(value, (int, float)) and value == 0:
                    completion_params[key] = value
                elif value != 0:
                    completion_params[key] = value
        
        completion = client.chat.completions.create(**completion_params)
        return completion
        
    except Exception as e:
        logger.error(f"OpenRouter request failed: {e}")
        raise HTTPException(status_code=500, detail=f"OpenRouter request failed: {str(e)}")

def process_openrouter_response(completion, method="openai"):
    try:
        if method == "openai":
            if not completion.choices or len(completion.choices) == 0:
                raise HTTPException(status_code=500, detail="No response choices from model")
            
            chat_response = completion.choices[0].message.content
            usage = completion.usage
            total_tokens = usage.total_tokens if usage else 0
            prompt_tokens = usage.prompt_tokens if usage else 0
            completion_tokens = usage.completion_tokens if usage else 0
            model = completion.model
            
        else:
            if not completion.get("choices") or len(completion["choices"]) == 0:
                raise HTTPException(status_code=500, detail="No response choices from model")
            
            chat_response = completion["choices"][0]["message"]["content"]
            usage = completion.get("usage", {})
            total_tokens = usage.get("total_tokens", 0)
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            model = completion.get("model", "unknown")
        
        if not chat_response or chat_response.strip() == "":
            chat_response = "[No response generated]"
        
        return {
            "content": chat_response,
            "usage": {
                "total_tokens": total_tokens,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens
            },
            "model": model
        }
        
    except Exception as e:
        logger.error(f"Failed to process OpenRouter response: {e}")
        raise HTTPException(status_code=500, detail="Failed to process OpenRouter response")

Config.validate()

try:
    init_db()
except Exception as e:
    logger.error(f"Failed to initialize application: {e}")
    raise

app = FastAPI(
    title="OpenRouter AI Gateway",
    description="A gateway service for OpenRouter AI with user management and credit system",
    version="2.0.0",
    openapi_tags=[
        {"name": "authentication", "description": "User authentication and balance operations"},
        {"name": "admin", "description": "Admin operations for user management"},
        {"name": "chat", "description": "Chat completion operations with OpenRouter"}
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    try:
        user_count = get_user_count()
        
        openrouter_status = "unknown"
        try:
            client = create_openrouter_client()
            models = client.models.list()
            openrouter_status = "connected" if models else "error"
        except:
            openrouter_status = "unavailable"
        
        return {
            "status": "healthy", 
            "database": "connected",
            "openrouter": openrouter_status,
            "user_count": user_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy", 
            "database": "disconnected", 
            "openrouter": "unknown",
            "error": str(e)
        }

@app.get("/models/simple", tags=["chat"])
async def get_models_simple(
    category: Optional[str] = Query(None, description="Filter by category (chat, code, image, etc.)"),
    provider: Optional[str] = Query(None, description="Filter by provider (openai, anthropic, etc.)"),
    suggested_only: bool = Query(False, description="Show only suggested models"),
    include_deprecated: bool = Query(False, description="Include deprecated models"),
    limit: int = Query(50, description="Maximum number of models to return", ge=1, le=200)
):
    try:
        models = get_cached_models()
        
        filtered_models = []
        for model in models:
            if model.get("deprecated", False) and not include_deprecated:
                continue
                
            if suggested_only and not model.get("suggested", False):
                continue
                
            if category:
                model_name = model.get("name", "").lower()
                model_desc = model.get("description", "").lower()
                if category.lower() not in model_name and category.lower() not in model_desc:
                    continue
                    
            if provider:
                provider_found = False
                top_provider_id = model.get("top_provider", {}).get("id", "").lower()
                if provider.lower() in top_provider_id:
                    provider_found = True
                if not provider_found and model.get("providers"):
                    for p in model["providers"]:
                        if provider.lower() in p.get("id", "").lower():
                            provider_found = True
                            break
                if not provider_found:
                    continue
            
            enhanced_model = {
                "id": model["id"],
                "name": model.get("name", model["id"]),
                "description": model.get("description", ""),
                "provider": {
                    "id": model.get("top_provider", {}).get("id", "unknown"),
                    "name": model.get("top_provider", {}).get("name", "Unknown")
                },
                "pricing": {
                    "input": model.get("pricing", {}).get("input", "N/A"),
                    "output": model.get("pricing", {}).get("output", "N/A"),
                    "unit": "per 1K tokens"
                },
                "capabilities": {
                    "context_length": model.get("context_length"),
                    "features": model.get("features", []),
                    "architecture": model.get("architecture", {})
                },
                "limits": {
                    "per_request": model.get("per_request_limits", {}),
                    "parameters": model.get("parameter_limits", {})
                },
                "metadata": {
                    "suggested": model.get("suggested", False),
                    "deprecated": model.get("deprecated", False)
                },
                "recommendations": _get_model_recommendations(model)
            }
            
            filtered_models.append(enhanced_model)
        
        filtered_models.sort(key=lambda x: (not x["metadata"]["suggested"], x["name"].lower()))
        
        if limit < len(filtered_models):
            filtered_models = filtered_models[:limit]
        
        total_models = len(filtered_models)
        suggested_count = sum(1 for m in filtered_models if m["metadata"]["suggested"])
        providers = list(set(m["provider"]["id"] for m in filtered_models))
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_models": total_models,
                "suggested_models": suggested_count,
                "providers": providers,
                "filters_applied": {
                    "category": category,
                    "provider": provider,
                    "suggested_only": suggested_only,
                    "include_deprecated": include_deprecated,
                    "limit": limit
                }
            },
            "models": filtered_models,
            "source": "OpenRouter",
            "cache_info": "Models are cached for 5 minutes for better performance"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching enhanced models: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/models/providers", tags=["chat"])
async def get_available_providers():
    try:
        models = get_cached_models()
        
        providers_map = {}
        
        for model in models:
            model_id = model.get("id", "")
            if '/' in model_id:
                provider_id = model_id.split('/')[0]
                
                if provider_id not in providers_map:
                    providers_map[provider_id] = {
                        "id": provider_id,
                        "name": provider_id.title(),
                        "model_count": 0,
                        "suggested_models": 0,
                        "pricing_available": False,
                        "total_context_length": 0,
                        "avg_context_length": 0
                    }
                
                providers_map[provider_id]["model_count"] += 1
                
                if model.get("suggested", False):
                    providers_map[provider_id]["suggested_models"] += 1
                
                pricing = model.get("pricing", {})
                if pricing.get("input") or pricing.get("output"):
                    providers_map[provider_id]["pricing_available"] = True
                
                context_length = model.get("context_length", 0)
                if context_length:
                    providers_map[provider_id]["total_context_length"] += context_length
        
        for provider_id, provider_data in providers_map.items():
            if provider_data["model_count"] > 0:
                provider_data["avg_context_length"] = provider_data["total_context_length"] // provider_data["model_count"]
        
        providers_list = list(providers_map.values())
        providers_list.sort(key=lambda x: x["model_count"], reverse=True)
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "total_providers": len(providers_list),
            "providers": providers_list,
            "source": "OpenRouter"
        }
        
    except Exception as e:
        logger.error(f"Error fetching providers: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def _get_model_recommendations(model: Dict[str, Any]) -> Dict[str, Any]:
    recommendations = {
        "best_for": [],
        "performance": "unknown",
        "cost_efficiency": "unknown"
    }
    
    model_name = model.get("name", "").lower()
    model_id = model.get("id", "").lower()
    features = model.get("features", [])
    pricing = model.get("pricing", {})
    architecture = model.get("architecture", {})
    
    if any(keyword in model_name for keyword in ["gpt", "claude", "gemini"]):
        recommendations["best_for"].append("General conversation")
    
    if any(keyword in model_name for keyword in ["code", "coder", "deepcoder"]):
        recommendations["best_for"].append("Code generation")
    
    if any(keyword in model_name for keyword in ["opus", "ultra", "pro"]):
        recommendations["best_for"].append("Advanced reasoning")
    
    if any(keyword in model_name for keyword in ["vision", "image"]):
        recommendations["best_for"].append("Image analysis")
    
    if "function_calling" in features or "tools" in features:
        recommendations["best_for"].append("Function calling")
    
    if "structured_outputs" in features:
        recommendations["best_for"].append("Structured output")
    
    if "reasoning" in features:
        recommendations["best_for"].append("Reasoning tasks")
    
    input_modalities = architecture.get("input_modalities", [])
    if "image" in input_modalities:
        recommendations["best_for"].append("Multimodal tasks")
    
    context_length = model.get("context_length", 0)
    if context_length:
        if context_length >= 100000:
            recommendations["performance"] = "high"
        elif context_length >= 32000:
            recommendations["performance"] = "medium"
        else:
            recommendations["performance"] = "standard"
    
    input_cost = pricing.get("input", 0)
    output_cost = pricing.get("output", 0)
    
    if input_cost and output_cost:
        try:
            input_cost_float = float(input_cost)
            output_cost_float = float(output_cost)
            total_cost = input_cost_float + output_cost_float
            
            if total_cost <= 0.0001:
                recommendations["cost_efficiency"] = "very_low"
            elif total_cost <= 0.001:
                recommendations["cost_efficiency"] = "low"
            elif total_cost <= 0.01:
                recommendations["cost_efficiency"] = "medium"
            else:
                recommendations["cost_efficiency"] = "high"
        except (ValueError, TypeError):
            recommendations["cost_efficiency"] = "unknown"
    
    provider = model.get("top_provider", {}).get("id", "").lower()
    if provider == "openai":
        if "gpt-4" in model_id:
            recommendations["best_for"].append("High-quality text generation")
        elif "gpt-3.5" in model_id:
            recommendations["best_for"].append("Fast responses")
    elif provider == "anthropic":
        if "claude" in model_id:
            recommendations["best_for"].append("Safety-focused tasks")
    elif provider == "google":
        if "gemini" in model_id:
            recommendations["best_for"].append("Multimodal tasks")
    
    recommendations["best_for"] = list(set(recommendations["best_for"]))
    
    return recommendations

@app.get("/user/balance", tags=["authentication"])
async def get_user_balance(api_key: str = Depends(get_api_key)):
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        return {
            "api_key": f"{api_key[:10]}...",
            "credits": user["credits"],
            "status": "active",
            "user_id": user.get("id")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user balance: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/monitor", tags=["authentication"])
async def user_monitor(api_key: str = Depends(get_api_key)):
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        usage_data = get_user_usage_metrics(api_key)
        
        if not usage_data:
            raise HTTPException(status_code=500, detail="Failed to retrieve usage data")
        
        rate_limits = get_user_rate_limits(api_key)
        rate_limits_data = {}
        
        if rate_limits:
            rate_limits_data = {
                "requests_per_minute": rate_limits["requests_per_minute"],
                "requests_per_hour": rate_limits["requests_per_hour"],
                "requests_per_day": rate_limits["requests_per_day"],
                "tokens_per_minute": rate_limits["tokens_per_minute"],
                "tokens_per_hour": rate_limits["tokens_per_hour"],
                "tokens_per_day": rate_limits["tokens_per_day"]
            }
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": usage_data["user_id"],
            "api_key": f"{api_key[:10]}...",
            "current_credits": usage_data["current_credits"],
            "usage_metrics": usage_data["usage_metrics"],
            "rate_limits": rate_limits_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user monitor data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/limit", tags=["authentication"])
async def user_get_rate_limits(api_key: str = Depends(get_api_key)):
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        rate_limits = get_user_rate_limits(api_key)
        
        if not rate_limits:
            return {
                "status": "success",
                "api_key": f"{api_key[:10]}...",
                "current_limits": {
                    "requests_per_minute": 60,
                    "requests_per_hour": 1000,
                    "requests_per_day": 10000,
                    "tokens_per_minute": 10000,
                    "tokens_per_hour": 100000,
                    "tokens_per_day": 1000000
                },
                "current_usage": {
                    "allowed": True,
                    "reason": "No rate limits configured"
                },
                "reset_times": {
                    "minute": datetime.utcnow().replace(second=0, microsecond=0) + timedelta(minutes=1),
                    "hour": datetime.utcnow().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1),
                    "day": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
                }
            }
        
        current_usage = check_rate_limit(api_key)
        
        return {
            "status": "success",
            "api_key": f"{api_key[:10]}...",
            "current_limits": {
                "requests_per_minute": rate_limits["requests_per_minute"],
                "requests_per_hour": rate_limits["requests_per_hour"],
                "requests_per_day": rate_limits["requests_per_day"],
                "tokens_per_minute": rate_limits["tokens_per_minute"],
                "tokens_per_hour": rate_limits["tokens_per_hour"],
                "tokens_per_day": rate_limits["tokens_per_day"]
            },
            "current_usage": current_usage,
            "reset_times": {
                "minute": datetime.utcnow().replace(second=0, microsecond=0) + timedelta(minutes=1),
                "hour": datetime.utcnow().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1),
                "day": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user rate limits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/profile", response_model=UserProfileResponse, tags=["authentication"])
async def get_user_profile_endpoint(api_key: str = Depends(get_api_key)):
    """Get user profile information"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        profile = get_user_profile(api_key)
        if not profile:
            raise HTTPException(status_code=500, detail="Failed to retrieve user profile")
        
        return profile
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/user/profile", response_model=UserProfileResponse, tags=["authentication"])
async def update_user_profile_endpoint(
    profile_update: UserProfileUpdate,
    api_key: str = Depends(get_api_key)
):
    """Update user profile information"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Validate that at least one field is provided
        if not any([
            profile_update.name is not None,
            profile_update.email is not None,
            profile_update.preferences is not None,
            profile_update.settings is not None
        ]):
            raise HTTPException(status_code=400, detail="At least one profile field must be provided")
        
        # Update user profile
        updated_user = update_user_profile(api_key, profile_update.dict(exclude_unset=True))
        
        if not updated_user:
            raise HTTPException(status_code=500, detail="Failed to update user profile")
        
        # Return updated profile
        profile = get_user_profile(api_key)
        return profile
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")



@app.delete("/user/account", response_model=DeleteAccountResponse, tags=["authentication"])
async def delete_user_account_endpoint(
    confirmation: DeleteAccountRequest,
    api_key: str = Depends(get_api_key)
):
    """Delete user account and all associated data"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Verify confirmation
        if confirmation.confirmation != "DELETE_ACCOUNT":
            raise HTTPException(
                status_code=400, 
                detail="Confirmation must be 'DELETE_ACCOUNT' to proceed with account deletion"
            )
        
        # Delete user account
        success = delete_user_account(api_key)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete user account")
        
        return {
            "status": "success",
            "message": "User account deleted successfully",
            "user_id": user["id"],
            "timestamp": datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user account: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# API Key Management Endpoints
@app.post("/user/api-keys", tags=["authentication"])
async def create_user_api_key(
    request: CreateApiKeyRequest,
    api_key: str = Depends(get_api_key)
):
    """Create a new API key or change primary key for the user"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Validate permissions - check if user can create keys
        if not validate_api_key_permissions(api_key, "write", "api_keys"):
            raise HTTPException(status_code=403, detail="Insufficient permissions to create API keys")
        
        if request.action == 'create':
            # Validate input
            if request.expiration_days is not None and request.expiration_days <= 0:
                raise HTTPException(status_code=400, detail="Expiration days must be positive")
            
            if request.max_requests is not None and request.max_requests <= 0:
                raise HTTPException(status_code=400, detail="Max requests must be positive")
            
            # Validate environment tag
            valid_environments = ['test', 'staging', 'live', 'development']
            if request.environment_tag not in valid_environments:
                raise HTTPException(status_code=400, detail=f"Invalid environment tag. Must be one of: {valid_environments}")
            
            # Create new API key
            try:
                new_api_key = create_api_key(
                    user_id=user["id"],
                    key_name=request.key_name,
                    environment_tag=request.environment_tag,
                    scope_permissions=request.scope_permissions,
                    expiration_days=request.expiration_days,
                    max_requests=request.max_requests,
                    ip_allowlist=request.ip_allowlist,
                    domain_referrers=request.domain_referrers
                )
            except ValueError as ve:
                # Handle specific validation errors
                error_message = str(ve)
                if "already exists" in error_message:
                    return JSONResponse(
                        status_code=400,
                        content={"detail": error_message}
                    )
                else:
                    return JSONResponse(
                        status_code=400,
                        content={"detail": f"Validation error: {error_message}"}
                    )
            
            return {
                "status": "success",
                "message": "API key created successfully",
                "api_key": new_api_key,
                "key_name": request.key_name,
                "environment_tag": request.environment_tag
            }
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Must be 'create'")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating/changing API key: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/user/api-keys/{key_id}", tags=["authentication"])
async def update_user_api_key_endpoint(
    key_id: int,
    request: UpdateApiKeyRequest,
    api_key: str = Depends(get_api_key)
):
    """Update an existing API key for the user"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Validate permissions - check if user can update keys
        if not validate_api_key_permissions(api_key, "write", "api_keys"):
            raise HTTPException(status_code=403, detail="Insufficient permissions to update API keys")
        
        # Verify user owns the key
        key_to_update = get_api_key_by_id(key_id, user["id"])
        
        if not key_to_update:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Prepare updates (only include fields that were provided)
        updates = {}
        if request.key_name is not None:
            updates['key_name'] = request.key_name
        if request.scope_permissions is not None:
            updates['scope_permissions'] = request.scope_permissions
        if request.expiration_days is not None:
            updates['expiration_days'] = request.expiration_days
        if request.max_requests is not None:
            updates['max_requests'] = request.max_requests
        if request.ip_allowlist is not None:
            updates['ip_allowlist'] = request.ip_allowlist
        if request.domain_referrers is not None:
            updates['domain_referrers'] = request.domain_referrers
        if request.is_active is not None:
            updates['is_active'] = request.is_active
        
        if not updates:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        # Update the key in the database
        try:
            success = update_api_key(api_key, user["id"], updates)
            
            if not success:
                raise HTTPException(status_code=500, detail="Failed to update API key")
        except ValueError as ve:
            # Handle specific validation errors
            error_message = str(ve)
            if "already exists" in error_message:
                return JSONResponse(
                    status_code=400,
                    content={"detail": error_message}
                )
            else:
                return JSONResponse(
                    status_code=400,
                    content={"detail": f"Validation error: {error_message}"}
                )
        
        # Get the updated key details
        updated_key = get_api_key_by_id(key_id, user["id"])
        
        if not updated_key:
            raise HTTPException(status_code=500, detail="Failed to retrieve updated key details")
        
        return UpdateApiKeyResponse(
            status="success",
            message="API key updated successfully",
            updated_key=ApiKeyResponse(**updated_key),
            timestamp=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating API key: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/api-keys", tags=["authentication"])
async def list_user_api_keys(api_key: str = Depends(get_api_key)):
    """Get all API keys for the authenticated user"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Validate permissions - check if user can read their keys
        if not validate_api_key_permissions(api_key, "read", "api_keys"):
            raise HTTPException(status_code=403, detail="Insufficient permissions to view API keys")
        
        keys = get_user_api_keys(user["id"])
        
        return ListApiKeysResponse(
            status="success",
            total_keys=len(keys),
            keys=keys
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing API keys: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/user/api-keys/{key_id}", tags=["authentication"])
async def delete_user_api_key(
    key_id: int,
    confirmation: DeleteApiKeyRequest,
    api_key: str = Depends(get_api_key)
):
    """Delete an API key for the user"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Verify confirmation
        if confirmation.confirmation != "DELETE_KEY":
            raise HTTPException(
                status_code=400, 
                detail="Confirmation must be 'DELETE_KEY' to proceed with key deletion"
            )
        
        # Delete the API key
        success = delete_api_key(key_id, user["id"])
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete API key")
        
        return {
            "status": "success",
            "message": "API key deleted successfully",
            "deleted_key_id": key_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting API key: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/api-keys/usage", tags=["authentication"])
async def get_user_api_key_usage(api_key: str = Depends(get_api_key)):
    """Get usage statistics for all API keys of the user"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        usage_stats = get_api_key_usage_stats(api_key)
        
        if usage_stats is None:
            raise HTTPException(status_code=500, detail="Failed to retrieve usage statistics")
        
        return usage_stats
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting API key usage: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/", tags=["authentication"])
async def root():
    return {
        "name": "OpenRouter AI Gateway",
        "version": "2.0.0",
        "description": "A production-ready API gateway for OpenRouter with credit management and monitoring",
        "status": "active",
        "endpoints": {
            "public": [
                "GET /health - Health check with system status",
                "GET /models/simple - Get available AI models with enhanced metrics",
                "GET /models/providers - Get list of available inference providers",
                "GET / - API information (this endpoint)"
            ],
            "admin": [
                "POST /admin/create_user - Create new user with API key",
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
                "POST /user/change-api-key - Generate new API key",
                "DELETE /user/account - Delete user account",
                "POST /user/api-keys - Create new API key",
                "GET /user/api-keys - List all user API keys",
                "DELETE /user/api-keys/{key_id} - Delete specific API key",
                "GET /user/api-keys/usage - Get API key usage statistics",
                "POST /v1/chat/completions - Chat completion with OpenRouter"
            ]
        },
        "features": [
            "Multi-model AI access via OpenRouter",
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

@app.post("/auth/register", response_model=UserRegistrationResponse, tags=["authentication"])
async def user_register(request: UserRegistrationRequest):
    """Register a new user with unified API key system"""
    try:
        # Validate input
        if request.initial_credits < 0:
            raise HTTPException(status_code=400, detail="Initial credits must be non-negative")
        
        if request.environment_tag not in ['test', 'staging', 'live', 'development']:
            raise HTTPException(status_code=400, detail="Invalid environment tag")
        
        # Create user with enhanced fields
        user_data = create_enhanced_user(
            username=request.username,
            email=request.email,
            auth_method=request.auth_method,
            credits=request.initial_credits
        )
        
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
            message="User registered successfully with primary API key",
            timestamp=datetime.utcnow()
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"User registration failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/admin/add_credits", tags=["admin"])
async def admin_add_credits(req: AddCreditsRequest):
    try:
        user = get_user(req.api_key)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Add credits to user account (not specific key)
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

@app.get("/admin/balance", tags=["admin"])
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

@app.get("/admin/monitor", tags=["admin"])
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
                "timestamp": datetime.utcnow().isoformat(),
                "data": monitor_data,
                "warning": "Data retrieved with errors, some information may be incomplete"
            }
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "data": monitor_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting admin monitor data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/admin/limit", tags=["admin"])
async def admin_set_rate_limit(req: SetRateLimitRequest):
    try:
        set_user_rate_limits(req.api_key, req.rate_limits.dict())
        
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

@app.post("/v1/chat/completions", tags=["chat"])
async def proxy_chat(req: ProxyRequest, api_key: str = Depends(get_api_key)):
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        rate_limit_check = check_rate_limit(api_key, tokens_used=0)
        if not rate_limit_check['allowed']:
            raise HTTPException(
                status_code=429, 
                detail=f"Rate limit exceeded: {rate_limit_check['reason']}"
            )
        
        if user['credits'] <= 0:
            raise HTTPException(status_code=402, detail="Insufficient credits")

        try:
            messages = [msg.dict() for msg in req.messages]
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
            
            rate_limit_check = check_rate_limit(api_key, tokens_used=total_tokens)
            if not rate_limit_check['allowed']:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Rate limit exceeded: {rate_limit_check['reason']}"
                )
            
            if user['credits'] < total_tokens:
                raise HTTPException(
                    status_code=402, 
                    detail=f"Insufficient credits. Required: {total_tokens}, Available: {user['credits']}"
                )
            
            try:
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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

@app.post("/admin/refresh-models", tags=["admin"])
async def admin_refresh_models():
    try:
        invalidate_model_cache()
        models = get_cached_models()
        
        return {
            "status": "success",
            "message": "Model cache refreshed successfully",
            "total_models": len(models),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to refresh model cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh model cache")

@app.get("/admin/cache-status", tags=["admin"])
async def admin_cache_status():
    try:
        cache_age = None
        if _model_cache["timestamp"]:
            cache_age = (datetime.utcnow() - _model_cache["timestamp"]).total_seconds()
        
        return {
            "status": "success",
            "cache_info": {
                "has_data": _model_cache["data"] is not None,
                "cache_age_seconds": cache_age,
                "ttl_seconds": _model_cache["ttl"],
                "is_valid": cache_age is not None and cache_age < _model_cache["ttl"],
                "total_cached_models": len(_model_cache["data"]) if _model_cache["data"] else 0
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get cache status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cache status")



# Vercel deployment entry point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
