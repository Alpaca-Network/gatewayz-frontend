#!/usr/bin/env python3
"""
Test Statsig Event Logging
===========================

This script tests that Statsig events are being logged correctly.
It simulates the full lifecycle: initialize -> log events -> shutdown

Usage:
    python3 test_statsig_logging.py

Requirements:
    - STATSIG_SERVER_SECRET_KEY must be set in environment or .env file
    - statsig-python-core package must be installed
"""

import os
import sys
import asyncio
import logging

# Add project root to path
sys.path.insert(0, '/root/repo')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_statsig_logging():
    """Test Statsig event logging end-to-end"""

    print("\n" + "=" * 60)
    print("STATSIG EVENT LOGGING TEST")
    print("=" * 60)

    # Check for .env file
    print("\n[STEP 1] Checking environment configuration...")
    if os.path.exists('.env'):
        print("✅ .env file found")
        from dotenv import load_dotenv
        load_dotenv()
    else:
        print("⚠️  No .env file found, using environment variables")

    # Check for API key
    api_key = os.environ.get('STATSIG_SERVER_SECRET_KEY')
    if not api_key:
        print("❌ STATSIG_SERVER_SECRET_KEY not set!")
        print("   Set it in .env or environment variables")
        return False
    elif api_key == 'secret-your-server-secret-key':
        print("❌ STATSIG_SERVER_SECRET_KEY is using placeholder value!")
        print("   Update it with your actual key from Statsig console")
        return False
    else:
        print(f"✅ STATSIG_SERVER_SECRET_KEY configured: {api_key[:10]}...")

    # Initialize Statsig service
    print("\n[STEP 2] Initializing Statsig service...")
    try:
        from src.services.statsig_service import statsig_service
        await statsig_service.initialize()

        if statsig_service.enabled:
            print("✅ Statsig service initialized successfully")
            print(f"   SDK enabled: {statsig_service.enabled}")
        else:
            print("❌ Statsig service failed to initialize (fallback mode)")
            print("   Check logs above for errors")
            return False

    except Exception as e:
        print(f"❌ Failed to initialize Statsig: {e}")
        import traceback
        traceback.print_exc()
        return False

    # Log test events
    print("\n[STEP 3] Logging test events...")
    test_events = [
        {
            "user_id": "test_user_123",
            "event_name": "test_event_basic",
            "value": None,
            "metadata": None
        },
        {
            "user_id": "test_user_456",
            "event_name": "test_event_with_value",
            "value": "test_value_123",
            "metadata": None
        },
        {
            "user_id": "test_user_789",
            "event_name": "test_event_with_metadata",
            "value": "SKU_12345",
            "metadata": {
                "price": "9.99",
                "item_name": "test_product",
                "test_timestamp": "2025-10-28T00:00:00Z"
            }
        }
    ]

    success_count = 0
    for i, event in enumerate(test_events, 1):
        print(f"\n   Event {i}/{len(test_events)}: {event['event_name']}")
        result = statsig_service.log_event(**event)
        if result:
            print(f"   ✅ Logged successfully")
            success_count += 1
        else:
            print(f"   ❌ Failed to log")

    print(f"\n✅ Logged {success_count}/{len(test_events)} events successfully")

    # Wait for events to be batched (Statsig batches every ~1 minute or 500 events)
    print("\n[STEP 4] Waiting for events to be queued...")
    print("   Note: Statsig batches events (flushes every ~1 min or 500 events)")
    print("   Events are queued and will be sent to Statsig dashboard shortly")
    await asyncio.sleep(2)  # Brief wait

    # Shutdown (this flushes pending events)
    print("\n[STEP 5] Shutting down Statsig (this flushes pending events)...")
    try:
        await statsig_service.shutdown()
        print("✅ Statsig shutdown complete (events flushed)")
    except Exception as e:
        print(f"⚠️  Shutdown warning: {e}")

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"\n✅ Successfully logged {success_count} test events to Statsig")
    print("\nNext steps:")
    print("1. Check Statsig console for events:")
    print("   https://console.statsig.com/events")
    print("2. Look for events named:")
    print("   - test_event_basic")
    print("   - test_event_with_value")
    print("   - test_event_with_metadata")
    print("3. Events should appear within 1-2 minutes")
    print("\n" + "=" * 60 + "\n")

    return True


if __name__ == "__main__":
    try:
        success = asyncio.run(test_statsig_logging())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
