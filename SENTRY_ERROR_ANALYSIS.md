# Sentry Error Analysis Guide

This guide explains how to review and analyze the most common errors in Sentry for the Gatewayz Beta application.

## Quick Access Methods

### Method 1: Sentry Web Dashboard (Easiest)

1. **Go to your Sentry dashboard**: https://sentry.io/organizations/[your-org]/issues/
2. **Filter by project**: Select "gatewayz-beta" or your project name
3. **Sort by frequency**: Click on "Events" column to sort by most frequent
4. **Time range**: Set to "Last 7 days" or desired period
5. **View details**: Click any issue to see:
   - Stack trace
   - Breadcrumbs (user actions leading to error)
   - Tags (error_type, api_route, component_name, etc.)
   - Affected users
   - Error frequency over time

### Method 2: Use the Analysis Script

We've created a script to fetch and analyze errors programmatically.

#### Setup:

```bash
# 1. Get your Sentry Auth Token
# Visit: https://sentry.io/settings/account/api/auth-tokens/
# Create a token with "project:read" and "event:read" permissions

# 2. Set environment variables
export SENTRY_AUTH_TOKEN="your-token-here"
export SENTRY_ORG="your-org-slug"
export SENTRY_PROJECT="your-project-slug"

# Optional: Set how many days back to analyze (default: 7)
export DAYS_BACK=14
```

#### Run the script:

**Option A: Shell script (requires `curl` and optionally `jq`):**
```bash
bash scripts/fetch-sentry-errors.sh
```

**Option B: Node.js script (more detailed analysis):**
```bash
node scripts/analyze-sentry-errors.js
```

The scripts will output:
- Top 10 most frequent errors
- Event counts and user impact
- Error categories and tags
- Links to view each issue in Sentry
- Raw JSON data saved to file

### Method 3: Sentry CLI

Install and use the official Sentry CLI:

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Configure
sentry-cli login

# List recent issues
sentry-cli issues list --project=your-project

