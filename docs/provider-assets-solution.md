# Provider Assets Solution

## Current Situation

The `/models/providers` endpoint now correctly identifies providers from the OpenRouter API and **OpenRouter API does provide official site URLs and policy links** through their dedicated `/api/v1/providers` endpoint. We've also implemented a hybrid logo solution that combines manual mapping with third-party services.

## What We Have Now

✅ **Working Features:**
- Correct provider identification from model IDs (e.g., "qwen/qwen3-vl-235b" → "qwen")
- Provider name mapping (e.g., "qwen" → "Qwen")
- Model counts per provider
- Suggested models count per provider
- **Official site URLs** from OpenRouter providers API
- **Privacy policy URLs** from OpenRouter providers API
- **Terms of service URLs** from OpenRouter providers API
- **Status page URLs** from OpenRouter providers API
- **Provider logo URLs** using hybrid approach (manual mapping + Clearbit API)

✅ **Logo Sources:**
- **Manual mapping** for major providers (OpenAI, Anthropic, Google, Meta, Microsoft, etc.)
- **Clearbit Logo API** for providers with site URLs
- **Graceful fallback** when logos aren't available

## Solutions for Provider Assets

### Option 1: Manual Asset Management (Recommended)

Create a comprehensive provider assets database:

```python
# Example implementation
PROVIDER_ASSETS = {
    'openai': {
        'name': 'OpenAI',
        'logo_url': 'https://your-cdn.com/logos/openai.svg',
        'site_url': 'https://openai.com',
        'description': 'Leading AI research company'
    },
    'anthropic': {
        'name': 'Anthropic',
        'logo_url': 'https://your-cdn.com/logos/anthropic.svg',
        'site_url': 'https://anthropic.com',
        'description': 'AI safety company'
    },
    'qwen': {
        'name': 'Qwen',
        'logo_url': 'https://your-cdn.com/logos/qwen.svg',
        'site_url': 'https://qwenlm.github.io',
        'description': 'Alibaba Cloud AI models'
    }
    # ... more providers
}
```

**Pros:**
- Full control over assets
- Consistent branding
- Fast loading
- Reliable URLs

**Cons:**
- Manual maintenance required
- Need to host/store assets
- Updates when new providers appear

### Option 2: Third-Party Logo Services

Use services like:
- **Clearbit Logo API**: `https://logo.clearbit.com/{domain}`
- **Favicon services**: `https://www.google.com/s2/favicons?domain={domain}`
- **Company logo APIs**: Various services available

```python
def get_provider_logo(provider_id, site_url):
    """Get logo from third-party service"""
    if not site_url:
        return None
    domain = site_url.replace('https://', '').replace('http://', '')
    return f"https://logo.clearbit.com/{domain}"
```

**Pros:**
- No manual maintenance
- Automatic updates
- Wide coverage
- Works with site URLs from OpenRouter

**Cons:**
- External dependency
- Potential rate limits
- Inconsistent quality
- May not work for all providers
- Requires site URL (now available from OpenRouter)

### Option 3: Hugging Face API (Not Recommended)

**Note**: Hugging Face API does not provide company/organization logos by provider name. The API is focused on models and their metadata, not company branding assets.

```python
# This approach doesn't work reliably
def get_huggingface_logo(provider_name):
    # Hugging Face doesn't provide company logos by name
    return None
```

**Why it doesn't work:**
- Hugging Face API is model-focused, not company-focused
- No reliable way to map provider names to organization logos
- Inconsistent metadata across different models
- Not designed for this use case
- Even with `hugging_face_id` from OpenRouter, the model API only returns `author` field, not `authorData.avatarUrl`

### Option 4: Hybrid Approach (✅ IMPLEMENTED)

**This is the approach we've successfully implemented!** It combines manual mapping with third-party services:

```python
def get_provider_logo_from_services(provider_id: str, site_url: str = None) -> str:
    """Get provider logo using third-party services and manual mapping"""
    # Manual mapping for major providers (high-quality logos)
    MANUAL_LOGO_DB = {
        'openai': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/openai.svg',
        'anthropic': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/anthropic.svg',
        'google': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/google.svg',
        'meta': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/meta.svg',
        'microsoft': 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@develop/icons/microsoft.svg',
        # ... more providers
    }
    
    # Try manual mapping first
    if provider_id in MANUAL_LOGO_DB:
        return MANUAL_LOGO_DB[provider_id]
    
    # Fallback to Clearbit Logo API using site URL
    if site_url:
        domain = extract_domain_from_url(site_url)
        return f"https://logo.clearbit.com/{domain}"
    
    return None
```

**Results:**
- ✅ **OpenAI**: Manual logo from Simple Icons
- ✅ **DeepSeek**: Clearbit API using `chat.deepseek.com`
- ✅ **Alibaba**: Manual logo from Simple Icons
- ✅ **Graceful fallback**: Returns `null` when no logo available

