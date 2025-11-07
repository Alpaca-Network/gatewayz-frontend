# AI Model Testing Guide

This guide explains how to use the testing scripts to verify your AI gateway setup.

## Available Scripts

### 1. `create_user_with_credits.py` - Create Test Users

Creates a new user with API key and credits for testing.

**Usage:**
```bash
# Create user with default $10 credits
python3 create_user_with_credits.py

# Create user with custom amount
python3 create_user_with_credits.py 100.00

# Create user with custom username
python3 create_user_with_credits.py 50.00 my_test_user

# Create user with all custom fields
python3 create_user_with_credits.py 25.00 premium_user test@example.com
```

**Output:**
- Creates user in database
- Adds specified credits
- Generates API key
- Saves details to `.user_<username>.txt`
- Displays ready-to-use curl command

---

### 2. `test_all_models.py` - Comprehensive Model Testing

Tests all available AI models with health check messages.

**Features:**
- ✅ Tests all 339 models in your catalog
- ✅ Colored output for easy reading
- ✅ Shows response time and token usage
- ✅ Groups failures by error type
- ✅ Saves detailed results to JSON
- ✅ Smart filtering for chat models

**Usage:**
```bash
# Test first 50 chat models (recommended)
python3 test_all_models.py

# Test ALL models (takes ~30 minutes)
python3 test_all_models.py --all
```

**Options:**
- Automatically uses API key from `.test_api_key` file
- Falls back to `API_KEY` environment variable
- 30 second timeout per request
- 0.5 second delay between requests

**Output:**
```
✓ Successful models in GREEN
✗ Failed models in RED
⚠ Warnings in YELLOW

Summary includes:
- Success/failure counts and percentages
- Models grouped by provider
- Failures grouped by error type
- Average response times
- Results saved to model_test_results_<timestamp>.json
```

---

### 3. `test_models.sh` - Quick Health Check

Fast bash script to test specific models.

**Features:**
- ✅ Quick testing of curated model list
- ✅ Colored terminal output
- ✅ Configurable delay between requests
- ✅ Tests most popular models

**Usage:**
```bash
# Run with default settings (2s delay)
./test_models.sh

# Run with custom delay (5s between requests)
DELAY=5 ./test_models.sh

# Run with custom API key
API_KEY="gw_your_key_here" ./test_models.sh
```

**Configure:**
Edit the `MODELS` array in the script to test different models:
```bash
declare -a MODELS=(
    "openai/gpt-4o-mini"
    "anthropic/claude-3-haiku"
    "google/gemini-2.0-flash"
    # Add more models here
)
```

---

## Quick Start

### 1. Create a Test User
```bash
# Create user with $10 credits
python3 create_user_with_credits.py

# Output will show your API key:
# API Key: gw_abc123...
```

### 2. Test a Single Model
```bash
export API_KEY="gw_abc123..."  # Use the key from step 1

curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 50
  }'
```

### 3. Test All Models
```bash
# The API key will be read from .test_api_key automatically
python3 test_all_models.py
```

---

## Understanding Test Results

### Success Indicators
```
✓ Model responded successfully
  - Shows response time (e.g., "587ms" or "4.56s")
  - Shows token count
  - Displays first 80 chars of response
```

### Common Failures

#### 1. Insufficient Credits (402)
```
⚠ Insufficient credits
```
**Solution:** Add more credits using `add_test_credits.py` or create new user with `create_user_with_credits.py`

#### 2. Rate Limited (429)
```
⚠ Rate limited
```
**Solution:**
- Increase `DELAY` between requests
- Wait a few minutes before retrying
- Check rate limit config in database

#### 3. Authentication Failed (401)
```
✗ Auth failed
```
**Solution:** Check your API key is valid and active

#### 4. Model Not Found / Provider Config Missing
```
✗ HTTP 500 - Internal server error
```
**Common causes:**
- Provider API key not configured in `.env`
- Google Vertex credentials missing
- Provider service down

---

## Provider Configuration Status

Check which providers are properly configured:

### ✅ Working (No Additional Config Needed)
- OpenRouter (via Portkey)
- DeepInfra (API key found)
- Hugging Face
- Together AI
- Groq
- Fireworks AI

### ⚠️ Needs Configuration
| Provider | Required Env Var | Status |
|----------|-----------------|--------|
| Google Vertex | `GOOGLE_APPLICATION_CREDENTIALS` | ❌ Missing |
| Google Gemini | `GOOGLE_API_KEY` | ❓ Check .env |
| OpenAI | `OPENAI_API_KEY` | ❓ Check .env |
| Anthropic | `ANTHROPIC_API_KEY` | ❓ Check .env |

