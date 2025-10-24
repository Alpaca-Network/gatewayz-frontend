# Braintrust Quick Setup Guide

## 1. Get Your API Key

1. **Sign up for Braintrust**
   - Visit: https://www.braintrust.dev/
   - Create a free account

2. **Generate API Key**
   - Navigate to: https://www.braintrust.dev/app/settings/api-keys
   - Click "Create API Key"
   - Copy your API key (starts with `sk-`)

3. **Update Environment Variable**
   - Open `.env` file in the project root
   - Replace the placeholder API key with your actual key:
   ```bash
   BRAINTRUST_API_KEY=sk-your-actual-api-key-here
   ```

## 2. Verify Installation

Run the integration test:
```bash
python3 tests/test_braintrust_integration.py
```

Expected output:
```
✅ Passed: 5/5
🎉 All tests passed! Braintrust integration is working correctly.
```

## 3. Start the Server

```bash
python3 -m uvicorn src.main:app --reload
```

Look for this line in the startup logs:
```
✅ Braintrust tracing initialized
```

## 4. Test with API Call

Make a test API call to trigger tracing:

```bash
curl -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## 5. View Traces

1. Visit: https://www.braintrust.dev/
2. Navigate to "Gatewayz Backend" project
3. You should see your traces appearing in real-time!

## Troubleshooting

### "Invalid API Key" Error

If you see `Invalid API key` errors:
1. Verify your API key is correct in `.env`
2. Make sure you copied the entire key (starts with `sk-`)
3. Check that `.env` file is in the project root
4. Restart the server after updating `.env`

### No Traces Appearing

1. **Check initialization**: Look for "✅ Braintrust tracing initialized" in server logs
2. **Verify API calls**: Make sure you're hitting the traced endpoints (`/v1/chat/completions` or `/v1/responses`)
3. **Check Braintrust project**: Ensure you're looking at the "Gatewayz Backend" project in the dashboard

### Test Failures

If `test_braintrust_integration.py` fails:
1. Ensure braintrust is installed: `pip list | grep braintrust`
2. Check API key is set: `echo $BRAINTRUST_API_KEY` or check `.env`
3. Verify python-dotenv is installed: `pip list | grep python-dotenv`

## What Gets Traced

Every request to these endpoints is automatically traced:
- `/v1/chat/completions` - Chat completion requests
- `/v1/responses` - Unified response API

**Captured Data:**
- Input messages
- Output responses
- Token counts (prompt, completion, total)
- Latency in milliseconds
- Cost in USD (for paid users)
- Model and provider information
- User and session identifiers

**Privacy Note:** Ensure your API key is kept secure and not committed to version control!

## Next Steps

- [Full Integration Guide](./BRAINTRUST_INTEGRATION.md)
- [Braintrust Documentation](https://www.braintrust.dev/docs)
- [Example Code](../src/utils/braintrust_tracing.py)
