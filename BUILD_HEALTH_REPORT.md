# Build Health Report

**Generated:** 2026-02-08 | **Project:** nextn@0.1.0 | **Node:** v22 | **pnpm:** 9.15.4

## Status: NEEDS ATTENTION

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 4 |
| Moderate | 15 |
| Low | 22 |
| Info | 2 |
| **Total** | **43** |

**TypeScript typecheck:** PASS

---

## High Priority Issues (fix immediately)

### 1. Next.js 15.3.8 has multiple security vulnerabilities

**Severity:** HIGH | **Package:** `next@15.3.8`

Next.js 15.3.8 is affected by:
- **GHSA-h25m-26qc-wcjf** (HIGH) - HTTP request deserialization DoS when using insecure React Server Components. Patched in `>=15.3.9`.
- **GHSA-g5qg-72qw-gw5v** (MODERATE) - Cache Key Confusion for Image Optimization API. Patched in `>=15.4.5`.
- **GHSA-xv57-4mr9-wg8v** (MODERATE) - Content Injection for Image Optimization. Patched in `>=15.4.5`.
- **Middleware redirect handling** - Improper redirect handling in `>=15.0.0`. Patched in `>=15.4.7`.
- **DoS via request body** - Self-hosted DoS in `>=10.0.0`. Patched in `>=15.5.10`.

**Fix:**
```bash
# Update next.js to latest 15.x patch (pinned in package.json)
# Edit package.json: change "next": "15.3.8" to "next": "15.5.10"
pnpm install
```

> Note: `next` is pinned without a caret (`15.3.8` not `^15.3.8`). You must manually update the version string.

### 2. @types/react and @types/react-dom must NOT be upgraded to v19

**Severity:** HIGH | **Packages:** `@types/react`, `@types/react-dom`

The project uses React 18.3.1 at runtime. The latest `@types/react` (v19.x) and `@types/react-dom` (v19.x) are incompatible with React 18. Upgrading types without upgrading React will break compilation.

**Fix:** Keep `@types/react` and `@types/react-dom` pinned at `^18`. Do NOT upgrade until a full React 18 -> 19 migration is planned.

---

## Moderate Issues

### 3. Deprecated packages (3 dev dependencies)

| Package | Issue | Fix |
|---------|-------|-----|
| `@cypress/react18` | Deprecated | Remove. Cypress 13+ has built-in component testing. Use `cypress/react` import. |
| `@types/cypress` | Deprecated | Remove. Cypress ships its own types since v10. |
| `@types/ioredis` | Deprecated | Remove. `ioredis` v5 ships its own types. |

**Fix:**
```bash
pnpm remove @cypress/react18 @types/cypress @types/ioredis
```

### 4. Sentry deprecated configuration options

The `next.config.ts` Sentry config uses two deprecated options that emit build warnings:

| Deprecated Option | Replacement |
|-------------------|-------------|
| `disableLogger: true` | `webpack: { treeshake: { removeDebugLogging: true } }` |
| `automaticVercelMonitors: true` | `webpack: { automaticVercelMonitors: true }` |

**Fix:** Update `sentryWebpackPluginOptions` in `next.config.ts`:
```diff
- disableLogger: true,
- automaticVercelMonitors: true,
+ // Moved to webpack namespace per Sentry v10 deprecation
+ webpack: {
+   treeshake: { removeDebugLogging: true },
+   automaticVercelMonitors: true,
+ },
```

### 5. Transitive security vulnerabilities

| Package | Severity | Issue | Via |
|---------|----------|-------|----|
| `prismjs@1.27.0` | MODERATE | DOM Clobbering (GHSA-x7hr-w5r2-h6wg) | `@sampleapp.ai/sdk > react-syntax-highlighter > refractor > prismjs` |
| `hono@4.11.4` (4 vulns) | MODERATE | XSS, cache bypass, IP restriction bypass, arbitrary key read | `@privy-io/react-auth > x402 > wagmi > ... > hono` |
| `lodash@<=4.17.22` | MODERATE | Prototype Pollution | Transitive |

