# Tasks 2–4 Report (Phase 1 hygiene)

Branch: `refactor/mvp-north-star`. Baseline: 23 failed suites / 261 failed tests
(`.superpowers/baseline.txt`). Bar: zero NEW failures per task. All three tasks
verified at this bar and committed separately.

---

## Task 2 — Lockfiles, dead deps, root junk (commit `f76fcf87`)

**Deleted (all existed, all deleted as listed):**
- `package-lock.json`, `yarn.lock`
- 27 root junk files: `FRONTEND_ERROR_ANALYSIS_JAN_{7,8,13,14,16,18}_2026.md`,
  `CHAT_CONFLICTS_FINAL_STATUS.txt`, `CHAT_CONFLICTS_RESOLVED_FINAL.txt`,
  `CHAT_FIXES_CONFIRMATION.txt`, `CHAT_BOTTLENECK_SUMMARY.txt`,
  `AUTH_SUMMARY.txt`, `COMPLETION_SUMMARY.txt`, `FIXES_SUMMARY_JAN_8_2026.md`,
  `IMPLEMENTATION_SUMMARY.md`, `BACKEND_UPDATE_ANALYSIS.md`,
  `FRONTEND_PAGINATION_UPDATE.md`, `GITHUB_ISSUE_MODELS_FALLBACK.md`,
  `UNIQUE_MODELS_MIGRATION.md`, `UNIQUE_MODELS_README.md`, `PLAN_CONTEXT.md`,
  `plan.md`, `TODO.md`, `dev.log`, `pnpm-dev.log`, `sentry-errors-24h.json`,
  `welcome-email-template.html`, `test-auth-setup.html`,
  `resolve-chat-conflicts.sh`, `clear-cache-restart.sh`
- Firebase dead scaffold: `.firebaserc`, `.idx/` (`dev.nix`, `icon.png`),
  `apphosting.yaml`
- `env.example` (kept `.env.example`)
- `opencode/` (redundant with `claude-code/`)

**Moved:**
- 17 root dev/debug scripts → `scripts/dev/` (created). Grepped each for dead
  endpoint references (`user/credits`, `user/settings`, `/v1/models/popular`,
  `/gateways`) from Task 1's fixes — **zero hits**, so moved rather than
  deleted: `test-auth-session-fixes.js`, `test-chat.js`, `test-chat-cache.mjs`,
  `test-gemini-consolidation.js`, `test-model-cache.mjs`, `test-redis.js`,
  `test-redis-metrics.mjs`, `test-redis-production.js`, `test-tool-calling.ts`,
  `test-tool-calling-simple.ts`, `test-tool-calling-curl.sh`,
  `analyze-deduplication.js`, `check-arch-router.js`, `debug-api.js`,
  `gateway-counts.js`, `validate-chat-implementation.js`, `setup-test-user.sh`
- `dev/active/*` scratchpads → `docs/archive/dev/active/*`

**Untracked + gitignored:** `test-results/`, `playwright-report/` (both had
tracked files — `index.html`, `.last-run.json` — now removed from git and
ignored). `*.tsbuildinfo` was already ignored.

**package.json:**
- Removed `next-auth` — `grep -rn "next-auth" src/` → 0 hits.
- Removed `@sampleapp.ai/sdk` — `grep -rn "sampleapp" src/` → 4 hits, all in
  `src/lib/__tests__/csp-config.test.ts` asserting the `sampleapp.ai` CSP
  *domain string*, not a package import. Zero `@sampleapp.ai/sdk` imports.
- Moved `@faker-js/faker` → devDependencies — only used by
  `src/__tests__/factories/*.factory.ts` (test-only).
- Moved `react-scan` → devDependencies — already dev-gated at runtime
  (`src/components/providers/react-scan-provider.tsx` only calls
  `import('react-scan')` inside `if (NODE_ENV === 'development')`, loaded via
  `next/dynamic({ssr:false})`), so it's dev tooling, not a prod dependency.

**Verification:** `pnpm install` (lockfile regenerated), `pnpm lint` clean
(pre-existing a11y warning only), `pnpm build` green, `pnpm test` → 23 failed
suites / 261 failed tests — **exact baseline match**.

---

## Task 3 — Cut Cypress; single E2E stack (commit `731fa2ef`)

**Deleted:** `cypress/` (all 15 files), `cypress.config.ts`,
`.github/workflows/cypress.yml`.

**devDeps removed** (grepped each of the plan's 4 named packages for non-
Cypress usage first): `webpack-dev-server`, `css-loader`, `style-loader`,
`ts-loader` — all were used **only** by `cypress/webpack.config.ts`'s
component-test bundler config; `grep` across `jest.config.mjs` and
`next.config.ts`'s webpack customization found zero non-Cypress usage. Also
removed the unambiguous Cypress-only packages not individually named in the
plan but clearly part of D-FE2: `cypress`, `@cypress/react18`,
`@cypress/webpack-dev-server`, `@types/cypress`, `cypress-real-events`.
Removed `cypress:*` / `test:cypress` npm scripts, folded `test:all` to
`pnpm test && pnpm test:e2e`. Removed `"cypress"` from
`pnpm.onlyBuiltDependencies`.

**Note (left alone, out of scope):** `postcss-loader` was also only used by
the now-deleted `cypress/webpack.config.ts`'s CSS rule chain and isn't
referenced elsewhere (`postcss.config.mjs` is unrelated — that's PostCSS
plugin config, not the webpack loader). It's now an orphaned devDependency
too, but it wasn't in the plan's named removal list, so I left it in place
per scope discipline. Flagging for a follow-up cleanup pass.

