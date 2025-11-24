# Sentry Releases Setup - Gatewayz Beta

This document describes how Sentry Releases are configured and used in the Gatewayz Beta application to track errors across different versions of your deployment.

## Overview

Sentry Releases allow you to:
- **Track errors by version** - Know exactly which release introduced a bug
- **Source map management** - Automatically upload and map stack traces to source code
- **Release tracking** - Monitor performance and issues across versions
- **Progress tracking** - See which releases have been deployed and their status
- **Regression detection** - Identify if a fix broke something in a new release

## Configuration

### Release Identifier

The application uses a multi-fallback strategy to determine the release identifier:

```
1. SENTRY_RELEASE environment variable (explicit override)
   ↓
2. VERCEL_GIT_COMMIT_SHA (Vercel deployment)
   ↓
3. GIT_COMMIT_SHA environment variable
   ↓
4. Git short commit SHA (local detection)
   ↓
5. Package version fallback: nextn@0.1.0
```

This ensures a release identifier is always available, even in different environments.

### Environment Configuration

The following environment variables control Sentry releases:

```bash
# Required for creating releases in Sentry
SENTRY_AUTH_TOKEN=your_auth_token_here

# Optional: explicitly set release identifier
SENTRY_RELEASE=my-app@1.0.0

# These are automatically detected from Vercel
VERCEL_GIT_COMMIT_SHA=abc123def456
VERCEL_GIT_COMMIT_REF=main

# Sentry project configuration (already set)
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Files Modified

#### 1. **next.config.ts**
Added release tracking to the Sentry webpack plugin:
```typescript
const getRelease = () => { /* ... */ };

const sentryWebpackPluginOptions = {
  // ... existing config
  release: getRelease(),  // ← NEW
};
```

#### 2. **sentry.server.config.ts**
Added release to server-side Sentry initialization:
```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: getRelease(),  // ← NEW
  // ... rest of config
});
```

#### 3. **instrumentation-client.ts**
Added release to client-side Sentry initialization:
```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: getRelease(),  // ← NEW
  // ... rest of config
});
```

#### 4. **package.json**
Added new npm scripts for release management:
```json
{
  "scripts": {
    "build:with-sentry": "node scripts/sentry-release.js info && next build",
    "build:with-release": "node scripts/sentry-release.js info && next build && node scripts/sentry-release.js create",
    "sentry:release": "node scripts/sentry-release.js",
    "sentry:create": "node scripts/sentry-release.js create"
  }
}
```

#### 5. **scripts/sentry-release.js** (NEW)
Release management helper script with two modes:
- **Info mode**: Display release information and environment variables
- **Create mode**: Create the release in Sentry

## Usage

### Development

When developing locally, releases are automatically tracked using git commit SHA:

```bash
npm run dev
```

The application will automatically use the git commit SHA as the release identifier.

### Building with Release Info

To see what release will be created during the build:

```bash
npm run sentry:release
# or
npm run build:with-sentry
```

Output example:
```
Sentry Release Information:
======================================
Release ID:    a1b2c3d4e5f
Branch:        main
Commit:        a1b2c3d4e5f6g7h8i9j0
Commit Msg:    feat: add new feature
======================================

Environment variables to set:
export SENTRY_RELEASE="a1b2c3d4e5f"
export NEXT_PUBLIC_SENTRY_RELEASE="a1b2c3d4e5f"
```

### Building and Creating Release

To build and automatically create the release in Sentry:

```bash
SENTRY_AUTH_TOKEN=your_token npm run build:with-release
```

This will:
1. Determine the release identifier
2. Build the Next.js application
3. Upload source maps (automatic via webpack plugin)
4. Create the release in Sentry
5. Associate the release with the project

### Manual Release Creation

To manually create a release in Sentry:

```bash
SENTRY_AUTH_TOKEN=your_token npm run sentry:create
```

### Vercel Deployment

For Vercel deployments, automatic release creation is recommended:

1. **Set the environment variable** in Vercel project settings:
   ```
   SENTRY_AUTH_TOKEN = <your_sentry_auth_token>
   ```

2. **Update your build command** to create releases:
   ```
   node scripts/sentry-release.js info && pnpm run build && node scripts/sentry-release.js create
   ```

   Or use the provided npm script:
   ```
   npm run build:with-release
   ```

## Sentry Release Operations

### Creating a Release

A release is created automatically when you run:
```bash
npm run build:with-release
```

The Sentry Release API will:
1. Create a new release with the identifier
2. Associate it with your project
3. Set the repository reference
4. Link to the commit SHA

### Source Map Upload

Source maps are automatically uploaded during the build via the Sentry webpack plugin (`@sentry/nextjs/withSentryConfig`):

- All source maps are uploaded to Sentry
- Maps are hidden from the client (`hideSourceMaps: true`)
- Extended file upload for better stack traces (`widenClientFileUpload: true`)
- Automatic for both server and client bundles

### Release Status Tracking

After creating a release, you can track its status in Sentry:

1. Go to **Releases** in your Sentry project
2. Find the release by its identifier
3. View:
   - Associated commits
   - Issues introduced/resolved in this release
   - Error trend graphs
   - Adoption (% of sessions on this release)

## Error Association

Errors are automatically associated with releases because:

1. **Initialization** - Sentry is initialized with the release identifier
2. **Propagation** - All errors reported include the release context
3. **Source maps** - Stack traces are mapped to source files using uploaded maps
4. **Session tracking** - Each user session is tagged with the release

When an error is reported, Sentry will:
- Group errors by similarity
- Show which release first introduced the issue
- Track if the error is fixed in newer releases
- Display adoption metrics

## Development Workflow

### Local Development

1. Make code changes
2. Test locally with `npm run dev`
3. Errors will be associated with your current git commit SHA

### Creating a Release

```bash
# Check what release would be created
npm run sentry:release

