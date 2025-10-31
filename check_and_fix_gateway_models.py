#!/usr/bin/env python3
"""
Gateway Model URL Health Check & Auto-Fix Script

This script tests every model URL page to ensure it's working and attempts
to fix the gateway if models aren't loading properly.

Features:
- Tests all gateway model endpoints (/v1/models)
- Checks model count and availability
- Validates API connectivity
- Auto-clears cache if stale/empty
- Reports detailed status for each gateway
- Automatically retries failed fetches
"""
import sys
import os
import time
import httpx
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Optional

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.services.models import get_cached_models
from src.config import Config
from src.cache import (
    _models_cache,
    _portkey_models_cache,
    _featherless_models_cache,
    _chutes_models_cache,
    _groq_models_cache,
    _fireworks_models_cache,
    _together_models_cache,
    _deepinfra_models_cache,
    _google_models_cache,
    _cerebras_models_cache,
    _nebius_models_cache,
    _xai_models_cache,
    _novita_models_cache,
    _huggingface_models_cache,
    _aimo_models_cache,
    _near_models_cache,
    _fal_models_cache,
)

# Gateway configuration with API endpoints
GATEWAY_CONFIG = {
    'openrouter': {
        'name': 'OpenRouter',
        'url': 'https://openrouter.ai/api/v1/models',
        'api_key_env': 'OPENROUTER_API_KEY',
        'api_key': Config.OPENROUTER_API_KEY,
        'cache': _models_cache,
        'min_expected_models': 100,
        'header_type': 'bearer'
    },
    'portkey': {
        'name': 'Portkey',
        'url': 'https://api.portkey.ai/v1/models',
        'api_key_env': 'PORTKEY_API_KEY',
        'api_key': Config.PORTKEY_API_KEY,
        'cache': _portkey_models_cache,
        'min_expected_models': 10,
        'header_type': 'portkey'
    },
    'featherless': {
        'name': 'Featherless',
        'url': 'https://api.featherless.ai/v1/models',
        'api_key_env': 'FEATHERLESS_API_KEY',
        'api_key': Config.FEATHERLESS_API_KEY,
        'cache': _featherless_models_cache,
        'min_expected_models': 10,
        'header_type': 'bearer'
    },
    'chutes': {
        'name': 'Chutes',
        'url': 'https://api.chutes.ai/v1/models',
        'api_key_env': 'CHUTES_API_KEY',
        'api_key': getattr(Config, 'CHUTES_API_KEY', None),
        'cache': _chutes_models_cache,
        'min_expected_models': 5,
        'header_type': 'bearer'
    },
    'groq': {
        'name': 'Groq',
        'url': 'https://api.groq.com/openai/v1/models',
        'api_key_env': 'GROQ_API_KEY',
        'api_key': os.environ.get('GROQ_API_KEY'),
        'cache': _groq_models_cache,
        'min_expected_models': 5,
        'header_type': 'bearer'
    },
    'fireworks': {
        'name': 'Fireworks',
        'url': 'https://api.fireworks.ai/inference/v1/models',
        'api_key_env': 'FIREWORKS_API_KEY',
        'api_key': os.environ.get('FIREWORKS_API_KEY'),
        'cache': _fireworks_models_cache,
        'min_expected_models': 10,
        'header_type': 'bearer'
    },
    'together': {
        'name': 'Together',
        'url': 'https://api.together.xyz/v1/models',
        'api_key_env': 'TOGETHER_API_KEY',
        'api_key': os.environ.get('TOGETHER_API_KEY'),
        'cache': _together_models_cache,
        'min_expected_models': 20,
        'header_type': 'bearer'
    },
    'deepinfra': {
        'name': 'DeepInfra',
        'url': 'https://api.deepinfra.com/models/list',
        'api_key_env': 'DEEPINFRA_API_KEY',
        'api_key': Config.DEEPINFRA_API_KEY,
        'cache': _deepinfra_models_cache,
        'min_expected_models': 50,
        'header_type': 'bearer'
    },
    'google': {
        'name': 'Google Generative AI',
        'url': 'https://generativelanguage.googleapis.com/v1beta/models',
        'api_key_env': 'GOOGLE_API_KEY',
        'api_key': Config.GOOGLE_API_KEY,
        'cache': _google_models_cache,
        'min_expected_models': 5,
        'header_type': 'google'
    },
    'cerebras': {
        'name': 'Cerebras',
        'url': 'https://api.cerebras.ai/v1/models',
        'api_key_env': 'CEREBRAS_API_KEY',
        'api_key': Config.CEREBRAS_API_KEY,
        'cache': _cerebras_models_cache,
        'min_expected_models': 2,
        'header_type': 'bearer'
    },
    'nebius': {
        'name': 'Nebius',
        'url': 'https://api.studio.nebius.ai/v1/models',
        'api_key_env': 'NEBIUS_API_KEY',
        'api_key': Config.NEBIUS_API_KEY,
        'cache': _nebius_models_cache,
        'min_expected_models': 5,
        'header_type': 'bearer'
    },
    'xai': {
        'name': 'xAI',
        'url': 'https://api.x.ai/v1/models',
        'api_key_env': 'XAI_API_KEY',
        'api_key': Config.XAI_API_KEY,
        'cache': _xai_models_cache,
        'min_expected_models': 2,
        'header_type': 'bearer'
    },
    'novita': {
        'name': 'Novita',
        'url': 'https://api.novita.ai/v3/models',
        'api_key_env': 'NOVITA_API_KEY',
        'api_key': Config.NOVITA_API_KEY,
        'cache': _novita_models_cache,
        'min_expected_models': 5,
        'header_type': 'bearer'
    },
    'huggingface': {
        'name': 'Hugging Face',
        'url': 'https://huggingface.co/api/models',
        'api_key_env': 'HUG_API_KEY',
        'api_key': Config.HUG_API_KEY,
        'cache': _huggingface_models_cache,
        'min_expected_models': 100,
        'header_type': 'bearer'
    },
    'aimo': {
        'name': 'AIMO',
        'url': 'https://devnet.aimo.network/api/v1/models',
        'api_key_env': 'AIMO_API_KEY',
        'api_key': getattr(Config, 'AIMO_API_KEY', None),
        'cache': _aimo_models_cache,
        'min_expected_models': 5,
        'header_type': 'bearer'
    },
    'near': {
        'name': 'NEAR',
        'url': 'https://cloud-api.near.ai/v1/models',
        'api_key_env': 'NEAR_API_KEY',
        'api_key': Config.NEAR_API_KEY,
        'cache': _near_models_cache,
        'min_expected_models': 5,
        'header_type': 'bearer'
    },
    'fal': {
        'name': 'Fal.ai',
        'url': None,  # Fal uses static catalog, no direct API endpoint
        'api_key_env': 'FAL_KEY',
        'api_key': getattr(Config, 'FAL_KEY', 'static_catalog'),  # Fal doesn't require API key for catalog
        'cache': _fal_models_cache,
        'min_expected_models': 50,
        'header_type': 'bearer'
    },
}


