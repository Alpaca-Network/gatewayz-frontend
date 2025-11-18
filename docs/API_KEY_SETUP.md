# API Key Setup & Configuration Guide

## Overview

This guide explains how to configure API key security for the Gatewayz backend. The system requires encryption configuration to securely create and store API keys.

## Problem: "Unable to Create API Keys"

If you're unable to create API keys and seeing errors related to `KEY_HASH_SALT`, this guide will help you fix the issue.

### Root Cause

The system has a **unique constraint** on the `key_hash` column to prevent duplicate API keys. When `KEY_HASH_SALT` is not configured:

1. The hash generation fails silently
2. `key_hash` is set to `NULL`
3. First API key creation succeeds (with `key_hash = NULL`)
4. **Second** API key creation fails because `NULL` is not unique

**Error you might see:**
```
ERROR: duplicate key value violates unique constraint "api_keys_new_key_hash_key"
DETAIL: Key (key_hash)=(NULL) already exists.
```

## Quick Fix: Automated Setup

### Option 1: Run the Setup Script (Recommended)

```bash
# Generate encryption keys and update .env
python scripts/setup_encryption_keys.py --output .env

# Restart your server
uvicorn src.main:app --reload
```

The script will:
- Generate a secure `KEY_HASH_SALT`
- Generate a `KEYRING_1` Fernet encryption key
- Write them to your `.env` file
- Show next steps

### Option 2: Manual Setup

#### Step 1: Generate KEY_HASH_SALT

```bash
python -c "import secrets; print('KEY_HASH_SALT=' + secrets.token_hex(32))"
```

Example output:
```
KEY_HASH_SALT=a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
```

#### Step 2: (Optional) Generate KEYRING_1 for Encryption

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Example output:
```
KEYRING_1=gAAAAABl_wZ8u...base64_encoded_key...==
```

#### Step 3: Add to .env

Add these lines to your `.env` file:

```bash
# API Key Security Configuration
KEY_HASH_SALT=a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
KEY_VERSION=1
KEYRING_1=gAAAAABl_wZ8u...base64_encoded_key...==
```

#### Step 4: Restart Your Application

```bash
# For local development
uvicorn src.main:app --reload

# For Docker
docker-compose up --build

# For Railway
git push origin your-branch
```

#### Step 5: Test API Key Creation

```bash
curl -X POST http://localhost:8000/user/api-keys \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "key_name": "test-key",
    "environment_tag": "test"
  }'
```

## Environment Variables Reference

### Required Variables

| Variable | Purpose | How to Generate | Example |
|----------|---------|-----------------|---------|
| `KEY_HASH_SALT` | Hashing salt for API key lookup | `secrets.token_hex(32)` | `a3f2b8c1...` |

### Optional Variables

| Variable | Purpose | How to Generate | Example |
|----------|---------|-----------------|---------|
| `KEY_VERSION` | Current encryption key version | Set to `1` | `1` |
| `KEYRING_1` | Fernet encryption key for v1 | `Fernet.generate_key().decode()` | `gAAAAABl_wZ8u...` |
| `KEYRING_2` | (For key rotation) Fernet key for v2 | `Fernet.generate_key().decode()` | `gAAAAABl_wZ8v...` |

## Key Configuration Details

### KEY_HASH_SALT

**Required**: Yes (for API key creation to work)
**Purpose**: Deterministic SHA-256 hashing for API key lookups
**Requirements**:
- Minimum 16 characters
- Should be cryptographically random (32+ characters recommended)

**Generation**:
```python
import secrets
salt = secrets.token_hex(32)  # 64-character hex string
print(f"KEY_HASH_SALT={salt}")
```

**Storage**: Add to `.env` and production environment variables

### KEY_VERSION & KEYRING_N

**Required**: No (optional, for enhanced security)
**Purpose**: Fernet (AES-128) encryption for at-rest API key storage
**How it works**:
- `KEY_VERSION=1` tells the system which encryption key to use
- `KEYRING_1=<key>` contains the actual Fernet key
- Multiple keys allow gradual key rotation

**Generation**:
```python
from cryptography.fernet import Fernet
key = Fernet.generate_key().decode()
print(f"KEYRING_1={key}")
```

**Key Rotation Example** (add new key gradually):
```bash
KEY_VERSION=1          # Current version
KEYRING_1=<old_key>   # Old key (keep for decryption)
KEYRING_2=<new_key>   # New key (used for new encryptions)
# Then later: KEY_VERSION=2 (after all keys are re-encrypted)
```

## Environment-Specific Setup

### Local Development

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Run the setup script:
   ```bash
   python scripts/setup_encryption_keys.py --output .env
   ```

3. Start the server:
   ```bash
   uvicorn src.main:app --reload
   ```

### Vercel

1. Generate keys locally:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

2. Add to Vercel environment:
   - Go to **Settings** → **Environment Variables**
   - Add `KEY_HASH_SALT` with generated value
   - Add `KEY_VERSION=1`
   - (Optional) Add `KEYRING_1` if using encryption

3. Redeploy:
   ```bash
   vercel --prod
   ```

### Railway

1. Generate keys (from your local machine):
   ```bash
   python scripts/setup_encryption_keys.py
   ```

