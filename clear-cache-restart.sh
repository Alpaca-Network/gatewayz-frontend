#!/bin/bash
# Clear all caches and restart dev server

echo "🧹 Clearing all caches..."

# 1. Clear Next.js build cache
echo "  → Removing .next directory..."
rm -rf .next

# 2. Clear Redis cache (if running locally)
if command -v redis-cli &> /dev/null; then
  echo "  → Flushing Redis cache..."
  redis-cli FLUSHDB 2>/dev/null || echo "    (Redis not running locally - skipping)"
else
  echo "  → Redis not installed locally - skipping"
fi

echo ""
echo "✅ Caches cleared!"
echo ""
echo "🚀 Now restart your dev server:"
echo "   pnpm dev"
echo ""
echo "📝 Then open http://localhost:3000/models and hard refresh (Cmd+Shift+R)"
echo "   Watch the server logs for:"
echo "   [Models] Fetched 500 models for gateway: all (offset: 0) (500/12543 total)"
echo ""
