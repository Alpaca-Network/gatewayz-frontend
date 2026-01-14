# Sentry Releases - Quick Start Guide

Get Sentry Releases working in 5 minutes.

## Step 1: Get Your Sentry Auth Token

1. Go to [Sentry Dashboard](https://sentry.io) → Settings → Auth Tokens
2. Create a token with these permissions:
   - `project:releases`
   - `project:write`
3. Copy the token

## Step 2: Set Environment Variable

```bash
export SENTRY_AUTH_TOKEN=your_token_here
```

Or in Vercel:
- Project Settings → Environment Variables
- Add `SENTRY_AUTH_TOKEN` with your token value

## Step 3: Build with Releases

```bash
# See what release will be created
npm run sentry:release

# Build and create release
npm run build:with-release
```

## Step 4: Verify in Sentry

1. Go to your Sentry project
2. Click **Releases** in the left sidebar
3. You should see your new release with commits and source maps

Done! ✅

## Common Commands

```bash
# Check release info (shows git commit or package version)
npm run sentry:release

# Build with release creation
npm run build:with-release

# Just create the release (after building)
npm run sentry:create

# Build without release creation
npm run build
```

## Vercel Deployment

Add to your Vercel build command:

```
npm run build:with-release
```

Set the auth token in Environment Variables:
```
SENTRY_AUTH_TOKEN = <your_token>
```

## How It Works

1. **Automatic Detection** - Uses git commit SHA as the release ID
2. **Source Maps Upload** - Automatically uploaded during build
3. **Release Creation** - Associates release with commits in Sentry
4. **Error Tracking** - All errors are tagged with the release

## Troubleshooting

**"SENTRY_AUTH_TOKEN not set"**
```bash
export SENTRY_AUTH_TOKEN=your_token
```

**"Release already exists"** (HTTP 409)
This is fine - it means the release was already created. The build succeeds.

**"Failed to create release"**
Check your token has these permissions:
- project:write
- project:releases

For more details, see [SENTRY_RELEASES_SETUP.md](./SENTRY_RELEASES_SETUP.md).
