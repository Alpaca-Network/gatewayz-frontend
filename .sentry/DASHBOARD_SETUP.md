# Sentry Dashboard Setup Guide

## Overview

This guide explains how to set up the Frontend Error Monitoring Dashboard in Sentry to track error resolution from our open PRs.

## Dashboard Configuration

**File**: `.sentry/dashboards/frontend-error-monitoring.json`

**Purpose**: Track frontend errors, measure PR impact, and monitor error filtering effectiveness.

---

## Setup Steps

### 1. Create Dashboard in Sentry

#### Option A: Using Sentry CLI
```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Configure auth token
export SENTRY_AUTH_TOKEN=your_auth_token_here

# Create dashboard
sentry-cli dashboards create \
  --org your-org \
  --project gatewayz-frontend \
  < .sentry/dashboards/frontend-error-monitoring.json
```

#### Option B: Manual Setup via UI

1. Go to **Sentry → Dashboards → Create Dashboard**
2. Name: `Frontend Error Monitoring`
3. Add widgets from the configuration file (see Widget Configuration section)
4. Set filters: `environment:production`, `project:gatewayz-frontend`
5. Set time range: Last 7 days

---

## Widget Configuration

### Core Metrics Widgets

#### 1. Error Rate Trend
```
Query 1: count() WHERE !error.handled:true
Query 2: count() WHERE !error.handled:true level:error
Display: Line chart
```
**Purpose**: Track overall error rate and critical errors
**Success**: Downward trend after PR merges

