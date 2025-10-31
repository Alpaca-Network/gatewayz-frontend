# Environment Variables Setup Guide

## Overview

This guide explains how to configure environment variables for the Gatewayz backend in different environments.

## Local Development

### 1. Copy the example file

```bash
cp .env.example .env
```

### 2. Required Variables

Add these required variables to your `.env` file:

```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# OpenRouter (Required)
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 3. Optional Provider Keys

Add these optional provider keys to enable additional model catalogs:

```bash
# Portkey Integration
PORTKEY_API_KEY=your-portkey-api-key

# Featherless.ai Integration (6,382 models)
FEATHERLESS_API_KEY=your-featherless-api-key

# Chutes.ai Integration (104 models)
CHUTES_API_KEY=your-chutes-api-key
```

### 4. Optional Provider-Specific Keys

```bash
# For use with Portkey routing
PROVIDER_OPENAI_API_KEY=sk-...
PROVIDER_ANTHROPIC_API_KEY=sk-ant-...

# DeepInfra direct access
DEEPINFRA_API_KEY=your-deepinfra-key
```

## Production Deployment

### Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `SUPABASE_URL` | Your Supabase URL | All |
| `SUPABASE_KEY` | Your Supabase key | All |
| `OPENROUTER_API_KEY` | Your OpenRouter key | All |
| `FEATHERLESS_API_KEY` | Your Featherless key | All |
| `CHUTES_API_KEY` | Your Chutes key | All |
| `PORTKEY_API_KEY` | Your Portkey key | All |

4. Redeploy your application

```bash
vercel --prod
```

### Railway

1. Open your Railway project
2. Go to **Variables** tab
3. Add environment variables
4. Redeploy

### Render

1. Go to your Render service dashboard
2. Navigate to **Environment**
3. Add environment variables
4. Trigger manual deploy

### Docker

Add environment variables to your docker-compose.yml:

```yaml
services:
  api:
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - FEATHERLESS_API_KEY=${FEATHERLESS_API_KEY}
      - CHUTES_API_KEY=${CHUTES_API_KEY}
      - PORTKEY_API_KEY=${PORTKEY_API_KEY}
```

## Getting API Keys

### Featherless.ai

1. Visit [featherless.ai](https://featherless.ai)
2. Sign up for an account
3. Navigate to API settings
4. Generate a new API key
5. Add to your environment: `FEATHERLESS_API_KEY=rc_...`

**Models Available:** 6,382 models

### Chutes.ai

1. Visit [chutes.ai](https://chutes.ai)
2. Create an account
3. Get your API key from the dashboard
4. Add to your environment: `CHUTES_API_KEY=cpk_...`

**Models Available:** 104 models (static catalog)

### Portkey

1. Visit [portkey.ai](https://portkey.ai)
2. Sign up and verify email
3. Create a new API key
4. Add to your environment: `PORTKEY_API_KEY=...`

### OpenRouter

1. Visit [openrouter.ai](https://openrouter.ai)
2. Create an account
3. Generate an API key
4. Add to your environment: `OPENROUTER_API_KEY=sk-or-v1-...`

## Verifying Configuration

### Test All Providers Locally

```bash
# Test Featherless
python3 test_featherless_endpoint.py

# Test Chutes
python3 test_chutes_integration.py

# Start server and test endpoints
uvicorn src.main:app --reload

# In another terminal:
curl "http://localhost:8000/models?gateway=all&limit=10"
```

### Expected Results

| Provider | Models | Requires API Key |
|----------|--------|------------------|
| OpenRouter | ~200+ | Yes (required) |
| Portkey | Variable | Yes |
| Featherless | 6,382 | Yes |
| Chutes | 104 | No (static catalog) |

## Troubleshooting

### Featherless Returns 0 Models

**Problem:** `/models?gateway=featherless` returns empty data

**Solution:**
1. Verify `FEATHERLESS_API_KEY` is set in production environment
2. Check API key is valid: `echo $FEATHERLESS_API_KEY`
3. Test locally: `python3 test_featherless_endpoint.py`
4. Restart your server/redeploy

### Chutes Returns 0 Models

**Problem:** `/models?gateway=chutes` returns empty data

**Solution:**
1. Verify static catalog exists: `ls src/data/chutes_catalog.json`
2. Check file permissions
3. Review logs for errors during startup

### API Key Not Loading

**Problem:** Environment variables not available in the app

**Solutions:**

**Local Development:**
```bash
# Ensure .env file exists
ls -la .env

# Load manually
source .env
python3 src/main.py
```

**Production (Vercel):**
```bash
# Check environment variables
vercel env ls

# Pull production env to local
vercel env pull .env.production
```

## Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use different keys** for development and production
3. **Rotate keys regularly** - Especially if exposed
4. **Restrict API key permissions** when possible
5. **Monitor API usage** to detect unauthorized access

## Environment Variable Reference

### Complete List

```bash
# ============= REQUIRED =============
SUPABASE_URL=
SUPABASE_KEY=
OPENROUTER_API_KEY=

# ============= OPTIONAL - SITE INFO =============
OPENROUTER_SITE_URL=
OPENROUTER_SITE_NAME=

# ============= OPTIONAL - PROVIDERS =============
PORTKEY_API_KEY=
FEATHERLESS_API_KEY=
CHUTES_API_KEY=

# ============= OPTIONAL - PROVIDER KEYS =============
PROVIDER_OPENAI_API_KEY=
PROVIDER_ANTHROPIC_API_KEY=
DEEPINFRA_API_KEY=

# ============= OPTIONAL - ADMIN =============
ADMIN_API_KEY=
 
# ============= OPTIONAL - API KEY ENCRYPTION =============
# App works without these (falls back safely). Set to enable encryption at rest.
# Current key version used for new encryptions
KEY_VERSION=1

# Keyring entries: one per version. Generate with Python:
#   from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())
KEYRING_1=

# Optional salt for deterministic key hashing (used for lookups/rate limits)
KEY_HASH_SALT=
```

## Support

If you encounter issues:
1. Check logs: `tail -f uvicorn_test.log`
2. Verify API keys are valid
3. Test endpoints: `curl http://localhost:8000/health`
4. Review deployment platform logs

---

**Last Updated:** 2025-10-29
