# Google Vertex AI Setup Guide - Complete Walkthrough

## Overview
This guide walks you through setting up Google Vertex AI to enable Gemini models in your backend.

**Time Required:** ~30 minutes
**Cost:** Free tier available (first 30K requests/month free)

---

## Prerequisites
- Google account
- Credit card (for GCP billing verification - won't be charged on free tier)
- Terminal access to your backend

---

## Part 1: Google Cloud Platform Setup (10 minutes)

### Step 1: Access Google Cloud Console
1. Go to https://console.cloud.google.com/
2. Sign in with your Google account
3. Accept Terms of Service if prompted

### Step 2: Create a New Project
1. Click the project dropdown at the top (says "Select a project")
2. Click "NEW PROJECT" button
3. Fill in:
   - **Project name:** `gatewayz-ai-backend` (or your preferred name)
   - **Organization:** Leave as "No organization" (unless you have one)
   - **Location:** Leave as default
4. Click "CREATE"
5. **IMPORTANT:** Copy the **Project ID** (shown below project name)
   - Example: `gatewayz-ai-backend-123456`
   - ⚠️ This is NOT the same as project name!
   - You'll need this for your `.env` file

### Step 3: Enable Vertex AI API
1. In the search bar at top, type: `Vertex AI API`
2. Click on "Vertex AI API" in results
3. Click the blue "ENABLE" button
4. Wait 1-2 minutes for activation
5. You should see "API enabled" message

### Step 4: Set Up Billing (Required)
1. Click hamburger menu (≡) → "Billing"
2. Click "LINK A BILLING ACCOUNT"
3. Either:
   - Select existing billing account
   - Or create new: "CREATE BILLING ACCOUNT"
4. Add payment method (credit card)
5. ⚠️ **Don't worry:** You won't be charged unless you exceed free tier
6. Free tier: 30,000 requests/month to Gemini models

**Verify billing is active:**
- Go to "Billing" page
- You should see your project listed under "My Projects"

---

## Part 2: Create Service Account (10 minutes)

### Step 1: Navigate to Service Accounts
1. Click hamburger menu (≡) → "IAM & Admin" → "Service Accounts"
2. OR use search: type "Service Accounts" and select it

### Step 2: Create Service Account
1. Click "+ CREATE SERVICE ACCOUNT" button
2. Fill in:
   - **Service account name:** `gatewayz-vertex-ai`
   - **Service account ID:** (auto-fills, looks like `gatewayz-vertex-ai@your-project.iam.gserviceaccount.com`)
   - **Description:** `Backend service for accessing Vertex AI models`
3. Click "CREATE AND CONTINUE"

### Step 3: Grant Permissions
1. In "Grant this service account access to project":
2. Click "Select a role" dropdown
3. Search for: `Vertex AI User`
4. Select: **Vertex AI User** (`roles/aiplatform.user`)
5. Click "CONTINUE"
6. Skip the optional "Grant users access" section
7. Click "DONE"

### Step 4: Create JSON Key
1. Find your service account in the list (`gatewayz-vertex-ai@...`)
2. Click the 3 dots (⋮) on the right side
3. Select "Manage keys"
4. Click "ADD KEY" → "Create new key"
5. Select format: **JSON**
6. Click "CREATE"
7. A file downloads automatically: `gatewayz-vertex-ai-xxxxx.json`
8. **⚠️ IMPORTANT:** This file is your authentication - keep it secure!

---

## Part 3: Configure Your Backend (5 minutes)

### Step 1: Create Secrets Directory
```bash
cd "/Users/arminrad/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Alpaca-Network/Gatewayz/gatewayz-backend"

# Create directory for secrets
mkdir -p .secrets
```

### Step 2: Move JSON Key File
```bash
# Move the downloaded file to your project
# Replace 'xxxxx' with your actual filename
mv ~/Downloads/gatewayz-vertex-ai-xxxxx.json .secrets/gcp-service-account.json
```

### Step 3: Update `.env` File
Open your `.env` file and update these lines (already added at the bottom):

```bash
# Replace 'your-project-id-here' with YOUR actual Project ID from Step 2.2
GOOGLE_PROJECT_ID=gatewayz-ai-backend-123456

# Choose your region (default is fine for most cases)
GOOGLE_VERTEX_LOCATION=us-central1

# Path should match where you saved the JSON file
GOOGLE_APPLICATION_CREDENTIALS=/Users/arminrad/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Alpaca-Network/Gatewayz/gatewayz-backend/.secrets/gcp-service-account.json
```

**Available Regions:**
- `us-central1` - Iowa (default, recommended)
- `us-east1` - South Carolina
- `us-west1` - Oregon
- `europe-west1` - Belgium
- `asia-east1` - Taiwan

### Step 4: Verify Permissions
```bash
# Make sure the JSON file is readable
chmod 600 .secrets/gcp-service-account.json
```

---

## Part 4: Test Your Setup (5 minutes)

### Run the Test Script
```bash
cd "/Users/arminrad/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Alpaca-Network/Gatewayz/gatewayz-backend"

# Activate your virtual environment first
source .venv/bin/activate  # or: source venv/bin/activate

# Run the test
python3 test_google_vertex_setup.py
```

### Expected Output
```
================================================================================
  Google Vertex AI Setup Test
================================================================================

================================================================================
  Step 1: Checking Environment Variables
================================================================================
✅ GOOGLE_PROJECT_ID: gatewayz-ai-backend-123456
✅ GOOGLE_VERTEX_LOCATION: us-central1
✅ GOOGLE_APPLICATION_CREDENTIALS: .secrets/gcp-service-account.json (file exists)

================================================================================
  Step 2: Testing Credential Loading
================================================================================
Attempting to load credentials...
✅ Credentials loaded successfully!
   Type: Credentials
   Valid: True

================================================================================
  Step 3: Testing Vertex AI API Call
================================================================================
Making test request to gemini-2.0-flash...
Prompt: 'Say hello in exactly 3 words'

✅ API call successful!
   Model: gemini-2.0-flash
   Response: Hello to you!
   Tokens used: 15
   Finish reason: stop

================================================================================
  Step 4: Listing Available Models
================================================================================
Fetching models from Google Vertex AI...

✅ Found 10 models:
    1. gemini-2.5-flash                        - Gemini 2.5 Flash
    2. gemini-2.5-flash-lite                   - Gemini 2.5 Flash Lite (GA)
    3. gemini-2.5-flash-lite-preview-09-2025   - Gemini 2.5 Flash Lite Preview
    4. gemini-2.5-pro                          - Gemini 2.5 Pro
    5. gemini-2.0-flash                        - Gemini 2.0 Flash
    6. gemini-2.0-flash-thinking               - Gemini 2.0 Flash Thinking
    7. gemini-2.0-pro                          - Gemini 2.0 Pro
    8. gemini-1.5-pro                          - Gemini 1.5 Pro
    9. gemini-1.5-flash                        - Gemini 1.5 Flash
   10. gemini-1.0-pro                          - Gemini 1.0 Pro

================================================================================
  Summary
================================================================================
  ✅ PASS  ENV
  ✅ PASS  CREDS
  ✅ PASS  API
  ✅ PASS  MODELS

🎉 All tests passed! Google Vertex AI is configured correctly.
   You can now use Gemini models in your backend.
```

---

## Troubleshooting

### Error: "Permission denied" or "403 Forbidden"
**Cause:** Service account doesn't have proper permissions

**Fix:**
1. Go to GCP Console → IAM & Admin → IAM
2. Find your service account
3. Click edit (pencil icon)
4. Add role: "Vertex AI User"
5. Save

### Error: "404 Not Found" or "Model not available"
**Cause:** Model not available in your region or project

**Fix:**
1. Check that Vertex AI API is enabled
2. Try a different region (e.g., change from `europe-west1` to `us-central1`)
3. Some preview models may not be in all regions

### Error: "Credentials not found" or "Authentication failed"
**Cause:** JSON key file path is wrong

**Fix:**
1. Check the file exists:
   ```bash
   ls -la .secrets/gcp-service-account.json
   ```
2. Verify the path in `.env` matches exactly
3. Make sure path is absolute, not relative

### Error: "Billing not enabled"
**Cause:** Project doesn't have billing configured

**Fix:**
1. Go to GCP Console → Billing
2. Link a billing account to your project
3. Wait 5-10 minutes for billing to activate

### Error: "Invalid JSON" or "Cannot parse credentials"
**Cause:** JSON file is corrupted or incomplete

**Fix:**
1. Download a fresh JSON key from GCP Console
2. Make sure the entire file downloaded (should be ~2-3 KB)
3. Verify file contents look like valid JSON:
   ```bash
   head .secrets/gcp-service-account.json
   ```

---

## What You Get

After setup, you'll have access to **10 Gemini models**:

### Latest Models (Recommended)
- `gemini-2.5-flash` - Fastest, most capable
- `gemini-2.5-flash-lite` - Lightweight, high-throughput
- `gemini-2.5-pro` - Best reasoning and complex tasks

### Specialized Models
- `gemini-2.0-flash-thinking` - Extended reasoning
- `gemini-2.0-flash` - Fast real-time applications
- `gemini-2.0-pro` - Advanced reasoning

### Older Models (Still Available)
- `gemini-1.5-pro` - Reliable workhorse
- `gemini-1.5-flash` - Fast and efficient
- `gemini-1.0-pro` - Legacy support

---

## Costs (Free Tier)

**Free quota per month:**
- 30,000 requests to Gemini models
- ~1M tokens (input + output combined)

**After free tier:**
- Gemini 2.0 Flash: $0.10 per 1M input tokens, $0.40 per 1M output
- Gemini 1.5 Flash: $0.075 per 1M input tokens, $0.30 per 1M output
- Gemini 1.5 Pro: $1.25 per 1M input tokens, $5.00 per 1M output

**Example cost:**
- 10,000 requests × 100 tokens each = 1M tokens
- Cost: ~$0.50 (well within free tier)

---

## Security Best Practices

### DO:
✅ Keep JSON key file in `.secrets/` directory (gitignored)
✅ Use service account with minimal permissions (only Vertex AI User)
✅ Rotate keys periodically (every 90 days)
✅ Monitor usage in GCP Console

### DON'T:
❌ Commit JSON key to git (already in `.gitignore`)
❌ Share key file with others
❌ Use personal account credentials
❌ Grant more permissions than needed

---

## Deployment (Production)

### For Vercel/Serverless:
Use base64-encoded credentials instead of file path:

```bash
# Encode your JSON key
cat .secrets/gcp-service-account.json | base64 > credentials.txt

# Add to Vercel environment variables
# Variable name: GOOGLE_VERTEX_CREDENTIALS_JSON
# Value: [paste contents of credentials.txt]
```

Then in `.env`:
```bash
# Comment out file path
# GOOGLE_APPLICATION_CREDENTIALS=...

# Use base64 instead
GOOGLE_VERTEX_CREDENTIALS_JSON=eyJhbGci...
```

---

## Next Steps

1. ✅ Run test script: `python3 test_google_vertex_setup.py`
2. ✅ Start your backend: `uvicorn src.main:app --reload`
3. ✅ Test a Gemini model via your API
4. ✅ Monitor usage in GCP Console: https://console.cloud.google.com/vertex-ai/

---

## Support

If you get stuck:
1. Check the troubleshooting section above
2. Review GCP logs: https://console.cloud.google.com/logs
3. Check Vertex AI quota: https://console.cloud.google.com/iam-admin/quotas

**Common Issues:**
- 90% of problems are billing or permissions
- Check API is enabled in GCP
- Verify service account has "Vertex AI User" role
