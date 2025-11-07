# Google Models Fix - Quick Guide

## Problem
Google models return "No Response Received" because credentials are missing from `.env` file.

## Root Cause
All Google configuration is missing:
- ❌ GOOGLE_API_KEY (not set)
- ❌ GOOGLE_PROJECT_ID (using hardcoded default that's not yours)
- ❌ GOOGLE_VERTEX_LOCATION (using default)
- ❌ GOOGLE_APPLICATION_CREDENTIALS (not set)

## Quick Fix Options

### Option 1: Get Google API Key (5 minutes)
```bash
# 1. Go to https://aistudio.google.com/app/apikey
# 2. Create an API key
# 3. Add to .env:

GOOGLE_API_KEY=AIzaSy...your-key-here
```

### Option 2: Full Vertex AI Setup (30 minutes)
```bash
# 1. Set up GCP project at https://console.cloud.google.com
# 2. Enable Vertex AI API
# 3. Create service account with Vertex AI User role
# 4. Download JSON key
# 5. Add to .env:

GOOGLE_PROJECT_ID=your-project-id
GOOGLE_VERTEX_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Option 3: Disable Google Models
Just remove the hardcoded defaults from `src/config/config.py:86-88` and let Google models gracefully fail.

## Test After Fix
```bash
# Test the credentials work
python3 test_production_vertex.sh
```

## Priority
- If <5% of requests use Google: Skip fixing
- If >5% of requests use Google: Get API key (Option 1)
- If business-critical: Full setup (Option 2)