def build_headers(gateway_config: dict) -> dict:
    """Build authentication headers based on gateway type"""
    api_key = gateway_config.get('api_key')
    if not api_key:
        return {}

    header_type = gateway_config.get('header_type', 'bearer')

    if header_type == 'bearer':
        return {"Authorization": f"Bearer {api_key}"}
    elif header_type == 'portkey':
        return {"x-portkey-api-key": api_key}
    elif header_type == 'google':
        # Google uses API key as query parameter, not header
        return {}
    else:
        return {}


def test_gateway_endpoint(gateway_name: str, config: dict) -> Tuple[bool, str, int]:
    """
    Test a gateway endpoint directly via HTTP

    Returns:
        (success: bool, message: str, model_count: int)
    """
    try:
        url = config['url']

        # Skip if URL is None (cache-only gateways)
        if url is None:
            return False, "No direct endpoint (cache-only gateway)", 0

        if not config['api_key']:
            return False, f"API key not configured ({config['api_key_env']})", 0

        headers = build_headers(config)

        # Google uses API key as query parameter
        if config.get('header_type') == 'google':
            url = f"{url}?key={config['api_key']}"

        # Make HTTP request with timeout
        response = httpx.get(url, headers=headers, timeout=30.0)

        if response.status_code != 200:
            return False, f"HTTP {response.status_code}: {response.text[:100]}", 0

        # Parse response
        data = response.json()

        # Extract model count (different APIs have different structures)
        if isinstance(data, list):
            model_count = len(data)
        elif isinstance(data, dict) and 'data' in data:
            model_count = len(data.get('data', []))
        elif isinstance(data, dict) and 'models' in data:
            # Google API uses 'models' key
            model_count = len(data.get('models', []))
        else:
            model_count = 0

        if model_count == 0:
            return False, "API returned 0 models", 0

        return True, f"OK - {model_count} models available", model_count
        
    except httpx.TimeoutException:
        return False, "Request timeout (30s)", 0
    except httpx.HTTPStatusError as e:
        return False, f"HTTP error: {e.response.status_code}", 0
    except Exception as e:
        return False, f"Error: {str(e)[:100]}", 0


