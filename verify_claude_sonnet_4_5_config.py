#!/usr/bin/env python3
"""
Simple verification script to check Claude Sonnet 4.5 configuration
This script doesn't make API calls, just verifies the integration is present
"""
import os
import sys

# Add src to path
sys.path.insert(0, 'src')


def print_header(title: str):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_check(name: str, status: bool, details: str = ""):
    symbol = "✓" if status else "✗"
    status_text = "PASS" if status else "FAIL"
    print(f"  [{symbol} {status_text}] {name}")
    if details:
        print(f"      {details}")


def check_messages_endpoint():
    """Check if Messages API endpoint exists"""
    try:
        from src.routes import messages
        return True, "Messages endpoint module found"
    except ImportError as e:
        return False, f"Messages endpoint not found: {e}"


def check_anthropic_transformer():
    """Check if Anthropic transformer service exists"""
    try:
        from src.services.anthropic_transformer import (
            transform_anthropic_to_openai,
            transform_openai_to_anthropic,
            extract_text_from_content
        )
        return True, "Anthropic transformer functions available"
    except ImportError as e:
        return False, f"Anthropic transformer not found: {e}"


def check_claude_model_in_tests():
    """Check if Claude Sonnet 4.5 is referenced in tests"""
    test_file = "/root/repo/tests/routes/test_messages.py"
    try:
        with open(test_file, 'r') as f:
            content = f.read()
            if "claude-sonnet-4-5-20250929" in content:
                count = content.count("claude-sonnet-4-5-20250929")
                return True, f"Found {count} references to Claude Sonnet 4.5 in tests"
            else:
                return False, "Claude Sonnet 4.5 not found in test files"
    except Exception as e:
        return False, f"Could not read test file: {e}"


def check_claude_model_in_docs():
    """Check if Claude Sonnet 4.5 is documented"""
    docs_file = "/root/repo/docs/MESSAGES_API.md"
    try:
        with open(docs_file, 'r') as f:
            content = f.read()
            if "claude-sonnet-4-5-20250929" in content:
                return True, "Claude Sonnet 4.5 documented in MESSAGES_API.md"
            else:
                return False, "Claude Sonnet 4.5 not found in documentation"
    except Exception as e:
        return False, f"Could not read documentation: {e}"


def check_model_transformations():
    """Check model transformation service"""
    try:
        from src.services.model_transformations import detect_provider_from_model_id

        # Test with Claude model format
        provider = detect_provider_from_model_id("anthropic/claude-3-opus")
        if provider == "openrouter":
            return True, "Anthropic models correctly routed to OpenRouter"
        else:
            return False, f"Unexpected provider: {provider}"
    except Exception as e:
        return False, f"Model transformation error: {e}"


def check_openrouter_client():
    """Check OpenRouter client exists"""
    try:
        from src.services.openrouter_client import (
            make_openrouter_request_openai,
            process_openrouter_response
        )
        return True, "OpenRouter client available"
    except ImportError as e:
        return False, f"OpenRouter client not found: {e}"


def check_portkey_client():
    """Check Portkey client exists"""
    try:
        from src.services.portkey_client import (
            make_portkey_request_openai,
            process_portkey_response
        )
        return True, "Portkey client available (alternative gateway)"
    except ImportError as e:
        return False, f"Portkey client not found: {e}"


def check_schemas():
    """Check Anthropic message schemas"""
    try:
        from src.schemas import MessagesRequest, AnthropicMessage

        # Check if schema has required fields
        schema_fields = MessagesRequest.__annotations__.keys()
        required = ['model', 'messages', 'max_tokens']

        all_present = all(field in schema_fields for field in required)

        if all_present:
            return True, f"MessagesRequest schema has all required fields"
        else:
            missing = [f for f in required if f not in schema_fields]
            return False, f"Missing schema fields: {missing}"
    except Exception as e:
        return False, f"Schema error: {e}"


def check_environment_variables():
    """Check if environment variables are configured"""
    required_vars = {
        'OPENROUTER_API_KEY': 'Required for OpenRouter integration',
        'PORTKEY_API_KEY': 'Optional for Portkey fallback',
    }

    configured = []
    missing = []

    for var, description in required_vars.items():
        if os.getenv(var):
            configured.append(f"{var}: ✓ Configured")
        else:
            missing.append(f"{var}: ✗ Not set ({description})")

    if configured:
        details = "\n      ".join(configured)
        if missing:
            details += "\n      " + "\n      ".join(missing)
        return True, details
    else:
        details = "\n      ".join(missing)
        return False, details


def main():
    print_header("CLAUDE SONNET 4.5 CONFIGURATION VERIFICATION")
    print("Checking if Claude Sonnet 4.5 integration is properly configured...")

    checks = [
        ("Messages API Endpoint", check_messages_endpoint),
        ("Anthropic Transformer Service", check_anthropic_transformer),
        ("Claude Sonnet 4.5 in Tests", check_claude_model_in_tests),
        ("Claude Sonnet 4.5 in Documentation", check_claude_model_in_docs),
        ("Model Transformation Service", check_model_transformations),
        ("OpenRouter Client", check_openrouter_client),
        ("Portkey Client", check_portkey_client),
        ("Message Request Schemas", check_schemas),
        ("Environment Variables", check_environment_variables),
    ]

    results = []

    print("\nRunning configuration checks...\n")

    for name, check_func in checks:
        try:
            status, details = check_func()
            print_check(name, status, details)
            results.append((name, status))
        except Exception as e:
            print_check(name, False, f"Error: {e}")
            results.append((name, False))

    # Summary
    print_header("VERIFICATION SUMMARY")

    passed = sum(1 for _, status in results if status)
    total = len(results)

    print(f"\nConfiguration Checks: {passed}/{total} passed")

    if passed == total:
        print("\n🎉 All configuration checks passed!")
        print("\nClaude Sonnet 4.5 is properly integrated. You can use it via:")
        print("  1. /v1/messages endpoint (Anthropic Messages API)")
        print("  2. /v1/chat/completions endpoint (OpenAI Chat Completions API)")
        print(f"\nModel ID: claude-sonnet-4-5-20250929")
        print("\nNext steps:")
        print("  - Ensure OPENROUTER_API_KEY is set in your environment")
        print("  - Start the server: python3 -m uvicorn src.main:app --reload")
        print("  - Test with: python3 test_claude_sonnet_4_5.py")
        return 0
    else:
        print(f"\n⚠ {total - passed} check(s) failed")
        print("\nSome components may be missing or misconfigured.")
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
