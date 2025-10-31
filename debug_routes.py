#!/usr/bin/env python3
"""
Debug script to check which routes are loaded
"""
import os
import sys

# Set environment variables
os.environ['APP_ENV'] = 'testing'
os.environ['TESTING'] = 'true'
os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
os.environ['SUPABASE_KEY'] = 'test-key'
os.environ['OPENROUTER_API_KEY'] = 'test-key'
os.environ['ENCRYPTION_KEY'] = 'test-encryption-key-32-bytes-long!'
os.environ['PORTKEY_API_KEY'] = 'test-key'

print("=" * 80)
print("DEBUG: Testing chat module import")
print("=" * 80)

try:
    import src.routes.chat as chat_module
    print(f"✓ Chat module imported successfully")
    print(f"✓ Has router attribute: {hasattr(chat_module, 'router')}")
    if hasattr(chat_module, 'router'):
        router = chat_module.router
        print(f"✓ Router type: {type(router)}")
        print(f"✓ Router routes: {len(router.routes)} routes")
        for route in router.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                print(f"  - {list(route.methods)} {route.path}")
except Exception as e:
    print(f"✗ Failed to import chat module: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("DEBUG: Testing main app import")
print("=" * 80)

try:
    from src.main import app
    print(f"✓ Main app imported successfully")
    print(f"✓ App type: {type(app)}")

    # List all routes
    print(f"\nAll registered routes:")
    chat_routes = []
    for route in app.routes:
        if hasattr(route, 'path'):
            path = route.path
            if hasattr(route, 'methods'):
                methods = list(route.methods)
                print(f"  {methods} {path}")
                if '/chat' in path.lower() or '/v1/chat' in path:
                    chat_routes.append(path)
            else:
                print(f"  [no methods] {path}")

    print(f"\nChat-related routes found: {len(chat_routes)}")
    for route in chat_routes:
        print(f"  - {route}")

    if not chat_routes:
        print("\n⚠️  WARNING: No chat routes found!")

except Exception as e:
    print(f"✗ Failed to import main app: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("SUCCESS: All imports completed")
print("=" * 80)