**Playwright consolidation:** Merged `playwright/mobile-browser-errors.spec.ts`
→ `e2e/mobile-browser-errors.spec.ts`, deleted the stray `playwright/` dir
(it had no config of its own to "consolidate" — the duplication was just the
orphaned directory sitting outside `playwright.config.ts`'s `testDir: './e2e'`
and outside `testMatch`, so this file was invisible to the test runner even
before this change). Added it to `testMatch`.

**Bug found + fixed:** merging exposed a latent break — the file's
`'iOS Safari'` describe called `test.use({...devices['iPhone 13']})` inside a
describe group. Playwright forbids changing `defaultBrowserType` inside any
describe (forces a new worker), so `playwright test --list` errored to
**0 tests / 0 files**. Fixed by destructuring `defaultBrowserType` out of the
`devices['iPhone 13']` spread (viewport/UA/mobile-emulation properties kept);
the suite only asserts on mocked `indexedDB`/`localStorage`/console behavior,
not real WebKit rendering, so running it on the configured chromium project
instead of forcing webkit doesn't reduce assertion validity — flagging as a
minor fidelity trade-off worth a follow-up look.

**`tests/` dir deleted** (`README.md` + `streaming-validation.ts`): the plan's
criterion was explicit — "keep `streaming-validation.ts` only if imported".
`grep -rln "streaming-validation" src/ e2e/` → 0 hits (it's a standalone
script run via `tsx tests/streaming-validation.ts`, never `import`ed as a
module). Meets the deletion bar. **Note:** it's still referenced from
`docs/OPENROUTER_AUTO_STREAMING_TESTS.md` and `docs/testing/*` — those docs
are now stale; out of scope for this task (docs pruning is a Deferred item).

**Verification:** `pnpm install`, `pnpm lint` clean, `pnpm build` green,
`pnpm exec playwright test --list` → **269 tests / 16 files** discovered
(would have been 0/0 without the describe-nesting fix), `pnpm test` → 23
failed / 261 failed — exact baseline match.

---

## Task 4 — Delete orphan modules + macOS duplicate artifacts (commit `2e1d5289`)

**macOS " 2"/" 3" duplicate files:** All 14 files listed in the plan were
already absent — `find src -iname "* 2.*" -o -iname "* 3.*"` → 0 results.
Confirmed via `git log` these were removed in a prior PR (#993 "chore: remove
stray duplicate files"). **Skipped — already done**, nothing to do.

**Orphans deleted** (re-verified zero live importers per instructions — used
exact import-path greps, not raw substring matches, since e.g. "streaming" as
a bare string is common noise across the chat stack):
- `src/lib/streaming.ts` (1,112-line dead monolith) — `grep` for
  `from '@/lib/streaming'`/`from '../streaming'` found only a doc-comment
  inside the file itself pointing importers at the new `src/lib/streaming/`
  module. Deleted along with its two `__tests__` files
  (`streaming.test.ts`, `streaming-comprehensive.test.ts`).
- `src/lib/model-availability.ts`, `optimistic-updates.ts`,
  `audit-logging.ts`, `device-fingerprint.ts`, `message-queue.ts` — zero
  importers found; none had `__tests__` files to remove.
- `src/app/ai-sdk-demo/page.tsx.disabled` (whole dir, only file in it) —
  zero references anywhere (also unroutable by Next.js since it's not
  `.tsx`).
- `src/lib/mock_token_generation_data.json` — zero importers.
- `src/app/redbeard/` (dead client-side redirect to `/`) — confirmed by
  reading `page.tsx`: `router.replace('/')` and nothing else; zero external
  references; deleted with its `__tests__/`.

**Verification:** `pnpm lint` clean, `pnpm build` green (`/redbeard` and
`/ai-sdk-demo` routes no longer emitted in the build output — confirms the
routes were actually live before deletion and are gone now), `pnpm test` →
23 failed / 261 failed — exact baseline match (test/suite totals dropped
from deleted test files, as expected; zero new failures).

---

## Summary table

| Task | Commit | Deleted/Moved | Skipped (already done) | Build/Lint | Tests vs baseline |
|---|---|---|---|---|---|
| 2 | `f76fcf87` | 27 junk files, 2 lockfiles, Firebase scaffold, env.example, opencode/, 17 scripts moved, 4 dev docs archived, 2 dirs untracked, 4 package.json dep changes | — | green | 23/261 — match |
| 3 | `731fa2ef` | cypress/ (15 files) + config + CI workflow, 9 devDeps, playwright/ merged into e2e/, tests/ dir | — | green | 23/261 — match |
| 4 | `2e1d5289` | 6 orphan modules + 3 test files, ai-sdk-demo/, redbeard/ (+tests) | 14 macOS " 2"/" 3" dupes (removed in prior PR #993) | green | 23/261 — match |

## Concerns for follow-up (not fixed, out of scope for this pass)
1. `postcss-loader` devDep is now orphaned (was Cypress-webpack-only) but
   wasn't in the plan's named removal list — left in place.
2. `docs/OPENROUTER_AUTO_STREAMING_TESTS.md` and `docs/testing/*` still
   reference the now-deleted `tests/streaming-validation.ts`.
3. `mobile-browser-errors.spec.ts`'s iOS Safari test now runs on chromium
   (viewport/UA emulated) instead of true WebKit, due to the
   `defaultBrowserType` describe-nesting restriction — assertions are
   engine-agnostic mocks, but this is a fidelity reduction worth a look if a
   dedicated webkit project is ever added to `playwright.config.ts`.
