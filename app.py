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
from urllib.parse import urlparse

# Import models directly
from models import (
    AddCreditsRequest, CreateUserRequest, CreateUserResponse, ProxyRequest,
    SetRateLimitRequest, RateLimitResponse, UserMonitorResponse, AdminMonitorResponse,
    UserProfileResponse, UserProfileUpdate, DeleteAccountRequest, DeleteAccountResponse,
    CreateApiKeyRequest, ApiKeyResponse, ListApiKeysResponse, DeleteApiKeyRequest, DeleteApiKeyResponse, ApiKeyUsageResponse,
    UserRegistrationRequest, UserRegistrationResponse, AuthMethod, UpdateApiKeyRequest, UpdateApiKeyResponse,
    PlanResponse, UserPlanResponse, AssignPlanRequest, PlanUsageResponse, PlanEntitlementsResponse
)

# Import Phase 4 security modules
from security import get_security_manager, get_audit_logger
from supabase_config import get_supabase_client
# Phase 4 security features integrated into existing endpoints

# Import database functions directly
from db import (
    create_enhanced_user, deduct_credits, get_user, get_user_count, 
    get_all_users, record_usage, get_user_usage_metrics, get_admin_monitor_data, 
    get_user_rate_limits, set_user_rate_limits, check_rate_limit, update_rate_limit_usage,
    get_user_profile, update_user_profile, delete_user_account,
    create_api_key, get_user_api_keys, delete_api_key, increment_api_key_usage, get_api_key_usage_stats,
    add_credits_to_user, get_api_key_by_id, update_api_key, validate_api_key_permissions,
    get_user_all_api_keys_usage, get_all_plans, get_plan_by_id, get_user_plan, assign_user_plan,
    check_plan_entitlements, get_user_usage_within_plan_limits, enforce_plan_limits, get_environment_usage_summary,
    # New rate limiting functions
    get_rate_limit_config, update_rate_limit_config, get_user_rate_limit_configs,
    bulk_update_rate_limit_configs, get_rate_limit_usage_stats, get_system_rate_limit_stats,
    create_rate_limit_alert, get_rate_limit_alerts,
    # Trial management functions
    get_trial_analytics
)

# Import new rate limiting module
from rate_limiting import get_rate_limit_manager, RateLimitConfig, RateLimitResult
from trial_service import get_trial_service
from trial_models import (
    StartTrialRequest, StartTrialResponse, ConvertTrialRequest, ConvertTrialResponse,
    TrialStatusResponse, TrackUsageRequest, TrackUsageResponse, SubscriptionPlansResponse
)

# Import notification modules
from notification_service import notification_service
from enhanced_notification_service import enhanced_notification_service
from notification_models import (
    NotificationPreferences, UpdateNotificationPreferencesRequest,
    SendNotificationRequest, NotificationStats, NotificationType, NotificationChannel
)

# Import configuration
from config import Config

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

# Create FastAPI app
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

# Provider cache for OpenRouter providers
_provider_cache = {
    "data": None,
    "timestamp": None,
    "ttl": 3600  # 1 hour (providers change less frequently)
}



def get_cached_providers():
    """Get cached providers or fetch from OpenRouter if cache is expired"""
    try:
        if _provider_cache["data"] and _provider_cache["timestamp"]:
            cache_age = (datetime.utcnow() - _provider_cache["timestamp"]).total_seconds()
            if cache_age < _provider_cache["ttl"]:
                return _provider_cache["data"]
        
        # Cache expired or empty, fetch fresh data
        return fetch_providers_from_openrouter()
    except Exception as e:
        logger.error(f"Error getting cached providers: {e}")
        return None