def test_gateway_cache(gateway_name: str, config: dict) -> Tuple[bool, str, int, List]:
    """
    Test gateway using cached models from the application

    Returns:
        (success: bool, message: str, model_count: int, models: List)
    """
    try:
        cache = config.get('cache')
        if not cache:
            return False, "No cache configured", 0, []

        # Check cache data
        cached_models = cache.get('data')
        cache_timestamp = cache.get('timestamp')

        if not cached_models:
            return False, "Cache is empty", 0, []

        model_count = len(cached_models) if isinstance(cached_models, list) else 0

        if model_count == 0:
            return False, "Cache has 0 models", 0, []

        # Check cache age
        if cache_timestamp:
            cache_age = (datetime.now(timezone.utc) - cache_timestamp).total_seconds()
            age_hours = cache_age / 3600
            age_str = f"{age_hours:.1f}h old" if age_hours >= 1 else f"{cache_age:.0f}s old"
        else:
            age_str = "unknown age"

        # Check if model count meets minimum threshold
        min_expected = config.get('min_expected_models', 1)
        if model_count < min_expected:
            return False, f"Only {model_count} models (expected ≥{min_expected}), {age_str}", model_count, cached_models

        return True, f"{model_count} models cached, {age_str}", model_count, cached_models

    except Exception as e:
        return False, f"Cache check error: {str(e)[:100]}", 0, []


def clear_gateway_cache(gateway_name: str, config: dict) -> bool:
    """Clear the cache for a gateway to force refresh"""
    try:
        cache = config.get('cache')
        if cache:
            cache['data'] = None
            cache['timestamp'] = None
            return True
        return False
    except Exception as e:
        print(f"  ❌ Failed to clear cache: {e}")
        return False


def attempt_auto_fix(gateway_name: str, config: dict) -> Tuple[bool, str]:
    """
    Attempt to automatically fix a failing gateway
    
    Returns:
        (fixed: bool, message: str)
    """
    try:
        print(f"  🔧 Attempting auto-fix...")
        
        # Step 1: Clear cache
        print(f"     → Clearing cache...")
        if not clear_gateway_cache(gateway_name, config):
            return False, "Failed to clear cache"
        
        # Step 2: Force refetch
        print(f"     → Fetching fresh models...")
        models = get_cached_models(gateway_name)
        
        if not models or len(models) == 0:
            return False, "Refetch returned 0 models"
        
        # Step 3: Verify the fix
        success, message, count, _ = test_gateway_cache(gateway_name, config)

        if success:
            return True, f"Fixed! Now has {count} models"
        else:
            return False, f"Refetch didn't help: {message}"
            
    except Exception as e:
        return False, f"Auto-fix error: {str(e)[:100]}"


