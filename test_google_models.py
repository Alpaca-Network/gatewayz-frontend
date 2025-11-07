#!/usr/bin/env python3
"""
Test Google AI models with a health check message
"""
import os
import sys
import json
import time
import requests
from datetime import datetime
from typing import Dict, List, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
TIMEOUT = 30  # seconds per request
HEALTH_CHECK_MESSAGE = "Health check - reply 'live' if receiving this message"

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'


def get_api_key():
    """Get API key from file or environment"""
    # Try to read from .test_api_key file
    if os.path.exists(".test_api_key"):
        with open(".test_api_key", "r") as f:
            return f.read().strip()

    # Try environment variable
    api_key = os.getenv("API_KEY")
    if api_key:
        return api_key

    # Prompt user
    print(f"{YELLOW}No API key found. Please provide your API key:{RESET}")
    return input("API Key: ").strip()


def get_google_models(api_key: str) -> List[Dict[str, Any]]:
    """Fetch only Google models from the catalog"""
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        response = requests.get(
            f"{BASE_URL}/v1/models",
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            all_models = data.get("data", [])

            # Filter for Google models (gemini, gemma, or google/ prefix)
            google_models = [
                m for m in all_models
                if ("google/" in m.get("id", "").lower() or
                    "gemini" in m.get("id", "").lower() or
                    "gemma" in m.get("id", "").lower())
            ]

            print(f"{GREEN}✓{RESET} Found {len(google_models)} Google models (out of {len(all_models)} total)")
            return google_models
        else:
            print(f"{RED}✗{RESET} Failed to fetch models: {response.status_code}")
            print(f"  Response: {response.text}")
            return []

    except Exception as e:
        print(f"{RED}✗{RESET} Error fetching models: {e}")
        return []


def test_model(model_id: str, api_key: str, max_tokens: int = 50) -> Dict[str, Any]:
    """Test a single model with health check message"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model_id,
        "messages": [
            {"role": "user", "content": HEALTH_CHECK_MESSAGE}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.7
    }

    start_time = time.time()

    try:
        response = requests.post(
            f"{BASE_URL}/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=TIMEOUT
        )

        elapsed = time.time() - start_time

        if response.status_code == 200:
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})

            return {
                "success": True,
                "status_code": 200,
                "response": content[:100],  # First 100 chars
                "elapsed": elapsed,
                "tokens": usage.get("total_tokens", 0),
                "error": None
            }
        else:
            return {
                "success": False,
                "status_code": response.status_code,
                "response": None,
                "elapsed": elapsed,
                "tokens": 0,
                "error": response.text[:200]  # First 200 chars of error
            }

    except requests.exceptions.Timeout:
        return {
            "success": False,
            "status_code": 0,
            "response": None,
            "elapsed": TIMEOUT,
            "tokens": 0,
            "error": "Request timeout"
        }

    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "success": False,
            "status_code": 0,
            "response": None,
            "elapsed": elapsed,
            "tokens": 0,
            "error": str(e)[:200]
        }


def format_duration(seconds: float) -> str:
    """Format duration in human-readable format"""
    if seconds < 1:
        return f"{seconds*1000:.0f}ms"
    else:
        return f"{seconds:.2f}s"


def main():
    print(f"\n{BOLD}{'='*80}{RESET}")
    print(f"{BOLD}🧪 GOOGLE AI MODELS HEALTH CHECK{RESET}")
    print(f"{BOLD}{'='*80}{RESET}\n")

    # Get API key
    api_key = get_api_key()
    if not api_key:
        print(f"{RED}✗{RESET} No API key provided")
        exit(1)

    print(f"{BLUE}ℹ{RESET} Using API key: {api_key[:20]}...")
    print(f"{BLUE}ℹ{RESET} Base URL: {BASE_URL}")
    print(f"{BLUE}ℹ{RESET} Timeout: {TIMEOUT}s per request\n")

    # Get Google models
    print(f"{BOLD}📋 Fetching Google models...{RESET}")
    google_models = get_google_models(api_key)

    if not google_models:
        print(f"{RED}✗{RESET} No Google models found. Check your GOOGLE_API_KEY in .env")
        exit(1)

    # Test each model
    print(f"\n{BOLD}🚀 Starting tests...{RESET}\n")

    results = {
        "success": [],
        "failed": [],
        "total": len(google_models)
    }

    for idx, model in enumerate(google_models, 1):
        model_id = model.get("id", "unknown")

        # Print progress
        print(f"[{idx}/{len(google_models)}] Testing {BOLD}{model_id}{RESET}... ", end="", flush=True)

        # Test the model
        result = test_model(model_id, api_key)

        # Store result
        result["model_id"] = model_id

        if result["success"]:
            results["success"].append(result)
            print(f"{GREEN}✓{RESET} {format_duration(result['elapsed'])} ({result['tokens']} tokens)")
            if result["response"]:
                print(f"    Response: {result['response'][:80]}...")
        else:
            results["failed"].append(result)
            if result["status_code"] == 502:
                print(f"{RED}✗{RESET} Bad Gateway (502) - Check GOOGLE_API_KEY")
            elif result["status_code"] == 401:
                print(f"{RED}✗{RESET} Unauthorized (401) - Invalid API key")
            elif result["status_code"] == 403:
                print(f"{RED}✗{RESET} Forbidden (403) - API key lacks permissions")
            elif result["status_code"] == 0:
                print(f"{RED}✗{RESET} {result['error']}")
            else:
                print(f"{RED}✗{RESET} HTTP {result['status_code']}")
                if result["error"]:
                    print(f"    Error: {result['error'][:80]}...")

        # Small delay to be respectful to upstream
        time.sleep(0.5)

    # Print summary
    print(f"\n{BOLD}{'='*80}{RESET}")
    print(f"{BOLD}📊 TEST SUMMARY{RESET}")
    print(f"{BOLD}{'='*80}{RESET}\n")

    success_count = len(results["success"])
    failed_count = len(results["failed"])
    total_count = results["total"]
    success_rate = (success_count / total_count * 100) if total_count > 0 else 0

    print(f"Total Google Models Tested: {total_count}")
    print(f"{GREEN}✓{RESET} Successful: {success_count} ({success_rate:.1f}%)")
    print(f"{RED}✗{RESET} Failed: {failed_count} ({100-success_rate:.1f}%)")

    # Group failures by error type
    if results["failed"]:
        print(f"\n{BOLD}Failed Models by Error Type:{RESET}")

        error_types = {}
        for result in results["failed"]:
            if result["status_code"] == 502:
                error_type = "Bad Gateway (502) - Invalid GOOGLE_API_KEY"
            elif result["status_code"] == 401:
                error_type = "Unauthorized (401)"
            elif result["status_code"] == 403:
                error_type = "Forbidden (403)"
            elif result["status_code"] == 404:
                error_type = "Model Not Found (404)"
            elif "timeout" in result.get("error", "").lower():
                error_type = "Timeout"
            else:
                error_type = f"HTTP {result['status_code']}" if result["status_code"] else "Connection Error"

            if error_type not in error_types:
                error_types[error_type] = []
            error_types[error_type].append(result["model_id"])

        for error_type, model_ids in sorted(error_types.items()):
            print(f"\n  {YELLOW}{error_type}{RESET}: {len(model_ids)} models")
            for model_id in model_ids[:10]:  # Show first 10
                print(f"    - {model_id}")
            if len(model_ids) > 10:
                print(f"    ... and {len(model_ids) - 10} more")

    # Show successful models
    if results["success"]:
        print(f"\n{BOLD}Successful Google Models:{RESET}")
        for result in results["success"][:10]:  # Show first 10
            print(f"  {GREEN}✓{RESET} {result['model_id']} - {format_duration(result['elapsed'])}")
        if len(results["success"]) > 10:
            print(f"  ... and {len(results['success']) - 10} more")

    # Calculate average response time for successful requests
    if results["success"]:
        avg_time = sum(r["elapsed"] for r in results["success"]) / len(results["success"])
        avg_tokens = sum(r["tokens"] for r in results["success"]) / len(results["success"])
        print(f"\n{BOLD}Performance Metrics:{RESET}")
        print(f"  Average Response Time: {format_duration(avg_time)}")
        print(f"  Average Tokens: {avg_tokens:.0f}")

    # Save results to file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"google_models_test_{timestamp}.json"

    with open(output_file, "w") as f:
        json.dump({
            "timestamp": timestamp,
            "base_url": BASE_URL,
            "total_tested": total_count,
            "successful": success_count,
            "failed": failed_count,
            "success_rate": success_rate,
            "results": {
                "success": results["success"],
                "failed": results["failed"]
            }
        }, f, indent=2)

    print(f"\n💾 Detailed results saved to: {output_file}")

    # Exit with appropriate code
    if failed_count == total_count:
        print(f"\n{RED}{BOLD}⚠ ALL TESTS FAILED{RESET}")
        print(f"{YELLOW}Tip: Check that GOOGLE_API_KEY in .env is a valid Google AI Studio API key{RESET}")
        print(f"{YELLOW}Get one at: https://aistudio.google.com/app/apikey{RESET}")

    print(f"\n{BOLD}{'='*80}{RESET}\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}⚠{RESET} Test interrupted by user")
        exit(1)
