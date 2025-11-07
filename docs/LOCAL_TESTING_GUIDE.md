# How to Test Google Vertex AI Locally

## Quick Testing Guide

### Step 1: Fix IAM Permissions First (One-time)

**Do this in GCP Console:**
1. Go to: https://console.cloud.google.com/iam-admin/iam?project=gatewayz-468519
2. Find: `gatewayz@gatewayz-468519.iam.gserviceaccount.com`
3. Click the pencil icon (✏️) to edit permissions
4. Click "+ ADD ANOTHER ROLE"
5. Select: **"Vertex AI User"**
6. Click "SAVE"

**Wait 1-2 minutes for permissions to propagate**

---

### Step 2: Test Credentials (Simple Python Script)

Run this in your terminal:

```bash
cd "/Users/arminrad/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Alpaca-Network/Gatewayz/gatewayz-backend"

python3 test_google_simple.py
```

**Expected Output:**
```
✅ Project ID: gatewayz-468519
✅ Location: us-central1
✅ Credentials: Set (2309 chars)
✅ Valid JSON
✅ Credentials object created
✅ OAuth token obtained
✅ API CALL SUCCESSFUL!
   Response: "Hello to you!"
🎉 SUCCESS!
```

**If it fails:** You need to fix IAM permissions (Step 1)

---

### Step 3: Start Your Backend Server Locally

```bash
cd "/Users/arminrad/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Alpaca-Network/Gatewayz/gatewayz-backend"

# Start the backend
uvicorn src.main:app --reload --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Keep this terminal open - your server is running!

---

### Step 4: Test Gemini Model via API (New Terminal)

Open a **new terminal** and run:

```bash
# Test with curl
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [{"role": "user", "content": "Say hello in 3 words"}],
    "max_tokens": 10
  }'
```

**Replace `YOUR_API_KEY_HERE` with your actual API key from your database**

**Expected Response:**
```json
{
  "id": "vertex-1234567890",
  "model": "gemini-2.0-flash",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello to you!"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

---

### Step 5: Test All 10 Gemini Models

Try different models:

```bash
# Gemini 2.5 Flash Lite (fastest, cheapest)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gemini-2.5-flash-lite",
    "messages": [{"role": "user", "content": "Hi"}]
  }'

# Gemini 2.0 Flash Thinking (for reasoning)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gemini-2.0-flash-thinking",
    "messages": [{"role": "user", "content": "Solve: 2+2"}]
  }'

# Gemini 1.5 Pro (best quality)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gemini-1.5-pro",
    "messages": [{"role": "user", "content": "Write a haiku"}]
  }'
```

---

## Quick Troubleshooting

### Error: "No access token in response"
**Cause:** Service account doesn't have Vertex AI User role
**Fix:** Follow Step 1 above (add IAM role)

### Error: "403 Forbidden" or "Permission denied"
**Cause:** Same as above - IAM permissions issue
**Fix:**
1. Check IAM role is added
2. Wait 2 minutes for propagation
3. Try again

### Error: "404 Not Found"
**Cause:** Model name might be wrong or not available in your region
**Fix:**
1. Use `gemini-2.0-flash` (most reliable)
2. Check your region is `us-central1`

### Error: "No Response Received"
**Cause:** Credentials not loaded
**Fix:**
1. Check `.env` has `GOOGLE_VERTEX_CREDENTIALS_JSON`
2. Restart your backend server
3. Check credentials aren't corrupted (should be ~2300 chars)

### Error: "Connection timeout"
**Cause:** Network issue or slow response
**Fix:**
1. Check internet connection
2. Try again (Google might be slow)
3. Increase timeout in your request

---

## Alternative: Test with Python Directly

Create a file `quick_test.py`:

```python
import os
import json
import httpx
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request

load_dotenv()

# Load credentials
creds_json = json.loads(os.getenv("GOOGLE_VERTEX_CREDENTIALS_JSON"))
credentials = Credentials.from_service_account_info(
    creds_json,
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
credentials.refresh(Request())

# Make API call
url = "https://us-central1-aiplatform.googleapis.com/v1/projects/gatewayz-468519/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent"

response = httpx.post(
    url,
    headers={"Authorization": f"Bearer {credentials.token}"},
    json={
        "contents": [{"role": "user", "parts": [{"text": "Hello!"}]}]
    },
    timeout=60.0
)

print(response.json())
```

Run it:
```bash
python3 quick_test.py
```

---

## Check Server Logs

While testing, watch your backend logs for errors:

```bash
# In the terminal where uvicorn is running, you'll see:
INFO:     127.0.0.1:54321 - "POST /v1/chat/completions HTTP/1.1" 200 OK
```

Or check for errors:
```
ERROR: Google Vertex AI request failed: ...
```

---

## Monitor Usage in GCP

Watch your requests in real-time:

1. Go to: https://console.cloud.google.com/vertex-ai/generative/dashboard?project=gatewayz-468519
2. You'll see:
   - Request count
   - Token usage
   - Costs (should be $0 in free tier)
   - Errors (if any)

---

## What Success Looks Like

✅ **Credentials test passes** → `python3 test_google_simple.py` works
✅ **Backend starts** → `uvicorn` runs without errors
✅ **API responds** → curl request returns JSON response
✅ **No errors in logs** → Server logs show 200 OK
✅ **GCP dashboard shows requests** → Usage appears in console

---

## Common Issues

| Issue | Check This |
|-------|-----------|
| IAM permissions | GCP Console → IAM → Vertex AI User role |
| Credentials loaded | `.env` has GOOGLE_VERTEX_CREDENTIALS_JSON |
| API enabled | GCP Console → Vertex AI API is enabled |
| Billing active | GCP Console → Billing is linked |
| Server running | `uvicorn` command worked |
| Correct port | Using port 8000 (or your configured port) |

---

## Need Help?

If stuck, check:
1. Server logs (terminal where uvicorn is running)
2. GCP Console errors
3. Test script output (`python3 test_google_simple.py`)

Tell me which step failed and what error you see!
