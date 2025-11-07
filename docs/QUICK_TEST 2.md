# Quick Test - Google Vertex AI Endpoint

## Test Through Production API (Gatewayz)

### Prerequisites
1. **Gatewayz API Key** - Get from https://gatewayz.ai/settings
2. **Sufficient Credits** - At least 100 credits (check at https://gatewayz.ai/dashboard)

### Quick Test Command

```bash
# Set your API key
export GATEWAYZ_API_KEY="your-api-key-here"

# Test the endpoint
curl -X POST https://api.gatewayz.ai/v1/images/generations \
  -H "Authorization: Bearer $GATEWAYZ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a serene mountain landscape at sunset, photorealistic",
    "model": "stable-diffusion-1.5",
    "size": "512x512",
    "n": 1,
    "provider": "google-vertex"
  }'
```

### Expected Response (Success)

```json
{
  "created": 1729718400,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAA...",
      "url": null
    }
  ],
  "provider": "google-vertex",
  "model": "stable-diffusion-1.5",
  "gateway_usage": {
    "tokens_charged": 100,
    "request_ms": 4500,
    "user_balance_after": 9900,
    "images_generated": 1
  }
}
```

### Possible Errors

#### Error 1: Authentication Failed (401)
```json
{
  "detail": "Invalid API key"
}
```
**Fix:** Get a valid API key from https://gatewayz.ai/settings

#### Error 2: Insufficient Credits (402)
```json
{
  "detail": "Insufficient credits. Image generation requires ~100 credits. Available: 50"
}
```
**Fix:** Add credits at https://gatewayz.ai/pricing

#### Error 3: Google Cloud Not Configured (500)
```json
{
  "detail": "Google Cloud project ID not configured. Set GOOGLE_PROJECT_ID environment variable"
}
```
**Fix:** Server needs Google Cloud credentials configured

#### Error 4: Vertex AI Endpoint Not Accessible (500)
```json
{
  "detail": "Google Vertex AI image generation request failed: 403 Permission Denied"
}
```
**Fix:** Service account needs Vertex AI User role

#### Error 5: Invalid Instance Format (500)
```json
{
  "detail": "Prediction failed: Invalid instance format"
}
```
**Fix:** Model expects different input parameters - check TEST_VERTEX_ENDPOINT.md

---

## Test Using Automated Script

### Option 1: Full Test Script
```bash
export GATEWAYZ_API_KEY="your-api-key"
./test_production_vertex.sh
```

This will:
- ✅ Check API health
- ✅ Verify your balance
- ✅ Test image generation
- ✅ Save the generated image
- ✅ Show detailed results

### Option 2: Direct Vertex AI Test (Requires Google Credentials)
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
python verify_vertex_endpoint.py
```

This tests the endpoint directly without going through the gateway.

---

## Interpreting Results

### ✅ Success Indicators
- HTTP Status: 200
- Response contains `"data"` array with image
- `b64_json` field has base64-encoded image data
- `gateway_usage.tokens_charged` is 100
- `provider` is "google-vertex"

### ❌ Failure Indicators
- HTTP Status: 401, 402, 500
- Response contains `"detail"` with error message
- No `data` array in response

### ⚠️ Partial Success
- HTTP Status: 200
- But `data` array is empty
- Or `b64_json` is null/invalid

---

## Saving the Generated Image

If you get a successful response, save the image:

```bash
# Get the response
RESPONSE=$(curl -s -X POST https://api.gatewayz.ai/v1/images/generations \
  -H "Authorization: Bearer $GATEWAYZ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a beautiful sunset",
    "model": "stable-diffusion-1.5",
    "size": "512x512",
    "n": 1,
    "provider": "google-vertex"
  }')

# Extract and decode the image
echo "$RESPONSE" | jq -r '.data[0].b64_json' | base64 -d > generated_image.png

# View the image
open generated_image.png  # macOS
xdg-open generated_image.png  # Linux
```

---

## Troubleshooting

### Check API Status
```bash
curl https://api.gatewayz.ai/health
```

### Check Your Balance
```bash
curl -H "Authorization: Bearer $GATEWAYZ_API_KEY" \
  https://api.gatewayz.ai/user/balance
```

### Test with Different Provider (DeepInfra - for comparison)
```bash
curl -X POST https://api.gatewayz.ai/v1/images/generations \
  -H "Authorization: Bearer $GATEWAYZ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a beautiful sunset",
    "model": "stabilityai/sd3.5",
    "size": "1024x1024",
    "n": 1,
    "provider": "deepinfra"
  }'
```

If DeepInfra works but google-vertex doesn't, the issue is with the Vertex AI configuration.

---

## What Each Test Validates

### ✅ If the curl command succeeds:
- Gateway API is working
- Your API key is valid
- You have sufficient credits
- Google Vertex AI is configured on the server
- The endpoint is accessible
- Image generation works

### ❌ If it fails with 500 error:
- Check server logs for Google Cloud errors
- Verify `GOOGLE_APPLICATION_CREDENTIALS` is set on server
- Verify service account has Vertex AI User role
- Verify endpoint 6072619212881264640 exists and is deployed

---

## Next Steps After Successful Test

1. ✅ Document the working parameters
2. ✅ Test with different prompts
3. ✅ Test with different sizes (512x512, 768x768)
4. ✅ Test generating multiple images (n=2, n=4)
5. ✅ Monitor costs in Google Cloud Console
6. ✅ Set up monitoring/alerting

---

## Support

If tests fail, check:
- **API Logs**: Contact Gatewayz support
- **Google Cloud Logs**: See TEST_VERTEX_ENDPOINT.md
- **Documentation**: See GOOGLE_VERTEX_SETUP.md
