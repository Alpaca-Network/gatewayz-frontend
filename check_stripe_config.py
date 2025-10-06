#!/usr/bin/env python3
"""Check Stripe configuration"""

import os
from dotenv import load_dotenv

load_dotenv()

print("Stripe Configuration Check:")
print("-" * 80)

# Check required environment variables
stripe_secret = os.getenv('STRIPE_SECRET_KEY')
stripe_webhook = os.getenv('STRIPE_WEBHOOK_SECRET')
stripe_publishable = os.getenv('STRIPE_PUBLISHABLE_KEY')

print(f"STRIPE_SECRET_KEY: {'[OK] Set' if stripe_secret else '[MISSING]'}")
if stripe_secret:
    print(f"  Value starts with: {stripe_secret[:7]}...")

print(f"STRIPE_WEBHOOK_SECRET: {'[OK] Set' if stripe_webhook else '[MISSING]'}")
if stripe_webhook:
    print(f"  Value starts with: {stripe_webhook[:7]}...")

print(f"STRIPE_PUBLISHABLE_KEY: {'[OK] Set' if stripe_publishable else '[MISSING]'}")
if stripe_publishable:
    print(f"  Value starts with: {stripe_publishable[:7]}...")

print("-" * 80)

# Check webhook endpoint availability
print("\nWebhook endpoint should be:")
print("  URL: https://beta.gatewayz.ai/api/stripe/webhook")
print("  Method: POST")
print("\nRequired Stripe events to configure:")
print("  - checkout.session.completed")
print("  - payment_intent.succeeded")
print("  - payment_intent.payment_failed")
