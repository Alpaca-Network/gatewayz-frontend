# Railway Error Monitoring & Auto-Fix Workflow

Complete workflow for using the error monitoring system with Railway deployment.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Your Railway Backend                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Application Logs & Errors                            │  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                             │
│  ┌────────────▼─────────────────────────────────────────┐  │
│  │ Error Monitor Service (Continuous)                   │  │
│  │ • Scans logs every 5 minutes                         │  │
│  │ • Detects error patterns                             │  │
│  │ • Classifies by severity                             │  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                             │
│  ┌────────────▼─────────────────────────────────────────┐  │
│  │ Auto-Fix Generator (When Threshold Met)              │  │
│  │ • Analyzes errors with Claude AI                     │  │
│  │ • Generates fix explanations                         │  │
│  │ • Proposes code changes                              │  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                             │
└───────────────┼─────────────────────────────────────────────┘
                │
       ┌────────▼────────┐
       │  GitHub Push    │
       └────────┬────────┘
                │
       ┌────────▼──────────────┐
       │ Create Pull Request   │
       │ (for your review)     │
       └────────┬──────────────┘
                │
       ┌────────▼──────────────┐
       │ Review & Test         │
       │ (by team)             │
       └────────┬──────────────┘
                │
       ┌────────▼──────────────┐
       │ Merge to main         │
       └────────┬──────────────┘
                │
       ┌────────▼──────────────┐
       │ Auto Deploy           │
       │ (GitHub Actions)      │
       └─────────────────────┬─┘
                             │
                    ┌────────▼────────┐
                    │  Issue Resolved │
                    │  & Deployed     │
                    └─────────────────┘
```

---

## Step-by-Step Workflow

### Phase 1: Initial Deployment to Railway

#### 1.1 Prerequisites

```bash
# Install Railway CLI
npm i -g @railway/cli

# Authenticate
railway login
```

#### 1.2 Deploy Application

```bash
# Option A: Use automated script
bash scripts/setup_railway.sh

# Option B: Manual setup
railway init
railway variables set ANTHROPIC_API_KEY "sk-ant-..."
railway variables set GITHUB_TOKEN "ghp_..."
# ... (set other variables)
railway up
```

#### 1.3 Verify Deployment

```bash
# Get your URL
URL=$(railway domains | head -1)

# Test health
curl $URL/health

# Check error monitor
curl $URL/api/error-monitor/status
```

**Status**: ✅ Application running and monitoring enabled

---

### Phase 2: Continuous Error Monitoring

#### 2.1 How It Works

Every 5 minutes (configurable), the system:

1. **Fetches recent logs** from Railway
2. **Parses for errors** using regex patterns
3. **Groups similar errors** into patterns
4. **Classifies severity**:
   - 🔴 **Critical**: System failures, data loss risks
   - 🟠 **High**: Major functionality broken
   - 🟡 **Medium**: Partial functionality affected
   - 🟢 **Low**: Workarounds available
   - ⚪ **Info**: Performance or informational

#### 2.2 Monitoring Configuration

```bash
# View current settings
railway variables

# Adjust scan interval (default: 300 seconds)
railway variables set ERROR_MONITOR_INTERVAL 300

# Lookback window (default: 1 hour)
railway variables set ERROR_MONITOR_LOOKBACK_HOURS 1

# Minimum severity for fixes (default: high)
railway variables set ERROR_FIX_MIN_SEVERITY high

# Min error count before triggering (default: 3)
railway variables set ERROR_FIX_MIN_COUNT 3
```

#### 2.3 Monitor in Real Time

```bash
# Watch for errors
watch -n 5 'curl -s https://your-url/api/error-monitor/errors | jq'

# Check status
curl https://your-url/api/error-monitor/status

# View full error details
curl https://your-url/api/error-monitor/errors?hours=1
```

**Status**: 🔍 System monitoring your application

---

### Phase 3: Error Detection

#### 3.1 When Error is Detected

Example: Application receives 5 `ValueError: Invalid API key format` in 30 minutes

```json
{
  "id": "err_2025110701",
  "type": "ValueError",
  "message": "Invalid API key format",
  "severity": "high",
  "count": 5,
  "first_seen": "2025-11-17T15:00:00Z",
  "last_seen": "2025-11-17T15:30:00Z"
}
```

#### 3.2 Error Conditions Met

The system checks:
- ✅ Error severity ≥ "high"
- ✅ Error count ≥ 3
- ✅ Error persisting ≥ 15 minutes
- ✅ AUTO_FIX_ENABLED = true

**Status**: ⚠️ Error detected, conditions met, generating fix...

---

### Phase 4: AI-Powered Fix Generation

#### 4.1 Claude Analysis

The system sends to Claude:

```
Error Pattern:
  Type: ValueError
  Message: Invalid API key format
  Stack Trace: [lines from logs]
  Context: Last 5 occurrences

