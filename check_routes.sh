
#!/bin/bash

echo "========================================"
echo "CHECKING REFERRAL ROUTES"
echo "========================================"

# Check if referral.py exists
if [ -f "src/routes/referral.py" ]; then
    echo "✅ src/routes/referral.py exists"
else
    echo "❌ src/routes/referral.py NOT FOUND"
    exit 1
fi

# Check if router is exported
if grep -q "router = APIRouter()" src/routes/referral.py; then
    echo "✅ router = APIRouter() found"
else
    echo "❌ router = APIRouter() NOT FOUND"
fi

# Check routes defined
echo ""
echo "Routes defined in referral.py:"
grep -n "@router\." src/routes/referral.py | head -10

# Check if registered in main.py
echo ""
if grep -q '"referral"' src/main.py; then
    echo "✅ Referral route registered in main.py"
    grep -n '"referral"' src/main.py
else
    echo "❌ Referral route NOT registered in main.py"
fi

echo ""
echo "========================================"
echo "SOLUTION:"
echo "========================================"
echo "Your routes are defined as:"
echo "  GET  /referral/code"
echo "  GET  /referral/stats"
echo "  POST /referral/validate"
echo "  POST /referral/generate"
echo ""
echo "Try accessing:"
echo "  https://your-domain.com/referral/code"
echo ""
echo "If you still get 404, restart your server:"
echo "  uvicorn src.main:app --reload"
echo "========================================"
