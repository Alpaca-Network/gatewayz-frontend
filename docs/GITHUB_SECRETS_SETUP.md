# GitHub Secrets Setup for CI/CD Tests

To fix the failing tests in GitHub Actions, you need to add the following secrets to your repository.

## How to Add GitHub Secrets

1. Go to your repository on GitHub: https://github.com/Alpaca-Network/gatewayz-backend
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret below

## Required Secrets

### Database & Backend Services

| Secret Name | Value | Source |
|-------------|-------|--------|
| `SUPABASE_URL` | `https://poxomztzvdkxxpqotybo.supabase.co` | From your `.env` file |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Your Supabase anon/service key |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | Your OpenRouter API key |
| `PORTKEY_API_KEY` | `pk-...` or `dummy-not-needed-for-openrouter` | Optional for tests |
| `RESEND_API_KEY` | `re_...` | Your Resend API key (optional) |
| `ENCRYPTION_KEY` | Random 32-byte string | For encrypting API keys |
| `ADMIN_API_KEY` | Random secure string | For admin endpoints |

## Quick Copy-Paste Values

Based on your `.env` file:

```bash
# Copy these values to GitHub Secrets
SUPABASE_URL=https://poxomztzvdkxxpqotybo.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveG9tenR6dmRreHhwcW90eWJvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzg0MjgxMSwiZXhwIjoyMDY5NDE4ODExfQ.gD-GMFzLLbNvhy89OVdy0Klx36sS-1P10ZlgL2WENIo
OPENROUTER_API_KEY=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
PORTKEY_API_KEY=dummy-not-needed-for-openrouter
RESEND_API_KEY=re_8nSfCD6U_B5AqufQerhUJMi2ckUtXRefs
ENCRYPTION_KEY=test-encryption-key-32-bytes-long!
ADMIN_API_KEY=gjrxRyE-JjXwj8vR2HRTCwJ33fc5FmoDbJfRD_52UhQ
```

## After Adding Secrets

1. The GitHub Actions workflow will automatically use these secrets
2. Re-run the failed workflow:
   - Go to **Actions** tab
   - Click on the failed workflow run
   - Click **Re-run all jobs**

## Security Notes

- ✅ GitHub Secrets are encrypted and never exposed in logs
- ✅ Only use test/development credentials in CI (don't use production keys)
- ✅ Consider creating a separate Supabase project for testing
- ⚠️ The values above are from your `.env` - make sure they're safe to use in CI

## Test Locally

To verify tests pass with these credentials:

```bash
# Set environment variables from .env
export $(cat .env | xargs)

# Run tests
pytest tests/ -v
```

## Alternative: Use Test Database

For better isolation, create a separate Supabase project for CI/CD:

1. Create new project at https://supabase.com
2. Use that project's URL and key for `SUPABASE_URL` and `SUPABASE_KEY`
3. This keeps test data separate from production
