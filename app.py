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

# Import models directly
from models import (
    AddCreditsRequest, CreateUserRequest, CreateUserResponse, ProxyRequest,
    SetRateLimitRequest, RateLimitResponse, UserMonitorResponse, AdminMonitorResponse,
    UserProfileResponse, UserProfileUpdate, DeleteAccountRequest, DeleteAccountResponse,
    CreateApiKeyRequest, ApiKeyResponse, ListApiKeysResponse, DeleteApiKeyRequest, DeleteApiKeyResponse, ApiKeyUsageResponse,
    UserRegistrationRequest, UserRegistrationResponse, AuthMethod, UpdateApiKeyRequest, UpdateApiKeyResponse
)

# Import database functions directly
from db import (
    create_enhanced_user, deduct_credits, get_user, get_user_count, 
    get_all_users, record_usage, get_user_usage_metrics, get_admin_monitor_data, 
    get_user_rate_limits, set_user_rate_limits, check_rate_limit, update_rate_limit_usage,
    get_user_profile, update_user_profile, delete_user_account,
    create_api_key, get_user_api_keys, delete_api_key, increment_api_key_usage, get_api_key_usage_stats,
    add_credits_to_user, get_api_key_by_id, update_api_key, validate_api_key_permissions,
    get_user_all_api_keys_usage
)

# Import configuration
from config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AI Gateway API",
    description="Gateway for AI model access with credit management",
    version="1.0.0"
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

# Model cache for OpenRouter models
_model_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 300  # 5 minutes
}

def get_cached_models():
    """Get cached models or fetch from OpenRouter if cache is expired"""
    try:
        if _model_cache["data"] and _model_cache["timestamp"]:
            cache_age = (datetime.utcnow() - _model_cache["timestamp"]).total_seconds()
            if cache_age < _model_cache["ttl"]:
                return _model_cache["data"]
        
        # Cache expired or empty, fetch fresh data
        return fetch_models_from_openrouter()
    except Exception as e:
        logger.error(f"Error getting cached models: {e}")
        return None

def invalidate_model_cache():
    """Invalidate the model cache to force refresh"""
    _model_cache["data"] = None
    _model_cache["timestamp"] = None

def fetch_models_from_openrouter():
    """Fetch models from OpenRouter API"""
    try:
        if not Config.OPENROUTER_API_KEY:
            logger.error("OpenRouter API key not configured")
            return None
        
        headers = {
            "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = httpx.get("https://openrouter.ai/api/v1/models", headers=headers)
        response.raise_for_status()
        
        models_data = response.json()
        _model_cache["data"] = models_data.get("data", [])
        _model_cache["timestamp"] = datetime.utcnow()
        
        return _model_cache["data"]
    except Exception as e:
        logger.error(f"Failed to fetch models from OpenRouter: {e}")
        return None

def get_openrouter_client():
    """Get OpenRouter client with proper configuration"""
    try:
        if not Config.OPENROUTER_API_KEY:
            raise ValueError("OpenRouter API key not configured")
        
        return OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=Config.OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": Config.OPENROUTER_SITE_URL,
                "X-Title": Config.OPENROUTER_SITE_NAME
            }
        )
    except Exception as e:
        logger.error(f"Failed to initialize OpenRouter client: {e}")
        raise

def make_openrouter_request_openai(messages, model, **kwargs):
    """Make request to OpenRouter using OpenAI client"""
    try:
        client = get_openrouter_client()
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )
        return response
    except Exception as e:
        logger.error(f"OpenRouter request failed: {e}")
        raise

def process_openrouter_response(response):
    """Process OpenRouter response to extract relevant data"""
    try:
        return {
            "id": response.id,
            "object": response.object,
            "created": response.created,
            "model": response.model,
            "choices": [
                {
                    "index": choice.index,
                    "message": {
                        "role": choice.message.role,
                        "content": choice.message.content
                    },
                    "finish_reason": choice.finish_reason
                }
                for choice in response.choices
            ],
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            } if response.usage else {}
        }
    except Exception as e:
        logger.error(f"Failed to process OpenRouter response: {e}")
        raise