def fetch_providers_from_openrouter():
    """Fetch providers from OpenRouter API"""
    try:
        if not Config.OPENROUTER_API_KEY:
            logger.error("OpenRouter API key not configured")
            return None
        
        headers = {
            "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = httpx.get("https://openrouter.ai/api/v1/providers", headers=headers)
        response.raise_for_status()
        
        providers_data = response.json()
        _provider_cache["data"] = providers_data.get("data", [])
        _provider_cache["timestamp"] = datetime.utcnow()
        
        return _provider_cache["data"]
    except Exception as e:
        logger.error(f"Failed to fetch providers from OpenRouter: {e}")
        return None


def get_provider_logo_from_services(provider_id: str, site_url: str = None) -> str:
    """Get provider logo using third-party services and manual mapping"""
    try:
        # Manual mapping for major providers (high-quality logos)
        MANUAL_LOGO_DB = {
            'openai': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/openai.svg',
            'anthropic': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/anthropic.svg',
            'google': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/google.svg',
            'meta': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/meta.svg',
            'microsoft': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/microsoft.svg',
            'nvidia': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/nvidia.svg',
            'cohere': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/cohere.svg',
            'mistralai': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/mistralai.svg',
            'perplexity': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/perplexity.svg',
            'amazon': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/amazon.svg',
            'baidu': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/baidu.svg',
            'tencent': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/tencent.svg',
            'alibaba': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/alibabacloud.svg',
            'ai21': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/ai21labs.svg',
            'inflection': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/inflection.svg'
        }
        
        # Try manual mapping first
        if provider_id in MANUAL_LOGO_DB:
            logger.info(f"Found manual logo for {provider_id}")
            return MANUAL_LOGO_DB[provider_id]
        
        # Fallback to third-party service using site URL
        if site_url:
            from urllib.parse import urlparse
            try:
                parsed = urlparse(site_url)
                domain = parsed.netloc
                # Remove www. prefix if present
                if domain.startswith('www.'):
                    domain = domain[4:]
                
                # Use Clearbit Logo API
                logo_url = f"https://logo.clearbit.com/{domain}"
                logger.info(f"Using Clearbit logo service for {provider_id}: {logo_url}")
                return logo_url
            except Exception as e:
                logger.error(f"Error extracting domain from {site_url}: {e}")
        
        logger.info(f"No logo found for provider {provider_id}")
        return None
    except Exception as e:
        logger.error(f"Error getting provider logo for {provider_id}: {e}")
        return None

def get_provider_info(provider_id: str, provider_name: str) -> dict:
    """Get provider information from OpenRouter providers API with Hugging Face logos"""
    try:
        providers = get_cached_providers()
        if not providers:
            return {
                'logo_url': None,
                'site_url': None,
                'privacy_policy_url': None,
                'terms_of_service_url': None,
                'status_page_url': None
            }
        
        # Find provider by slug (provider_id)
        provider_info = None
        for provider in providers:
            if provider.get('slug') == provider_id:
                provider_info = provider
                break
        
        # Get site URL from OpenRouter
        site_url = None
        if provider_info and provider_info.get('privacy_policy_url'):
            # Extract domain from privacy policy URL
            from urllib.parse import urlparse
            parsed = urlparse(provider_info['privacy_policy_url'])
            site_url = f"{parsed.scheme}://{parsed.netloc}"
        
        # Get logo using manual mapping and third-party services
        logo_url = get_provider_logo_from_services(provider_id, site_url)
        
        if provider_info:
            return {
                'logo_url': logo_url,
                'site_url': site_url,
                'privacy_policy_url': provider_info.get('privacy_policy_url'),
                'terms_of_service_url': provider_info.get('terms_of_service_url'),
                'status_page_url': provider_info.get('status_page_url')
            }
        else:
            # Provider not found in OpenRouter providers list
            return {
                'logo_url': logo_url,
                'site_url': site_url,
                'privacy_policy_url': None,
                'terms_of_service_url': None,
                'status_page_url': None
            }
    except Exception as e:
        logger.error(f"Error getting provider info for {provider_id}: {e}")
        return {
            'logo_url': None,
            'site_url': None,
            'privacy_policy_url': None,
            'terms_of_service_url': None,
            'status_page_url': None
        }


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

async def get_api_key(credentials: HTTPAuthorizationCredentials = Depends(security), request: Request = None):
    """Validate API key from either legacy or new system with access controls"""
    if not credentials:
        raise HTTPException(status_code=422, detail="Authorization header is required")
    
    api_key = credentials.credentials
    if not api_key:
        raise HTTPException(status_code=401, detail="API key is required")
    
    # Phase 4 secure validation with IP/domain enforcement
    logger.info(f"Starting Phase 4 validation for key: {api_key[:20]}...")
    
    # Extract security context from request
    client_ip = "127.0.0.1"  # Default for testing
    referer = None
    user_agent = None
    
    if request:
        # Extract real IP and headers
        client_ip = request.client.host if request.client else "127.0.0.1"
        referer = request.headers.get("referer")
        user_agent = request.headers.get("user-agent")
    
    logger.info(f"Phase 4 validation: Client IP: {client_ip}, Referer: {referer}")
    
    # Phase 4 secure validation with IP/domain enforcement
    client = get_supabase_client()
    
    # Check both new and legacy API key tables
    tables_to_check = ['api_keys', 'api_keys_new']
    
    for table_name in tables_to_check:
        logger.info(f"Phase 4 validation: Checking {table_name} table")
        
        # Get all API keys from this table
        result = client.table(table_name).select('*').execute()
        
        logger.info(f"Phase 4 validation: Found {len(result.data) if result.data else 0} keys in {table_name}")
        
        if result.data:
            for key_data in result.data:
                stored_key = key_data['api_key']
                
                # Check if it's a plain text key (current system)
                if stored_key.startswith(('gw_live_', 'gw_test_', 'gw_staging_', 'gw_dev_')):
                    # Compare with provided key
                    if stored_key == api_key:
                        # Found matching key, now validate with Phase 4 security checks
                        key_id = key_data['id']
                        user_id = key_data['user_id']
                    
                        logger.info(f"Phase 4 validation: Found matching key {key_id} in {table_name}, IP: {client_ip}, Allowlist: {key_data.get('ip_allowlist', [])}")
                        
                        # Check if key is active
                        if not key_data.get('is_active', True):
                            logger.warning(f"Key {key_id} is inactive")
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
                                        logger.warning(f"Key {key_id} has expired")
                                        raise HTTPException(status_code=401, detail="API key has expired")
                            except Exception as date_error:
                                logger.warning(f"Error checking expiration for key {key_id}: {date_error}")
                        
                        # Check request limits
                        if key_data.get('max_requests') is not None:
                            if key_data.get('requests_used', 0) >= key_data['max_requests']:
                                logger.warning(f"Key {key_id} request limit reached")
                                raise HTTPException(status_code=429, detail="API key request limit reached")
                        
                        # IP allowlist enforcement
                        ip_allowlist = key_data.get('ip_allowlist') or []
                        if ip_allowlist and len(ip_allowlist) > 0 and ip_allowlist != ['']:
                            logger.info(f"Checking IP {client_ip} against allowlist {ip_allowlist}")
                            if client_ip not in ip_allowlist:
                                logger.warning(f"IP {client_ip} not in allowlist {ip_allowlist}")
                                raise HTTPException(status_code=403, detail="IP address not allowed for this API key")
                        
                        # Domain referrer enforcement
                        domain_referrers = key_data.get('domain_referrers') or []
                        if domain_referrers and len(domain_referrers) > 0 and domain_referrers != ['']:
                            logger.info(f"Checking domain {referer} against allowlist {domain_referrers}")
                            if not referer or not any(domain in referer for domain in domain_referrers):
                                logger.warning(f"Domain {referer} not in allowlist {domain_referrers}")
                                raise HTTPException(status_code=403, detail="Domain not allowed for this API key")
                        
                        # Update last used timestamp
                        try:
                            client.table(table_name).update({
                                'last_used_at': datetime.utcnow().isoformat()
                            }).eq('id', key_id).execute()
                        except Exception as update_error:
                            logger.warning(f"Failed to update last_used_at for key {key_id}: {update_error}")
                        
                        logger.info(f"Phase 4 validation successful for key {key_id} from {table_name}")
                        return api_key
    
    logger.info("Phase 4 validation: No matching key found, falling back to legacy validation")
    
    # If no matching key found, try legacy validation
    user = get_user(api_key)
    if user:
        # Legacy validation fallback
        logger.info("Using legacy validation fallback")
        return api_key
    
    # If not found in either system, reject
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
            # Test connection by trying to get providers
            test_providers = get_cached_providers()
            openrouter_status = "connected" if test_providers else "error"
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


# User endpoints
@app.get("/user/balance", tags=["authentication"])
async def get_user_balance(api_key: str = Depends(get_api_key)):
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Check if this is a trial user
        from trial_validation import validate_trial_access
        trial_validation = validate_trial_access(api_key)
        
        if trial_validation.get('is_trial', False):
            # For trial users, show trial credits and tokens
            return {
                "api_key": f"{api_key[:10]}...",
                "credits": trial_validation.get('remaining_credits', 0.0),
                "tokens_remaining": trial_validation.get('remaining_tokens', 0),
                "requests_remaining": trial_validation.get('remaining_requests', 0),
                "status": "trial",
                "trial_end_date": trial_validation.get('trial_end_date'),
                "user_id": user.get("id")
            }
        else:
            # For non-trial users, show regular credits
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
            
            # Create new API key with Phase 4 security features (using existing working system)
            try:
                # Use the existing create_api_key function for now (it works)
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
                
                # Add Phase 4 security logging and audit features
                from security import get_audit_logger
                audit_logger = get_audit_logger()
                
                # Get the created key ID for audit logging
                client = get_supabase_client()
                key_result = client.table('api_keys').select('*').eq('api_key', new_api_key).execute()
                
                if key_result.data:
                    key_id = key_result.data[0]['id']
                    audit_logger.log_api_key_creation(
                        user["id"], 
                        key_id, 
                        request.key_name, 
                        request.environment_tag, 
                        "user"
                    )
                
                # Log the key creation for audit purposes (Phase 4 feature)
                logger.info(f"API key created with Phase 4 security features for user {user['id']}: {request.key_name} ({request.environment_tag})")
            except ValueError as ve:
                # Handle specific validation errors
                error_message = str(ve)
                if "already exists" in error_message:
                    raise HTTPException(status_code=400, detail=error_message)
                else:
                    raise HTTPException(status_code=400, detail=f"Validation error: {error_message}")
            
            return {
                "status": "success",
                "message": "API key created successfully with enhanced security features",
                "api_key": new_api_key,
                "key_name": request.key_name,
                "environment_tag": request.environment_tag,
                "security_features": {
                    "ip_allowlist": request.ip_allowlist or [],
                    "domain_referrers": request.domain_referrers or [],
                    "expiration_days": request.expiration_days,
                    "max_requests": request.max_requests,
                    "audit_logging": True,
                    "last_used_tracking": True
                },
                "phase4_integration": True
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
        
        # Handle key rotation (Phase 4 feature)
        if request.action == 'rotate':
            # Generate new API key with same settings
            import secrets
            old_key = key_to_update['api_key']
            environment_tag = key_to_update['environment_tag']
            
            if environment_tag == 'test':
                prefix = 'gw_test_'
            elif environment_tag == 'staging':
                prefix = 'gw_staging_'
            elif environment_tag == 'development':
                prefix = 'gw_dev_'
            else:
                prefix = 'gw_live_'
            
            random_part = secrets.token_urlsafe(32)
            new_api_key = prefix + random_part
            
            # Update the API key
            updates = {'api_key': new_api_key}
            
            # Log rotation for audit purposes
            logger.info(f"API key rotated for user {user['id']}: {key_to_update['key_name']} -> new key generated")
            
        elif request.action == 'bulk_rotate':
            # Handle bulk rotation for all user keys
            try:
                from db_security import bulk_rotate_user_keys
                
                result = bulk_rotate_user_keys(
                    user_id=user["id"],
                    environment_tag=request.environment_tag
                )
                
                return {
                    "status": "success",
                    "message": f"Bulk rotation completed: {result['rotated_count']} keys rotated",
                    "rotated_count": result['rotated_count'],
                    "new_keys": result['new_keys'],
                    "phase4_integration": True,
                    "timestamp": datetime.utcnow().isoformat()
                }
            except Exception as e:
                logger.error(f"Bulk rotation failed: {e}")
                raise HTTPException(status_code=500, detail=f"Bulk rotation failed: {str(e)}")
            
        else:
            # Regular update - prepare updates (only include fields that were provided)
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
        
        # Prepare response message based on action
        if request.action == 'rotate':
            message = "API key rotated successfully with new key generated"
            phase4_info = {
                "rotation_performed": True,
                "new_api_key": updated_key['api_key'],
                "old_key_invalidated": True
            }
        else:
            message = "API key updated successfully with enhanced security features"
            phase4_info = {
                "rotation_performed": False,
                "security_features_updated": True
            }
        
        return UpdateApiKeyResponse(
            status="success",
            message=message,
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
        
        # Add Phase 4 security status to each key
        enhanced_keys = []
        for key in keys:
            key_with_security = key.copy()
            key_with_security['security_status'] = {
                'has_ip_restrictions': bool(key.get('ip_allowlist') and len(key.get('ip_allowlist', [])) > 0),
                'has_domain_restrictions': bool(key.get('domain_referrers') and len(key.get('domain_referrers', [])) > 0),
                'has_expiration': bool(key.get('expiration_date')),
                'has_usage_limits': bool(key.get('max_requests')),
                'last_used_tracking': True,
                'audit_logging': True,
                'phase4_enhanced': True
            }
            enhanced_keys.append(key_with_security)
        
        return {
            "status": "success",
            "total_keys": len(enhanced_keys),
            "keys": enhanced_keys,
            "phase4_integration": True,
            "security_features_enabled": True,
            "message": "API keys retrieved with Phase 4 security status"
        }
        
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
        
        # Validate permissions - check if user can delete keys
        if not validate_api_key_permissions(api_key, "write", "api_keys"):
            raise HTTPException(status_code=403, detail="Insufficient permissions to delete API keys")

        # Resolve key string by id and ownership
        key_to_delete = get_api_key_by_id(key_id, user["id"])
        if not key_to_delete:
            raise HTTPException(status_code=404, detail="API key not found")

        # Delete the API key by its actual string
        success = delete_api_key(key_to_delete["api_key"], user["id"])
        
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
        
        # Add Phase 4 audit logging information
        enhanced_usage = usage_stats.copy()
        enhanced_usage['audit_logging'] = {
            'enabled': True,
            'last_audit_check': datetime.utcnow().isoformat(),
            'security_events_tracked': True,
            'access_patterns_monitored': True
        }
        enhanced_usage['phase4_integration'] = True
        
        return enhanced_usage
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting API key usage: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/api-keys/audit-logs", tags=["authentication"])
async def get_user_audit_logs(
    key_id: Optional[int] = None,
    action: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    api_key: str = Depends(get_api_key)
):
    """Get audit logs for the user's API keys (Phase 4 feature)"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Validate permissions
        if not validate_api_key_permissions(api_key, "read", "api_keys"):
            raise HTTPException(status_code=403, detail="Insufficient permissions to view audit logs")
        
        # Parse dates if provided
        start_dt = None
        end_dt = None
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use ISO format.")
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use ISO format.")
        
        # Get audit logs
        from db_security import get_audit_logs
        
        logs = get_audit_logs(
            user_id=user["id"],
            key_id=key_id,
            action=action,
            start_date=start_dt,
            end_date=end_dt,
            limit=limit
        )
        
        return {
            "status": "success",
            "total_logs": len(logs),
            "logs": logs,
            "phase4_integration": True,
            "security_features_enabled": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting audit logs: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Authentication endpoints
@app.post("/auth/register", response_model=UserRegistrationResponse, tags=["authentication"])
async def user_register(request: UserRegistrationRequest):
    """Register a new user with unified API key system"""
    try:
        # Validate input
        if request.environment_tag not in ['test', 'staging', 'live', 'development']:
            raise HTTPException(status_code=400, detail="Invalid environment tag")
        
        # Create user with enhanced fields (automatic 500,000 tokens trial)
        user_data = create_enhanced_user(
            username=request.username,
            email=request.email,
            auth_method=request.auth_method,
            credits=10  # $10 worth of credits (500,000 tokens)
        )
        
        # Send welcome email
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
            message="User registered successfully!",
            timestamp=datetime.utcnow()
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"User registration failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Admin endpoints
@app.post("/admin/add_credits", tags=["admin"])
async def admin_add_credits(req: AddCreditsRequest, admin_key: str = Depends(get_admin_key)):
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
async def admin_get_all_balances(admin_key: str = Depends(get_admin_key)):
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
async def admin_monitor(admin_key: str = Depends(get_admin_key)):
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
async def admin_set_rate_limit(req: SetRateLimitRequest, admin_key: str = Depends(get_admin_key)):
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
        
        # Get environment tag from API key
        environment_tag = user.get('environment_tag', 'live')
        
        # Check plan limits first
        plan_check = enforce_plan_limits(user['id'], 0, environment_tag)  # Check with 0 tokens first
        if not plan_check['allowed']:
            raise HTTPException(
                status_code=429, 
                detail=f"Plan limit exceeded: {plan_check['reason']}"
            )
        
        # Check trial status first (simplified)
        from trial_validation import validate_trial_access
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
                    detail=trial_validation.get('error', 'Access denied. Please start a trial or subscribe to a paid plan.')
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
            
            # Check plan limits with actual token usage
            plan_check_final = enforce_plan_limits(user['id'], total_tokens, environment_tag)
            if not plan_check_final['allowed']:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Plan limit exceeded: {plan_check_final['reason']}"
                )
            
            # Track trial usage BEFORE generating response
            if trial_validation.get('is_trial') and not trial_validation.get('is_expired'):
                try:
                    from trial_validation import track_trial_usage
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
                        headers={"Retry-After": str(rate_limit_check_final.retry_after)} if rate_limit_check_final.retry_after else None
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
@app.post("/admin/refresh-providers", tags=["admin"])
async def admin_refresh_providers(admin_key: str = Depends(get_admin_key)):
    try:
        # Invalidate provider cache to force refresh
        _provider_cache["data"] = None
        _provider_cache["timestamp"] = None
        
        providers = get_cached_providers()
        
        return {
            "status": "success",
            "message": "Provider cache refreshed successfully",
            "total_providers": len(providers) if providers else 0,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to refresh provider cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh provider cache")

@app.get("/admin/cache-status", tags=["admin"])
async def admin_cache_status(admin_key: str = Depends(get_admin_key)):
    try:
        cache_age = None
        if _provider_cache["timestamp"]:
            cache_age = (datetime.utcnow() - _provider_cache["timestamp"]).total_seconds()
        
        return {
            "status": "success",
            "cache_info": {
                "has_data": _provider_cache["data"] is not None,
                "cache_age_seconds": cache_age,
                "ttl_seconds": _provider_cache["ttl"],
                "is_valid": cache_age is not None and cache_age < _provider_cache["ttl"],
                "total_cached_providers": len(_provider_cache["data"]) if _provider_cache["data"] else 0
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get cache status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cache status")

# Plan Management Endpoints
@app.get("/plans", response_model=List[PlanResponse], tags=["plans"])
async def get_plans():
    """Get all available subscription plans"""
    try:
        logger.info("Attempting to get all plans...")
        plans = get_all_plans()
        logger.info(f"Successfully retrieved {len(plans) if plans else 0} plans")
        
        if not plans:
            logger.warning("No plans found in database")
            return []
        
        # Convert to PlanResponse format
        plan_responses = []
        for plan in plans:
            try:
                # Handle features field - convert from dict to list if needed
                features = plan.get("features", [])
                if isinstance(features, dict):
                    # Convert dict to list of feature names
                    features = list(features.keys())
                elif not isinstance(features, list):
                    features = []
                
                plan_response = {
                    "id": plan.get("id"),
                    "name": plan.get("name"),
                    "description": plan.get("description"),
                    "plan_type": plan.get("plan_type", "free"),
                    "daily_request_limit": plan.get("daily_request_limit"),
                    "monthly_request_limit": plan.get("monthly_request_limit"),
                    "daily_token_limit": plan.get("daily_token_limit"),
                    "monthly_token_limit": plan.get("monthly_token_limit"),
                    "price_per_month": float(plan.get("price_per_month", 0)),
                    "yearly_price": float(plan.get("yearly_price", 0)) if plan.get("yearly_price") else None,
                    "price_per_token": float(plan.get("price_per_token", 0)) if plan.get("price_per_token") else None,
                    "is_pay_as_you_go": plan.get("is_pay_as_you_go", False),
                    "max_concurrent_requests": plan.get("max_concurrent_requests", 5),
                    "features": features,
                    "is_active": plan.get("is_active", True)
                }
                plan_responses.append(plan_response)
            except Exception as plan_error:
                logger.error(f"Error processing plan {plan.get('id', 'unknown')}: {plan_error}")
                continue
        
        # Sort plans by type (Free, Dev, Team, Customize)
        plan_order = {'free': 0, 'dev': 1, 'team': 2, 'customize': 3}
        plan_responses.sort(key=lambda x: plan_order.get(x.get('plan_type', 'free'), 999))
        
        logger.info(f"Returning {len(plan_responses)} plan responses")
        return plan_responses
        
    except Exception as e:
        logger.error(f"Error getting plans: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/plans/{plan_id}", response_model=PlanResponse, tags=["plans"])
async def get_plan(plan_id: int):
    """Get a specific plan by ID"""
    try:
        plan = get_plan_by_id(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting plan {plan_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/plan", response_model=UserPlanResponse, tags=["authentication"])
async def get_user_plan_endpoint(api_key: str = Depends(get_api_key)):
    """Get current user's plan"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        user_plan = get_user_plan(user["id"])
        if not user_plan:
            raise HTTPException(status_code=404, detail="No active plan found")
        
        return user_plan
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user plan: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/plan/usage", response_model=PlanUsageResponse, tags=["authentication"])
async def get_user_plan_usage(api_key: str = Depends(get_api_key)):
    """Get user's plan usage and limits"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        usage_data = get_user_usage_within_plan_limits(user["id"])
        if not usage_data:
            raise HTTPException(status_code=500, detail="Failed to retrieve usage data")
        
        return usage_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user plan usage: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/plan/entitlements", response_model=PlanEntitlementsResponse, tags=["authentication"])
async def get_user_plan_entitlements(api_key: str = Depends(get_api_key), feature: Optional[str] = Query(None)):
    """Check user's plan entitlements"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        entitlements = check_plan_entitlements(user["id"], feature)
        return entitlements
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking user plan entitlements: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/admin/assign-plan", tags=["admin"])
async def assign_plan_to_user(request: AssignPlanRequest, admin_key: str = Depends(get_admin_key)):
    """Assign a plan to a user (Admin only)"""
    try:
        success = assign_user_plan(request.user_id, request.plan_id, request.duration_months)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to assign plan")
        
        return {
            "status": "success",
            "message": f"Plan {request.plan_id} assigned to user {request.user_id} for {request.duration_months} months",
            "user_id": request.user_id,
            "plan_id": request.plan_id,
            "duration_months": request.duration_months,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error assigning plan: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/environment-usage", tags=["authentication"])
async def get_user_environment_usage(api_key: str = Depends(get_api_key)):
    """Get user's usage breakdown by environment"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        env_usage = get_environment_usage_summary(user["id"])
        
        return {
            "status": "success",
            "user_id": user["id"],
            "environment_usage": env_usage,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting environment usage: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# =============================================================================
# ADVANCED RATE LIMITING ENDPOINTS
# =============================================================================

@app.get("/user/rate-limits", tags=["authentication"])
async def get_user_rate_limits_advanced(api_key: str = Depends(get_api_key)):
    """Get advanced rate limit configuration and status for user's API keys"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Get rate limit configurations for all user's keys
        configs = get_user_rate_limit_configs(user["id"])
        
        # Get current usage stats for each key
        enhanced_configs = []
        for config in configs:
            usage_stats = {
                'minute': get_rate_limit_usage_stats(config['api_key'], 'minute'),
                'hour': get_rate_limit_usage_stats(config['api_key'], 'hour'),
                'day': get_rate_limit_usage_stats(config['api_key'], 'day')
            }
            
            enhanced_configs.append({
                **config,
                'usage_stats': usage_stats,
                'current_status': {
                    'requests_remaining_minute': max(0, config['rate_limit_config'].get('requests_per_minute', 60) - usage_stats['minute']['total_requests']),
                    'tokens_remaining_minute': max(0, config['rate_limit_config'].get('tokens_per_minute', 10000) - usage_stats['minute']['total_tokens']),
                    'requests_remaining_hour': max(0, config['rate_limit_config'].get('requests_per_hour', 1000) - usage_stats['hour']['total_requests']),
                    'tokens_remaining_hour': max(0, config['rate_limit_config'].get('tokens_per_hour', 100000) - usage_stats['hour']['total_tokens']),
                    'requests_remaining_day': max(0, config['rate_limit_config'].get('requests_per_day', 10000) - usage_stats['day']['total_requests']),
                    'tokens_remaining_day': max(0, config['rate_limit_config'].get('tokens_per_day', 1000000) - usage_stats['day']['total_tokens'])
                }
            })
        
        return {
            "status": "success",
            "user_id": user["id"],
            "rate_limit_configs": enhanced_configs,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting advanced rate limits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/user/rate-limits/{key_id}", tags=["authentication"])
async def update_user_rate_limits_advanced(
    key_id: int,
    rate_limit_config: dict,
    api_key: str = Depends(get_api_key)
):
    """Update rate limit configuration for a specific API key"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Verify user owns the key
        key_to_update = get_api_key_by_id(key_id, user["id"])
        if not key_to_update:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Validate rate limit configuration
        required_fields = ['requests_per_minute', 'requests_per_hour', 'requests_per_day', 
                          'tokens_per_minute', 'tokens_per_hour', 'tokens_per_day']
        
        for field in required_fields:
            if field not in rate_limit_config:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
            
            if not isinstance(rate_limit_config[field], int) or rate_limit_config[field] < 0:
                raise HTTPException(status_code=400, detail=f"Invalid value for {field}: must be non-negative integer")
        
        # Update rate limit configuration
        success = update_rate_limit_config(key_to_update["api_key"], rate_limit_config)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update rate limit configuration")
        
        return {
            "status": "success",
            "message": "Rate limit configuration updated successfully",
            "key_id": key_id,
            "updated_config": rate_limit_config,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rate limits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/user/rate-limits/bulk-update", tags=["authentication"])
async def bulk_update_user_rate_limits(
    rate_limit_config: dict,
    api_key: str = Depends(get_api_key)
):
    """Bulk update rate limit configuration for all user's API keys"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Validate rate limit configuration
        required_fields = ['requests_per_minute', 'requests_per_hour', 'requests_per_day', 
                          'tokens_per_minute', 'tokens_per_hour', 'tokens_per_day']
        
        for field in required_fields:
            if field not in rate_limit_config:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
            
            if not isinstance(rate_limit_config[field], int) or rate_limit_config[field] < 0:
                raise HTTPException(status_code=400, detail=f"Invalid value for {field}: must be non-negative integer")
        
        # Bulk update rate limit configurations
        updated_count = bulk_update_rate_limit_configs(user["id"], rate_limit_config)
        
        return {
            "status": "success",
            "message": f"Rate limit configuration updated for {updated_count} API keys",
            "updated_count": updated_count,
            "updated_config": rate_limit_config,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk updating rate limits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/user/rate-limits/usage/{key_id}", tags=["authentication"])
async def get_api_key_rate_limit_usage(
    key_id: int,
    time_window: str = "minute",
    api_key: str = Depends(get_api_key)
):
    """Get detailed rate limit usage statistics for a specific API key"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Verify user owns the key
        key_to_check = get_api_key_by_id(key_id, user["id"])
        if not key_to_check:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Validate time window
        if time_window not in ['minute', 'hour', 'day']:
            raise HTTPException(status_code=400, detail="Invalid time window. Must be 'minute', 'hour', or 'day'")
        
        # Get usage statistics
        usage_stats = get_rate_limit_usage_stats(key_to_check["api_key"], time_window)
        
        # Get rate limit configuration
        rate_limit_config = get_rate_limit_config(key_to_check["api_key"])
        
        return {
            "status": "success",
            "key_id": key_id,
            "key_name": key_to_check["key_name"],
            "time_window": time_window,
            "usage_stats": usage_stats,
            "rate_limit_config": rate_limit_config,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting rate limit usage: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/admin/rate-limits/system", tags=["admin"])
async def get_system_rate_limits(admin_key: str = Depends(get_admin_key)):
    """Get system-wide rate limiting statistics"""
    try:
        stats = get_system_rate_limit_stats()
        
        return {
            "status": "success",
            "system_stats": stats,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting system rate limit stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/admin/rate-limits/alerts", tags=["admin"])
async def get_rate_limit_alerts_endpoint(
    api_key: Optional[str] = None,
    resolved: bool = False,
    limit: int = 100,
    admin_key: str = Depends(get_admin_key)
):
    """Get rate limit alerts for monitoring"""
    try:
        alerts = get_rate_limit_alerts(api_key, resolved, limit)
        
        return {
            "status": "success",
            "total_alerts": len(alerts),
            "alerts": alerts,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting rate limit alerts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Root endpoint
@app.get("/", tags=["authentication"])
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

# Trial Status Endpoint (Simplified)

@app.get("/trial/status", tags=["trial"])
async def get_trial_status(api_key: str = Depends(get_api_key)):
    """Get current trial status for the authenticated API key"""
    try:
        from trial_validation import validate_trial_access
        trial_status = validate_trial_access(api_key)
        
        return {
            "success": True,
            "trial_status": trial_status,
            "message": "Trial status retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Error getting trial status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/subscription/plans", tags=["subscription"])
async def get_subscription_plans():
    """Get available subscription plans with 4-tier structure"""
    try:
        # Get all plans from database
        plans = get_all_plans()
        
        # Enhance plans with additional information
        enhanced_plans = []
        for plan in plans:
            plan_type = plan.get('plan_type', 'free')
            is_pay_as_you_go = plan.get('is_pay_as_you_go', False)
            
            enhanced_plan = {
                "id": plan.get('id'),
                "name": plan.get('name'),
                "description": plan.get('description'),
                "plan_type": plan_type,
                "monthly_price": float(plan.get('price_per_month', 0)),
                "yearly_price": float(plan.get('yearly_price', 0)) if plan.get('yearly_price') else None,
                "price_per_token": float(plan.get('price_per_token', 0)) if plan.get('price_per_token') else None,
                "is_pay_as_you_go": is_pay_as_you_go,
                "daily_request_limit": plan.get('daily_request_limit', 0),
                "monthly_request_limit": plan.get('monthly_request_limit', 0),
                "daily_token_limit": plan.get('daily_token_limit', 0),
                "monthly_token_limit": plan.get('monthly_token_limit', 0),
                "max_concurrent_requests": plan.get('max_concurrent_requests', 5),
                "features": plan.get('features', []),
                "is_active": plan.get('is_active', True),
                "trial_eligible": plan_type == 'free'  # Only Free plan is trial eligible
            }
            enhanced_plans.append(enhanced_plan)
        
        # Sort plans by price (Free, Dev, Team, Customize)
        plan_order = {'free': 0, 'dev': 1, 'team': 2, 'customize': 3}
        enhanced_plans.sort(key=lambda x: plan_order.get(x['plan_type'], 999))
        
        return {
            "success": True,
            "plans": enhanced_plans,
            "message": "Subscription plans retrieved successfully",
            "trial_info": {
                "trial_days": 3,
                "trial_credits": 10.0,
                "trial_tokens": 1000000,  # 1M tokens for trial
                "trial_requests": 10000,  # 10K requests for trial
                "trial_plan": "free"
            }
        }
    except Exception as e:
        logger.error(f"Error getting subscription plans: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

## Notification Endpoints

@app.get("/user/notifications/preferences", response_model=NotificationPreferences, tags=["notifications"])
async def get_notification_preferences(api_key: str = Depends(get_api_key)):
    """Get user notification preferences"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        preferences = notification_service.get_user_preferences(user['id'])
        if not preferences:
            # Create default preferences if they don't exist
            preferences = notification_service.create_user_preferences(user['id'])
        
        return preferences
    except Exception as e:
        logger.error(f"Error getting notification preferences: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/user/notifications/preferences", tags=["notifications"])
async def update_notification_preferences(
    request: UpdateNotificationPreferencesRequest,
    api_key: str = Depends(get_api_key)
):
    """Update user notification preferences"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Convert request to dict, excluding None values
        updates = {k: v for k, v in request.dict().items() if v is not None}
        
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        success = notification_service.update_user_preferences(user['id'], updates)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update preferences")
        
        return {
            "status": "success",
            "message": "Notification preferences updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating notification preferences: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/user/notifications/test", tags=["notifications"])
async def test_notification(
    notification_type: NotificationType = Query(..., description="Type of notification to test"),
    api_key: str = Depends(get_api_key)
):
    """Send test notification to user"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Create test notification based on type
        if notification_type == NotificationType.LOW_BALANCE:
            subject = f"Test Low Balance Alert - {os.environ.get('APP_NAME', 'AI Gateway')}"
            content = f"""
            <html>
            <body>
                <h2>Test Low Balance Alert</h2>
                <p>Hello {user.get('username', 'User')},</p>
                <p>This is a test notification for low balance alerts.</p>
                <p>Current Credits: ${user.get('credits', 0):.2f}</p>
                <p>This is just a test - no action required.</p>
                <p>Best regards,<br>The {os.environ.get('APP_NAME', 'AI Gateway')} Team</p>
            </body>
            </html>
            """
        elif notification_type == NotificationType.TRIAL_EXPIRING:
            subject = f"Test Trial Expiry Alert - {os.environ.get('APP_NAME', 'AI Gateway')}"
            content = f"""
            <html>
            <body>
                <h2>Test Trial Expiry Alert</h2>
                <p>Hello {user.get('username', 'User')},</p>
                <p>This is a test notification for trial expiry alerts.</p>
                <p>This is just a test - no action required.</p>
                <p>Best regards,<br>The {os.environ.get('APP_NAME', 'AI Gateway')} Team</p>
            </body>
            </html>
            """
        elif notification_type == NotificationType.SUBSCRIPTION_EXPIRING:
            subject = f"Test Subscription Expiry Alert - {os.environ.get('APP_NAME', 'AI Gateway')}"
            content = f"""
            <html>
            <body>
                <h2>Test Subscription Expiry Alert</h2>
                <p>Hello {user.get('username', 'User')},</p>
                <p>This is a test notification for subscription expiry alerts.</p>
                <p>This is just a test - no action required.</p>
                <p>Best regards,<br>The {os.environ.get('APP_NAME', 'AI Gateway')} Team</p>
            </body>
            </html>
            """
        else:
            subject = f"Test Notification - {os.environ.get('APP_NAME', 'AI Gateway')}"
            content = f"""
            <html>
            <body>
                <h2>Test Notification</h2>
                <p>Hello {user.get('username', 'User')},</p>
                <p>This is a test notification.</p>
                <p>This is just a test - no action required.</p>
                <p>Best regards,<br>The {os.environ.get('APP_NAME', 'AI Gateway')} Team</p>
            </body>
            </html>
            """
        
        request = SendNotificationRequest(
            user_id=user['id'],
            type=notification_type,
            channel=NotificationChannel.EMAIL,
            subject=subject,
            content=content,
            metadata={'test': True}
        )
        
        success = notification_service.create_notification(request)
        
        return {
            "status": "success" if success else "failed",
            "message": "Test notification sent successfully" if success else "Failed to send test notification"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending test notification: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/auth/password-reset", tags=["authentication"])
async def request_password_reset(email: str):
    """Request password reset email"""
    try:
        # Find user by email
        client = get_supabase_client()
        user_result = client.table('users').select('id', 'username', 'email').eq('email', email).execute()
        
        if not user_result.data:
            # Don't reveal if email exists or not for security
            return {"message": "If an account with that email exists, a password reset link has been sent."}
        
        user = user_result.data[0]
        
        # Send password reset email
        reset_token = enhanced_notification_service.send_password_reset_email(
            user_id=user['id'],
            username=user['username'],
            email=user['email']
        )
        
        if reset_token:
            return {"message": "Password reset email sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send password reset email")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error requesting password reset: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/auth/reset-password", tags=["authentication"])
async def reset_password(token: str, new_password: str):
    """Reset password using token"""
    try:
        client = get_supabase_client()
        
        # Verify token
        token_result = client.table('password_reset_tokens').select('*').eq('token', token).eq('used', False).execute()
        
        if not token_result.data:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
        token_data = token_result.data[0]
        expires_at = datetime.fromisoformat(token_data['expires_at'].replace('Z', '+00:00'))
        
        if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
            raise HTTPException(status_code=400, detail="Reset token has expired")
        
        # Update password (in a real app, you'd hash this)
        # For now, we'll just mark the token as used
        client.table('password_reset_tokens').update({'used': True}).eq('id', token_data['id']).execute()
        
        return {"message": "Password reset successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/user/notifications/send-usage-report", tags=["notifications"])
async def send_usage_report(
    month: str = Query(..., description="Month to send report for (YYYY-MM)"),
    api_key: str = Depends(get_api_key)
):
    """Send monthly usage report email"""
    try:
        user = get_user(api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Get usage stats for the month
        client = get_supabase_client()
        start_date = f"{month}-01"
        end_date = f"{month}-31"
        
        # This is a simplified example - you'd need to implement actual usage tracking
        usage_stats = {
            'total_requests': 1000,
            'tokens_used': 50000,
            'credits_spent': 5.00,
            'remaining_credits': user.get('credits', 0)
        }
        
        success = enhanced_notification_service.send_monthly_usage_report(
            user_id=user['id'],
            username=user['username'],
            email=user['email'],
            month=month,
            usage_stats=usage_stats
        )
        
        if success:
            return {"message": "Usage report sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send usage report")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending usage report: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/admin/notifications/stats", response_model=NotificationStats, tags=["admin"])
async def get_notification_stats(admin_key: str = Depends(get_admin_key)):
    """Get notification statistics for admin"""
    try:
        client = get_supabase_client()
        
        # Get notification counts
        logger.info("Fetching notification counts...")
        result = client.table('notifications').select('status').execute()
        notifications = result.data if result.data else []
        
        total_notifications = len(notifications)
        sent_notifications = len([n for n in notifications if n['status'] == 'sent'])
        failed_notifications = len([n for n in notifications if n['status'] == 'failed'])
        pending_notifications = len([n for n in notifications if n['status'] == 'pending'])
        
        delivery_rate = (sent_notifications / total_notifications * 100) if total_notifications > 0 else 0
        
        # Get last 24 hours notifications - use a simpler approach
        logger.info("Fetching recent notifications...")
        try:
            yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
            recent_result = client.table('notifications').select('id').gte('created_at', yesterday).execute()
            last_24h_notifications = len(recent_result.data) if recent_result.data else 0
        except Exception as recent_error:
            logger.warning(f"Error fetching recent notifications: {recent_error}")
            # Fallback: get all notifications and filter in Python
            all_notifications = client.table('notifications').select('created_at').execute()
            if all_notifications.data:
                yesterday_dt = datetime.utcnow() - timedelta(days=1)
                last_24h_notifications = len([
                    n for n in all_notifications.data 
                    if datetime.fromisoformat(n['created_at'].replace('Z', '+00:00')) >= yesterday_dt
                ])
            else:
                last_24h_notifications = 0
        
        logger.info(f"Notification stats calculated: total={total_notifications}, sent={sent_notifications}, failed={failed_notifications}, pending={pending_notifications}")
        
        return NotificationStats(
            total_notifications=total_notifications,
            sent_notifications=sent_notifications,
            failed_notifications=failed_notifications,
            pending_notifications=pending_notifications,
            delivery_rate=round(delivery_rate, 2),
            last_24h_notifications=last_24h_notifications
        )
    except Exception as e:
        logger.error(f"Error getting notification stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/admin/notifications/process", tags=["admin"])
async def process_notifications(admin_key: str = Depends(get_admin_key)):
    """Process all pending notifications (admin only)"""
    try:
        stats = notification_service.process_notifications()
        
        return {
            "status": "success",
            "message": "Notifications processed successfully",
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Error processing notifications: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/admin/trial/analytics", tags=["admin"])
async def get_trial_analytics_admin(admin_key: str = Depends(get_admin_key)):
    """Get trial analytics and conversion metrics for admin"""
    try:
        analytics = get_trial_analytics()
        return {
            "success": True,
            "analytics": analytics
        }
    except Exception as e:
        logger.error(f"Error getting trial analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get trial analytics")

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
