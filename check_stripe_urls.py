#!/usr/bin/env python3
"""
Quick script to check Stripe checkout session redirect URLs
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("\n=== Stripe URL Configuration Check ===\n")

# Check backend settings
frontend_url = os.getenv('FRONTEND_URL', 'https://gatewayz.ai')
print(f"Backend FRONTEND_URL: {frontend_url}")
print(f"  This is the fallback used when frontend doesn't provide URLs")

# Check if FRONTEND_URL is set
if os.getenv('FRONTEND_URL'):
    print(f"  ✓ FRONTEND_URL is explicitly set")
else:
    print(f"  ⚠ FRONTEND_URL not set, using default: {frontend_url}")

print("\n=== What URLs should be used? ===")
print("Frontend should send:")
print("  success_url: https://beta.gatewayz.ai/settings/credits?session_id={CHECKOUT_SESSION_ID}")
print("  cancel_url: https://beta.gatewayz.ai/settings/credits")

print("\n=== Action Required ===")
if frontend_url != 'https://beta.gatewayz.ai':
    print("⚠ Set FRONTEND_URL=https://beta.gatewayz.ai in Railway environment")
    print("  Go to Railway > gatewayz-backend > Variables")
    print("  Add: FRONTEND_URL=https://beta.gatewayz.ai")
else:
    print("✓ FRONTEND_URL is correctly configured")

print("\nNote: Frontend should always provide success_url and cancel_url in requests,")
print("so FRONTEND_URL is only used as a fallback.\n")
