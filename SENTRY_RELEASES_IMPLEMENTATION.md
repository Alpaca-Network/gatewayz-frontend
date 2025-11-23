# Sentry Releases Implementation Summary

This document summarizes the Sentry Releases implementation for the Gatewayz Beta application.

## What Was Added

### Overview
Complete Sentry Releases setup enabling automatic error tracking across application versions with source map management.

## Files Modified

### 1. **next.config.ts** ✅
**What changed:** Added `getRelease()` function and release option to webpack plugin

**Why:** Sentry webpack plugin needs to know which release is being built to properly upload source maps.

**Changes:**
```typescript
// Added function to determine release identifier
const getRelease = () => { /* ... */ };

// Updated sentryWebpackPluginOptions
sentryWebpackPluginOptions = {
  // ... existing options
  release: getRelease(),  // ← NEW
}
```

### 2. **sentry.server.config.ts** ✅
**What changed:** Added `getRelease()` function and release option to Sentry.init()

**Why:** Server-side errors need to be tagged with the release they occurred in.

**Changes:**
```typescript
// Added getRelease() function
// Updated Sentry.init()
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: getRelease(),  // ← NEW
  // ... rest of config
})
```

### 3. **instrumentation-client.ts** ✅
**What changed:** Added `getRelease()` function and release option to client-side Sentry.init()

**Why:** Client-side errors need release context to be properly associated and tracked.

**Changes:**
```typescript
// Added getRelease() function
// Updated Sentry.init()
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: getRelease(),  // ← NEW
  // ... rest of config
})
```

**Note:** Client-side getRelease() includes checking for meta tags as an additional fallback.

### 4. **package.json** ✅
**What changed:** Added new npm scripts for release management

**Why:** Provides convenient commands to check, build, and create releases.

**New scripts:**
```json
{
  "build:with-sentry": "node scripts/sentry-release.js info && next build",
  "build:with-release": "node scripts/sentry-release.js info && next build && node scripts/sentry-release.js create",
  "sentry:release": "node scripts/sentry-release.js",
  "sentry:create": "node scripts/sentry-release.js create"
}
```

## Files Created

### 1. **scripts/sentry-release.js** ✨ NEW
**Purpose:** CLI helper for managing Sentry releases

**Features:**
- Automatically detects release identifier from git/env/package
- Displays release information
- Creates releases in Sentry via API
- Two modes: info (display) and create (API call)

**Usage:**
```bash
npm run sentry:release         # Display release info
npm run sentry:create         # Create release in Sentry
```

### 2. **SENTRY_RELEASES_SETUP.md** 📖 NEW
**Purpose:** Comprehensive setup and usage guide

**Contents:**
- Configuration explanation
- Environment variables setup
- Usage examples (development, deployment, CI/CD)
- Troubleshooting guide
- Best practices
- Integration points

### 3. **SENTRY_RELEASES_QUICK_START.md** 📖 NEW
**Purpose:** Quick 5-minute setup guide

**Contents:**
- Step-by-step setup
- Common commands
- Vercel deployment setup
- Basic troubleshooting

### 4. **SENTRY_RELEASES_IMPLEMENTATION.md** 📖 NEW
**Purpose:** This file - technical summary of changes

## Release Identifier Strategy

The application uses a smart fallback strategy to determine the release:

```
1. SENTRY_RELEASE env var (explicit override)
   ↓
2. VERCEL_GIT_COMMIT_SHA (Vercel deployment)
   ↓
3. GIT_COMMIT_SHA env var
   ↓
4. Git short commit SHA (local detection)
   ↓
5. Package version fallback (nextn@0.1.0)
```

This ensures every build has a release identifier, even without git.

## How It Works

### Local Development
```bash
npm run dev
```
- Release = git commit SHA (e.g., `a1b2c3d`)
- Errors tagged with current commit
- No build needed for dev

### Building with Release
```bash
npm run build:with-sentry
```
- Displays release info
- Builds Next.js app
- Source maps uploaded automatically

### Creating Release in Sentry
```bash
SENTRY_AUTH_TOKEN=token npm run build:with-release
```
- Displays release info
- Builds app
- Uploads source maps
- Creates release in Sentry
- Associates commits with release

### Vercel Deployment
Set build command to:
```
npm run build:with-release
```

And add environment variable:
```
SENTRY_AUTH_TOKEN = your_token
```

Vercel will automatically:
1. Detect commit SHA
2. Build application
3. Upload source maps
4. Create release
5. Associate with commits

## Key Features Enabled

### ✅ Release Tracking
- Track which errors occurred in which release
- See error trends across versions
- Identify regression patterns

### ✅ Source Map Management
- Automatic source map upload during build
- Stack traces mapped to original source code
- Better debugging with original code visibility

