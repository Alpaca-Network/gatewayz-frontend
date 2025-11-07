# Google Vertex AI End-to-End Integration Test

## Overview

`test_google_vertex_e2e.py` provides comprehensive end-to-end testing of Google Vertex AI integration with the Gatewayz API.

## What This Test Does

The test simulates a complete real-world workflow:

1. **User Creation** - Creates a test user with initial credits ($100)
2. **Credit Purchase** - Simulates purchasing additional credits ($50)
3. **Model Testing** - Calls ALL Google Gemini models available via Vertex AI:
   - Gemini 2.5 Flash
   - Gemini 2.5 Flash Lite
   - Gemini 2.5 Pro
   - Gemini 2.0 Flash (Experimental)
   - Gemini 2.0 Flash
   - Gemini 1.5 Pro
   - Gemini 1.5 Flash
   - Gemma 2 9B Instruct
   - Gemma 2 27B Instruct
4. **Response Validation** - Validates that responses come from live Vertex AI (not OpenRouter fallback)
5. **Cost Tracking** - Tracks and validates credit deductions for each API call
6. **Streaming Test** - Validates streaming support for models that support it

## Prerequisites

### 1. Google Cloud Setup

You need a Google Cloud project with Vertex AI enabled:

```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Verify your project
gcloud config get-value project
```

### 2. Service Account Credentials

Create a service account with Vertex AI permissions:

```bash
# Create service account
gcloud iam service-accounts create vertex-ai-gateway \
    --display-name="Vertex AI Gateway Service Account"

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:vertex-ai-gateway@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# Create and download key
gcloud iam service-accounts keys create vertex-ai-key.json \
    --iam-account=vertex-ai-gateway@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 3. Set Environment Variable

The test requires `GOOGLE_VERTEX_CREDENTIALS_JSON` to be set:

**Option A: Raw JSON**
```bash
export GOOGLE_VERTEX_CREDENTIALS_JSON='{"type":"service_account","project_id":"your-project",...}'
```

**Option B: Base64 Encoded** (recommended for deployment)
```bash
export GOOGLE_VERTEX_CREDENTIALS_JSON=$(cat vertex-ai-key.json | base64)
```

**Option C: From File**
```bash
export GOOGLE_VERTEX_CREDENTIALS_JSON=$(cat vertex-ai-key.json)
```

## Running the Tests

### Run All Vertex AI Tests

```bash
pytest tests/integration/test_google_vertex_e2e.py -v -s
```

### Run Specific Test Classes

```bash
# Run end-to-end flow tests only
pytest tests/integration/test_google_vertex_e2e.py::TestGoogleVertexE2E -v -s

# Run direct API call tests only
pytest tests/integration/test_google_vertex_e2e.py::TestVertexAIDirectCall -v -s
```

### Run Specific Tests

```bash
# Test credentials only
pytest tests/integration/test_google_vertex_e2e.py::TestGoogleVertexE2E::test_01_vertex_credentials_available -v -s

# Test all models
pytest tests/integration/test_google_vertex_e2e.py::TestGoogleVertexE2E::test_03_call_all_gemini_models -v -s

# Test streaming
pytest tests/integration/test_google_vertex_e2e.py::TestGoogleVertexE2E::test_04_verify_streaming_support -v -s
```

### Run with Detailed Logging

```bash
pytest tests/integration/test_google_vertex_e2e.py -v -s --log-cli-level=INFO
```

### Run Directly (Alternative)

```bash
python tests/integration/test_google_vertex_e2e.py
```

## Expected Output

When tests run successfully, you'll see output like:

```
============================================================
Testing: Gemini 2.5 Flash
Gateway Model ID: gemini-2.5-flash
Vertex Model ID: gemini-2.5-flash-preview-09-2025
============================================================
Response status: 200
✓ SUCCESS
  Response: Hello from Vertex AI
  Finish reason: stop
  Tokens: 12 input + 5 output = 17 total
  Cost: $0.000015 ($0.000009 input + $0.000006 output)
  Valid response: True

============================================================
TEST SUMMARY
============================================================
Total models tested: 9
Successful calls: 9
Failed calls: 0
Total cost: $0.000135
============================================================
```

## Test Validation

The tests validate:

✅ **Credentials**: Google Vertex credentials are properly configured
✅ **User Creation**: Test user is created with credits
✅ **Credit Purchase**: Credits can be added to user account
✅ **API Responses**: All Gemini models respond successfully
✅ **Response Quality**: Responses contain expected content
✅ **Cost Calculation**: Costs are calculated correctly
✅ **Streaming**: Models support streaming where advertised
✅ **Provider**: Responses come from Vertex AI (not fallback to OpenRouter)

## Skipping Tests

Tests are automatically skipped if:

- `GOOGLE_VERTEX_CREDENTIALS_JSON` is not set
- Google Cloud credentials are invalid
- Vertex AI API is not enabled

You'll see:

```
SKIPPED [1] test_google_vertex_e2e.py:25: GOOGLE_VERTEX_CREDENTIALS_JSON not set
```

## Troubleshooting

### Issue: "GOOGLE_VERTEX_CREDENTIALS_JSON not set"

**Solution**: Set the environment variable as described above.

### Issue: "Permission denied" or "403 Forbidden"

**Solution**: Ensure your service account has the `roles/aiplatform.user` role:

```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID \
    --flatten="bindings[].members" \
    --format="table(bindings.role)" \
    --filter="bindings.members:vertex-ai-gateway@*"
```

### Issue: "Model not found" or "404"

**Solution**: Some preview models may not be available in all regions. The test will report which models failed.

### Issue: "Quota exceeded"

**Solution**: Check your Vertex AI quotas:

```bash
gcloud alpha services quota list --service=aiplatform.googleapis.com
```

### Issue: "Invalid credentials format"

**Solution**: Verify JSON is properly formatted:

```bash
# Test JSON validity
echo $GOOGLE_VERTEX_CREDENTIALS_JSON | python -m json.tool
```

## Cost Considerations

**⚠️ Warning**: This test makes real API calls to Google Vertex AI which may incur costs.

Estimated costs per full test run:
- **Free tier models** (Gemini 2.0 Flash Exp): $0.00
- **Paid models**: ~$0.001 - $0.01 per test run
- **Total**: Usually under $0.05 per full test run

To minimize costs:
1. Use free preview models for development
2. Reduce `max_tokens` in test requests
3. Run specific tests instead of full suite
4. Monitor costs in Google Cloud Console

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Vertex AI Integration Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  vertex-ai-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run Vertex AI tests
        env:
          GOOGLE_VERTEX_CREDENTIALS_JSON: ${{ secrets.GOOGLE_VERTEX_CREDENTIALS_JSON }}
        run: |
          pytest tests/integration/test_google_vertex_e2e.py -v -s
```

### Railway/Vercel

Set `GOOGLE_VERTEX_CREDENTIALS_JSON` in environment variables section.

## Additional Resources

- [Google Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing)

## Support

For issues specific to:
- **Vertex AI API**: Check [Google Cloud Status](https://status.cloud.google.com/)
- **Gatewayz Integration**: Open an issue in the repository
- **Test Failures**: Check test logs with `-v -s --log-cli-level=DEBUG`

---

**Last Updated**: 2025-11-07
**Test Version**: 1.0.0
