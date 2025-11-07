# Rate Limiting Guide

## What is Burst Limit?

**Burst Limit** prevents users from making too many requests in a very short time period, even if they haven't hit their hourly/daily limits yet.

Think of it like a water faucet:
- **Hourly Limit (1000 requests/hour)** = Total water allowed per hour
- **Burst Limit (500 requests)** = How fast the water can flow at once

### Current Rate Limits

```python
# Default configuration in src/services/rate_limiting.py
requests_per_minute: 250     # ~4 requests per second
requests_per_hour: 1000
requests_per_day: 10000
burst_limit: 500             # Maximum rapid-fire requests
concurrency_limit: 50        # Maximum simultaneous requests
```

---

## Why Am I Getting "Burst limit exceeded"?

You're sending requests **too quickly**. The system allows:
- ✅ 250 requests per minute = ~**4 requests/second**
- ✅ 500 burst requests in rapid succession
- ❌ Sending faster triggers rate limiting

---

## Solutions

### Option 1: Slow Down Your Requests (Recommended)

**For the Python test script:**
```python
# Already updated test_all_models.py with 1.5s delay
# This respects 250 req/min limit (~4 req/sec)
python3 test_all_models.py
```

**For the bash script:**
```bash
# Use longer delay
DELAY=2 ./test_models.sh  # 2 seconds between requests
```

**For manual testing:**
```bash
# Add sleep between curl commands
curl ... && sleep 2 && curl ... && sleep 2 && curl ...
```

---

### Option 2: Disable Rate Limiting for Testing

⚠️ **ONLY for local development/testing!**

Add to your `.env` file:
```bash
# Disable rate limiting (DEV ONLY)
DISABLE_RATE_LIMITING=true
```

Then modify `src/routes/chat.py` (or wherever rate limiting is applied):

```python
# Before (in chat route):
rate_limit_result = await rate_limiter.check_rate_limit(...)

# After (add check):
import os
if not os.getenv("DISABLE_RATE_LIMITING"):
    rate_limit_result = await rate_limiter.check_rate_limit(...)
else:
    # Skip rate limiting in dev
    logger.info("Rate limiting disabled for testing")
```

**Restart server after changes:**
```bash
# Server will auto-reload if already running
```

---

### Option 3: Increase Rate Limits (Code Change)

Edit `src/services/rate_limiting.py`:

```python
# Change line 29-36 from:
DEFAULT_CONFIG = RateLimitConfig(
    requests_per_minute=250,
    requests_per_hour=1000,
    burst_limit=500,
    concurrency_limit=50,
)

# To:
DEFAULT_CONFIG = RateLimitConfig(
    requests_per_minute=1000,     # 4x higher
    requests_per_hour=10000,      # 10x higher
    burst_limit=5000,             # 10x higher
    concurrency_limit=100,        # 2x higher
)
```

**Restart server:**
```bash
# Auto-reload should pick this up
```

---

### Option 4: Test Fewer Models at Once

Instead of testing all 339 models, test in batches:

```python
# Test first 10 models
python3 test_all_models.py | head -30

# Or modify the script to test specific providers only
# Edit test_all_models.py, line ~130:
test_models = [m for m in models if m.get("provider") == "openai"][:10]
```

---

## Understanding the Error Message

```json
{"detail":"Rate limit exceeded: Burst limit exceeded"}
```

This means:
- ✅ You have enough **credits** (not a billing issue)
- ✅ You're **authenticated** correctly
- ✅ The **API is working**
- ❌ You're just sending requests **too fast**

**Solution:** Wait 1-2 minutes, then retry with slower pace

---

## Best Practices for Testing

### Recommended: Test with Delays
```bash
# Good: 1.5-2s between requests
python3 test_all_models.py  # Updated with 1.5s delay

# Better: Test specific models only
curl ... && sleep 2 && curl ...  # Manual testing

# Best: Test one provider at a time
python3 -c "
models = ['openai/gpt-4o-mini', 'openai/gpt-4o']
for model in models:
    test_model(model)
    time.sleep(2)
"
```

### Fast Testing (Risk Rate Limits)
```bash
# Quick test 5 models only
./test_models.sh  # Tests curated list with 2s delay
```

---

## Monitoring Rate Limits

### Check Current Usage (if Redis is configured)
```bash
redis-cli
> KEYS rate_limit:*
> GET rate_limit:gw_your_key
```

### Check Logs for Rate Limit Events
```bash
# Watch server logs
tail -f logs/app.log | grep "rate limit"
```

### Via API (if endpoint exists)
```bash
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:8000/v1/rate-limits
```

---

## Production Recommendations

For production environments:

1. **Keep default limits** (they're reasonable)
2. **Implement retry logic** with exponential backoff:
   ```python
   import time
   import random

   def call_with_retry(func, max_retries=3):
       for i in range(max_retries):
           try:
               return func()
           except RateLimitError as e:
               if i == max_retries - 1:
                   raise
               wait = (2 ** i) + random.random()
               time.sleep(wait)
   ```

3. **Respect HTTP 429 headers**:
   ```python
   if response.status_code == 429:
       retry_after = response.headers.get('Retry-After', 60)
       time.sleep(int(retry_after))
   ```

4. **Queue requests** instead of rapid-fire
5. **Use connection pooling** to reduce overhead

---

## FAQ

### Q: Can I increase limits per API key?
**A:** Not currently in database (rate_limit_configs table doesn't exist). Limits are code-level only.

### Q: How long do I need to wait after hitting rate limit?
**A:** Usually 60 seconds for burst limits, check `Retry-After` header in response.

### Q: Why different limits (250/min vs 500 burst)?
**A:**
- **250/min** = Sustained rate over time
- **500 burst** = Short spike allowed, but then must slow down

### Q: Does rate limiting consume my credits?
**A:** No! Rate-limited requests don't charge credits.

### Q: Can I get unlimited rate limits for testing?
**A:** Yes, use Option 2 or 3 above, but **ONLY for local dev**!

---

## Current Status After Fix

✅ **Test script updated** with 1.5s delay
✅ **Respects 250 req/min** limit
✅ **Can test 50 models** in ~90 seconds
✅ **Won't trigger burst limit** anymore

**You can now run:**
```bash
python3 test_all_models.py
```

It will take longer (~90 seconds for 50 models) but won't hit rate limits! 🎉

---

## Quick Reference

| Action | Command | Time |
|--------|---------|------|
| Test 50 models (safe) | `python3 test_all_models.py` | ~90s |
| Test all 339 models | `python3 test_all_models.py --all` | ~8.5 min |
| Quick test 11 models | `./test_models.sh` | ~22s |
| Single model test | `curl ... && sleep 2` | 2s |

**Rate Limits:**
- 250 requests/minute
- 1000 requests/hour
- 500 burst limit
- 50 concurrent requests

---

Need help? Check the logs or ask! 🚀
