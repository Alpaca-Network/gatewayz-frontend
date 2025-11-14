#!/bin/bash

# Test User Setup Script
# This script demonstrates setting up the test user with the provided API key

API_KEY="gw_live_hMdf3qaEzGnM1l3164lMjE0Q6pHVgKfmAoQEBgD67OA"

echo "🧪 Test User Setup"
echo "===================="
echo ""
echo "✅ API Key configured: ${API_KEY:0:15}..."
echo ""
echo "📝 To use this in the browser:"
echo ""
echo "1. Open http://localhost:3000/dev/test-auth.html"
echo "2. Enter the following details:"
echo ""
echo "   API Key: $API_KEY"
echo "   User ID: 1"
echo "   Display Name: Test User"
echo "   Email: test@localhost.local"
echo "   Credits: 100"
echo ""
echo "3. Click 'Setup Test User'"
echo ""
echo "4. Navigate to http://localhost:3000/chat to test"
echo ""
echo "===================="
echo ""
echo "🔍 Testing API connectivity..."
echo ""

# Test if the server is running
if timeout 5 curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Local server is running on port 3000"
else
    echo "❌ Local server is not responding"
    echo "   Run: pm2 start 'pnpm dev' --name gatewayz-frontend"
    exit 1
fi

echo ""
echo "🔍 Testing backend API connectivity..."
echo ""

# Test if we can reach the backend API
if timeout 5 curl -s https://api.gatewayz.ai > /dev/null 2>&1; then
    echo "✅ Backend API is reachable"
    echo ""
    echo "🚀 You can now test the chat functionality!"
    echo ""
    echo "   Test with cURL:"
    echo "   curl -X POST http://localhost:3000/api/chat/completions \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -H 'Authorization: Bearer $API_KEY' \\"
    echo "     -d '{\"model\":\"gpt-3.5-turbo\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello!\"}],\"max_tokens\":50}'"
else
    echo "⚠️  Backend API is not reachable from this environment"
    echo ""
    echo "   This is expected in sandboxed/offline environments."
    echo "   The chat will work when deployed or run with internet access."
    echo ""
    echo "   For now, you can:"
    echo "   1. Set up the test user in your browser (steps above)"
    echo "   2. Open the chat interface (UI will load)"
    echo "   3. When deployed with internet, it will work automatically"
fi

echo ""
echo "===================="
echo "✅ Setup complete!"
echo "===================="
