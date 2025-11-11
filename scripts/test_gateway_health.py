#!/usr/bin/env python3
"""
Gateway Health Testing Script

This script tests all gateways in the Gatewayz platform to identify any issues
that might cause 502 errors or other failures.

Usage:
    python scripts/test_gateway_health.py [--verbose] [--gateway GATEWAY_NAME]
"""

import asyncio
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import Config
from src.services.models import get_cached_models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# All gateways to test
ALL_GATEWAYS = [
    "openrouter",
    "portkey",
    "featherless",
    "chutes",
    "groq",
    "fireworks",
    "together",
    "deepinfra",
    "google-vertex",
    "cerebras",
    "nebius",
    "xai",
    "novita",
    "huggingface",
    "aimo",
    "near",
    "fal",
    "vercel-ai-gateway",
    "helicone",
    "anannas",
    "aihubmix",
]

# Gateway configurations for direct API testing
GATEWAY_CONFIGS = {
    "openrouter": {
        "url": "https://openrouter.ai/api/v1/models",
        "api_key_env": "OPENROUTER_API_KEY",
        "headers": lambda key: {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    },
    "portkey": {
        "url": "https://api.portkey.ai/v1/models",
        "api_key_env": "PORTKEY_API_KEY",
        "headers": lambda key: {
            "x-portkey-api-key": key,
            "Content-Type": "application/json",
        },
    },
    "featherless": {
        "url": "https://api.featherless.ai/v1/models",
        "api_key_env": "FEATHERLESS_API_KEY",
        "headers": lambda key: {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    },
    "deepinfra": {
        "url": "https://api.deepinfra.com/v1/openai/models",
        "api_key_env": "DEEPINFRA_API_KEY",
        "headers": lambda key: {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    },
    "groq": {
        "url": "https://api.groq.com/openai/v1/models",
        "api_key_env": "GROQ_API_KEY",
        "headers": lambda key: {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    },
    "fireworks": {
        "url": "https://api.fireworks.ai/inference/v1/models",
        "api_key_env": "FIREWORKS_API_KEY",
        "headers": lambda key: {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    },
    "together": {
        "url": "https://api.together.xyz/v1/models",
        "api_key_env": "TOGETHER_API_KEY",
        "headers": lambda key: {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    },
    "xai": {
        "url": "https://api.x.ai/v1/models",
        "api_key_env": "XAI_API_KEY",
        "headers": lambda key: {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    },
}


class GatewayTestResult:
    """Test result for a gateway"""

    def __init__(self, gateway: str):
        self.gateway = gateway
        self.cache_import_ok = False
        self.get_cached_models_ok = False
        self.direct_api_ok = False
        self.model_count = 0
        self.error_message: Optional[str] = None
        self.response_time_ms: Optional[float] = None
        self.http_status: Optional[int] = None
        self.warnings: List[str] = []

    def is_healthy(self) -> bool:
        """Check if gateway is healthy"""
        return self.get_cached_models_ok and self.model_count > 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "gateway": self.gateway,
            "healthy": self.is_healthy(),
            "cache_import_ok": self.cache_import_ok,
            "get_cached_models_ok": self.get_cached_models_ok,
            "direct_api_ok": self.direct_api_ok,
            "model_count": self.model_count,
            "error_message": self.error_message,
            "response_time_ms": self.response_time_ms,
            "http_status": self.http_status,
            "warnings": self.warnings,
        }


async def test_cache_import(gateway: str, result: GatewayTestResult) -> None:
    """Test if the gateway cache is properly imported"""
    try:
        from src.cache import get_models_cache

        cache = get_models_cache(gateway)
        if cache is not None:
            result.cache_import_ok = True
            logger.debug(f"✓ {gateway}: Cache import OK")
        else:
            result.cache_import_ok = False
            result.warnings.append(f"Cache not found in get_models_cache()")
            logger.warning(f"⚠ {gateway}: Cache not found in get_models_cache()")
    except Exception as e:
        result.cache_import_ok = False
        result.warnings.append(f"Cache import error: {str(e)}")
        logger.error(f"✗ {gateway}: Cache import error - {e}")


async def test_get_cached_models(gateway: str, result: GatewayTestResult) -> None:
    """Test if get_cached_models() works for the gateway"""
    try:
        start_time = time.time()
        models = get_cached_models(gateway)
        response_time = (time.time() - start_time) * 1000

        if models is not None:
            result.get_cached_models_ok = True
            result.model_count = len(models)
            result.response_time_ms = response_time
            logger.info(
                f"✓ {gateway}: get_cached_models() returned {result.model_count} models in {response_time:.0f}ms"
            )

            # Validate model structure
            if result.model_count > 0:
                sample_model = models[0]
                if not isinstance(sample_model, dict):
                    result.warnings.append("Models are not dictionaries")
                elif "id" not in sample_model:
                    result.warnings.append("Models missing 'id' field")
        else:
            result.get_cached_models_ok = False
            result.error_message = "get_cached_models() returned None"
            logger.error(f"✗ {gateway}: get_cached_models() returned None")
    except Exception as e:
        result.get_cached_models_ok = False
        result.error_message = f"get_cached_models() error: {str(e)}"
        logger.error(f"✗ {gateway}: get_cached_models() error - {e}")


async def test_direct_api(gateway: str, result: GatewayTestResult) -> None:
    """Test direct API call to the gateway"""
    if gateway not in GATEWAY_CONFIGS:
        logger.debug(f"⊘ {gateway}: No direct API config available (skipping)")
        return

    config = GATEWAY_CONFIGS[gateway]
    api_key_env = config["api_key_env"]
    api_key = getattr(Config, api_key_env, None)

    if not api_key:
        result.warnings.append(f"API key not configured: {api_key_env}")
        logger.warning(f"⚠ {gateway}: API key not configured ({api_key_env})")
        return

    try:
        headers = config["headers"](api_key)
        url = config["url"]

        async with httpx.AsyncClient(timeout=30.0) as client:
            start_time = time.time()
            response = await client.get(url, headers=headers)
            response_time = (time.time() - start_time) * 1000

            result.http_status = response.status_code
            result.response_time_ms = response_time

            if response.status_code == 200:
                result.direct_api_ok = True
                try:
                    data = response.json()
                    # Try to extract model count
                    if isinstance(data, dict) and "data" in data:
                        models = data["data"]
                    elif isinstance(data, list):
                        models = data
                    else:
                        models = []
                    logger.info(
                        f"✓ {gateway}: Direct API OK - {len(models)} models in {response_time:.0f}ms"
                    )
                except Exception as e:
                    logger.warning(f"⚠ {gateway}: Could not parse API response - {e}")
            elif response.status_code == 502:
                result.direct_api_ok = False
                result.error_message = f"502 Bad Gateway from {url}"
                logger.error(f"✗ {gateway}: 502 Bad Gateway from {url}")
            else:
                result.direct_api_ok = False
                result.error_message = f"HTTP {response.status_code}: {response.text[:200]}"
                logger.error(
                    f"✗ {gateway}: HTTP {response.status_code} from {url}"
                )
    except httpx.TimeoutException:
        result.direct_api_ok = False
        result.error_message = "Request timeout (30s)"
        logger.error(f"✗ {gateway}: Request timeout")
    except Exception as e:
        result.direct_api_ok = False
        result.error_message = f"Direct API error: {str(e)}"
        logger.error(f"✗ {gateway}: Direct API error - {e}")


async def test_gateway(gateway: str, verbose: bool = False) -> GatewayTestResult:
    """Test a single gateway"""
    logger.info(f"\n{'='*60}")
    logger.info(f"Testing gateway: {gateway}")
    logger.info(f"{'='*60}")

    result = GatewayTestResult(gateway)

    # Test 1: Cache import
    await test_cache_import(gateway, result)

    # Test 2: get_cached_models()
    await test_get_cached_models(gateway, result)

    # Test 3: Direct API call (if configured)
    await test_direct_api(gateway, result)

    # Summary
    status = "✓ HEALTHY" if result.is_healthy() else "✗ UNHEALTHY"
    logger.info(f"\n{gateway}: {status}")
    if result.error_message:
        logger.error(f"  Error: {result.error_message}")
    if result.warnings:
        for warning in result.warnings:
            logger.warning(f"  Warning: {warning}")

    return result


async def test_all_gateways(
    gateways: Optional[List[str]] = None, verbose: bool = False
) -> List[GatewayTestResult]:
    """Test all gateways"""
    test_gateways = gateways or ALL_GATEWAYS

    logger.info(f"\n{'='*60}")
    logger.info(f"GATEWAY HEALTH TEST")
    logger.info(f"Testing {len(test_gateways)} gateways")
    logger.info(f"{'='*60}\n")

    results = []
    for gateway in test_gateways:
        result = await test_gateway(gateway, verbose)
        results.append(result)
        await asyncio.sleep(0.5)  # Small delay between tests

    return results


def print_summary(results: List[GatewayTestResult]) -> None:
    """Print test summary"""
    logger.info(f"\n{'='*60}")
    logger.info(f"TEST SUMMARY")
    logger.info(f"{'='*60}\n")

    healthy_count = sum(1 for r in results if r.is_healthy())
    unhealthy_count = len(results) - healthy_count

    logger.info(f"Total gateways tested: {len(results)}")
    logger.info(f"Healthy: {healthy_count}")
    logger.info(f"Unhealthy: {unhealthy_count}")

    if unhealthy_count > 0:
        logger.info("\n❌ PROBLEMATIC GATEWAYS:\n")
        for result in results:
            if not result.is_healthy():
                logger.info(f"  • {result.gateway}")
                if result.error_message:
                    logger.info(f"    Error: {result.error_message}")
                if result.warnings:
                    for warning in result.warnings:
                        logger.info(f"    Warning: {warning}")

    # Detailed results table
    logger.info(f"\n{'='*60}")
    logger.info("DETAILED RESULTS")
    logger.info(f"{'='*60}\n")
    logger.info(
        f"{'Gateway':<20} {'Status':<12} {'Models':<10} {'Cache':<8} {'API':<8}"
    )
    logger.info("-" * 60)

    for result in results:
        status = "✓ HEALTHY" if result.is_healthy() else "✗ UNHEALTHY"
        cache_status = "✓" if result.cache_import_ok else "✗"
        api_status = "✓" if result.direct_api_ok else ("⊘" if result.http_status is None else "✗")

        logger.info(
            f"{result.gateway:<20} {status:<12} {result.model_count:<10} {cache_status:<8} {api_status:<8}"
        )


def save_results(results: List[GatewayTestResult], output_file: str) -> None:
    """Save results to JSON file"""
    output = {
        "timestamp": datetime.now().isoformat(),
        "total_gateways": len(results),
        "healthy_count": sum(1 for r in results if r.is_healthy()),
        "unhealthy_count": sum(1 for r in results if not r.is_healthy()),
        "results": [r.to_dict() for r in results],
    }

    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)

    logger.info(f"\n✓ Results saved to: {output_file}")


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Test gateway health")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--gateway", "-g", help="Test specific gateway only")
    parser.add_argument(
        "--output", "-o", default="gateway_test_results.json", help="Output file"
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Test gateways
    gateways = [args.gateway] if args.gateway else ALL_GATEWAYS
    results = await test_all_gateways(gateways, args.verbose)

    # Print summary
    print_summary(results)

    # Save results
    save_results(results, args.output)

    # Exit with error code if any gateway is unhealthy
    unhealthy_count = sum(1 for r in results if not r.is_healthy())
    sys.exit(1 if unhealthy_count > 0 else 0)


if __name__ == "__main__":
    asyncio.run(main())
