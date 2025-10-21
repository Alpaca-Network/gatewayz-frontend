"""
Test script for analytics integration
Verifies that the analytics routes are properly registered and working
"""
import asyncio
import sys
sys.path.insert(0, 'src')

from dotenv import load_dotenv
load_dotenv()

async def test_analytics_integration():
    print("=" * 60)
    print("ANALYTICS INTEGRATION TEST")
    print("=" * 60)

    # Test 1: Verify routes are registered
    print("\n[TEST 1] Checking if analytics routes are registered...")
    try:
        from src.main import app
        routes = [route.path for route in app.routes]
        analytics_routes = [r for r in routes if 'analytics' in r.lower()]

        if analytics_routes:
            print(f"✅ Found {len(analytics_routes)} analytics route(s):")
            for route in analytics_routes:
                print(f"   - {route}")
        else:
            print("❌ No analytics routes found")
            print("   Available routes:", routes[:10], "...")
    except Exception as e:
        print(f"❌ Error checking routes: {e}")
        import traceback
        traceback.print_exc()

    # Test 2: Verify Statsig service can be imported
    print("\n[TEST 2] Checking Statsig service...")
    try:
        from src.services.statsig_service import statsig_service
        print("✅ Statsig service imported successfully")
        print(f"   Initialized: {statsig_service._initialized}")
        print(f"   Has client: {statsig_service.statsig is not None}")
    except Exception as e:
        print(f"❌ Error importing Statsig service: {e}")

    # Test 3: Verify analytics route module
    print("\n[TEST 3] Checking analytics route module...")
    try:
        from src.routes.analytics import router
        print("✅ Analytics router imported successfully")
        print(f"   Routes in router: {len(router.routes)}")
        for route in router.routes:
            print(f"   - {route.methods} {route.path}")
    except Exception as e:
        print(f"❌ Error importing analytics router: {e}")
        import traceback
        traceback.print_exc()

    # Test 4: Test analytics event logging
    print("\n[TEST 4] Testing analytics event logging...")
    try:
        from src.services.statsig_service import statsig_service

        # Initialize if needed
        if not statsig_service.statsig:
            await statsig_service.initialize()

        # Try logging a test event
        statsig_service.log_event(
            user_id='test_user',
            event_name='test_event',
            metadata={'source': 'integration_test'}
        )
        print("✅ Test event logged successfully")
        print("   Note: Check Statsig console to verify event was received")
    except Exception as e:
        print(f"⚠️  Event logging test: {e}")
        print("   This is expected if STATSIG_SERVER_SECRET_KEY is not set")

    print("\n" + "=" * 60)
    print("INTEGRATION TEST COMPLETE")
    print("=" * 60)
    print("\nNEXT STEPS:")
    print("1. Ensure STATSIG_SERVER_SECRET_KEY is set in backend .env")
    print("2. Restart the backend server to load new analytics routes")
    print("3. Test frontend analytics by opening chat and sending a message")
    print("4. Check browser console for any errors")
    print("5. Verify events appear in Statsig console")

if __name__ == "__main__":
    asyncio.run(test_analytics_integration())
