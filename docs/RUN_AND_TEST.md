# Run Backend Locally & Test with Curl

## Step-by-Step Guide

### Step 1: Start Your Backend Server

Open a terminal and run:

```bash
cd "/Users/arminrad/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Alpaca-Network/Gatewayz/gatewayz-backend"

# Start the server
uvicorn src.main:app --reload --port 8000
```

**You should see:**
```
INFO:     Will watch for changes in these directories: ['/Users/arminrad/...']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

✅ **Your backend is now running at http://localhost:8000**

**Keep this terminal open!** Don't close it while testing.

---

### Step 2: Get an API Key

You need an API key to authenticate requests.

**Option A: Use Existing Key (if you have one)**

Check your database for existing API keys:
```bash
# This will show your API keys
psql $DATABASE_URL -c "SELECT id, key_hash, user_id FROM api_keys LIMIT 5;"
```

**Option B: Create a New Test Key**

Open a **new terminal** (keep the server running in the first one):

```bash
# Create a test user and API key
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

This returns an API key. **Copy it!** It looks like: `gw_abc123xyz...`

**Option C: Quick Test Key**

For quick testing, you can often use:
```bash
export API_KEY="your-key-here"
```

---

### Step 3: Test with Curl

Now you can test! Open a **new terminal** (keep server running in first terminal).

#### **Test 1: Simple Health Check**

```bash
curl http://localhost:8000/health
```

**Expected:**
```json
{"status": "healthy"}
```

---

#### **Test 2: List Available Models**

```bash
curl http://localhost:8000/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

**Expected:** JSON list of all 400+ models including Gemini models

---

#### **Test 3: Test Gemini 2.0 Flash**

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": "Say hello in exactly 3 words"
      }
    ],
    "max_tokens": 10
  }'
```

**Expected Response:**
```json
{
  "id": "vertex-1234567890",
  "object": "text_completion",
  "created": 1234567890,
  "model": "gemini-2.0-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello to you!"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

---

#### **Test 4: Test Gemini 2.5 Flash Lite (Fastest)**

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "model": "gemini-2.5-flash-lite",
    "messages": [
      {
        "role": "user",
        "content": "Count to 5"
      }
    ],
    "max_tokens": 20
  }'
```

---

#### **Test 5: Test with Streaming**

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": "Write a short poem about code"
      }
    ],
    "stream": true,
    "max_tokens": 100
  }'
```

**Expected:** Stream of SSE events with chunks of text

---

#### **Test 6: Test Different Models**

```bash
# Gemini 1.5 Pro (Best quality)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "model": "gemini-1.5-pro",
    "messages": [{"role": "user", "content": "Explain quantum computing in one sentence"}]
  }'

# Gemini 2.0 Flash Thinking (Reasoning)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "model": "gemini-2.0-flash-thinking",
    "messages": [{"role": "user", "content": "Solve: If x+5=10, what is x?"}]
  }'

# Gemini 1.5 Flash (Balanced)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "model": "gemini-1.5-flash",
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
  }'
```

---

### Step 4: Check Server Logs

While testing, watch the terminal where your server is running. You'll see:

**Success:**
```
INFO:     127.0.0.1:54321 - "POST /v1/chat/completions HTTP/1.1" 200 OK
```

**Errors:**
```
ERROR: Google Vertex AI request failed: ...
ERROR: Authentication failed: ...
ERROR: Model not found: ...
```

---

## Common Curl Parameters

### Basic Request Structure:
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [...],
    "max_tokens": 100,
    "temperature": 0.7,
    "top_p": 0.9,
    "stream": false
  }'
```

### Parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `model` | Which Gemini model to use | `"gemini-2.0-flash"` |
| `messages` | Conversation history | `[{"role": "user", "content": "Hi"}]` |
| `max_tokens` | Max response length | `100` |
| `temperature` | Randomness (0-2) | `0.7` |
| `top_p` | Nucleus sampling (0-1) | `0.9` |
| `stream` | Enable streaming | `true` or `false` |

### Message Roles:

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello!"},
    {"role": "assistant", "content": "Hi! How can I help?"},
    {"role": "user", "content": "Tell me a joke"}
  ]
}
```

---

## Troubleshooting

### Error: "Connection refused"
**Problem:** Server isn't running
**Fix:** Run `uvicorn src.main:app --reload --port 8000` in terminal 1

---

### Error: "401 Unauthorized" or "Invalid API key"
**Problem:** API key is wrong or missing
**Fix:**
1. Check you're using the right key
2. Make sure it starts with `gw_` or matches your format
3. Create a new key if needed

---

### Error: "No Response Received" or "500 Internal Server Error"
**Problem:** Google Vertex credentials issue
**Fix:**
1. Check `.env` has `GOOGLE_VERTEX_CREDENTIALS_JSON`
2. Fix IAM permissions (add "Vertex AI User" role)
3. Check server logs for specific error

---

### Error: "404 Not Found"
**Problem:** Model name is wrong
**Fix:** Use exact model name like `gemini-2.0-flash` (check `/v1/models` endpoint)

---

### Error: "Timeout"
**Problem:** Request taking too long
**Fix:**
1. Check internet connection
2. Use smaller `max_tokens`
3. Try simpler prompt

---

## Pro Tips

### 1. Pretty Print JSON
```bash
curl http://localhost:8000/v1/models | python3 -m json.tool
```

### 2. Save Response to File
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model": "gemini-2.0-flash", "messages": [...]}' \
  > response.json
```

### 3. Time the Request
```bash
time curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{...}'
```

### 4. Use Environment Variable for API Key
```bash
# Set once
export GATEWAYZ_API_KEY="your-key-here"

# Use in all requests
curl -H "Authorization: Bearer $GATEWAYZ_API_KEY" ...
```

### 5. Verbose Mode (See Full Request/Response)
```bash
curl -v -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{...}'
```

---

## Quick Reference

### Start Server:
```bash
uvicorn src.main:app --reload --port 8000
```

### Stop Server:
Press `Ctrl+C` in the terminal where server is running

### Test Model:
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model": "gemini-2.0-flash", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Check Health:
```bash
curl http://localhost:8000/health
```

### List Models:
```bash
curl http://localhost:8000/v1/models -H "Authorization: Bearer YOUR_API_KEY"
```

---

## What Success Looks Like

✅ Server starts without errors
✅ Health check returns `{"status": "healthy"}`
✅ `/v1/models` returns JSON with 400+ models
✅ Chat completion returns response from Gemini
✅ Server logs show `200 OK`
✅ No errors in terminal

---

## Need an API Key Fast?

If you don't have an API key yet, you can create one via the database:

```bash
# Connect to your database
psql $DATABASE_URL

# Create a test API key manually
INSERT INTO api_keys (user_id, key_hash, name)
VALUES (
  (SELECT id FROM users LIMIT 1),
  'test-key-hash',
  'Test Key'
) RETURNING *;
```

Or use the registration endpoint to create a user + key automatically.
