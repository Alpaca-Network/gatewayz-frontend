# Google Vertex AI Setup - Quick Checklist

## 30-Minute Setup Checklist

Copy this to track your progress:

### Part 1: GCP Console Setup (10 min)
- [ ] Go to https://console.cloud.google.com/
- [ ] Create new project
- [ ] **Copy Project ID** → Write here: `___________________________`
- [ ] Enable "Vertex AI API"
- [ ] Set up billing account
- [ ] Verify billing is linked to project

### Part 2: Service Account (10 min)
- [ ] Go to IAM & Admin → Service Accounts
- [ ] Create service account: `gatewayz-vertex-ai`
- [ ] Grant role: "Vertex AI User"
- [ ] Create JSON key
- [ ] Download JSON file
- [ ] Move to: `.secrets/gcp-service-account.json`

### Part 3: Backend Config (5 min)
- [ ] Open `.env` file
- [ ] Set `GOOGLE_PROJECT_ID=` (your Project ID from above)
- [ ] Set `GOOGLE_VERTEX_LOCATION=us-central1`
- [ ] Set `GOOGLE_APPLICATION_CREDENTIALS=` (path to JSON file)
- [ ] Save `.env`

### Part 4: Test (5 min)
- [ ] Run: `python3 test_google_vertex_setup.py`
- [ ] All 4 tests pass ✅
- [ ] Can make API call successfully
- [ ] 10 models are listed

---

## Quick Command Reference

```bash
# 1. Create secrets directory
mkdir -p .secrets

# 2. Move downloaded JSON key
mv ~/Downloads/gatewayz-vertex-ai-*.json .secrets/gcp-service-account.json

# 3. Set permissions
chmod 600 .secrets/gcp-service-account.json

# 4. Test setup
python3 test_google_vertex_setup.py

# 5. Start backend
uvicorn src.main:app --reload
```

---

## .env Template

Copy this and fill in your values:

```bash
# Google Vertex AI
GOOGLE_PROJECT_ID=YOUR_PROJECT_ID_HERE
GOOGLE_VERTEX_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/Users/arminrad/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Alpaca-Network/Gatewayz/gatewayz-backend/.secrets/gcp-service-account.json
```

---

## Verification

✅ **Setup is complete when:**
- Test script shows all 4 tests passing
- You can see "Hello to you!" response
- 10 models are listed
- No error messages

❌ **Setup needs fixing if:**
- Any test shows ❌ FAIL
- You see 403/404/401 errors
- No models are listed
- Credentials can't be loaded