#### 2. Authentication Error Rate
```
Query: count() WHERE message:*auth* OR message:*privy* OR message:*sign-in*
Display: Line chart
```
**Purpose**: Monitor auth errors (PRs #650, #652, #653, #659)
**Success**: Reduction after auth PR merges

#### 3. Provider Initialization Errors
```
Query 1: count() WHERE message:*statsig* OR message:*session replay*
Query 2: count() WHERE message:*privy* OR message:*iframe*
Display: Line chart
```
**Purpose**: Track provider errors (PRs #651, #648)
**Success**: Zero errors after provider fixes

#### 4. Mobile Browser Errors
```
Query 1: count() WHERE message:*indexeddb* browser.name:*Safari*
Query 2: count() WHERE tags[is_ios_in_app_browser]:true
Display: Line chart
```
**Purpose**: Monitor iOS errors (PR #649)
**Success**: Errors filtered or zero occurrence

### Filter Effectiveness Widgets

#### 5. Filtered vs Captured Errors
```
Query 1: count() WHERE error.handled:true
Query 2: count() WHERE !error.handled:true
Query 3: equation | count(error.handled:true) / (count(error.handled:true) + count(!error.handled:true)) * 100
Display: Big number
```
**Purpose**: Measure filter effectiveness
**Target**: >90% filter rate

#### 6. Browser Extension Interference
```
Query: count() WHERE message:*chrome.runtime* OR message:*extension*
Display: Line chart
```
**Purpose**: Track extension errors (PRs #646, #647)
**Success**: All errors filtered

### PR Impact Tracking

#### 7. Error Resolution Impact
```
Query:
  SELECT tags[pr_number], error.type, count(),
  equation | count(release:before) - count(release:after)
  WHERE tags[pr_number]:*
  ORDER BY -equation
Display: Table
```
**Purpose**: Measure error reduction per PR
**How to use**: Tag errors with `pr_number` tag

### Critical Monitoring

#### 8. Critical Auth Flow Errors
```
Query:
  SELECT message, count(), count_unique(user), last_seen()
  WHERE message:*auth* !error.handled:true level:error
  ORDER BY -count()
Display: Table
```
**Purpose**: Immediate action items
**Alert**: Set up alert when count > 10

---

## Tagging Strategy for PR Tracking

### Before Merging a PR

Add tags to related errors in Sentry:

```javascript
// In instrumentation-client.ts or error handler
Sentry.setTag('pr_number', '652'); // Example for PR #652
Sentry.setTag('error_category', 'auth');
Sentry.setTag('pr_status', 'open');
```

### After Merging a PR

Update release tracking:

```javascript
// In sentry.*.config.ts
release: `frontend@${process.env.GIT_SHA}`,

// Tag the release with PR number
Sentry.setTag('merged_prs', '650,651,652');
```

### Recommended Tags for Each PR

| PR # | Tag | Error Pattern |
|------|-----|---------------|
| 650 | `pr_650_privy_hook` | `Invalid hook call` |
| 651 | `pr_651_statsig_init` | `Statsig initialization` |
| 652 | `pr_652_auth_logging` | Auth timing errors |
| 653 | `pr_653_privy_origin` | Origin not allowed |
| 649 | `pr_649_ios_indexeddb` | IndexedDB iOS errors |
| 648 | `pr_648_session_replay` | DOM manipulation |
| 647 | `pr_647_extension` | Extension fetch errors |
| 646 | `pr_646_network_monitor` | Network interference |
| 659 | `pr_659_database_deletion` | Database deleted |

---

## Alert Configuration

### Critical Alerts (PagerDuty/Slack)

#### 1. Auth Error Spike
```
Condition: count() WHERE message:*auth* level:error > 50 in 5 minutes
Action: Alert #engineering-critical
```

#### 2. Error Rate Spike
```
Condition: count() WHERE !error.handled:true > 100 in 5 minutes
Action: Alert #engineering
```

#### 3. Sentry Quota Approaching Limit
```
Condition: count() > 8000 in 1 hour
Action: Alert #devops (approaching 10k/hour limit)
```

### Warning Alerts (Slack only)

#### 4. New Error Pattern Detected
```
Condition: count_unique(error.type) increases by >3
Action: Notify #frontend-monitoring
```

#### 5. Mobile Browser Error Increase
```
Condition: count() WHERE tags[is_ios_in_app_browser]:true > 20 in 1 hour
Action: Notify #mobile-team
```

---

## Dashboard Interpretation Guide

### What to Look For

#### ✅ Good Signs
- **Error rate trending down** after PR merges
- **Filter rate >90%** (most errors are non-blocking)
- **Zero critical auth errors**
- **Mobile browser errors filtered** (not reaching Sentry)
- **Provider initialization errors = 0**

#### ⚠️ Warning Signs
- **Error rate plateau** after PR merge (PR didn't fix issue)
- **Filter rate <80%** (too many actionable errors)
- **Auth errors >10/hour** (user impact)
- **New error types appearing** (regression)

#### 🚨 Critical Issues
- **Error rate spike >5x** (deployment issue)
- **Sentry 429 errors** (quota exceeded)
- **Critical auth errors >50** (blocking sign-ins)
- **Filter rate <50%** (filtering broken)

### Weekly Review Checklist

**Every Monday**:
- [ ] Check error rate trend (should be downward)
- [ ] Review top 10 errors (prioritize fixes)
- [ ] Verify filter effectiveness (>90%)
- [ ] Check PR impact (merged PRs reducing errors?)
- [ ] Review quota usage (within limits?)
- [ ] Identify new error patterns (need new PRs?)

**After Each PR Merge**:
- [ ] Monitor related error rate for 24 hours
- [ ] Verify expected error reduction occurred
- [ ] Check for regressions (new errors introduced)
- [ ] Update PR impact table
- [ ] Document lessons learned

---

## Query Examples for Custom Analysis

### Find errors fixed by a specific PR
```sql
SELECT error.type, count()
WHERE tags[pr_number]:652
  AND release.version >= "frontend@abc123" -- Release with PR
GROUP BY error.type
ORDER BY count() DESC
```

### Compare error rates before/after PR merge
```sql
SELECT
  count() FILTER (WHERE release.version < "frontend@abc123") AS before,
  count() FILTER (WHERE release.version >= "frontend@abc123") AS after
WHERE error.type:"InvalidHookCall"
```

### Top errors affecting most users
```sql
SELECT error.type, count_unique(user), count()
WHERE !error.handled:true
GROUP BY error.type
ORDER BY count_unique(user) DESC
LIMIT 20
```

### Errors by browser/platform
```sql
SELECT browser.name, os.name, count()
WHERE !error.handled:true
GROUP BY browser.name, os.name
ORDER BY count() DESC
```

---

## Dashboard Maintenance

### Monthly Tasks
1. **Archive old errors**: Mark resolved errors with `status:resolved`
2. **Update filters**: Add new error patterns to `instrumentation-client.ts`
3. **Review widget queries**: Ensure queries still capture relevant data
4. **Check alert effectiveness**: Review false positives/negatives
5. **Document new patterns**: Update error catalog

### Quarterly Tasks
1. **Dashboard audit**: Remove unused widgets, add new ones
2. **Performance review**: Analyze error resolution velocity
3. **Team training**: Review dashboard usage with team
4. **Baseline update**: Set new error rate targets

---

## Integration with Development Workflow

### During Development
```bash
# Run tests and check for new error patterns
pnpm test
pnpm test:e2e

# Check dashboard before opening PR
open https://sentry.io/dashboards/frontend-error-monitoring/
```

### In Pull Requests
```markdown
## Error Impact

- [ ] Checked Sentry dashboard for related errors
- [ ] Tagged errors with PR number
- [ ] Expected error reduction: 50 errors/day → 0 errors/day
- [ ] Added tests for error scenario
- [ ] Updated error filters if needed
```

### Post-Deployment
```bash
# Monitor error rates for 1 hour after deployment
watch -n 60 'curl -X GET \
  https://sentry.io/api/0/organizations/your-org/projects/frontend/issues/ \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN"'
```

---

## Troubleshooting

### Dashboard not showing data
1. Verify project filter: `project:gatewayz-frontend`
2. Check time range: Last 7 days
3. Verify environment: `environment:production`
4. Check Sentry DSN configuration

### Queries returning no results
1. Verify tag exists: Check event in Issues → Tags
2. Escape special characters: Use `\` for `-`, `*`, etc.
3. Check field names: Use exact field from event JSON
4. Verify time range: Extend to 30 days

### Filter rate seems wrong
1. Check `error.handled` tag is set correctly
2. Verify `beforeSend` is filtering as expected
3. Review `instrumentation-client.ts` filter logic
4. Test with sample error in staging

---

## Additional Resources

- [Sentry Dashboards Documentation](https://docs.sentry.io/product/dashboards/)
- [Sentry Query Syntax](https://docs.sentry.io/product/sentry-basics/search/)
- [Custom Tags Guide](https://docs.sentry.io/platforms/javascript/enriching-events/tags/)
- [Alert Configuration](https://docs.sentry.io/product/alerts/)

---

**Last Updated**: December 31, 2025
**Maintainer**: Engineering Team
**Review Cycle**: Monthly
