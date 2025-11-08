# Google Vertex AI Integration for Stability Diffusion v1.5

This document explains how to set up and use the Google Vertex AI integration for Stability Diffusion v1.5 image generation through the AI Gateway.

## Overview

The AI Gateway now supports image generation using Google Vertex AI endpoints, allowing you to leverage custom-trained or pre-deployed models like Stability Diffusion v1.5 on Google Cloud Platform.

## Prerequisites

1. **Google Cloud Project** with Vertex AI enabled
2. **Deployed Vertex AI Endpoint** with Stability Diffusion v1.5 model
3. **Service Account Credentials** with permissions to access Vertex AI
4. **Python 3.8+** with required dependencies

## Setup Instructions

### 1. Install Dependencies

The required Google Cloud AI Platform SDK is already added to `requirements.txt`:

```bash
pip install -r requirements.txt
```

This will install:
- `google-cloud-aiplatform>=1.38.0`
- All other AI Gateway dependencies

### 2. Configure Google Cloud Credentials

Set up authentication using a service account:

```bash
# Download your service account key from Google Cloud Console
# Then set the environment variable
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

Alternatively, if running on Google Cloud (GCE, GKE, Cloud Run), the application will use the default service account.

### 3. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Google Vertex AI Configuration
GOOGLE_PROJECT_ID=gatewayz-468519                 # Your Google Cloud project ID
GOOGLE_VERTEX_LOCATION=us-central1                # Your endpoint region
GOOGLE_VERTEX_ENDPOINT_ID=6072619212881264640     # Your deployed endpoint ID
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json  # Path to service account key
```

**Note:** The default values in `config.py` are already configured for your project, but you can override them via environment variables or per-request.

### 4. Verify Your Endpoint

Before using the endpoint, verify it's deployed and active:

```bash
gcloud ai endpoints list \
  --project=gatewayz-468519 \
  --region=us-central1
```

You should see your endpoint ID `6072619212881264640` in the list with status "DEPLOYED".

## Usage

### API Endpoint

```
POST /v1/images/generations
```

### Request Format

The endpoint follows OpenAI's image generation API format with additional Google Vertex AI parameters:

```json
{
  "prompt": "A serene mountain landscape at sunset",
  "model": "stable-diffusion-1.5",
  "size": "512x512",
  "n": 1,
  "provider": "google-vertex",
  "google_project_id": "gatewayz-468519",
  "google_location": "us-central1",
  "google_endpoint_id": "6072619212881264640"
}
```

#### Required Parameters

- **`prompt`** (string): Text description of the image to generate
- **`provider`** (string): Must be `"google-vertex"`

#### Optional Parameters

- **`model`** (string): Model identifier for tracking (default: "stable-diffusion-1.5")
- **`size`** (string): Image dimensions, e.g., "512x512", "768x768" (default: "1024x1024")
- **`n`** (integer): Number of images to generate (default: 1)
- **`google_project_id`** (string): Override default project ID
- **`google_location`** (string): Override default region
- **`google_endpoint_id`** (string): Override default endpoint ID

Additional parameters (like `num_inference_steps`, `guidance_scale`, `negative_prompt`) can be passed and will be forwarded to your Vertex AI endpoint if supported by your model deployment.

### Response Format

```json
{
  "created": 1698765432,
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
    "request_ms": 3542,
    "user_balance_after": 9900,
    "user_api_key": "sk_test123...",
    "images_generated": 1
  }
}
```

**Note:** Google Vertex AI typically returns images as base64-encoded strings in `b64_json`. The `url` field will be `null`.

## Example Usage

### Using Python Requests

```python
import requests
import base64
from pathlib import Path

url = "https://your-gateway.com/v1/images/generations"
headers = {
    "Authorization": "Bearer your-api-key",
    "Content-Type": "application/json"
}

payload = {
    "prompt": "A futuristic cityscape at night, neon lights, cyberpunk",
    "model": "stable-diffusion-1.5",
    "size": "512x512",
    "n": 1,
    "provider": "google-vertex"
}

response = requests.post(url, headers=headers, json=payload)
result = response.json()

# Save the generated image
if result['data'][0]['b64_json']:
    image_data = base64.b64decode(result['data'][0]['b64_json'])
    Path("generated_image.png").write_bytes(image_data)
    print("Image saved to generated_image.png")
```

### Using the Test Script

A test script is provided at `test_google_vertex_endpoint.py`:

