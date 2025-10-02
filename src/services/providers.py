import logging
import datetime

from datetime import datetime, timezone

import httpx

from src.config import Config

# Initialize logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

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
            cache_age = (datetime.now(timezone.utc) - _provider_cache["timestamp"]).total_seconds()
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
        _provider_cache["timestamp"] = datetime.now(timezone.utc)

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


def enhance_providers_with_logos_and_sites(providers: list) -> list:
    """Enhance providers with site_url and logo_url (shared logic)"""
    try:
        enhanced_providers = []
        for provider in providers:
            # Extract site URL from various sources
            site_url = None

            # Try privacy policy URL first
            if provider.get('privacy_policy_url'):
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(provider['privacy_policy_url'])
                    site_url = f"{parsed.scheme}://{parsed.netloc}"
                except Exception:
                    pass

            # Try terms of service URL if privacy policy didn't work
            if not site_url and provider.get('terms_of_service_url'):
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(provider['terms_of_service_url'])
                    site_url = f"{parsed.scheme}://{parsed.netloc}"
                except Exception:
                    pass

            # Try status page URL if others didn't work
            if not site_url and provider.get('status_page_url'):
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(provider['status_page_url'])
                    site_url = f"{parsed.scheme}://{parsed.netloc}"
                except Exception:
                    pass

            # Manual mapping for known providers
            if not site_url:
                manual_site_urls = {
                    'openai': 'https://openai.com',
                    'anthropic': 'https://anthropic.com',
                    'google': 'https://google.com',
                    'meta': 'https://meta.com',
                    'microsoft': 'https://microsoft.com',
                    'cohere': 'https://cohere.com',
                    'mistralai': 'https://mistral.ai',
                    'perplexity': 'https://perplexity.ai',
                    'amazon': 'https://aws.amazon.com',
                    'baidu': 'https://baidu.com',
                    'tencent': 'https://tencent.com',
                    'alibaba': 'https://alibaba.com',
                    'ai21': 'https://ai21.com',
                    'inflection': 'https://inflection.ai'
                }
                site_url = manual_site_urls.get(provider.get('slug'))

            # Generate logo URL using Google favicon service
            logo_url = None
            if site_url:
                # Clean the site URL for favicon service
                clean_url = site_url.replace('https://', '').replace('http://', '')
                if clean_url.startswith('www.'):
                    clean_url = clean_url[4:]
                logo_url = f"https://www.google.com/s2/favicons?domain={clean_url}&sz=128"

            enhanced_provider = {
                **provider,
                "site_url": site_url,
                "logo_url": logo_url
            }

            enhanced_providers.append(enhanced_provider)

        return enhanced_providers
    except Exception as e:
        logger.error(f"Error enhancing providers with logos and sites: {e}")
        return providers
