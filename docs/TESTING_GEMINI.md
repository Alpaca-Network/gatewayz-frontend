# Testing Google Vertex AI - Gemini 2.0 Flash

This guide shows how to test the Google Vertex AI integration with Gemini 2.0 Flash using the new lightweight JWT authentication.

## Quick Start

### 1. Check Configuration

First, verify your configuration is correct:

```bash
python3 check_vertex_ai_config.py
```

This script checks:
- ✓ GOOGLE_VERTEX_CREDENTIALS_JSON is set and valid
- ✓ GOOGLE_PROJECT_ID is configured
- ✓ GOOGLE_VERTEX_LOCATION is configured
- ✓ Required Python dependencies are installed
- ✓ google_oauth2_jwt module is available

### 2. Set Environment Variables

```bash
# Set your service account credentials (raw JSON or base64)
export GOOGLE_VERTEX_CREDENTIALS_JSON='{"type":"service_account",...}'

# Set your GCP project ID
export GOOGLE_PROJECT_ID=my-gcp-project

# Set the region (default: us-central1)
export GOOGLE_VERTEX_LOCATION=us-central1
```

### 3. Run the Test

```bash
python3 test_gemini_2_flash.py
```

Expected output:

```
================================================================================
TESTING GOOGLE VERTEX AI - GEMINI 2.0 FLASH
================================================================================

1. Checking environment variables...
   ✓ GOOGLE_PROJECT_ID: my-gcp-project
   ✓ GOOGLE_VERTEX_LOCATION: us-central1
   ✓ GOOGLE_VERTEX_CREDENTIALS_JSON: Set (length: 2547)

2. Testing JWT authentication...
   ✓ Access token obtained (length: 1234 chars)
   ✓ Token preview: ya29.c.b0AW...

3. Testing Gemini 2.0 Flash API call...
   Calling: https://us-central1-aiplatform.googleapis.com/v1/projects/my-gcp-project/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent
   Model: gemini-2.0-flash
   Prompt: 'What is 2 + 2? Reply with just the answer.'
   ✓ Got response from Gemini 2.0 Flash

   Response:
   ───────────────────────────────────────────────
   4
   ───────────────────────────────────────────────

   Tokens used:
   • Prompt: 11
   • Completion: 3
   • Total: 14

================================================================================
✓ TEST PASSED - Gemini 2.0 Flash is working correctly!
================================================================================
```

## Configuration

### Service Account Credentials

You need a Google Cloud service account with Vertex AI permissions.

#### Option 1: JSON File

If you have a service account JSON file:

```bash
export GOOGLE_VERTEX_CREDENTIALS_JSON=$(cat service-account.json)
```

#### Option 2: Base64-Encoded (for Vercel/Railway)

For serverless deployments, use base64 encoding:

```bash
export GOOGLE_VERTEX_CREDENTIALS_JSON=$(base64 -w0 service-account.json)
```

#### Option 3: Environment Variable

Set the raw JSON directly:

```bash
export GOOGLE_VERTEX_CREDENTIALS_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

### GCP Project ID

Your GCP project ID:

```bash
export GOOGLE_PROJECT_ID=my-project-123
```

### Region

The Google Cloud region (default: us-central1):

```bash
export GOOGLE_VERTEX_LOCATION=us-central1
```

Supported regions for Vertex AI:
- us-central1
- us-west1
- us-east1
- europe-west1
- asia-southeast1

## Troubleshooting

### "GOOGLE_VERTEX_CREDENTIALS_JSON not set"

**Error**:
```
✗ GOOGLE_VERTEX_CREDENTIALS_JSON not set
```

**Solution**: Set the environment variable:
```bash
export GOOGLE_VERTEX_CREDENTIALS_JSON='<your-service-account-json>'
```

### "Invalid service account JSON"

**Error**:
```
✗ Invalid JSON: Expecting value: line 1 column 1 (char 0)
```

**Solution**: Verify your JSON is valid:
```bash
# Test with curl
echo $GOOGLE_VERTEX_CREDENTIALS_JSON | python3 -m json.tool