```bash
# Set your API key
export GATEWAY_API_KEY="your-api-key"
export GATEWAY_URL="http://localhost:8000"  # or your deployed URL

# Run the test
python test_google_vertex_endpoint.py
```

### Using cURL

```bash
curl -X POST https://your-gateway.com/v1/images/generations \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A serene mountain landscape at sunset",
    "model": "stable-diffusion-1.5",
    "size": "512x512",
    "n": 1,
    "provider": "google-vertex",
    "google_project_id": "gatewayz-468519",
    "google_location": "us-central1",
    "google_endpoint_id": "6072619212881264640"
  }'
```

## Advanced Configuration

### Custom Model Parameters

If your Vertex AI endpoint supports additional parameters, you can pass them in the request:

```json
{
  "prompt": "A futuristic robot",
  "provider": "google-vertex",
  "size": "512x512",
  "num_inference_steps": 50,
  "guidance_scale": 7.5,
  "negative_prompt": "blurry, low quality",
  "seed": 42
}
```

These parameters are passed directly to your Vertex AI endpoint's prediction API.

### Multiple Images

Generate multiple images in a single request:

```json
{
  "prompt": "Various mountain landscapes",
  "provider": "google-vertex",
  "n": 4,
  "size": "512x512"
}
```

**Note:** Each image costs 100 tokens, so generating 4 images will charge 400 tokens.

### Different Image Sizes

Stable Diffusion 1.5 typically works best with these sizes:
- **512x512** - Default, fastest
- **512x768** or **768x512** - Portrait/landscape
- **768x768** - Higher resolution (slower)

```json
{
  "prompt": "A detailed portrait",
  "provider": "google-vertex",
  "size": "512x768"
}
```

## Pricing

Image generation via Google Vertex AI costs:
- **100 tokens per image** in the AI Gateway
- Plus Google Cloud Vertex AI prediction costs (charged by Google)

Check your Google Cloud billing for Vertex AI prediction pricing.

## Troubleshooting

### Authentication Errors

**Error:** `Authentication failed` or `Permission denied`

**Solution:**
1. Verify `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account key
2. Ensure the service account has `Vertex AI User` role
3. Check that the project ID is correct

```bash
# Test authentication
gcloud auth application-default login
# Or use service account
gcloud auth activate-service-account --key-file=/path/to/key.json
```

### Endpoint Not Found

**Error:** `Endpoint not found` or `Invalid endpoint ID`

**Solution:**
1. Verify the endpoint exists and is deployed:
```bash
gcloud ai endpoints describe 6072619212881264640 \
  --project=gatewayz-468519 \
  --region=us-central1
```

2. Check the endpoint status is "DEPLOYED"
3. Verify the region matches your endpoint location

### Timeout Errors

**Error:** Request times out after 120 seconds

**Solution:**
- Image generation can be slow; consider increasing the timeout
- Check if your Vertex AI endpoint has sufficient resources allocated
- Try generating fewer images per request

### Invalid Instance Format

**Error:** `Invalid instance format` or `Prediction failed`

**Solution:**
- The instance format depends on your specific model deployment
- Check your model's expected input format in the Vertex AI console
- You may need to modify the `make_google_vertex_image_request` function to match your model's input schema

### Response Format Issues

If images aren't being decoded correctly, check your model's output format:

1. View a raw prediction response:
```python
from google.cloud import aiplatform

aiplatform.init(project="gatewayz-468519", location="us-central1")
endpoint = aiplatform.Endpoint("6072619212881264640")
response = endpoint.predict(instances=[{"prompt": "test"}])
print(response.predictions)
```

2. Update the response processing in `image_generation_client.py` if needed

## Reference Links

- [Google Cloud AI Platform Python Client Documentation](https://cloud.google.com/python/docs/reference/aiplatform/latest/index.html)
- [Vertex AI Prediction API](https://cloud.google.com/vertex-ai/docs/predictions/get-predictions)
- [Custom Model Prediction Sample](https://github.com/googleapis/python-aiplatform/blob/main/samples/snippets/prediction_service/predict_custom_trained_model_sample.py)
- [Stability AI Documentation](https://stability.ai/stable-diffusion)

## Support

For issues related to:
- **AI Gateway integration**: Open an issue in this repository
- **Google Cloud/Vertex AI**: Check [Google Cloud Support](https://cloud.google.com/support)
- **Stability Diffusion model**: Refer to [Stability AI documentation](https://stability.ai/stable-diffusion)
