# Sentry Releases - Verification Checklist

Use this checklist to verify that Sentry Releases are properly configured and working.

## Pre-Setup Verification

- [ ] Sentry account exists and project is set up
- [ ] Sentry DSN is available: `https://...@sentry.io/...`
- [ ] Project name is `javascript-nextjs`
- [ ] Organization is `alpaca-network`
- [ ] Can access Sentry dashboard

## Token Setup Verification

- [ ] Sentry Auth Token generated
- [ ] Token has `project:read` permission
- [ ] Token has `project:write` permission
- [ ] Token has `project:releases` permission
- [ ] Token is saved securely
- [ ] Environment variable `SENTRY_AUTH_TOKEN` is set locally

```bash
# Verify token is set
echo $SENTRY_AUTH_TOKEN
```

## Configuration Verification

### File: next.config.ts

- [ ] File exists and is readable
- [ ] Contains `getRelease()` function
- [ ] `sentryWebpackPluginOptions` includes `release: getRelease()`
- [ ] Org is set to `alpaca-network`
- [ ] Project is set to `javascript-nextjs`

```bash
grep -n "getRelease\|release:" /root/repo/next.config.ts | head -5
```

### File: sentry.server.config.ts

- [ ] File exists and is readable
- [ ] Contains `getRelease()` function
- [ ] `Sentry.init()` includes `release: getRelease()`
- [ ] DSN is properly configured

```bash
grep -n "getRelease\|release:" /root/repo/sentry.server.config.ts | head -5
```

### File: instrumentation-client.ts

- [ ] File exists and is readable
- [ ] Contains `getRelease()` function
- [ ] Includes meta tag fallback for release
- [ ] `Sentry.init()` includes `release: getRelease()`

```bash
grep -n "getRelease\|release:" /root/repo/instrumentation-client.ts | head -5
```

### File: package.json

- [ ] Contains `build:with-sentry` script
- [ ] Contains `build:with-release` script
- [ ] Contains `sentry:release` script
- [ ] Contains `sentry:create` script

```bash
grep -E "build:with|sentry:" /root/repo/package.json
```

### File: scripts/sentry-release.js

- [ ] File exists and is executable
- [ ] Contains `getRelease()` function
- [ ] Contains `printReleaseInfo()` function
- [ ] Contains `createRelease()` function
- [ ] Size is approximately 5KB

```bash
ls -lah /root/repo/scripts/sentry-release.js
```

### File: .env.example

- [ ] Contains `SENTRY_AUTH_TOKEN` documentation
- [ ] Contains link to quick-start guide
- [ ] Contains optional release override variables

```bash
grep -A5 "Sentry Releases" /root/repo/.env.example
```

## Local Testing

### Test 1: Display Release Info

```bash
npm run sentry:release
```

**Expected output:**
```
Sentry Release Information:
======================================
Release ID:    <git_commit_or_version>
Branch:        <current_branch>
Commit:        <commit_sha>
Commit Msg:    <message>
======================================

Environment variables to set:
export SENTRY_RELEASE="..."
export NEXT_PUBLIC_SENTRY_RELEASE="..."
```

- [ ] Command runs without errors
- [ ] Release ID is detected (git commit or version)
- [ ] Branch name is correct
- [ ] Output is readable

### Test 2: Build with Release Info

```bash
npm run build:with-sentry
```

**Expected:**
- [ ] Release info is displayed first
- [ ] Next.js build completes successfully
- [ ] No TypeScript errors
- [ ] No build warnings about Sentry

### Test 3: Check Build Output

```bash
ls -la .next/
```

**Expected:**
- [ ] `.next/` directory exists
- [ ] Contains `.nft.json` files (build metadata)
- [ ] Contains `.rsc` files (React Server Components)
- [ ] Build completed without errors

## Sentry Dashboard Verification

1. Go to your Sentry project dashboard
2. Click **Releases** in left sidebar

### Before First Release

- [ ] Releases page exists
- [ ] No releases listed (or previous releases exist)
- [ ] Can see release creation interface

### After Creating Release

```bash
SENTRY_AUTH_TOKEN=your_token npm run build:with-release
```

Wait 1-2 minutes for data to propagate in Sentry.

**Then verify:**

- [ ] New release appears in Releases list
- [ ] Release name matches your identifier
- [ ] Release shows commit information
- [ ] Release shows commit SHA
- [ ] Source maps appear in release detail

## Integration Testing

### Test 1: Error Reporting with Release

Create a test error:

```typescript
// In a server component or API route
import * as Sentry from '@sentry/nextjs';

try {
  throw new Error('Test error for Sentry');
} catch (error) {
  Sentry.captureException(error);
}
```

**Then verify in Sentry:**

- [ ] Error appears in Issues list
- [ ] Error shows release context
- [ ] Error associates with correct release
- [ ] Stack trace is readable (source map working)