Request: Analyze the error and propose a fix
```

#### 4.2 Claude Response

Claude provides:

1. **Root Cause Analysis**
   ```
   The error occurs when API keys don't match the expected format.
   The validation regex on line 42 is too strict.
   ```

2. **Solution Explanation**
   ```
   We should update the validation to allow both old and new formats.
   This maintains backward compatibility.
   ```

3. **Code Changes**
   ```python
   # Before:
   if not re.match(r'^sk-\d{32}$', key):
       raise ValueError("Invalid API key format")

   # After:
   if not re.match(r'^(sk-\d{32}|sk-[a-z0-9]{32})$', key):
       raise ValueError("Invalid API key format")
   ```

**Status**: 🤖 Fix generated by Claude

---

### Phase 5: GitHub Integration

#### 5.1 PR Creation

The system:

1. **Creates a new branch**
   ```
   auto-fix/error-2025110701-valueerror
   ```

2. **Commits the changes**
   ```
   fix: Handle both old and new API key formats

   Error Pattern:
   - Type: ValueError
   - Message: Invalid API key format
   - Occurrences: 5

   Solution:
   Update validation regex to support both formats
   while maintaining backward compatibility.

   Auto-generated by Claude Error Monitor
   ```

3. **Opens Pull Request**
   - Title: `[AUTO] Fix: ValueError - Invalid API key format`
   - Description: Includes error analysis and fix explanation
   - Reviewer: Assigned to team
   - Labels: `auto-generated`, `high-priority`

#### 5.2 GitHub Notification

You receive GitHub notification:

```
New Pull Request: [AUTO] Fix: ValueError - Invalid API key format
#42 opened by claude-bot

Changes: 1 file changed, 3 insertions(+), 1 deletion(-)
Error: Invalid API key format (5 occurrences)
Severity: High
```

**Status**: 📬 PR created and waiting for review

---

### Phase 6: Review & Testing

#### 6.1 Team Review

```markdown
## PR Details

### Error Information
- **Type**: ValueError
- **Message**: Invalid API key format
- **Count**: 5 occurrences
- **Severity**: High

### Analysis
The error occurs when API keys don't match expected format.
The validation is too strict.

### Solution
Update regex to accept both old and new key formats.

### Testing
[ ] Run tests locally
[ ] Test with old format keys
[ ] Test with new format keys
[ ] Verify no regression
```

#### 6.2 Local Testing

```bash
# 1. Checkout the PR branch
git checkout auto-fix/error-2025110701-valueerror

# 2. Run tests
pytest tests/security/test_api_keys.py -v

# 3. Test manually
python -m pytest tests/ --tb=short

# 4. Review changes
git diff main...auto-fix/error-2025110701-valueerror

# 5. If approved, push back to PR
git commit --allow-empty -m "Approved: Ready to merge"
git push origin auto-fix/error-2025110701-valueerror
```

#### 6.3 Approval

- ✅ Tests pass
- ✅ Code review approved
- ✅ No regressions detected
- ✅ Ready to merge!

**Status**: ✅ Fix validated, ready for deployment

---

### Phase 7: Merge & Deploy

#### 7.1 Merge to Main

```bash
# Via GitHub UI:
# 1. Click "Merge pull request"
# 2. Select "Squash and merge"
# 3. Confirm merge
# 4. Delete branch

# OR via CLI:
git checkout main
git pull origin main
git merge --squash auto-fix/error-2025110701-valueerror
git commit -m "Merge fix for ValueError"
git push origin main
```

#### 7.2 Automatic Deployment

GitHub Actions workflow triggers:

```yaml
Deploy to Railway:
  ✓ Build: 45 seconds
  ✓ Run tests: 2 minutes
  ✓ Deploy: 1 minute
  ✓ Health check: Passed
  ✓ Deployed!
```

#### 7.3 Railway Update

```bash
# Monitor deployment
railway logs --follow

# Verify new version
curl https://your-url/health
```

**Status**: 🚀 Fix deployed to production

---

### Phase 8: Verification

#### 8.1 Confirm Issue Resolved

```bash
# Check error frequency
curl https://your-url/api/error-monitor/errors?hours=1

# Expected: Error count drops to 0

{
  "errors": [],
  "total": 0
}
```

#### 8.2 Monitor for Regression

```bash
# Watch for new errors in this category
watch -n 60 'curl -s https://your-url/api/error-monitor/errors | jq'

# No new ValueError errors appearing ✓
```

#### 8.3 System Auto-Closes PR

The system automatically:
- ✅ Records fix successful
- ✅ Updates audit log
- ✅ Sends notification to team
- ✅ Cleans up branch

**Status**: 💚 Issue resolved and deployed!

---

## Configuration Options

### Scanning Behavior

```bash
# How often to scan for errors
ERROR_MONITOR_INTERVAL=300  # seconds (default: 5 min)

# How far back to look
ERROR_MONITOR_LOOKBACK_HOURS=1  # (default: 1 hour)