# Or use jq
echo $GOOGLE_VERTEX_CREDENTIALS_JSON | jq .
```

### "Missing required fields"

**Error**:
```
✗ Missing required fields: private_key, client_email
```

**Solution**: Download a fresh service account key from Google Cloud Console:
1. Go to IAM & Admin → Service Accounts
2. Select your service account
3. Click "Keys" tab
4. Create a new JSON key
5. Use the downloaded JSON

### "HTTP 401 - Unauthorized"

**Error**:
```
✗ HTTP 401
Error: invalid_assertion
```

**Causes**:
1. Service account credentials are invalid or expired
2. Private key has been revoked
3. Service account has been deleted

**Solution**:
1. Verify credentials are still valid
2. Download a fresh key if needed
3. Check IAM permissions for the service account

### "HTTP 403 - Permission Denied"

**Error**:
```
✗ HTTP 403
Error: Permission denied on resource
```

**Causes**:
1. Service account lacks Vertex AI User role
2. Service account lacks Vertex AI API Admin role
3. Vertex AI API is not enabled

**Solutions**:
1. Add IAM role to service account:
   ```
   Go to IAM & Admin → IAM
   Find your service account
   Click Edit
   Add "Vertex AI User" role
   ```

2. Enable Vertex AI API:
   ```
   Go to APIs & Services → Enable APIs and Services
   Search for "Vertex AI API"
   Click Enable
   ```

### "HTTP 404 - Not Found"

**Error**:
```
✗ HTTP 404
Error: models/gemini-2.0-flash not found
```

**Causes**:
1. Model is not available in the specified region
2. Project ID or region is incorrect
3. Vertex AI API is not enabled

**Solutions**:
1. Verify the model is available in your region
2. Check GOOGLE_PROJECT_ID and GOOGLE_VERTEX_LOCATION
3. Enable Vertex AI API in Google Cloud Console

### "Module not found: google_oauth2_jwt"

**Error**:
```
✗ google_oauth2_jwt: Not available
```

**Solution**: The module should be in `src/services/`. Verify:
1. You're in the `/root/repo` directory
2. The file exists: `src/services/google_oauth2_jwt.py`
3. The Python path is correct

## Testing Different Models

You can test other Gemini models by creating a similar script:

```python
# Test Gemini 1.5 Pro
model = "gemini-1.5-pro"

# Test Gemini 1.5 Flash
model = "gemini-1.5-flash"

# Test Gemini 2.0 Flash Lite
model = "gemini-2.0-flash-lite"
```

## Advanced Testing

### Test with Custom Parameters

Create a test script with custom parameters:

```python
from src.services.google_vertex_client import make_google_vertex_request_openai

response = make_google_vertex_request_openai(
    messages=[
        {"role": "user", "content": "Your prompt here"}
    ],
    model="gemini-2.0-flash",
    max_tokens=1000,
    temperature=0.7,
    top_p=0.9,
)

print(response["choices"][0]["message"]["content"])
```

### Test with Streaming

Gemini 2.0 Flash also supports streaming:

```python
from src.services.google_vertex_client import make_google_vertex_request_openai_stream

stream = make_google_vertex_request_openai_stream(
    messages=[
        {"role": "user", "content": "Write a short poem about clouds"}
    ],
    model="gemini-2.0-flash",
)

for chunk in stream:
    print(chunk, end="", flush=True)
```

### Test with Chat History

```python
from src.services.google_vertex_client import make_google_vertex_request_openai

messages = [
    {"role": "user", "content": "What is the capital of France?"},
    {"role": "assistant", "content": "The capital of France is Paris."},
    {"role": "user", "content": "What is its population?"},
]

response = make_google_vertex_request_openai(
    messages=messages,
    model="gemini-2.0-flash",
)

print(response["choices"][0]["message"]["content"])
```

## Performance Notes

### Token Usage

Gemini 2.0 Flash is optimized for:
- Fast inference (10-50ms token generation)
- Low latency
- Cost-effective

### Pricing

Check current pricing at:
https://cloud.google.com/vertex-ai/pricing

### Rate Limits

Default rate limits:
- 1,000 requests per minute
- 2,000,000 tokens per minute

## Integration with Application Routes

Once verified, the integration can be used in your routes:

```python
from src.services.google_vertex_client import make_google_vertex_request_openai

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatRequest):
    response = make_google_vertex_request_openai(
        messages=request.messages,
        model=request.model,
        max_tokens=request.max_tokens,
        temperature=request.temperature,
    )
    return response
```

## Documentation

- **JWT Authentication**: [docs/GOOGLE_OAUTH2_JWT.md](GOOGLE_OAUTH2_JWT.md)
- **Migration Guide**: [docs/GOOGLE_VERTEX_MIGRATION.md](GOOGLE_VERTEX_MIGRATION.md)
- **Integration Guide**: [docs/INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- **Vertex AI Client**: [src/services/google_vertex_client.py](../src/services/google_vertex_client.py)

---

**Ready to test?**

```bash
python3 check_vertex_ai_config.py
python3 test_gemini_2_flash.py
```
