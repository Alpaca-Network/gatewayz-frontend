# Sentry Error Analysis Scripts

This directory contains scripts to fetch and analyze common errors from Sentry.

## Quick Start

### 1. Get Your Sentry Credentials

1. Visit: https://sentry.io/settings/account/api/auth-tokens/
2. Create a new token with these permissions:
   - `project:read`
   - `event:read`
   - `org:read`
3. Find your organization slug: https://sentry.io/settings/
4. Find your project slug: https://sentry.io/settings/projects/

### 2. Set Environment Variables

```bash
export SENTRY_AUTH_TOKEN="sntrys_YOUR_TOKEN_HERE"
export SENTRY_ORG="your-org-slug"
export SENTRY_PROJECT="gatewayz-beta"  # or your project slug
```

Or add to `.env.local`:
```bash
SENTRY_AUTH_TOKEN=sntrys_YOUR_TOKEN_HERE
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=gatewayz-beta
```

### 3. Run a Script

**Shell script (quick):**
```bash
bash scripts/fetch-sentry-errors.sh
```

**Node.js script (detailed analysis):**
```bash
node scripts/analyze-sentry-errors.js
```

## Scripts

### `fetch-sentry-errors.sh`

Fast shell script using `curl` to fetch Sentry issues.

**Requirements:**
- `curl` (pre-installed on most systems)
- `jq` (optional, for pretty formatting)
  - macOS: `brew install jq`
  - Linux: `apt-get install jq` or `yum install jq`

**Output:**
- Top 10 most frequent errors
- Basic issue information
- Raw JSON saved to file

**Usage:**
```bash
# Default: last 7 days
bash scripts/fetch-sentry-errors.sh

# Custom time range
DAYS_BACK=14 bash scripts/fetch-sentry-errors.sh

# Save output to file
bash scripts/fetch-sentry-errors.sh > sentry-report.txt
```

### `analyze-sentry-errors.js`

Comprehensive Node.js script with detailed analysis.

**Requirements:**
- Node.js 18+

**Output:**
- Top 10 most frequent errors (detailed table)
- Detailed analysis of top 5 errors
- Error category breakdown
- Tag analysis
- Links to view in Sentry

**Usage:**
```bash
# Default: last 7 days
node scripts/analyze-sentry-errors.js

# The script reads from environment variables
# Make sure SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT are set
```

**Configuration:**
Edit these values at the top of `analyze-sentry-errors.js`:
```javascript
const SENTRY_ORG = 'your-org-slug';
const SENTRY_PROJECT = 'your-project-slug';
const DAYS_BACK = 7;
```

## Output Examples

### Shell Script Output

```
🔍 Fetching Sentry issues from the last 7 days...
Organization: gatewayz
Project: gatewayz-beta

✅ Successfully fetched Sentry issues

==================================================
  TOP 10 MOST FREQUENT ERRORS
==================================================

[1]
  Title:       Authentication timeout - stuck in authenticating state
  Issue ID:    GATEWAYZ-BETA-4X
  Events:      1,234
  Users:       456
  Level:       error
  Status:      unresolved
  First Seen:  2025-11-19T10:23:45Z
  Last Seen:   2025-11-26T09:15:32Z
  Link:        https://sentry.io/...
  Location:    src/context/gatewayz-auth-context.tsx

...

📁 Raw data saved to: sentry-errors-20251126-091532.json
```

### Node.js Script Output

```
🔍 Analyzing Sentry Errors...

================================================================================

Found 45 issues. Analyzing top 10 most frequent errors:

┌─────┬────────────┬───────────┬─────────────────────────────────────────────────┐
│ Rank│   Events   │   Users   │ Error Title                                     │
├─────┼────────────┼───────────┼─────────────────────────────────────────────────┤
│    1│       1234 │       456 │ Authentication timeout - stuck in authenticating│
│    2│        876 │       234 │ Temporary API key could not be upgraded         │
│    3│        567 │       123 │ Token retrieval timeout during authentication   │
...
└─────┴────────────┴───────────┴─────────────────────────────────────────────────┘


📊 Detailed Error Analysis:

================================================================================

1. Authentication timeout - stuck in authenticating state
--------------------------------------------------------------------------------
   Issue ID:      12345
   Short ID:      GATEWAYZ-BETA-4X
   Status:        unresolved
   Level:         error
   Type:          error
   Event Count:   1234
   User Count:    456
   First Seen:    11/19/2025, 10:23:45 AM
   Last Seen:     11/26/2025, 9:15:32 AM
   Link:          https://sentry.io/organizations/...
   Error Type:    Error
   Error Value:   Authentication timeout
   Tags:
     - error_type: auth_error
     - operation: auth_timeout
     - environment: production
   Location:      src/context/gatewayz-auth-context.tsx:236

...

📈 Error Categories:

================================================================================
   Error                           3 issues,   2345 events
   TypeError                       2 issues,   1234 events
   NetworkError                    1 issues,    567 events

🏷️  Common Error Tags:

================================================================================

   error_type:
     - auth_error: 5 issues
     - api_error: 3 issues
     - network_error: 2 issues

   operation:
     - auth_timeout: 1 issues
     - auth_sync: 1 issues
     - token_refresh: 1 issues

================================================================================

✅ Analysis complete!
```