### ✅ Version Association
- Every error knows which version it occurred in
- See which release introduced a bug
- Track if fixes work in newer releases

### ✅ Adoption Monitoring
- Track % of sessions on each release
- Monitor rollout progress
- Identify canary issues early

### ✅ Release Notes
- Link commits to releases
- See what changed between versions
- Communicate changes to team

## Existing Sentry Integration

This release setup builds on existing Sentry integration:

- ✅ Error tracking (via `@sentry/nextjs`)
- ✅ Session replay (client-side)
- ✅ Performance monitoring (distributed tracing)
- ✅ Structured logging (trace, debug, info, warn, error)
- ✅ Breadcrumb tracking (user actions, state changes)
- ✅ Source map upload (webpack plugin)
- ✅ Custom error handlers (API middleware)
- ✅ Error filtering (Privy wallet extension)

Now with releases, errors are also:
- ✅ **Version-aware** - Know which release had the error
- ✅ **Reggressible** - Track fixes across versions
- ✅ **Adoptable** - Monitor rollout and adoption

## Environment Configuration

### Required for Production

```bash
# Must be set to create releases in Sentry
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

### Already Configured

```bash
# Already in .env.example
NEXT_PUBLIC_SENTRY_DSN=your_dsn
```

### Optional Overrides

```bash
# Explicitly set release (usually auto-detected)
SENTRY_RELEASE=my-app@1.0.0

# Used by Vercel automatically
VERCEL_GIT_COMMIT_SHA=abc123
VERCEL_GIT_COMMIT_REF=main
```

## Getting Your Auth Token

1. Go to https://sentry.io → Settings → Auth Tokens
2. Create a new token
3. Select these permissions:
   - `project:read`
   - `project:write`
   - `project:releases`
4. Copy and save securely

## Testing the Setup

### Local Test

```bash
# See what release would be created
npm run sentry:release

# Output should show:
# Release ID:    <git_commit_or_version>
# Branch:        <current_branch>
# Commit:        <commit_sha>
```

### Vercel Test

1. Set `SENTRY_AUTH_TOKEN` in Vercel Environment Variables
2. Update build command to: `npm run build:with-release`
3. Push to main branch
4. Watch build logs
5. Check Sentry Releases page

## Troubleshooting

### Token Issues
```bash
# Verify token is set
echo $SENTRY_AUTH_TOKEN

# Check token in Vercel dashboard
# Settings → Environment Variables → SENTRY_AUTH_TOKEN
```

### Source Map Issues
```bash
# Verify build created source maps
ls -la .next/

# Check for Sentry webpack plugin output
npm run build 2>&1 | grep -i sentry
```

### Release Not Appearing
```bash
# Check Sentry project settings
# Settings → Projects → javascript-nextjs
# Verify org: alpaca-network
# Verify project: javascript-nextjs
```

## Integration Points

Releases are integrated into:

1. **Sentry Configuration** - All 3 config files initialize with release
2. **Build Process** - Webpack plugin captures release
3. **Error Reporting** - All errors include release context
4. **Source Maps** - Automatically associated with release
5. **Breadcrumbs** - Include release metadata
6. **Sessions** - Tagged with release identifier

## File Locations

```
/root/repo/
├── next.config.ts                         # Release in webpack plugin
├── sentry.server.config.ts                # Release in server init
├── instrumentation-client.ts              # Release in client init
├── package.json                           # New npm scripts
├── scripts/
│   └── sentry-release.js                  # Release helper (NEW)
├── .sentryclirc                           # Already configured
├── .env.example                           # Already has SENTRY_AUTH_TOKEN
└── Documentation (NEW):
    ├── SENTRY_RELEASES_SETUP.md           # Complete guide
    ├── SENTRY_RELEASES_QUICK_START.md     # 5-minute setup
    └── SENTRY_RELEASES_IMPLEMENTATION.md  # This file
```

## Next Steps

1. **Set up auth token:**
   - Generate from Sentry settings
   - Add to .env or Vercel

2. **Test locally:**
   ```bash
   npm run sentry:release
   ```

3. **Build with release:**
   ```bash
   SENTRY_AUTH_TOKEN=token npm run build:with-release
   ```

4. **Monitor in Sentry:**
   - Go to Releases page
   - Verify release appears with commits
   - Check source maps are uploaded

5. **Deploy to production:**
   - Update Vercel build command
   - Set SENTRY_AUTH_TOKEN in Vercel
   - Push to deploy

## Summary

✅ **Release tracking configured** - All 3 Sentry configs now include release identifier
✅ **Source maps management** - Webpack plugin already uploads, now with release association
✅ **Build scripts created** - Easy commands for checking and creating releases
✅ **Documentation provided** - Complete and quick-start guides
✅ **Ready for production** - Just add auth token and start deploying

The application is now ready to track errors across versions with full source map visibility and release adoption metrics.