# Build with release creation
SENTRY_AUTH_TOKEN=<token> npm run build:with-release
```

### Post-Deployment

After deploying to production:
1. Visit your Sentry project's **Releases** page
2. Confirm the new release appears
3. Monitor error rates and trends
4. Track adoption as users receive the new version

## Sentry API Token

To create releases, you need a Sentry auth token:

### Generating a Token

1. Go to **Settings** → **Auth Tokens** in Sentry
2. Create a new token with these permissions:
   - `project:read`
   - `project:write`
   - `project:releases`
   - `org:read`
3. Copy the token and store it securely

### Using the Token

**Locally:**
```bash
export SENTRY_AUTH_TOKEN=your_token_here
npm run build:with-release
```

**In Vercel:**
Add to Environment Variables:
```
SENTRY_AUTH_TOKEN = your_token_here
```

**In GitHub Actions:**
```yaml
env:
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

## Troubleshooting

### Release Not Created

**Issue:** Release creation fails with authentication error

**Solution:**
```bash
# Verify token is set
echo $SENTRY_AUTH_TOKEN

# Test with explicit token
SENTRY_AUTH_TOKEN=your_token npm run sentry:create

# Check token has correct permissions in Sentry settings
```

### Source Maps Not Uploaded

**Issue:** Stack traces are unminified/unreadable

**Solution:**
```bash
# Verify the build includes source maps
ls -la .next/

# Check build logs for Sentry webpack plugin output
npm run build 2>&1 | grep -i sentry

# Verify hideSourceMaps doesn't affect upload (only visibility)
```

### Wrong Release Identifier

**Issue:** Release identifier is package version instead of git commit

**Solution:**
```bash
# Explicitly set the release
export SENTRY_RELEASE=my-custom-release
npm run build:with-release

# Or check git is available
git rev-parse --short HEAD
```

### Release Already Exists

**Issue:** Trying to create a release that already exists

**Solution:**
This is expected and handled gracefully (HTTP 409 Conflict). The script will:
- Log the release as successfully created
- Not fail the build
- Allow redeployments with the same release

## Integration Points

### Error Reporting

All errors are automatically tagged with the release:

```typescript
// This error includes the release context automatically
try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  // Release context is automatically included
}
```

### Custom Context

You can add additional context to errors:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.setContext('deployment', {
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  environment: process.env.NODE_ENV,
  timestamp: new Date().toISOString(),
});
```

### Breadcrumbs

Breadcrumbs are recorded with release context:

```typescript
Sentry.addBreadcrumb({
  message: 'User action',
  category: 'user-action',
  level: 'info',
});
// Release is automatically included in the breadcrumb context
```

## Best Practices

### Release Naming

✅ **Good:**
- Commit SHA: `a1b2c3d` (automatic)
- Semantic version: `1.0.0`, `1.2.3`
- Combined: `1.0.0-a1b2c3d`

❌ **Avoid:**
- Non-unique: `latest`, `main`, `production`
- Unclear: `build-123`, `deployment`
- Timestamps: `2024-01-01-10-30` (use commit dates instead)

### Deployment Strategy

1. **Build locally first**
   ```bash
   npm run sentry:release    # Check release info
   npm run build             # Build application
   ```

2. **Test staging**
   ```bash
   npm run start             # Test built app
   ```

3. **Create release when ready**
   ```bash
   SENTRY_AUTH_TOKEN=<token> npm run sentry:create
   ```

4. **Deploy to production**
   ```bash
   npm run start             # Or deploy to Vercel
   ```

### Monitoring Releases

Regularly check your Sentry project:

1. **Release Health** - Track adoption and crash rates
2. **Release Issues** - See which issues were introduced
3. **Release Commits** - Review what code was included
4. **Error Trends** - Monitor if fixes are working

## File Locations

```
/root/repo/
├── next.config.ts                    # Release config in webpack plugin
├── sentry.server.config.ts           # Release in server init
├── instrumentation-client.ts         # Release in client init
├── package.json                      # New npm scripts
├── scripts/
│   └── sentry-release.js             # Release helper script
├── .sentryclirc                       # Sentry CLI config
└── SENTRY_RELEASES_SETUP.md          # This file
```

## Additional Resources

- [Sentry Releases Documentation](https://docs.sentry.io/product/releases/setup/)
- [Next.js Integration Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [Sentry API Documentation](https://docs.sentry.io/api/releases/)
- [Source Maps Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/)

## Support

For issues or questions:

1. Check **Sentry Dashboard** - Release status and errors
2. Review **Build Logs** - Webpack plugin output
3. Verify **Environment Variables** - Auth token and release identifier
4. Check **Network Requests** - API token permissions
5. See **Troubleshooting** section above
