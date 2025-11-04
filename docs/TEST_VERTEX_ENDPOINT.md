# Testing Google Vertex AI Stable Diffusion v1.5 Endpoint

This guide will help you verify that your Stable Diffusion v1.5 endpoint on Google Vertex AI is working correctly.

## Prerequisites

Before testing, you need:

1. **Google Cloud Service Account Key**
   - Download from: [Google Cloud Console > IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
   - The service account must have **Vertex AI User** role
   - Save the JSON key file to your local machine

2. **Python 3.8+** installed

3. **Required packages** installed:
   ```bash
   pip install google-cloud-aiplatform
   ```

## Quick Test

### Option 1: Using the Verification Script (Recommended)

Run the automated verification script:

```bash
# Set your Google Cloud credentials
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"

# Run the verification script
python verify_vertex_endpoint.py
```

**What it checks:**
- ✅ Google Cloud credentials are configured
- ✅ Required packages are installed
- ✅ Endpoint exists and is accessible
- ✅ Endpoint can generate images
- ✅ Response format is correct

### Option 2: Manual Test with gcloud CLI

```bash
# Authenticate with Google Cloud
gcloud auth activate-service-account --key-file=/path/to/key.json

# Set the project
gcloud config set project gatewayz-468519

# Check if the endpoint exists
gcloud ai endpoints describe 6072619212881264640 \
  --project=gatewayz-468519 \
  --region=us-central1
```

**Expected output:**
```
createTime: '2025-XX-XX...'
deployedModels:
- ...
displayName: stable-diffusion-1-5
endpoint: projects/.../locations/us-central1/endpoints/6072619212881264640
name: projects/.../locations/us-central1/endpoints/6072619212881264640
updateTime: '2025-XX-XX...'
```

### Option 3: Python Test Script

Create a file `test_endpoint.py`:

```python
from google.cloud import aiplatform

# Initialize
aiplatform.init(project="gatewayz-468519", location="us-central1")

# Get endpoint
endpoint = aiplatform.Endpoint("6072619212881264640")
print(f"Endpoint: {endpoint.display_name}")

# Make a test prediction
instance = {
    "prompt": "a beautiful sunset over mountains",
    "width": 512,
    "height": 512
}

response = endpoint.predict(instances=[instance])
print(f"Success! Generated {len(response.predictions)} image(s)")
```

Run it:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
python test_endpoint.py
```

## Testing Through the AI Gateway

Once you've verified the endpoint works directly, test it through your AI Gateway:

### 1. Start the Gateway

```bash
# Make sure all environment variables are set
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
export SUPABASE_URL="your-supabase-url"
export SUPABASE_KEY="your-supabase-key"
# ... other required env vars

# Start the server
uvicorn src.main:app --reload
```

### 2. Test the Image Generation Endpoint

```bash
# Get your API key from the gateway
export GATEWAY_API_KEY="your-gateway-api-key"

# Make a request
curl -X POST http://localhost:8000/v1/images/generations \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a serene mountain landscape at sunset",
    "model": "stable-diffusion-1.5",
    "size": "512x512",
    "n": 1,
    "provider": "google-vertex"
  }'
```

**Expected response:**
```json
{
  "created": 1234567890,
  "data": [
    {
      "b64_json": "iVBORw0KGgo...",
      "url": null
    }
  ],
  "provider": "google-vertex",
  "model": "stable-diffusion-1.5",
  "gateway_usage": {
    "tokens_charged": 100,
    "request_ms": 3542,
    "user_balance_after": 9900,
    "images_generated": 1
  }
}
```

### 3. Use the Test Script

```bash
export GATEWAY_API_KEY="your-api-key"
export GATEWAY_URL="http://localhost:8000"

python test_google_vertex_endpoint.py
```

## Common Issues and Solutions

### Issue 1: "Permission Denied" or "403 Forbidden"

**Cause:** Service account doesn't have proper permissions

**Solution:**
```bash
# Grant Vertex AI User role to your service account
gcloud projects add-iam-policy-binding gatewayz-468519 \
  --member="serviceAccount:YOUR-SERVICE-ACCOUNT@gatewayz-468519.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### Issue 2: "Endpoint not found"

