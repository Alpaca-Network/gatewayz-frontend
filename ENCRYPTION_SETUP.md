# Encryption Key Configuration Guide

## Overview

This guide documents the setup and management of encryption keys for the Gatewayz platform. Encryption keys are critical for securing sensitive data at rest and in transit.

## Security Classification

**Priority**: P0 (Critical Security)

## Current Configuration

The following encryption keys are configured in Railway production environment:

- `KEY_VERSION`: 1
- `KEYRING_1`: BKFD4AxBn3NwerzRRFWWhusTPsaiGlMfIqlXhoGocfw=

## Environment Variables

### Required Variables

1. **KEY_VERSION** (integer)
   - Current active key version number
   - Used to identify which key from the keyring to use for encryption
   - Current value: `1`

2. **KEYRING_N** (string)
   - Fernet encryption key for version N
   - Format: Base64-encoded 32-byte key
   - Example: `KEYRING_1` for version 1

## Setup Instructions

### Step 1: Generate a New Encryption Key

Generate a new Fernet encryption key using Python:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

This will output a base64-encoded key like:
```
BKFD4AxBn3NwerzRRFWWhusTPsaiGlMfIqlXhoGocfw=
```

### Step 2: Configure Environment Variables

#### Local Development

Add to your `.env.local` file:

```bash
KEY_VERSION=1
KEYRING_1=your-generated-key-here
```

#### Railway Production

Use the Railway MCP tools or Railway CLI:

**Option A: Using Railway MCP Tools**

```typescript
await mcp__railway__variable_bulk_set({
  projectId: "5112467d-86a2-4aa8-9deb-6dbd094d55f9",
  environmentId: "52f8dd63-e6d5-46da-acc6-7b237d57eae3",
  serviceId: "3006f83c-760e-49b6-96e7-43cee502c06a",
  variables: {
    "KEY_VERSION": "1",
    "KEYRING_1": "your-generated-key-here"
  }
});
```

**Option B: Using Railway CLI**

```bash
railway variables set KEY_VERSION=1
railway variables set KEYRING_1=your-generated-key-here
```

**Option C: Railway Dashboard**

1. Go to Railway Dashboard
2. Select `gatewayz-backend` project
3. Select `production` environment
4. Select `api` service
5. Go to Variables tab
6. Add `KEY_VERSION` = `1`
7. Add `KEYRING_1` = `your-generated-key-here`

### Step 3: Verify Configuration

Check that the variables are set correctly:

```bash
# Using Railway MCP
await mcp__railway__list_service_variables({
  projectId: "5112467d-86a2-4aa8-9deb-6dbd094d55f9",
  environmentId: "52f8dd63-e6d5-46da-acc6-7b237d57eae3",
  serviceId: "3006f83c-760e-49b6-96e7-43cee502c06a"
});

# Using Railway CLI
railway variables
```

Verify that both `KEY_VERSION` and `KEYRING_1` appear in the output.

## Key Rotation

### When to Rotate Keys

- **Scheduled**: Every 90 days (recommended)
- **Incident**: Immediately if key compromise is suspected
- **Compliance**: As required by security audits

### How to Rotate Keys

1. **Generate a new key** (version 2):
   ```bash
   python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

2. **Add the new key** to the keyring while keeping the old key:
   ```bash
   railway variables set KEYRING_2=new-generated-key-here
   ```

3. **Update KEY_VERSION** to use the new key:
   ```bash
   railway variables set KEY_VERSION=2
   ```

4. **Keep old keys** for backward compatibility (to decrypt existing data):
   - DO NOT delete `KEYRING_1` until all data is re-encrypted
   - The keyring supports multiple versions simultaneously

5. **Verify** the new configuration:
   ```bash
   railway variables
   ```

### Migration Process

When rotating keys, you must re-encrypt existing data:

1. Deploy new key (KEYRING_2) without changing KEY_VERSION
2. Run migration script to re-encrypt data using new key
3. Update KEY_VERSION to 2
4. After successful migration, remove old key (KEYRING_1)

## Security Best Practices

### DO

✅ Generate keys using cryptographically secure methods
✅ Store keys in environment variables only (never in code)
✅ Keep old keys during rotation for backward compatibility
✅ Rotate keys regularly (every 90 days minimum)
✅ Monitor key usage and access patterns
✅ Use different keys for different environments (dev, staging, prod)
✅ Document all key rotation events

### DON'T

❌ Commit keys to version control
❌ Share keys via email or chat
❌ Reuse keys across environments
❌ Delete old keys before data migration is complete
❌ Use predictable or weak keys
❌ Log keys in application logs
❌ Store keys in configuration files

## Troubleshooting

### Key Not Found Error

**Symptom**: Application fails with "Key not found" error

**Solution**:
1. Verify `KEY_VERSION` matches an existing `KEYRING_N` variable
2. Check that `KEYRING_N` is set in the environment
3. Restart the service after setting variables

### Decryption Failed Error

**Symptom**: Cannot decrypt existing data

**Solution**:
1. Verify the old key (`KEYRING_1`) is still present
2. Check that data was encrypted with the correct key version
3. Restore the previous `KEYRING_N` if accidentally deleted

### Key Rotation Failed

**Symptom**: Errors after updating KEY_VERSION

**Solution**:
1. Rollback KEY_VERSION to previous value
2. Verify new `KEYRING_N` is correctly set
3. Check application logs for specific error messages
4. Ensure data migration completed successfully

## Compliance & Audit

### Key Storage

- Keys are stored in Railway's secure environment variable system
- Railway encrypts environment variables at rest
- Access to keys is restricted to authorized team members

### Access Control

- Production keys: Only DevOps and Security team members
- Staging keys: Development team members
- Local development keys: Individual developers (non-production data only)

### Audit Trail

All key rotation events should be logged with:
- Date and time of rotation
- Previous key version
- New key version
- Person who performed the rotation
- Reason for rotation (scheduled, incident, compliance)

## Support

For questions or issues related to encryption keys:

1. Check this documentation first
2. Review application logs
3. Contact DevOps team
4. For security incidents, follow incident response procedure

## Related Documentation

- `.env.example` - Environment variable examples
- `CLAUDE.md` - Codebase documentation
- Railway documentation: https://docs.railway.app/

## Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2025-12-29 | 1.0 | Initial encryption key setup | Terry (Terragon Labs) |
| 2025-12-29 | 1.0 | Added KEY_VERSION=1 and KEYRING_1 to production | Terry (Terragon Labs) |

---

**Last Updated**: 2025-12-29
**Document Owner**: DevOps Team
**Security Classification**: CONFIDENTIAL
