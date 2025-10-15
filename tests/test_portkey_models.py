#!/usr/bin/env python3
"""
Test script to verify Portkey models are accessible via chat endpoint
"""
import os
import sys
import json

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_portkey_models():
    """Test Portkey models through chat completions endpoint"""

    print("🔍 Testing Portkey Models Integration\n")
    print("=" * 60)

    # Check environment variables
    print("\n1️⃣  Checking Portkey Configuration...")
    portkey_key = os.getenv("PORTKEY_API_KEY")
    portkey_virtual_key = (
        os.getenv("PORTKEY_VIRTUAL_KEY_OPENAI")
        or os.getenv("PORTKEY_VIRTUAL_KEY")
    )

    if portkey_key:
        print(f"   ✅ PORTKEY_API_KEY: {portkey_key[:10]}...")
    else:
        print("   ❌ PORTKEY_API_KEY: Not configured")

    if portkey_virtual_key:
        print(f"   ✅ PORTKEY_VIRTUAL_KEY_OPENAI: {portkey_virtual_key[:10]}...")
    else:
        print("   ❌ PORTKEY_VIRTUAL_KEY(_OPENAI): Not configured")
        print("      → Store your provider key in Portkey and export the virtual key.")

    # Test Portkey client initialization
    print("\n2️⃣  Testing Portkey Client Initialization...")
    try:
        from src.services.portkey_client import get_portkey_client

        if portkey_virtual_key:
            client = get_portkey_client(provider="openai", virtual_key=portkey_virtual_key)
            print("   ✅ Portkey client (virtual key): Initialized")
        else:
            print("   ⚠️  Skipped Portkey client init (virtual key missing)")

    except Exception as e:
        print(f"   ❌ Import failed: {e}")
        return False

    # Test making requests
    print("\n3️⃣  Testing Portkey Request...")
    try:
        from src.services.portkey_client import make_portkey_request_openai, process_portkey_response

        messages = [{"role": "user", "content": "Say 'Hello from Portkey!' in 5 words or less"}]
        model = "gpt-3.5-turbo"

        if portkey_virtual_key:
            print(f"   📤 Sending test request to {model} via Portkey...")
            response = make_portkey_request_openai(
                messages=messages,
                model=model,
                provider="openai",
                max_tokens=50,
                virtual_key=portkey_virtual_key
            )

            processed = process_portkey_response(response)

            print("   ✅ Request successful!")
            print(f"   📝 Response: {processed['choices'][0]['message']['content']}")
            print(f"   📊 Tokens: {processed['usage']['total_tokens']}")

        else:
            print("   ⚠️  Skipped (no PORTKEY virtual key)")
            print("   💡 To test: Configure PORTKEY_VIRTUAL_KEY or PORTKEY_VIRTUAL_KEY_OPENAI")

    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        import traceback
        traceback.print_exc()

    # Test streaming
    print("\n4️⃣  Testing Portkey Streaming...")
    try:
        from src.services.portkey_client import make_portkey_request_openai_stream

        if portkey_virtual_key:
            print(f"   📤 Sending streaming test request...")
            stream = make_portkey_request_openai_stream(
                messages=messages,
                model=model,
                provider="openai",
                max_tokens=50,
                virtual_key=portkey_virtual_key
            )

            print("   ✅ Stream initialized!")
            print("   📝 Streaming response: ", end="", flush=True)

            content = ""
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content += chunk.choices[0].delta.content
                    print(chunk.choices[0].delta.content, end="", flush=True)

            print()
            print(f"   ✅ Streaming complete! ({len(content)} chars)")

        else:
            print("   ⚠️  Skipped (no PORTKEY virtual key)")

    except Exception as e:
        print(f"   ❌ Streaming failed: {e}")
        import traceback
        traceback.print_exc()

    # Test via chat endpoint
    print("\n5️⃣  Testing via Chat Completions Endpoint...")
    print("   ℹ️  To test via API:")
    print("   ```bash")
    print("   curl -X POST 'https://api.gatewayz.ai/v1/chat/completions' \\")
    print("     -H 'Authorization: Bearer YOUR_API_KEY' \\")
    print("     -H 'Content-Type: application/json' \\")
    print("     -d '{")
    print('       "model": "gpt-3.5-turbo",')
    print('       "provider": "portkey",')
    print('       "portkey_provider": "openai",')
    print('       "portkey_virtual_key": "vk_xxx",')
    print('       "messages": [{"role": "user", "content": "Hello"}]')
    print("     }'")
    print("   ```")

    # Supported providers via Portkey
    print("\n6️⃣  Supported Portkey Providers:")
    providers = [
        ("openai", "OpenAI (GPT-3.5, GPT-4, etc.)", "PROVIDER_OPENAI_API_KEY"),
        ("anthropic", "Anthropic (Claude)", "PROVIDER_ANTHROPIC_API_KEY"),
        ("google-ai", "Google AI (Gemini)", "PROVIDER_GOOGLE_AI_KEY"),
        ("cohere", "Cohere", "PROVIDER_COHERE_API_KEY"),
        ("together-ai", "Together AI", "PROVIDER_TOGETHER_AI_KEY"),
    ]

    for provider_id, name, env_var in providers:
        has_key = os.getenv(env_var) is not None
        status = "✅" if has_key else "⚠️ "
        print(f"   {status} {name}")
        if not has_key:
            print(f"      Set {env_var} or use Portkey virtual keys")

    print("\n" + "=" * 60)
    print("\n💡 Summary:")
    print("   • Portkey integration is " + ("✅ CONFIGURED" if portkey_key else "❌ NOT CONFIGURED"))
    print("   • To use Portkey in chat completions, set:")
    print('     "provider": "portkey"')
    print('     "portkey_provider": "openai"  (or "anthropic", etc.)')
    print("   • Provide a Portkey virtual key via request field or env variables")
    print("\n" + "=" * 60)

if __name__ == "__main__":
    test_portkey_models()
