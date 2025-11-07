#!/usr/bin/env python3
"""
Test script to validate all available Google Vertex AI models
and run a test prompt with each one.
"""

import sys
import json
from datetime import datetime
from typing import Any
from pathlib import Path

# Add src to path for imports
repo_root = Path(__file__).parent.parent.parent.resolve()  # Go up 3 levels: validation -> scripts -> repo
sys.path.insert(0, str(repo_root))

from src.config import Config
from src.services.google_vertex_client import (
    make_google_vertex_request_openai,
    diagnose_google_vertex_credentials,
)
from src.services.model_transformations import (
    GEMINI_2_5_FLASH_LITE_PREVIEW,
    GEMINI_2_5_FLASH_PREVIEW,
    GEMINI_2_5_PRO_PREVIEW,
    GEMINI_2_0_FLASH,
    GEMINI_2_0_PRO,
    GEMINI_1_5_PRO,
    GEMINI_1_5_FLASH,
    GEMINI_1_0_PRO,
)

# List of available Google models
GOOGLE_MODELS = [
    # Gemini 2.5 Preview models (mapped to 2.0 stable versions)
    ("gemini-2.5-flash-lite", GEMINI_2_0_FLASH, "Mapped to Gemini 2.0 Flash"),
    ("gemini-2.5-flash", GEMINI_2_0_FLASH, "Mapped to Gemini 2.0 Flash"),
    ("gemini-2.5-pro", GEMINI_2_0_PRO, "Mapped to Gemini 2.0 Pro"),

    # Gemini 2.0 models (stable)
    ("gemini-2.0-flash", GEMINI_2_0_FLASH, "Stable Gemini 2.0 Flash"),
    ("gemini-2.0-pro", GEMINI_2_0_PRO, "Stable Gemini 2.0 Pro"),
    ("gemini-2.0-flash-thinking", "gemini-2.0-flash-thinking", "Gemini 2.0 Flash with thinking"),

    # Gemini 1.5 models
    ("gemini-1.5-pro", GEMINI_1_5_PRO, "Gemini 1.5 Pro"),
    ("gemini-1.5-flash", GEMINI_1_5_FLASH, "Gemini 1.5 Flash"),

    # Gemini 1.0 models
    ("gemini-1.0-pro", GEMINI_1_0_PRO, "Gemini 1.0 Pro"),
]

# Test prompt
TEST_PROMPT = "Say 'Hello from [MODEL_NAME]!' in exactly 5 words or less."


def format_result(model_input: str, resolved_model: str, success: bool, response: dict | str) -> dict:
    """Format test result for display"""
    return {
        "model_input": model_input,
        "resolved_model": resolved_model,
        "success": success,
        "response": response if isinstance(response, str) else str(response),
    }


def run_model_test(model_input: str, resolved_model: str) -> dict:
    """Test a single model with the test prompt"""
    try:
        print(f"\n  Testing {model_input} (resolved to: {resolved_model})...")

        messages = [
            {
                "role": "user",
                "content": TEST_PROMPT.replace("[MODEL_NAME]", resolved_model),
            }
        ]

        response = make_google_vertex_request_openai(
            messages=messages,
            model=resolved_model,
            max_tokens=100,
            temperature=0.7,
        )

        # Extract the response text
        if response and "choices" in response:
            content = response["choices"][0]["message"]["content"]
            print(f"    ✓ Success: {content[:100]}")
            return format_result(model_input, resolved_model, True, content)
        else:
            error = "No content in response"
            print(f"    ✗ Failed: {error}")
            return format_result(model_input, resolved_model, False, error)

    except Exception as e:
        error_msg = str(e)[:200]
        print(f"    ✗ Failed: {error_msg}")
        return format_result(model_input, resolved_model, False, error_msg)


def main():
    """Main test runner"""
    print("=" * 80)
    print("Google Vertex AI Model Validation Test")
    print("=" * 80)

    # Step 1: Diagnose credentials
    print("\n1. Diagnosing Google Vertex AI Credentials...")
    print("-" * 80)

    diagnosis = diagnose_google_vertex_credentials()
    print(f"Credentials Available: {diagnosis['credentials_available']}")
    print(f"Credential Source: {diagnosis['credential_source']}")
    print(f"Project ID: {diagnosis['project_id']}")
    print(f"Location: {diagnosis['location']}")
    print(f"Token Available: {diagnosis['token_available']}")
    print(f"Health Status: {diagnosis['health_status']}")

    if diagnosis["error"]:
        print(f"Error: {diagnosis['error']}")
        print("\nDiagnostic Steps:")
        for step in diagnosis["steps"]:
            print(f"  {step['step']}: {'✓' if step.get('passed', False) else '✗'}")
            if step.get('details'):
                print(f"    {step['details']}")

        if not diagnosis['credentials_available']:
            print("\nCannot proceed with model tests - credentials not available")
            return

    print("\n✓ Credentials validated successfully")

    # Step 2: Test all models
    print("\n2. Testing All Google Models...")
    print("-" * 80)

    results = []

    for model_input, resolved_model, description in GOOGLE_MODELS:
        print(f"\n[{resolved_model}]")
        print(f"  Description: {description}")

        result = run_model_test(model_input, resolved_model)
        results.append(result)

    # Step 3: Summary
    print("\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)

    successful = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])

    print(f"\nTotal Tests: {len(results)}")
    print(f"Successful: {successful} ✓")
    print(f"Failed: {failed} ✗")
    print(f"Success Rate: {(successful/len(results)*100):.1f}%")

    # Detailed results
    print("\nDetailed Results:")
    print("-" * 80)

    for result in results:
        status = "✓ PASS" if result["success"] else "✗ FAIL"
        print(f"\n{status} - {result['model_input']} → {result['resolved_model']}")
        if result["success"]:
            # Truncate long responses
            response_text = result["response"]
            if len(response_text) > 150:
                response_text = response_text[:150] + "..."
            print(f"  Response: {response_text}")
        else:
            # Truncate long errors
            error_text = result["response"]
            if len(error_text) > 150:
                error_text = error_text[:150] + "..."
            print(f"  Error: {error_text}")

    # Export results to JSON
    print("\n" + "=" * 80)
    results_file = repo_root / "google_models_test_results.json"
    with open(results_file, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_models": len(results),
            "successful": successful,
            "failed": failed,
            "success_rate": f"{(successful/len(results)*100):.1f}%",
            "results": results,
            "configuration": {
                "project_id": Config.GOOGLE_PROJECT_ID,
                "location": Config.GOOGLE_VERTEX_LOCATION,
            },
        }, f, indent=2)

    print(f"Results exported to: {results_file}")
    print("=" * 80)

    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