async def get_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate API key from either legacy or new system"""
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
        try:
            from supabase_config import get_supabase_client
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
        except Exception as e:
            logger.warning(f"Error checking new system for key {api_key}: {e}")
        
        # If not found in either system, reject
        raise HTTPException(status_code=401, detail="Invalid API key")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating API key {api_key}: {e}")
        raise HTTPException(status_code=401, detail="Invalid API key")

# Initialize configuration
Config.validate()

try:
    from supabase_config import init_db
    init_db()
except Exception as e:
    logger.error(f"Failed to initialize application: {e}")
    raise

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        user_count = get_user_count()
        
        openrouter_status = "unknown"
        try:
            client = get_openrouter_client()
            # Test connection by trying to get models
            test_models = get_cached_models()
            openrouter_status = "connected" if test_models else "error"
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

# Models endpoints
@app.get("/models", tags=["models"])
async def get_models_endpoint():
    """Get available AI models from OpenRouter"""
    try:
        models = get_cached_models()
        if not models:
            raise HTTPException(status_code=500, detail="Failed to retrieve models")
        
        return {
            "status": "success",
            "total_models": len(models),
            "models": models,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting models: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/models/providers", tags=["models"])
async def get_models_providers():
    """Get provider statistics for available models"""
    try:
        models = get_cached_models()
        if not models:
            raise HTTPException(status_code=500, detail="Failed to retrieve models")
        
        provider_stats = {}
        suggested_count = 0
        pricing_available = 0
        
        for model in models:
            # Count suggested models
            if model.get('suggested', False):
                suggested_count += 1
            
            # Count models with pricing
            if model.get('pricing') and any(model['pricing'].values()):
                pricing_available += 1
            
            # Count by provider
            provider_id = model.get('top_provider', {}).get('id', 'unknown')
            if provider_id not in provider_stats:
                provider_stats[provider_id] = {
                    'name': model.get('top_provider', {}).get('name', provider_id.title()),
                    'model_count': 0,
                    'suggested_models': 0
                }
            
            provider_stats[provider_id]['model_count'] += 1
            if model.get('suggested', False):
                provider_stats[provider_id]['suggested_models'] += 1
        
        return {
            "status": "success",
            "provider_statistics": {
                "total_providers": len(provider_stats),
                "total_models": len(models),
                "suggested_models": suggested_count,
                "pricing_available": pricing_available,
                "providers": provider_stats
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting provider statistics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# User endpoints
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
    """Create a new API key for the user"""
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
                    raise HTTPException(status_code=400, detail=error_message)
                else:
                    raise HTTPException(status_code=400, detail=f"Validation error: {error_message}")
            
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
                raise HTTPException(status_code=400, detail=error_message)
            else:
                raise HTTPException(status_code=400, detail=f"Validation error: {error_message}")
        
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
        
        usage_stats = get_user_all_api_keys_usage(user["id"])
        
        if usage_stats is None:
            raise HTTPException(status_code=500, detail="Failed to retrieve usage statistics")
        
        return usage_stats
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting API key usage: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Authentication endpoints
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

# Admin endpoints
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

# Chat completion endpoint
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

# Admin cache management endpoints
@app.post("/admin/refresh-models", tags=["admin"])
async def admin_refresh_models():
    try:
        invalidate_model_cache()
        models = get_cached_models()
        
        return {
            "status": "success",
            "message": "Model cache refreshed successfully",
            "total_models": len(models) if models else 0,
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

# Root endpoint
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
                "GET /models - Get available AI models from OpenRouter",
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
                "GET /user/api-keys - List all user API keys",
                "PUT /user/api-keys/{key_id} - Update specific API key",
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

# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Vercel deployment entry point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
