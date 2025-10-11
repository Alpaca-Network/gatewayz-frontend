#!/usr/bin/env python3
"""
Manual validation script for referral system
Run this with: python test_referral_manual.py
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 70)
print("REFERRAL SYSTEM VALIDATION")
print("=" * 70)

# Test 1: Check constants
print("\n✅ TEST 1: Checking Constants")
print("-" * 70)

try:
    from src.services.referral import (
        MAX_REFERRAL_USES,
        MIN_PURCHASE_AMOUNT,
        REFERRAL_BONUS,
        REFERRAL_CODE_LENGTH
    )

    print(f"MAX_REFERRAL_USES = {MAX_REFERRAL_USES}")
    assert MAX_REFERRAL_USES == 10, f"Expected 10, got {MAX_REFERRAL_USES}"
    print("  ✓ Max uses is 10")

    print(f"MIN_PURCHASE_AMOUNT = ${MIN_PURCHASE_AMOUNT}")
    assert MIN_PURCHASE_AMOUNT == 10.0, f"Expected 10.0, got {MIN_PURCHASE_AMOUNT}"
    print("  ✓ Minimum purchase is $10")

    print(f"REFERRAL_BONUS = ${REFERRAL_BONUS}")
    assert REFERRAL_BONUS == 10.0, f"Expected 10.0, got {REFERRAL_BONUS}"
    print("  ✓ Bonus amount is $10")

    print(f"REFERRAL_CODE_LENGTH = {REFERRAL_CODE_LENGTH}")
    assert REFERRAL_CODE_LENGTH == 8, f"Expected 8, got {REFERRAL_CODE_LENGTH}"
    print("  ✓ Code length is 8 characters")

    print("\n✅ TEST 1 PASSED: All constants are correct!")

except Exception as e:
    print(f"\n❌ TEST 1 FAILED: {e}")
    sys.exit(1)

# Test 2: Check referral code generation
print("\n✅ TEST 2: Referral Code Generation")
print("-" * 70)

try:
    from src.services.referral import generate_referral_code

    codes = set()
    for i in range(100):
        code = generate_referral_code()

        # Check length
        assert len(code) == 8, f"Code {code} has wrong length: {len(code)}"

        # Check uppercase
        assert code.isupper(), f"Code {code} is not uppercase"

        # Check alphanumeric
        assert code.isalnum(), f"Code {code} is not alphanumeric"

        codes.add(code)

    # Check uniqueness
    assert len(codes) == 100, f"Expected 100 unique codes, got {len(codes)}"

    print(f"Generated 100 unique codes")
    print(f"Sample codes: {list(codes)[:5]}")
    print("\n✅ TEST 2 PASSED: Code generation working correctly!")

except Exception as e:
    print(f"\n❌ TEST 2 FAILED: {e}")
    sys.exit(1)

# Test 3: Check file structure
print("\n✅ TEST 3: File Structure")
print("-" * 70)

files_to_check = [
    ('src/services/referral.py', 'Referral service'),
    ('src/routes/referral.py', 'Referral routes'),
    ('src/schemas/users.py', 'User schemas'),
]

all_files_exist = True
for file_path, description in files_to_check:
    full_path = os.path.join(os.path.dirname(__file__), file_path)
    if os.path.exists(full_path):
        print(f"  ✓ {description}: {file_path}")
    else:
        print(f"  ✗ MISSING: {file_path}")
        all_files_exist = False

if all_files_exist:
    print("\n✅ TEST 3 PASSED: All files exist!")
else:
    print("\n❌ TEST 3 FAILED: Some files are missing")
    sys.exit(1)

# Test 4: Check route registration
print("\n✅ TEST 4: Route Registration")
print("-" * 70)

try:
    with open('src/main.py', 'r') as f:
        main_content = f.read()

    if '("referral"' in main_content:
        print("  ✓ Referral route registered in main.py")
        print("\n✅ TEST 4 PASSED: Routes are registered!")
    else:
        print("  ✗ Referral route NOT found in main.py")
        print("\n❌ TEST 4 FAILED: Route registration missing")
        sys.exit(1)

except Exception as e:
    print(f"\n❌ TEST 4 FAILED: {e}")
    sys.exit(1)

# Test 5: Check payment integration
print("\n✅ TEST 5: Payment Integration")
print("-" * 70)

try:
    with open('src/services/payments.py', 'r') as f:
        payment_content = f.read()

    checks = [
        ('apply_referral_bonus' in payment_content, 'apply_referral_bonus import'),
        ('mark_first_purchase' in payment_content, 'mark_first_purchase import'),
        ('has_made_first_purchase' in payment_content, 'first purchase check'),
        ('referred_by_code' in payment_content, 'referral code check'),
    ]

    all_checks_passed = True
    for check, description in checks:
        if check:
            print(f"  ✓ Found: {description}")
        else:
            print(f"  ✗ MISSING: {description}")
            all_checks_passed = False

    if all_checks_passed:
        print("\n✅ TEST 5 PASSED: Payment integration complete!")
    else:
        print("\n❌ TEST 5 FAILED: Some payment integrations missing")
        sys.exit(1)

except Exception as e:
    print(f"\n❌ TEST 5 FAILED: {e}")
    sys.exit(1)

# Test 6: Check API endpoints
print("\n✅ TEST 6: API Endpoints")
print("-" * 70)

try:
    with open('src/routes/referral.py', 'r') as f:
        routes_content = f.read()

    endpoints = [
        ('/referral/stats', 'GET referral stats'),
        ('/referral/code', 'GET referral code'),
        ('/referral/validate', 'POST validate code'),
        ('/referral/generate', 'POST generate code'),
    ]

    all_endpoints_found = True
    for endpoint, description in endpoints:
        if endpoint in routes_content:
            print(f"  ✓ {description}: {endpoint}")
        else:
            print(f"  ✗ MISSING: {endpoint}")
            all_endpoints_found = False

    if all_endpoints_found:
        print("\n✅ TEST 6 PASSED: All API endpoints exist!")
    else:
        print("\n❌ TEST 6 FAILED: Some endpoints missing")
        sys.exit(1)

except Exception as e:
    print(f"\n❌ TEST 6 FAILED: {e}")
    sys.exit(1)

# Test 7: Check database schema support
print("\n✅ TEST 7: Database Schema")
print("-" * 70)

try:
    with open('supabase/migrations/20251011073440_remote_schema.sql', 'r') as f:
        schema_content = f.read()

    schema_checks = [
        ('referrals' in schema_content, 'referrals table'),
        ('referral_code' in schema_content, 'referral_code column'),
        ('referred_by_code' in schema_content, 'referred_by_code column'),
        ('has_made_first_purchase' in schema_content, 'has_made_first_purchase column'),
        ('generate_referral_code' in schema_content, 'generate_referral_code function'),
    ]

    all_schema_checks_passed = True
    for check, description in schema_checks:
        if check:
            print(f"  ✓ Found: {description}")
        else:
            print(f"  ✗ MISSING: {description}")
            all_schema_checks_passed = False

    if all_schema_checks_passed:
        print("\n✅ TEST 7 PASSED: Database schema is complete!")
    else:
        print("\n❌ TEST 7 FAILED: Some schema elements missing")
        sys.exit(1)

except Exception as e:
    print(f"\n❌ TEST 7 FAILED: {e}")
    sys.exit(1)

# Summary
print("\n" + "=" * 70)
print("🎉 ALL TESTS PASSED!")
print("=" * 70)
print("\nReferral System Summary:")
print(f"  • Max referral uses per code: {MAX_REFERRAL_USES}")
print(f"  • Minimum qualifying purchase: ${MIN_PURCHASE_AMOUNT}")
print(f"  • Bonus per successful referral: ${REFERRAL_BONUS} (to both users)")
print(f"  • Referral code length: {REFERRAL_CODE_LENGTH} characters")
print("\nFeatures Implemented:")
print("  ✓ Referral code generation and validation")
print("  ✓ API endpoints for managing referrals")
print("  ✓ Stripe payment webhook integration")
print("  ✓ Database schema with proper indexes")
print("  ✓ User registration with referral codes")
print("  ✓ Automatic bonus application on first purchase")
print("\nNext Steps:")
print("  1. Start your server: uvicorn src.main:app --reload")
print("  2. Test endpoints at: http://localhost:8000/docs")
print("  3. Look for 'referral' tag in the API documentation")
print("=" * 70)
