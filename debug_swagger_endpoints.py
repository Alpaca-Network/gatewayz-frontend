#!/usr/bin/env python3
"""
Debug why ranking endpoints don't appear in Swagger UI
"""

import sys
sys.path.append('src')

def debug_swagger_endpoints():
    """Debug Swagger endpoint registration"""
    
    print("🔍 Debugging Swagger Endpoint Registration")
    print("=" * 45)
    
    try:
        # Import the main app
        from src.main import create_app
        app = create_app()
        
        print("✅ Successfully created FastAPI app")
        print(f"   App title: {app.title}")
        print(f"   App version: {app.version}")
        
        # Get all routes
        routes = []
        for route in app.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                routes.append({
                    'path': route.path,
                    'methods': list(route.methods),
                    'name': getattr(route, 'name', 'Unknown')
                })
        
        print(f"\n📋 All Registered Routes ({len(routes)}):")
        ranking_routes = []
        for route in routes:
            if 'ranking' in route['path']:
                ranking_routes.append(route)
                print(f"   🎯 {route['methods']} {route['path']} ({route['name']})")
            else:
                print(f"   - {route['methods']} {route['path']} ({route['name']})")
        
        print(f"\n🎯 Ranking Routes Found: {len(ranking_routes)}")
        if not ranking_routes:
            print("❌ No ranking routes found!")
            print("   This means the ranking router is not being included properly")
        else:
            print("✅ Ranking routes are registered")
        
        # Check if ranking router is imported
        print(f"\n🔍 Checking Router Imports:")
        try:
            from src.routes import ranking as ranking_routes
            print("✅ Ranking routes module imported successfully")
            print(f"   Router: {ranking_routes.router}")
            print(f"   Routes in router: {len(ranking_routes.router.routes)}")
        except Exception as e:
            print(f"❌ Failed to import ranking routes: {e}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_swagger_endpoints()