**Fix for prismjs:** Upstream fix needed in `@sampleapp.ai/sdk`. Add pnpm override as workaround:
```json
"pnpm": {
  "overrides": {
    "prismjs": ">=1.30.0"
  }
}
```

**Fix for hono:** Upgrade `@privy-io/react-auth` when a patched version is released (requires hono >= 4.11.7).

---

## Low Priority (version drift, no action needed now)

The following major versions are available. These are informational - upgrade only when ready:

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `ai` | 5.0.x | 6.0.x | AI SDK v6 has breaking changes. All `@ai-sdk/*` providers must upgrade together. |
| `@ai-sdk/anthropic` | 2.0.x | 3.0.x | Requires `ai@6`. Upgrade with ai. |
| `@ai-sdk/google` | 2.0.x | 3.0.x | Requires `ai@6`. Upgrade with ai. |
| `@ai-sdk/openai` | 2.0.x | 3.0.x | Requires `ai@6`. Upgrade with ai. |
| `@ai-sdk/react` | 2.0.x | 3.0.x | Requires `ai@6`. Upgrade with ai. |
| `next` | 15.3.x | 16.1.x | Next.js 16 is a major version. Review migration guide. |
| `react` / `react-dom` | 18.3.x | 19.2.x | React 19 migration required. |
| `tailwindcss` | 3.4.x | 4.1.x | Tailwind v4 has a new config system. Major migration effort. |
| `eslint` | 8.57.x | 10.0.x | ESLint 9+ uses flat config. Requires config rewrite. |
| `zod` | 3.25.x | 4.3.x | Zod v4 has API changes. Review migration guide. |
| `recharts` | 2.15.x | 3.7.x | Review changelog for API changes. |
| `stripe` | 19.3.x | 20.3.x | Review Stripe SDK changelog. |
| `date-fns` | 3.6.x | 4.1.x | v4 is ESM-only. |
| `@faker-js/faker` | 8.4.x | 10.3.x | v9/v10 dropped CommonJS support. |
| `@hookform/resolvers` | 4.1.x | 5.2.x | Requires react-hook-form v7.54+. |
| `@privy-io/wagmi` | 2.1.x | 4.0.x | v4 has breaking connector API changes. |
| `braintrust` | 0.4.x | 2.2.x | Major version jump. Review migration guide. |
| `dotenv` | 16.6.x | 17.2.x | v17 drops Node < 18. |

---

## Configuration Notes

| Item | Status | Recommendation |
|------|--------|----------------|
| `typescript.ignoreBuildErrors` | `true` | Consider `false` to catch type errors at build time |
| `eslint.ignoreDuringBuilds` | `true` | Consider `false` to catch lint errors at build time |
| `reactStrictMode` | `false` | Documented as disabled due to layout router issues |

---

## Usage

Run the build health monitor at any time:

```bash
# Full check with fix recommendations
pnpm build:health

# JSON output for CI integration
pnpm build:health:json

# Show actionable fixes
pnpm build:health:fix
```

The script automatically:
- Runs TypeScript typecheck
- Audits for security vulnerabilities (pnpm audit)
- Detects deprecated packages (pnpm outdated)
- Flags major version drift with breaking change notes
- Checks Sentry config for deprecations
- Validates Next.js security advisories
- Reviews build configuration
- Saves JSON reports to `reports/build-health-latest.json`

---

## Recommended Priority Actions

1. **Upgrade Next.js** from `15.3.8` to `>=15.5.10` (security fixes)
2. **Remove deprecated dev deps:** `@cypress/react18`, `@types/cypress`, `@types/ioredis`
3. **Update Sentry config** to use non-deprecated option names
4. **Add pnpm override** for `prismjs >= 1.30.0`
5. **Do NOT upgrade** `@types/react` or `@types/react-dom` to v19 until React migration