### Test 2: Session Replay with Release

Generate user activity:
1. Load the application
2. Click some buttons
3. Navigate between pages
4. Trigger an error (optional)

**Then verify in Sentry:**

- [ ] Session replay captures activity
- [ ] Replay shows release information
- [ ] Replay timeline is accurate
- [ ] User actions are visible

### Test 3: Performance Monitoring with Release

Load the application and navigate:

```bash
npm run start
# Navigate to http://localhost:3000
# Click through several pages
```

**Then verify in Sentry:**

- [ ] Performance data appears
- [ ] Transactions show release context
- [ ] Page load metrics are recorded
- [ ] API request durations are tracked

## CI/CD Verification

### For GitHub Actions

If using GitHub Actions, add to your workflow:

```yaml
env:
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

- [ ] Secret is configured in GitHub
- [ ] Workflow runs successfully
- [ ] Build logs show release creation
- [ ] Sentry dashboard shows new release

### For Vercel

If deploying to Vercel:

1. Go to Vercel Project Settings → Environment Variables
2. Add `SENTRY_AUTH_TOKEN`

- [ ] Vercel shows the environment variable
- [ ] Build command is: `npm run build:with-release`
- [ ] Deployment succeeds
- [ ] Check build logs for Sentry output
- [ ] New release appears in Sentry

### For Other CI/CD

Update your build command to:

```bash
SENTRY_AUTH_TOKEN=your_token npm run build:with-release
```

- [ ] CI system sets SENTRY_AUTH_TOKEN
- [ ] Build command is updated
- [ ] Build completes successfully
- [ ] Sentry receives release creation request

## Documentation Verification

- [ ] `SENTRY_RELEASES_QUICK_START.md` exists
- [ ] `SENTRY_RELEASES_SETUP.md` exists
- [ ] `SENTRY_RELEASES_IMPLEMENTATION.md` exists
- [ ] `SENTRY_RELEASES_VERIFICATION.md` (this file) exists

```bash
ls -la /root/repo/SENTRY_RELEASES_*.md
```

## Common Issues & Fixes

### Issue: "SENTRY_AUTH_TOKEN not set"

**Fix:**
```bash
export SENTRY_AUTH_TOKEN=your_token_here
npm run sentry:release
```

- [ ] Token is set correctly
- [ ] Token is valid in Sentry settings
- [ ] Token has required permissions

### Issue: "Release ID is package version instead of git commit"

**Fix:**
```bash
# Verify git is available
git rev-parse --short HEAD

# If not in git repo, set explicitly
export SENTRY_RELEASE=my-app@1.0.0
npm run build:with-release
```

- [ ] git is installed and accessible
- [ ] Current directory is git repository
- [ ] SENTRY_RELEASE can be set explicitly

### Issue: "Failed to create release - 409 Conflict"

**This is expected!** It means the release already exists.

- [ ] Build continues successfully
- [ ] Release was already created in Sentry
- [ ] No action needed - redeployments work fine

### Issue: "Source maps not showing in Sentry"

**Fix:**
```bash
# Verify build created source maps
ls -la .next/

# Check Sentry webpack plugin output
npm run build 2>&1 | grep -i sentry
```

- [ ] .next/ directory contains build files
- [ ] Source maps are being uploaded
- [ ] hideSourceMaps is set to true (correct)

## Performance Check

Test build performance with releases:

```bash
# Measure build time
time npm run build:with-sentry

# Typical times:
# - Initial build: 30-60 seconds
# - Incremental: 5-15 seconds
# - Release creation: 2-5 seconds
```

- [ ] Build completes in reasonable time
- [ ] Release creation doesn't slow build significantly
- [ ] No memory issues during build

## Final Verification

Run through entire workflow:

```bash
# 1. Check release info
npm run sentry:release

# 2. Build with sentry
npm run build:with-sentry

# 3. Create release
SENTRY_AUTH_TOKEN=your_token npm run sentry:create

# 4. Verify in Sentry dashboard
# → Releases page should show your release
```

**Completion checklist:**

- [ ] All file modifications verified
- [ ] All new files created
- [ ] Release info displays correctly
- [ ] Build completes without errors
- [ ] Release appears in Sentry
- [ ] Source maps are uploaded
- [ ] Errors associate with release
- [ ] Documentation is complete

## Sign Off

Team member verifying setup:
- Name: _________________
- Date: _________________
- Status: ☐ All checks passed ☐ Issues found

Issues found:
_________________________________________________________________

Notes:
_________________________________________________________________

---

✅ If all checks pass, Sentry Releases are properly configured and ready for production use.

For support, see:
- Quick start: `SENTRY_RELEASES_QUICK_START.md`
- Full guide: `SENTRY_RELEASES_SETUP.md`
- Implementation: `SENTRY_RELEASES_IMPLEMENTATION.md`
