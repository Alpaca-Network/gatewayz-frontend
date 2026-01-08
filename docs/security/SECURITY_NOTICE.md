# ⚠️ SECURITY NOTICE: API Key Management

## Important Security Update

**Date**: 2025-11-14

### What Happened

API keys were inadvertently included in documentation files and committed to git history in commits:
- `61fd6ac` - docs: add test user setup script and completion guide
- Previous commits in this branch

### What We Fixed

✅ **Removed hardcoded API keys** from all documentation files
✅ **Updated setup scripts** to use environment variables (`TEST_API_KEY`)
✅ **Added .env.local** for local API key storage (gitignored)
✅ **Updated all examples** to use `$TEST_API_KEY` instead of hardcoded values

### ⚠️ Action Required

**The API key that was exposed in git history should be considered compromised and must be rotated immediately.**

To rotate your API key:
1. Visit https://beta.gatewayz.ai/settings/keys
2. Delete the old API key: `gw_live_hMdf3qa...` (if it's still active)
3. Generate a new API key
4. Update `.env.local` with the new key:
   ```bash
   TEST_API_KEY=your_new_api_key_here
   ```

### Secure API Key Management Going Forward

**DO**:
- ✅ Store API keys in `.env.local` (automatically gitignored)
- ✅ Use environment variables in scripts and examples
- ✅ Reference keys via `$TEST_API_KEY` or similar env vars
- ✅ Keep `.env*.local` in `.gitignore`

**DON'T**:
- ❌ Never commit API keys to git
- ❌ Never hardcode API keys in documentation
- ❌ Never include API keys in screenshots or examples
- ❌ Never share `.env.local` files

### Current Setup

**File Structure**:
```
.env.local          # Contains TEST_API_KEY (gitignored)
.gitignore          # Includes .env* pattern
setup-test-user.sh  # Reads from $TEST_API_KEY
```

**Usage**:
```bash
# Set your API key in .env.local
echo "TEST_API_KEY=your_new_key_here" >> .env.local

# Scripts automatically load from .env.local
./setup-test-user.sh

# Or export manually
export TEST_API_KEY=your_new_key_here
```

### Lessons Learned

1. **Always use environment variables** for sensitive data
2. **Review commits** before pushing for exposed secrets
3. **Use .env files** that are gitignored
4. **Never trust git history** - once committed, assume compromised
5. **Rotate keys immediately** if accidentally exposed

### Git History Note

While we've removed the keys from current files, **git history still contains the exposed key**. This is why rotation is critical.

To completely remove from history (advanced):
```bash
# WARNING: This rewrites git history and requires force push
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch TEST_USER_SETUP_COMPLETE.md setup-test-user.sh" \
  --prune-empty --tag-name-filter cat -- --all

# Then force push (only if you have permission and understand the risks)
git push origin --force --all
```

**Recommendation**: Instead of rewriting history, simply rotate the API key.

## Current Status

✅ All documentation updated to use environment variables
✅ `.env.local` setup for local development
✅ Security best practices documented
⚠️ **API key rotation required**

---

**Remember**: Security is everyone's responsibility. When in doubt, rotate credentials.
