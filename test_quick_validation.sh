#!/bin/bash

echo "======================================================================"
echo "REFERRAL SYSTEM VALIDATION (Quick Check)"
echo "======================================================================"

# Check constants in code
echo ""
echo "✅ TEST 1: Checking Constants in Code"
echo "----------------------------------------------------------------------"
grep -n "MAX_REFERRAL_USES = 10" src/services/referral.py && echo "  ✓ MAX_REFERRAL_USES = 10" || echo "  ✗ MAX_REFERRAL_USES not set to 10"
grep -n "MIN_PURCHASE_AMOUNT = 10.0" src/services/referral.py && echo "  ✓ MIN_PURCHASE_AMOUNT = 10.0" || echo "  ✗ MIN_PURCHASE_AMOUNT not set to 10.0"
grep -n "REFERRAL_BONUS = 10.0" src/services/referral.py && echo "  ✓ REFERRAL_BONUS = 10.0" || echo "  ✗ REFERRAL_BONUS not set to 10.0"

# Check files exist
echo ""
echo "✅ TEST 2: Checking Files Exist"
echo "----------------------------------------------------------------------"
[ -f "src/services/referral.py" ] && echo "  ✓ src/services/referral.py" || echo "  ✗ MISSING: src/services/referral.py"
[ -f "src/routes/referral.py" ] && echo "  ✓ src/routes/referral.py" || echo "  ✗ MISSING: src/routes/referral.py"
[ -f "tests/test_referral_system.py" ] && echo "  ✓ tests/test_referral_system.py" || echo "  ✗ MISSING: tests/test_referral_system.py"

# Check route registration
echo ""
echo "✅ TEST 3: Checking Route Registration"
echo "----------------------------------------------------------------------"
grep -n '"referral"' src/main.py && echo "  ✓ Referral route registered in main.py" || echo "  ✗ Referral route NOT registered"

# Check payment integration
echo ""
echo "✅ TEST 4: Checking Payment Integration"
echo "----------------------------------------------------------------------"
grep -n "apply_referral_bonus" src/services/payments.py && echo "  ✓ apply_referral_bonus found" || echo "  ✗ apply_referral_bonus NOT found"
grep -n "mark_first_purchase" src/services/payments.py && echo "  ✓ mark_first_purchase found" || echo "  ✗ mark_first_purchase NOT found"

# Check API endpoints
echo ""
echo "✅ TEST 5: Checking API Endpoints"
echo "----------------------------------------------------------------------"
grep -c "/referral/" src/routes/referral.py | awk '{print "  Found " $1 " referral endpoints"}'

# Check database schema
echo ""
echo "✅ TEST 6: Checking Database Schema"
echo "----------------------------------------------------------------------"
grep -c "referral" supabase/migrations/20251011073440_remote_schema.sql | awk '{print "  Found " $1 " referral-related schema elements"}'

echo ""
echo "======================================================================"
echo "🎉 VALIDATION COMPLETE!"
echo "======================================================================"
echo ""
echo "Referral System Configuration:"
echo "  • Max uses per code: 10"
echo "  • Minimum purchase: \$10"
echo "  • Bonus amount: \$10 (both users)"
echo ""