## Analyzing the Output

### Key Metrics to Look At

1. **Event Count**: Total number of times the error occurred
2. **User Count**: Number of unique users affected
3. **First/Last Seen**: When error started and most recent occurrence
4. **Level**: `error`, `warning`, `info`, `fatal`
5. **Status**: `resolved`, `unresolved`, `ignored`

### Red Flags

🚨 **High Priority** if:
- Event count > 1000 in 7 days
- User count > 100
- Level = `error` or `fatal`
- Status = `unresolved`
- Location = authentication or payment code

⚠️ **Medium Priority** if:
- Event count > 100 in 7 days
- User count > 10
- Level = `warning`
- Recently started (within last 2 days)

ℹ️ **Low Priority** if:
- Event count < 100
- User count < 10
- Level = `info`
- Status = `resolved` or `ignored`

### Common Patterns

**Pattern 1: One user, many events**
```
Events: 1000
Users: 1
```
→ One user hitting the same error repeatedly. May be a specific user issue.

**Pattern 2: Many users, many events**
```
Events: 1000
Users: 500
```
→ Widespread issue affecting many users. HIGH PRIORITY.

**Pattern 3: Recent spike**
```
First Seen: 1 hour ago
Events: 500
```
→ New error after deployment. Check recent changes.

## Working with the Raw JSON

The scripts save raw JSON data to files like `sentry-errors-20251126-091532.json`.

### Query with `jq`

```bash
# Get all error titles
jq '.[].title' sentry-errors-*.json

# Get errors with > 100 events
jq '.[] | select(.count > 100) | {title, count, userCount}' sentry-errors-*.json

# Get all auth errors
jq '.[] | select(.tags[].key == "error_type" and .tags[].value == "auth_error")' sentry-errors-*.json

# Get errors by level
jq '.[] | select(.level == "error")' sentry-errors-*.json

# Count errors by status
jq 'group_by(.status) | map({status: .[0].status, count: length})' sentry-errors-*.json

# Get errors from specific file
jq '.[] | select(.culprit | contains("auth-context"))' sentry-errors-*.json
```

### Import into Spreadsheet

```bash
# Convert to CSV (requires jq)
jq -r '["Title","Events","Users","Level","Status","First Seen","Last Seen"],
       (.[] | [.title, .count, .userCount, .level, .status, .firstSeen, .lastSeen])
       | @csv' sentry-errors-*.json > sentry-errors.csv
```

Then open `sentry-errors.csv` in Excel, Google Sheets, etc.

## Troubleshooting

### Error: "SENTRY_AUTH_TOKEN environment variable is required"

**Fix:** Set the environment variable:
```bash
export SENTRY_AUTH_TOKEN="your-token-here"
```

Or add to `.env.local` and run with dotenv:
```bash
# Install dotenv-cli
npm install -g dotenv-cli

# Run with dotenv
dotenv -e .env.local -- bash scripts/fetch-sentry-errors.sh
```

### Error: "401 - Authentication failed"

**Causes:**
- Invalid token
- Expired token
- Token missing required permissions

**Fix:**
1. Get a new token: https://sentry.io/settings/account/api/auth-tokens/
2. Make sure it has `project:read` and `event:read` permissions

### Error: "404 - Project not found"

**Causes:**
- Wrong organization slug
- Wrong project slug
- Token doesn't have access to project

**Fix:**
1. Check your org slug: https://sentry.io/settings/
2. Check your project slug: https://sentry.io/settings/projects/
3. Update the script or environment variables

### Script outputs "command not found: jq"

**Fix:** Install `jq`:
- macOS: `brew install jq`
- Ubuntu/Debian: `sudo apt-get install jq`
- CentOS/RHEL: `sudo yum install jq`
- Or skip it - the script works without `jq`, just less pretty

## Next Steps

After running the scripts:

1. **Review the output** - Focus on high event/user counts
2. **Read the analysis docs** - See `COMMON_SENTRY_ERRORS.md` for expected errors
3. **Prioritize fixes** - Use the priority matrix in the docs
4. **Fix errors** - Start with critical and high-priority errors
5. **Monitor** - Run scripts regularly (weekly) to track progress

## Related Documentation

- `SENTRY_ERROR_ANALYSIS.md` - Complete guide to analyzing Sentry errors
- `COMMON_SENTRY_ERRORS.md` - Expected common errors in the codebase
- `SENTRY_INTEGRATION.md` - How Sentry is integrated
- `src/lib/sentry-utils.ts` - Error tracking utilities

## Questions?

If you need help interpreting the results or prioritizing fixes, share:
1. The script output (top 10 errors)
2. Any specific errors you're concerned about
3. Your goals (reduce error rate, fix user-impacting issues, etc.)
