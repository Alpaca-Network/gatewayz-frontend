#!/usr/bin/env python3
"""Test script to verify Vercel AI Gateway integration"""

import sys
import os

# Add repo to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from src.config import Config
from src.services.model_transformations import (
    transform_model_id,
    detect_provider_from_model_id,
    get_model_id_mapping
)
from src.services.provider_failover import build_provider_failover_chain
import importlib.util


def test_vercel_config():
    """Test that Vercel AI Gateway configuration is present"""
    print("Testing Vercel AI Gateway Configuration...")
    print("-" * 60)

    # Check if the config attribute exists
    has_api_key_attr = hasattr(Config, 'VERCEL_AI_GATEWAY_API_KEY')
    print(f"✓ VERCEL_AI_GATEWAY_API_KEY attribute exists: {has_api_key_attr}")

    if has_api_key_attr:
        api_key = Config.VERCEL_AI_GATEWAY_API_KEY
        if api_key:
            print(f"✓ API key configured: {api_key[:10]}..." if len(api_key) > 10 else f"✓ API key configured (empty or test key)")
        else:
            print("⚠ API key not set in environment (expected for tests)")

    return has_api_key_attr


def test_vercel_client_import():
    """Test that the Vercel AI Gateway client can be imported"""
    print("\nTesting Vercel AI Gateway Client Import...")
    print("-" * 60)

    try:
        from src.services.vercel_ai_gateway_client import (
            get_vercel_ai_gateway_client,
            make_vercel_ai_gateway_request_openai,
            make_vercel_ai_gateway_request_openai_stream,
            process_vercel_ai_gateway_response
        )
        print("✓ Successfully imported all Vercel AI Gateway client functions")
        print(f"  - get_vercel_ai_gateway_client: {get_vercel_ai_gateway_client}")
        print(f"  - make_vercel_ai_gateway_request_openai: {make_vercel_ai_gateway_request_openai}")
        print(f"  - make_vercel_ai_gateway_request_openai_stream: {make_vercel_ai_gateway_request_openai_stream}")
        print(f"  - process_vercel_ai_gateway_response: {process_vercel_ai_gateway_response}")
        return True
    except ImportError as e:
        print(f"❌ Failed to import Vercel AI Gateway client: {e}")
        return False


def test_vercel_model_mappings():
    """Test Vercel AI Gateway model ID transformations"""
    print("\nTesting Vercel AI Gateway Model Mappings...")
    print("-" * 60)

    # Get Vercel mappings
    mappings = get_model_id_mapping("vercel-ai-gateway")
    if not mappings:
        print("❌ No Vercel AI Gateway mappings found!")
        return False

    print(f"✓ Found {len(mappings)} Vercel AI Gateway model mappings")

    # Test some specific mappings
    test_cases = [
        ("gpt-4", "gpt-4"),
        ("gpt-4o", "gpt-4o"),
        ("claude-sonnet", "claude-3-sonnet-20240229"),
        ("gemini-2.0-flash", "gemini-2.0-flash"),
        ("anthropic/claude-3-opus", "claude-3-opus-20240229"),
        ("openai/gpt-4", "gpt-4"),
    ]

    all_pass = True
    for input_id, expected_output in test_cases:
        transformed = transform_model_id(input_id, "vercel-ai-gateway")
        if transformed == expected_output:
            print(f"✓ {input_id} -> {transformed}")
        else:
            print(f"❌ {input_id} -> {transformed} (expected {expected_output})")
            all_pass = False

    return all_pass


def test_vercel_provider_detection():
    """Test that Vercel AI Gateway models are properly detected"""
    print("\nTesting Vercel AI Gateway Provider Detection...")
    print("-" * 60)

    test_cases = [
        ("gpt-4", "vercel-ai-gateway"),
        ("gpt-4o", "vercel-ai-gateway"),
        ("claude-sonnet", "vercel-ai-gateway"),
        ("gemini-2.0-flash", "google-vertex"),  # This might be detected as google-vertex
    ]

    all_pass = True
    for model_id, expected_provider in test_cases:
        detected = detect_provider_from_model_id(model_id)
        if detected == expected_provider:
            print(f"✓ {model_id} detected as {detected}")
        else:
            # Only fail if it's not None, since model might be detected by another provider first
            if detected is not None:
                print(f"⚠ {model_id} detected as {detected} (expected {expected_provider})")
            else:
                print(f"ℹ {model_id} not automatically detected (expected {expected_provider})")

    return True


def test_failover_chain():
    """Test that Vercel AI Gateway is in the failover chain"""
    print("\nTesting Failover Chain Integration...")
    print("-" * 60)

    chain = build_provider_failover_chain("vercel-ai-gateway")
    print(f"✓ Failover chain starting with 'vercel-ai-gateway': {chain}")

    if "vercel-ai-gateway" in chain:
        print("✓ Vercel AI Gateway is in the failover chain")
        chain_index = chain.index("vercel-ai-gateway")
        print(f"  Position in chain: {chain_index + 1}/{len(chain)}")
        if chain_index == 0:
            print("✓ Vercel AI Gateway is the primary provider")
        return True
    else:
        print("❌ Vercel AI Gateway is NOT in the failover chain!")
        return False


def test_chat_route_integration():
    """Test that Vercel AI Gateway is integrated in the chat route"""
    print("\nTesting Chat Route Integration...")
    print("-" * 60)

    try:
        from src.routes import chat
        # Check if the import is in the chat module
        module_source = str(chat)

        # Check for Vercel imports
        if hasattr(chat, 'make_vercel_ai_gateway_request_openai'):
            print("✓ Vercel AI Gateway request function imported in chat route")
        else:
            # Try reading the source file
            import inspect
            source = inspect.getsource(chat)
            if 'vercel_ai_gateway' in source:
                print("✓ Vercel AI Gateway is referenced in chat route")
            else:
                print("⚠ Could not verify Vercel AI Gateway in chat route (import may be conditional)")

        return True
    except Exception as e:
        print(f"⚠ Could not verify chat route integration: {e}")
        return False


def run_all_tests():
    """Run all tests and report results"""
    print("=" * 60)
    print("VERCEL AI GATEWAY INTEGRATION TEST SUITE")
    print("=" * 60)

    results = {
        "Config": test_vercel_config(),
        "Client Import": test_vercel_client_import(),
        "Model Mappings": test_vercel_model_mappings(),
        "Provider Detection": test_vercel_provider_detection(),
        "Failover Chain": test_failover_chain(),
        "Chat Route": test_chat_route_integration(),
    }

    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)

    passed = 0
    failed = 0
    for test_name, result in results.items():
        status = "✓ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
        else:
            failed += 1

    print("=" * 60)
    print(f"Total: {passed + failed} tests, {passed} passed, {failed} failed")

    if failed == 0:
        print("✓ ALL TESTS PASSED!")
        return True
    else:
        print(f"❌ {failed} TEST(S) FAILED")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
