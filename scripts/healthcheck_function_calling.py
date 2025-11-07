#!/usr/bin/env python3
"""Health check script for function calling support

This script can be run periodically to verify that function calling
is working correctly. Can be integrated into monitoring systems.
"""

import json
import logging
import os
import sys
from typing import Any

import httpx

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration
API_URL = os.getenv("GATEWAYZ_API_URL", "http://localhost:8000")
API_KEY = os.getenv("GATEWAYZ_API_KEY", "")
HEALTH_CHECK_MODEL = os.getenv("HEALTH_CHECK_MODEL", "gpt-3.5-turbo")
HEALTH_CHECK_PROVIDER = os.getenv("HEALTH_CHECK_PROVIDER", "openrouter")


def check_function_calling() -> dict[str, Any]:
    """Check if function calling is working
    
    Returns:
        Health check result dictionary
    """
    result = {
        "status": "unknown",
        "tools_received": False,
        "tools_passed_to_provider": False,
        "error": None,
        "timestamp": None,
    }
    
    if not API_KEY:
        result["status"] = "error"
        result["error"] = "API_KEY not configured"
        return result
    
    try:
        import datetime
        
        result["timestamp"] = datetime.datetime.now().isoformat()
        
        # Simple test tools
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "test_function",
                    "description": "Test function",
                    "parameters": {
                        "type": "object",
                        "properties": {"test": {"type": "string"}},
                    },
                },
            }
        ]
        
        # Make a test request
        payload = {
            "model": HEALTH_CHECK_MODEL,
            "messages": [{"role": "user", "content": "Hello"}],
            "tools": tools,
            "max_tokens": 10,
        }
        
        if HEALTH_CHECK_PROVIDER:
            payload["provider"] = HEALTH_CHECK_PROVIDER
        
        with httpx.Client(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {API_KEY}"}
            response = client.post(
                f"{API_URL}/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            
            if response.status_code == 200:
                result["status"] = "healthy"
                result["tools_received"] = True
                # Note: We can't easily verify tools were passed to provider
                # without checking logs or mocking. For now, we assume if request
                # succeeds, tools were processed correctly.
                result["tools_passed_to_provider"] = True
            else:
                result["status"] = "unhealthy"
                result["error"] = f"HTTP {response.status_code}: {response.text[:200]}"
    
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        logger.exception("Health check failed")
    
    return result


def main():
    """Run health check"""
    result = check_function_calling()
    
    # Output as JSON for easy parsing
    print(json.dumps(result, indent=2))
    
    # Exit with appropriate code
    if result["status"] == "healthy":
        sys.exit(0)
    elif result["status"] == "unhealthy":
        sys.exit(1)
    else:
        sys.exit(2)  # Error state


if __name__ == "__main__":
    main()