2. Add to Railway:
   - Open your Railway project
   - Go to **Variables** tab
   - Add the variables
   - Redeploy automatically or manually

### Docker / Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  api:
    environment:
      - KEY_HASH_SALT=${KEY_HASH_SALT}
      - KEY_VERSION=${KEY_VERSION}
      - KEYRING_1=${KEYRING_1}
```

Or set them directly in the container:

```bash
docker run -e KEY_HASH_SALT=<value> -e KEY_VERSION=1 gatewayz-api
```

## Troubleshooting

### Error: "KEY_HASH_SALT must be configured"

**Problem**: You're seeing this error when trying to create an API key

**Solution**:
1. Generate the salt: `python -c "import secrets; print(secrets.token_hex(32))"`
2. Add it to `.env` or production environment
3. Restart your application

### Error: "duplicate key value violates unique constraint"

**Problem**: You've already created one API key with `KEY_HASH_SALT` missing

**Solution**:
1. Set up `KEY_HASH_SALT` (see above)
2. Delete the old key from the database:
   ```sql
   DELETE FROM api_keys_new WHERE key_hash IS NULL;
   ```
3. Restart the app and try creating a new key

### Error: "Cryptography library not available"

**Problem**: `cryptography` package not installed

**Solution**:
```bash
pip install cryptography
python scripts/setup_encryption_keys.py --output .env
```

### API keys work but not encrypted

**Problem**: API keys are being created but `encrypted_key` is `NULL` in the database

**Explanation**: This is normal if `KEYRING_1` is not set. Keys are still secure because they use `KEY_HASH_SALT` for lookups.

**To enable encryption**:
1. Generate `KEYRING_1`:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
2. Add to `.env` or production environment
3. Restart the app
4. New API keys will be encrypted

## Security Best Practices

1. **Generate cryptographically random values**: Use `secrets` module, not random strings
2. **Store securely**:
   - Local: in `.env` (git-ignored)
   - Production: use platform secret manager (Vercel Secrets, Railway Variables, etc.)
3. **Never commit secrets**: Ensure `.env` is in `.gitignore`
4. **Rotate keys periodically**:
   - Generate new `KEYRING_N`
   - Update `KEY_VERSION`
   - Keep old keys for decryption during transition
5. **Audit key usage**: Check audit logs in `api_key_audit_logs` table
6. **Use different keys per environment**: Don't reuse production keys in development

## Key Concepts

### Hash vs Encrypt

- **Hash (`KEY_HASH_SALT`)**: One-way function for fast lookups. Required for API key creation.
- **Encrypt (`KEYRING_N`)**: Reversible encryption for at-rest security. Optional for additional security.

### API Key Flow

```
1. User creates API key via /user/api-keys
2. System generates random key (e.g., gw_live_abc123...)
3. System hashes it using KEY_HASH_SALT (deterministic)
4. System encrypts it using KEYRING_1 (if set)
5. Stores in database:
   - api_key: plaintext (used for Bearer token)
   - key_hash: SHA256(salt + api_key) [UNIQUE]
   - encrypted_key: Fernet(api_key) [optional]
6. Returns plaintext key to user (only shown once)
```

### Database Constraints

- **`api_key` column**: UNIQUE index (prevents duplicate keys)
- **`key_hash` column**: UNIQUE constraint (prevents hash collisions, requires non-NULL if using)
- **Foreign keys**: Cascade deletes to `rate_limit_configs` and `api_key_audit_logs`

## API Key Creation Endpoint

### Request

```bash
POST /user/api-keys
Authorization: Bearer <valid-api-key>
Content-Type: application/json

{
  "key_name": "Production Key",
  "environment_tag": "live",  # test, staging, live, development
  "expiration_days": 30,
  "max_requests": 1000000,
  "scope_permissions": {"chat": ["*"]},
  "ip_allowlist": ["192.168.1.0/24"],
  "domain_referrers": ["myapp.com"]
}
```

### Response (Success)

```json
{
  "api_key": "gw_live_abc123xyz...",
  "key_name": "Production Key",
  "key_id": 42,
  "environment_tag": "live",
  "security_features": {
    "rate_limited": true,
    "ip_restricted": true,
    "domain_restricted": true,
    "encrypted": true
  }
}
```

### Response (Failure)

If `KEY_HASH_SALT` is missing:

```json
{
  "detail": "API key creation requires KEY_HASH_SALT environment variable. Generate a 16+ character random salt:\n  python -c \"import secrets; print('KEY_HASH_SALT=' + secrets.token_hex(32))\"\nThen set it in your environment variables."
}
```

## Additional Resources

- [Environment Setup Guide](./ENVIRONMENT_SETUP.md)
- [API Reference](./api.md) - `/user/api-keys` endpoint
- [Security Documentation](./DEPLOYMENT.md#security)
- [Database Schema](../supabase/migrations/) - API key tables

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review logs: `tail -f uvicorn_test.log`
3. Test endpoint: `curl http://localhost:8000/health`
4. Open an issue on GitHub

---

**Last Updated**: 2025-11-18
**Related PRs**: Fix API Key Loading #16lnru