## Implementation Recommendations

### ✅ Phase 1: Basic Implementation (COMPLETED)
- ✅ Provider identification working
- ✅ Site URLs from OpenRouter providers API
- ✅ Policy URLs from OpenRouter providers API
- ✅ Logo URLs using hybrid approach

### ✅ Phase 2: Logo Support (COMPLETED)
1. ✅ **Hybrid approach implemented** (manual + third-party)
2. ✅ **Asset fetching working** (Simple Icons + Clearbit API)
3. ✅ **API response updated** with logo URLs
4. ✅ **Caching implemented** for performance

### 🔄 Phase 3: Enhanced Features (Optional)
1. **Provider descriptions**
2. **Provider categories** (e.g., "Open Source", "Commercial")
3. **Provider status** (e.g., "Active", "Beta", "Deprecated")
4. **Last updated timestamps**
5. **More providers in manual mapping**

## Code Example for Enhanced Provider Assets

```python
# Add to app.py
import re
from urllib.parse import urlparse

def get_enhanced_provider_info(provider_id: str, site_url: str = None) -> dict:
    """Get enhanced provider information with assets using OpenRouter data"""
    
    # Manual mapping for high-quality logos
    MANUAL_LOGO_DB = {
        'openai': 'https://cdn.yourdomain.com/logos/openai.svg',
        'anthropic': 'https://cdn.yourdomain.com/logos/anthropic.svg',
        'google': 'https://cdn.yourdomain.com/logos/google.svg',
        'meta': 'https://cdn.yourdomain.com/logos/meta.svg',
        'microsoft': 'https://cdn.yourdomain.com/logos/microsoft.svg'
    }
    
    # Try manual mapping first
    if provider_id in MANUAL_LOGO_DB:
        logo_url = MANUAL_LOGO_DB[provider_id]
    elif site_url:
        # Fallback to third-party service using OpenRouter site URL
        domain = extract_domain_from_url(site_url)
        logo_url = f"https://logo.clearbit.com/{domain}"
    else:
        logo_url = None
    
    return {
        'logo_url': logo_url,
        'site_url': site_url
    }

def extract_domain_from_url(url: str) -> str:
    """Extract domain from URL for logo service"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        # Remove www. prefix if present
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain
    except Exception:
        return None

# Update the existing get_provider_info function
def get_provider_info(provider_id: str, provider_name: str) -> dict:
    """Get provider information from OpenRouter providers API with enhanced assets"""
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
        
        if provider_info:
            # Extract domain from privacy policy URL for site URL
            site_url = None
            if provider_info.get('privacy_policy_url'):
                parsed = urlparse(provider_info['privacy_policy_url'])
                site_url = f"{parsed.scheme}://{parsed.netloc}"
            
            # Get enhanced assets
            enhanced_info = get_enhanced_provider_info(provider_id, site_url)
            
            return {
                'logo_url': enhanced_info['logo_url'],
                'site_url': site_url,
                'privacy_policy_url': provider_info.get('privacy_policy_url'),
                'terms_of_service_url': provider_info.get('terms_of_service_url'),
                'status_page_url': provider_info.get('status_page_url')
            }
        else:
            # Provider not found in OpenRouter providers list
            return {
                'logo_url': None,
                'site_url': None,
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
```

## Next Steps

1. **Decide on approach** for provider assets
2. **Implement asset management** system
3. **Update API response** to include logos
4. **Add caching** for performance
5. **Create admin interface** for managing assets
6. **Add monitoring** for broken links

## Current API Response

The current `/models/providers` endpoint returns:

```json
{
  "status": "success",
  "provider_statistics": {
    "total_providers": 15,
    "total_models": 324,
    "suggested_models": 12,
    "pricing_available": 324,
    "providers": {
      "openai": {
        "name": "OpenAI",
        "model_count": 12,
        "suggested_models": 5,
        "logo_url": null,
        "site_url": "https://openai.com",
        "privacy_policy_url": "https://openai.com/policies/privacy-policy/",
        "terms_of_service_url": "https://openai.com/policies/row-terms-of-use/",
        "status_page_url": "https://status.openai.com/"
      }
    }
  }
}
```

The new `/providers` endpoint returns:

```json
{
  "status": "success",
  "total_providers": 25,
  "providers": [
    {
      "name": "OpenAI",
      "slug": "openai",
      "privacy_policy_url": "https://openai.com/policies/privacy-policy/",
      "terms_of_service_url": "https://openai.com/policies/row-terms-of-use/",
      "status_page_url": "https://status.openai.com/"
    }
  ]
}
```

This provides official provider information from OpenRouter's API, with only logo URLs needing to be added separately.