**Cause:** Endpoint ID or project/location mismatch

**Solution:**
```bash
# List all endpoints to verify
gcloud ai endpoints list \
  --project=gatewayz-468519 \
  --region=us-central1

# Verify the endpoint ID matches: 6072619212881264640
```

### Issue 3: "Invalid instance format"

**Cause:** The model expects different input parameters

**Solution:** Check your model's input schema in the Vertex AI console:
1. Go to [Vertex AI Endpoints](https://console.cloud.google.com/vertex-ai/endpoints)
2. Click on your endpoint
3. Check the "Input schema" or "Sample request"
4. Adjust the instance format in `image_generation_client.py` if needed

Common formats for Stable Diffusion:
```python
# Format 1: Simple
{"prompt": "...", "width": 512, "height": 512}

# Format 2: With parameters
{
  "prompt": "...",
  "negative_prompt": "...",
  "width": 512,
  "height": 512,
  "num_inference_steps": 50,
  "guidance_scale": 7.5
}

# Format 3: Instances array
{"instances": [{"prompt": "..."}]}
```

### Issue 4: "Model not deployed"

**Cause:** The model is not currently deployed to the endpoint

**Solution:**
```bash
# Check deployment status
gcloud ai endpoints describe 6072619212881264640 \
  --project=gatewayz-468519 \
  --region=us-central1 \
  --format="value(deployedModels)"

# Redeploy if needed via the Vertex AI console
```

### Issue 5: Response format doesn't match

**Cause:** Model returns images in a different format

**Solution:** Update the response processing in `src/services/image_generation_client.py`:

```python
# Current code assumes this format:
if 'image' in prediction:
    image_b64 = prediction['image']

# You might need to adjust based on actual response
# Check the raw response first:
print(f"Raw prediction: {prediction}")
```

## Debugging Tips

### Enable Detailed Logging

Add to your code:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check Raw Response

```python
response = endpoint.predict(instances=[instance])
print(f"Full response: {response}")
print(f"Predictions: {response.predictions}")
print(f"First prediction: {response.predictions[0]}")
```

### Test with Vertex AI Console

1. Go to [Vertex AI Endpoints](https://console.cloud.google.com/vertex-ai/endpoints)
2. Click your endpoint
3. Click "Sample Request"
4. Test directly in the console to see the expected format

### Check Endpoint Logs

```bash
gcloud logging read "resource.type=aiplatform.googleapis.com/Endpoint AND resource.labels.endpoint_id=6072619212881264640" \
  --limit 50 \
  --project=gatewayz-468519
```

## Expected Performance

For Stable Diffusion v1.5:
- **Image size:** 512x512 (native resolution)
- **Generation time:** 3-10 seconds per image
- **Memory:** ~4GB VRAM required
- **Best quality:** 50-100 inference steps

## Next Steps

Once the endpoint is verified:

1. ✅ Update the instance format if needed (in `image_generation_client.py`)
2. ✅ Test with different prompts and parameters
3. ✅ Monitor costs in Google Cloud Console
4. ✅ Set up monitoring and alerts
5. ✅ Document any custom parameters your model supports

## Support

- **Vertex AI Documentation:** https://cloud.google.com/vertex-ai/docs
- **Stability AI Documentation:** https://stability.ai/stable-diffusion
- **AI Gateway Documentation:** See `GOOGLE_VERTEX_SETUP.md`

## Test Checklist

- [ ] Google Cloud credentials configured
- [ ] `google-cloud-aiplatform` package installed
- [ ] Endpoint exists in Vertex AI console
- [ ] Endpoint status is "DEPLOYED"
- [ ] Service account has Vertex AI User role
- [ ] Direct endpoint test succeeds (Python script)
- [ ] AI Gateway server starts without errors
- [ ] Image generation through gateway succeeds
- [ ] Response contains valid base64 image data
- [ ] Image can be decoded and saved successfully

Once all items are checked, your endpoint is ready for production use!
