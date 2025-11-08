# Google Vertex AI Setup Guide

This guide explains how to configure Google Vertex AI credentials for the Gatewayz API.

## Overview

Google Vertex AI integration allows you to use Google's Gemini models through the Gatewayz API. When credentials are properly configured, `google/gemini-*` model requests will be routed directly to Google Vertex AI. Without credentials, these requests fall back to OpenRouter.

## Prerequisites

1. A Google Cloud Platform (GCP) project with Vertex AI API enabled
2. A service account with appropriate permissions
3. Service account JSON key file

## Setup Steps

### 1. Create a GCP Project (if you don't have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID (e.g., `gatewayz-468519`)

### 2. Enable Vertex AI API

```bash
gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT_ID
```

Or enable it through the [GCP Console](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com).

### 3. Create a Service Account

1. Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click "Create Service Account"
3. Name it (e.g., `gatewayz-vertex-ai`)
4. Grant the following role:
   - **Vertex AI User** (`roles/aiplatform.user`)
5. Click "Done"

### 4. Create and Download Service Account Key

1. Click on your service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose JSON format
5. Download the JSON file (keep it secure!)

### 5. Configure Environment Variables

You have two options for providing credentials:

#### Option A: JSON String (Recommended for serverless/Vercel)

Set the entire JSON content as an environment variable:

```bash
export GOOGLE_VERTEX_CREDENTIALS_JSON='{"type":"service_account","project_id":"your-project",...}'
```

For serverless deployments, you can also base64-encode the JSON:

```bash
export GOOGLE_VERTEX_CREDENTIALS_JSON=$(cat service-account-key.json | base64)
```

#### Option B: File Path (Recommended for local development)

Set the path to your downloaded JSON key file:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### 6. Set Additional Configuration

Set your GCP project ID and preferred region:

```bash
export GOOGLE_PROJECT_ID=your-project-id
export GOOGLE_VERTEX_LOCATION=us-central1  # or your preferred region
```

**Default values:**
- `GOOGLE_PROJECT_ID`: `gatewayz-468519`
- `GOOGLE_VERTEX_LOCATION`: `us-central1`

## Environment Variables Reference

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `GOOGLE_VERTEX_CREDENTIALS_JSON` | Yes* | Service account JSON (raw or base64) | None |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to service account JSON file | None |
| `GOOGLE_PROJECT_ID` | No | GCP project ID | `gatewayz-468519` |
| `GOOGLE_VERTEX_LOCATION` | No | GCP region | `us-central1` |

\* You must set **either** `GOOGLE_VERTEX_CREDENTIALS_JSON` **or** `GOOGLE_APPLICATION_CREDENTIALS`.

## Testing Your Setup

### Option 1: Using the Diagnostic Script

Run the built-in diagnostic script:

```bash
python debug_vertex_connection.py
```

This will:
1. ✅ Check all environment variables
2. ✅ Test credential loading
3. ✅ Test access token generation
4. ✅ Make a test API call to Vertex AI
5. ✅ Verify provider routing

### Option 2: Using the Direct Test Script

Run the direct Vertex AI test:

```bash
python test_vertex_direct.py
```

This makes a raw API call to Vertex AI to verify credentials work.

### Option 3: Manual API Test

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "google/gemini-2.0-flash",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Routing Behavior

| Scenario | Routing Decision |
|----------|------------------|
| Credentials configured + `google/gemini-*` model | ✅ Routes to Google Vertex AI |
| No credentials + `google/gemini-*` model | ⚠️ Routes to OpenRouter (fallback) |
| Credentials configured + `gemini-*` model (no prefix) | ✅ Routes to Google Vertex AI |
| No credentials + `gemini-*` model (no prefix) | ✅ Routes to Google Vertex AI |

**Note:** Model IDs starting with `google/` will route to OpenRouter if Vertex credentials are not available, allowing users to still access Gemini models through OpenRouter.

## Supported Models

When using Google Vertex AI, the following Gemini models are supported:

- `google/gemini-2.5-flash-lite-preview-09-2025`
- `google/gemini-2.5-flash-preview-09-2025`
- `google/gemini-2.5-pro-preview-09-2025`
- `google/gemini-2.0-flash`
- `google/gemini-2.0-flash-001`
- `google/gemini-2.0-pro`
- `google/gemini-1.5-pro`
- `google/gemini-1.5-flash`
- `google/gemini-1.0-pro`

You can also use the shorter versions without the `google/` prefix:
- `gemini-2.0-flash`
- `gemini-1.5-pro`
- etc.

## Troubleshooting

### Error: "No Google credentials configured"

**Solution:** Set either `GOOGLE_VERTEX_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`.

### Error: "401 Unauthorized"

**Causes:**
1. Service account credentials are invalid or expired
2. Credentials file is corrupted
3. JSON is not properly formatted

**Solution:**
- Verify your JSON key file is valid
- Try creating a new service account key
- Check that the JSON is not corrupted (try parsing it with `jq` or `json.loads()`)

### Error: "403 Forbidden / Permission Denied"

**Causes:**
1. Service account lacks the "Vertex AI User" role
2. Vertex AI API is not enabled
3. Service account is not authorized for the project

**Solution:**
1. Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam)
2. Find your service account
3. Add the **Vertex AI User** role (`roles/aiplatform.user`)
4. Ensure Vertex AI API is enabled in your project

### Error: "404 Not Found"

**Causes:**
1. Vertex AI API is not enabled
2. Model is not available in the selected region
3. Project ID or region is incorrect
4. Model name format is invalid

**Solution:**
- Verify `GOOGLE_PROJECT_ID` is correct
- Verify `GOOGLE_VERTEX_LOCATION` is correct
- Try a different region (some models are region-specific)
- Enable Vertex AI API: `gcloud services enable aiplatform.googleapis.com`

### Error: "Received id_token instead of access_token"

**Cause:** Credential configuration issue with scope or credential type.

**Solution:**
- Ensure you're using a **service account** key (not OAuth client)
- The service account JSON must have these fields:
  - `type: "service_account"`
  - `private_key`
  - `client_email`
- Try creating a new service account key

### Models routing to HuggingFace instead of Vertex AI

**Cause:** Provider detection logic not running correctly.

**Solution:** This was fixed in commit `c05145a`. Make sure you have the latest version of the code.

## Security Best Practices

1. **Never commit credentials to version control**
   - Add `*.json` to `.gitignore`
   - Use environment variables or secrets managers

2. **Rotate keys regularly**
   - Create new service account keys periodically
   - Delete old keys after rotation

3. **Use principle of least privilege**
   - Only grant "Vertex AI User" role (not broader roles like "Owner")
   - Create separate service accounts for different environments

4. **For production deployments:**
   - Use Vercel/Railway environment variables UI
   - Or use secrets managers (Google Secret Manager, AWS Secrets Manager, etc.)
   - Enable VPC Service Controls for additional security

## Additional Resources

- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing)
- [Gemini API Reference](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)

## Support

If you encounter issues:
1. Run the diagnostic script: `python debug_vertex_connection.py`
2. Check the logs for detailed error messages
3. Verify all environment variables are set correctly
4. Ensure IAM permissions are configured properly

---

**Last Updated:** 2025-11-08