# Get details of a specific issue
sentry-cli issues show ISSUE-ID
```

## Understanding Error Tags in Gatewayz

The codebase uses structured error tagging. Here are the main tags to filter by:

### Error Categories (`error_type` tag)

- `api_error` - API route failures
- `hook_error` - React hook errors
- `component_error` - UI component errors
- `service_error` - Service/utility function errors
- `auth_error` - Authentication failures
- `payment_error` - Payment processing errors
- `network_error` - Network/fetch failures
- `storage_error` - LocalStorage/SessionStorage errors
- `validation_error` - Input validation failures
- `integration_error` - Third-party integration issues

### Location Tags

- `api_route` - Which API endpoint failed (e.g., `/api/auth`, `/api/chat/completions`)
- `hook_name` - Which React hook (e.g., `useAuth`, `useChatStream`)
- `component_name` - Which component (e.g., `ChatInterface`, `ModelSelector`)
- `service_name` - Which service (e.g., `ChatHistoryAPI`, `models-service`)

### Operation Tags

- `operation` - What was being attempted (e.g., `auth_login`, `api_fetch`, `payment_process`)

## Common Error Patterns to Look For

### 1. Authentication Errors

**Search in Sentry:**
- Filter by tag: `error_type:auth_error`
- Check tags: `operation:auth_login`, `operation:auth_sync`

**Common causes:**
- Rate limiting (429 errors)
- Token expiration
- Privy authentication failures
- API key issues

**Relevant files:**
- `src/context/gatewayz-auth-context.tsx:236` - Auth timeout detection
- `src/context/gatewayz-auth-context.tsx:521` - Temporary API key upgrade failures
- `src/context/gatewayz-auth-context.tsx:642` - Max retry limit reached
- `src/components/providers/privy-provider.tsx:57` - Rate limit handling

### 2. API Errors

**Search in Sentry:**
- Filter by tag: `error_type:api_error`
- Group by: `api_route` tag

**Common patterns:**
- 5xx errors - Backend issues
- 4xx errors - Invalid requests
- Timeout errors
- CORS issues

**Relevant files:**
- `src/app/api/middleware/error-handler.ts` - Centralized error handler
- All `/api/*` routes

### 3. Chat/Streaming Errors

**Search in Sentry:**
- Filter by tag: `component_name:ChatInterface` or `hook_name:useChatStream`
- Look for streaming-related failures

**Common causes:**
- Model availability issues
- Token limit exceeded
- Streaming connection drops
- Rate limiting

**Relevant files:**
- `src/hooks/chat/use-chat-orchestrator.ts`
- `src/lib/streaming.ts`
- `src/lib/stream-coordinator.ts`

### 4. Payment Errors

**Search in Sentry:**
- Filter by tag: `error_type:payment_error`
- Check Stripe webhook failures

**Common causes:**
- Stripe webhook verification failures
- Payment processing issues
- Subscription management errors

**Relevant files:**
- `src/app/api/stripe/webhook/route.ts`
- `src/app/api/payments/*`

### 5. Model Sync Errors

**Search in Sentry:**
- Filter by tag: `service_name:model-sync-service`

**Common causes:**
- Gateway API failures
- Rate limiting from model providers
- Data parsing errors

**Relevant files:**
- `src/lib/model-sync-service.ts:100` - Sync operation errors
- `src/lib/models-service.ts` - Multi-gateway fetching

## Analyzing Error Trends

### Questions to Ask:

1. **Are errors increasing over time?**
   - Check the error graph in Sentry
   - Look for spikes correlating with deployments

2. **Are errors affecting many users or just a few?**
   - Check "User Count" vs "Event Count"
   - High events, low users = one user hitting the same error repeatedly

3. **Are errors clustered by browser/device?**
   - Filter by `browser` or `os` tags
   - May indicate compatibility issues

4. **Are errors in production only or also staging?**
   - Filter by `environment` tag
   - Production-only errors may indicate env config issues

5. **Do errors correlate with specific models/features?**
   - Check tags like `model`, `tier`, `gateway`
   - May indicate provider-specific issues

## Sentry Dashboard Filters to Try

### Most Impactful Errors
```
is:unresolved
environment:production
```
Sort by: **Events** (descending)

### New Errors This Week
```
is:unresolved
firstSeen:>now-7d
```

### Authentication Issues
```
error_type:auth_error
is:unresolved
```

### API Failures
```
error_type:api_error
status_code:[500 TO 599]
```

### High-Impact User Errors
```
is:unresolved
has:user
userCount:>10
```

## Taking Action on Common Errors

### Priority 1: Critical Errors (Fix Immediately)
- Errors preventing authentication
- Payment processing failures
- Errors affecting many users
- 5xx errors with high frequency

### Priority 2: High-Impact Errors (Fix Soon)
- Errors affecting specific features
- Errors with workarounds but poor UX
- 4xx errors indicating bugs
- Rate limiting issues

### Priority 3: Low-Impact Errors (Monitor)
- Errors affecting single users
- Edge case errors
- Client-side validation errors
- Non-critical background sync failures

## Exporting Data for Analysis

### From Sentry Dashboard:
1. Go to **Discover** → **Build new query**
2. Add filters and columns
3. Click **"..."** → **Export CSV**

### Using the API:
```bash
# Our script automatically saves JSON
bash scripts/fetch-sentry-errors.sh
# Creates: sentry-errors-YYYYMMDD-HHMMSS.json

# Then analyze with jq
jq '.[] | select(.level == "error") | {title, count, userCount}' sentry-errors-*.json
```

## Integration with Claude Code

When analyzing errors for fixes, you can:

1. **Export the error list** using the scripts above
2. **Share relevant errors** with Claude Code
3. **Get automated fixes** for common patterns

Example workflow:
```bash
# 1. Fetch errors
bash scripts/fetch-sentry-errors.sh

# 2. Review the output
# 3. Ask Claude Code to fix specific issues:
# "The authentication timeout error (gatewayz-auth-context.tsx:236) is occurring
#  frequently. Can you review and fix?"
```

## Additional Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Sentry Discover Queries](https://docs.sentry.io/product/discover-queries/)
- [Sentry API Reference](https://docs.sentry.io/api/)
- Our integration docs: `SENTRY_INTEGRATION.md`
- Error utilities: `src/lib/sentry-utils.ts`

## Need Help?

If errors are unclear or you need help prioritizing:

1. **Export the top 10 errors** using the scripts
2. **Share the error details** (title, count, stack trace)
3. **Ask for analysis** to identify root causes and fixes