---

## Adding Google Vertex AI Support

To test Google Gemini models (gemini-2.0-flash, etc.):

1. Get your service account JSON from Google Cloud
2. Save it:
   ```bash
   cp ~/Downloads/service-account-key.json .secrets/gatewayz-service-account.json
   ```

3. Add to `.env`:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=.secrets/gatewayz-service-account.json
   GOOGLE_CLOUD_PROJECT=gatewayz-468519
   GOOGLE_VERTEX_LOCATION=us-central1
   ```

4. Restart server and test:
   ```bash
   curl -X POST http://localhost:8000/v1/chat/completions \
     -H "Authorization: Bearer $(cat .test_api_key)" \
     -H "Content-Type: application/json" \
     -d '{"model": "gemini-2.0-flash", "messages": [{"role": "user", "content": "Hello"}]}'
   ```

---

## Troubleshooting

### Issue: Rate Limiting During Tests
**Symptoms:** Many "HTTP 429" errors

**Solutions:**
1. Increase delay in Python script:
   ```python
   # In test_all_models.py, line ~300
   time.sleep(2.0)  # Change from 0.5 to 2.0
   ```

2. Increase delay in bash script:
   ```bash
   DELAY=5 ./test_models.sh
   ```

3. Check rate limit config:
   ```sql
   SELECT * FROM rate_limit_configs WHERE api_key_id = <your_key_id>;
   ```

### Issue: All Tests Fail with "Insufficient Credits"
**Solution:**
```bash
python3 add_test_credits.py  # Adds 999,999 credits
```

### Issue: Connection Timeout
**Symptoms:** "Request timeout" errors

**Solutions:**
1. Check if server is running: `curl http://localhost:8000/health`
2. Increase timeout in script (default: 30s)
3. Test with simpler/faster models first

---

## Performance Benchmarks

Expected response times for popular models:

| Model | Provider | Avg Response Time | Cost per 1M tokens |
|-------|----------|-------------------|-------------------|
| gpt-4o-mini | OpenAI | 500-1000ms | $0.15 / $0.60 |
| claude-3-haiku | Anthropic | 600-900ms | $0.25 / $1.25 |
| gemini-2.0-flash | Google | 800-1500ms | Free / $0.075 |
| llama-3.3-70b | DeepInfra | 2000-4000ms | ~$0.30 / $0.30 |

---

## Monitoring Credits Usage

Check your credit balance:
```bash
curl -H "Authorization: Bearer $(cat .test_api_key)" \
  http://localhost:8000/v1/users/me | python3 -m json.tool
```

View credit transaction history:
```sql
SELECT * FROM credit_transactions
WHERE user_id = <your_user_id>
ORDER BY created_at DESC
LIMIT 10;
```

---

## Advanced Usage

### Test Specific Provider Models Only
```python
# Modify test_all_models.py to filter by provider
models = [m for m in all_models if m.get("provider") == "openai"]
```

### Test with Different Parameters
```bash
# Test with streaming enabled
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o-mini", "messages": [...], "stream": true}'
```

### Export Test Results
```bash
# Run test and save results
python3 test_all_models.py > test_output.log 2>&1

# View results later
less test_output.log
```

---

## Files Created by Scripts

| File | Created By | Purpose |
|------|------------|---------|
| `.test_api_key` | `create_api_key_direct.py` | Stores API key for testing |
| `.user_<username>.txt` | `create_user_with_credits.py` | User details and API key |
| `model_test_results_<timestamp>.json` | `test_all_models.py` | Detailed test results |

---

## Need Help?

1. Check server logs: The backend server shows detailed error messages
2. Test a single model manually with curl first
3. Verify your API key is active: `curl http://localhost:8000/v1/users/me -H "Authorization: Bearer $API_KEY"`
4. Check database directly:
   ```sql
   SELECT * FROM users WHERE email LIKE 'test_%';
   SELECT * FROM api_keys_new WHERE user_id = <id>;
   ```

---

## Summary

You now have **339 AI models** available to test across **20+ providers**!

**Quick commands:**
```bash
# 1. Create user with credits
python3 create_user_with_credits.py

# 2. Test all models
python3 test_all_models.py

# 3. Quick test popular models
./test_models.sh
```

Happy testing! 🚀