# Maximum errors to process per scan
ERROR_MONITOR_MAX_ERRORS=100
```

### Fix Generation

```bash
# Enable/disable auto-fix
AUTO_FIX_ENABLED=true

# Minimum severity threshold
ERROR_FIX_MIN_SEVERITY=high  # critical|high|medium|low|info

# Minimum error count before fixing
ERROR_FIX_MIN_COUNT=3

# Minimum error frequency (hours)
ERROR_FIX_MIN_DURATION=0.5
```

### GitHub Integration

```bash
# Create PRs automatically
AUTO_FIX_CREATE_PRS=true

# Repository (owner/repo)
AUTO_FIX_REPO=your-org/your-repo

# Base branch for PRs
AUTO_FIX_BASE_BRANCH=main

# Dry-run mode (don't create real PRs)
DRY_RUN=false
```

### Claude AI Settings

```bash
# Model to use
CLAUDE_MODEL=claude-opus-4-1-20250805

# Max tokens for analysis
CLAUDE_MAX_TOKENS_ANALYSIS=1024

# Max tokens for fix generation
CLAUDE_MAX_TOKENS_FIX=2048

# Temperature (0=deterministic, 1=creative)
CLAUDE_TEMPERATURE=0.3
```

---

## API Endpoints

### Check Status

```bash
curl https://your-url/api/error-monitor/status
```

Response:
```json
{
  "enabled": true,
  "monitoring": true,
  "errors_detected": 5,
  "last_scan": "2025-11-17T16:30:00Z",
  "auto_fix_enabled": true,
  "fixes_generated": 2,
  "prs_created": 1,
  "uptime": "8h 45m"
}
```

### Get Detected Errors

```bash
# All errors
curl https://your-url/api/error-monitor/errors

# Last N hours
curl https://your-url/api/error-monitor/errors?hours=2

# Specific severity
curl https://your-url/api/error-monitor/errors?severity=high
```

### Get Generated Fixes

```bash
curl https://your-url/api/error-monitor/fixes
```

### Manually Trigger Scan

```bash
curl -X POST https://your-url/api/error-monitor/scan \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

---

## Best Practices

### 1. Monitor the Monitoring

```bash
# Daily check
watch -n 300 'curl -s https://your-url/api/error-monitor/status | jq'

# Weekly review
curl https://your-url/api/error-monitor/errors?hours=168
```

### 2. Review All Auto-Generated PRs

- ⚠️ **Never** merge without reviewing
- ⚠️ **Always** run tests locally
- ✅ **Verify** the fix makes sense
- ✅ **Test** with real data when possible

### 3. Adjust Thresholds

Too many false positives?
```bash
railway variables set ERROR_FIX_MIN_SEVERITY critical
railway variables set ERROR_FIX_MIN_COUNT 5
```

Not catching enough errors?
```bash
railway variables set ERROR_FIX_MIN_SEVERITY medium
railway variables set ERROR_FIX_MIN_COUNT 2
```

### 4. Keep API Keys Secure

```bash
# Never commit secrets
echo ".env*" >> .gitignore

# Use Railway for secrets
railway variables set GITHUB_TOKEN "ghp_..."

# Rotate tokens regularly
# Update in Railway dashboard
```

---

## Troubleshooting

### No Errors Detected

```bash
# Check if monitoring is enabled
railway variables get ERROR_MONITORING_ENABLED

# Check logs
railway logs --follow | grep -i "error monitor"

# Verify threshold settings
railway variables get ERROR_FIX_MIN_COUNT
railway variables get ERROR_FIX_MIN_SEVERITY
```

### PRs Not Being Created

```bash
# Verify GitHub token is valid
railway variables get GITHUB_TOKEN

# Check if auto-fix is enabled
railway variables get AUTO_FIX_ENABLED

# Verify repository setting
railway variables get AUTO_FIX_REPO

# Check logs
railway logs --follow | grep -i "pr\|github"
```

### Issues with Generated Fixes

```bash
# Enable debug logging
railway variables set LOG_LEVEL DEBUG

# Check Claude API key
railway variables get ANTHROPIC_API_KEY

# Monitor token usage
railway logs --follow | grep -i "claude\|token"
```

---

## Summary

| Phase | Duration | Status | Action |
|-------|----------|--------|--------|
| 1. Deployment | 5-10 min | ✅ | Run setup script |
| 2. Monitoring | Continuous | 🔍 | Watch for errors |
| 3. Detection | 5 min - hours | ⚠️ | Automatic |
| 4. Fix Generation | 1-2 min | 🤖 | Automatic via Claude |
| 5. PR Creation | 1 min | 📬 | Automatic via GitHub |
| 6. Review | Your decision | ⏳ | Team review |
| 7. Merge & Deploy | 5 min | 🚀 | Automatic via CI/CD |
| 8. Verification | 10 min | 💚 | Confirm resolved |

---

**Total Time to Fix**: ~5-20 minutes from error detection to production fix!

---

**Next Step**: [Deploy to Railway](RAILWAY_QUICKSTART.md)