def run_comprehensive_check(
    auto_fix: bool = True,
    verbose: bool = False,
    gateway: Optional[str] = None
) -> Dict:
    """
    Run comprehensive check on all gateways
    
    Args:
        auto_fix: Whether to attempt automatic fixes for failing gateways
        verbose: Whether to print detailed output
        
    Returns:
        Dictionary with test results
    """
    print("=" * 80)
    print("Gateway Model URL Health Check & Auto-Fix")
    print("=" * 80)
    print()
    
    if gateway:
        gateway_key = gateway.lower()
        if gateway_key not in GATEWAY_CONFIG:
            raise ValueError(
                f"Unknown gateway: {gateway}. Available: {', '.join(GATEWAY_CONFIG.keys())}"
            )
        gateways_to_check = {gateway_key: GATEWAY_CONFIG[gateway_key]}
    else:
        gateways_to_check = GATEWAY_CONFIG

    results = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'total_gateways': len(gateways_to_check),
        'healthy': 0,
        'unhealthy': 0,
        'fixed': 0,
        'unconfigured': 0,
        'gateways': {}
    }
    
    for gateway_name, config in gateways_to_check.items():
        gateway_display_name = config['name']
        print(f"\n{'─' * 80}")
        print(f"Testing: {gateway_display_name} ({gateway_name})")
        print(f"{'─' * 80}")
        
        gateway_result = {
            'name': gateway_display_name,
            'configured': bool(config['api_key']),
            'endpoint_test': {},
            'cache_test': {},
            'auto_fix_attempted': False,
            'auto_fix_successful': False,
            'final_status': 'unknown'
        }
        
        # Check if API key is configured
        if not config['api_key']:
            print(f"⚠️  API key not configured: {config['api_key_env']}")
            gateway_result['final_status'] = 'unconfigured'
            results['unconfigured'] += 1
            results['gateways'][gateway_name] = gateway_result
            continue
        
        # Test 1: Direct endpoint test
        print(f"\n1. Testing API endpoint: {config['url']}")
        endpoint_success, endpoint_msg, endpoint_count = test_gateway_endpoint(gateway_name, config)
        gateway_result['endpoint_test'] = {
            'success': endpoint_success,
            'message': endpoint_msg,
            'model_count': endpoint_count
        }

        if endpoint_success:
            print(f"   ✅ {endpoint_msg}")
        else:
            print(f"   ❌ {endpoint_msg}")
        
        # Test 2: Cache test
        print(f"\n2. Testing cached models:")
        cache_success, cache_msg, cache_count, cached_models = test_gateway_cache(gateway_name, config)
        gateway_result['cache_test'] = {
            'success': cache_success,
            'message': cache_msg,
            'model_count': cache_count,
            'models': cached_models
        }
        
        if cache_success:
            print(f"   ✅ {cache_msg}")
        else:
            print(f"   ❌ {cache_msg}")
        
        # Determine if gateway is healthy
        is_healthy = endpoint_success or cache_success
        
        # Auto-fix if needed and enabled
        if not is_healthy and auto_fix:
            print(f"\n3. Auto-fix:")
            gateway_result['auto_fix_attempted'] = True
            fixed, fix_msg = attempt_auto_fix(gateway_name, config)
            gateway_result['auto_fix_successful'] = fixed
            
            if fixed:
                print(f"   ✅ {fix_msg}")
                is_healthy = True
                results['fixed'] += 1
            else:
                print(f"   ❌ {fix_msg}")
        
        # Final status
        if is_healthy:
            gateway_result['final_status'] = 'healthy'
            results['healthy'] += 1
            print(f"\n✅ Final Status: HEALTHY")
        else:
            gateway_result['final_status'] = 'unhealthy'
            results['unhealthy'] += 1
            print(f"\n❌ Final Status: UNHEALTHY")
        
        results['gateways'][gateway_name] = gateway_result
    
    # Print summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Gateways:  {results['total_gateways']}")
    print(f"✅ Healthy:       {results['healthy']}")
    print(f"❌ Unhealthy:     {results['unhealthy']}")
    print(f"⚠️  Unconfigured:  {results['unconfigured']}")
    if auto_fix:
        print(f"🔧 Auto-fixed:    {results['fixed']}")
    print("=" * 80)
    
    # Return status code
    return results


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Check and fix gateway model endpoints')
    parser.add_argument('--no-fix', action='store_true', help='Disable auto-fix attempts')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--gateway', '-g', type=str, help='Test only specific gateway')
    
    args = parser.parse_args()
    
    gateway_filter: Optional[str] = None
    if args.gateway:
        gateway_name = args.gateway.lower()
        if gateway_name not in GATEWAY_CONFIG:
            print(f"❌ Unknown gateway: {gateway_name}")
            print(f"Available gateways: {', '.join(GATEWAY_CONFIG.keys())}")
            sys.exit(1)
        gateway_filter = gateway_name
    
    # Run comprehensive check
    results = run_comprehensive_check(
        auto_fix=not args.no_fix,
        verbose=args.verbose,
        gateway=gateway_filter
    )
    
    # Exit with error code if there are unhealthy gateways
    if results['unhealthy'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
