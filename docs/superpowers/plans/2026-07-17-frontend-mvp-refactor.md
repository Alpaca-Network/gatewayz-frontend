# Frontend MVP Refactor Implementation Plan (North Star Alignment)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align gatewayz-frontend with `gatewayz-backend/docs/NORTH_STAR.md` — fix 8 live API-contract bugs, delete killed-feature surfaces and duplicate engines (~189k → ~125k LOC), and make the backend's DB-driven catalog the single source of model/provider truth.

**Architecture:** Hotfix the live contract bugs first (deployable same day), then pure subtraction (hygiene → feature cuts), then consolidation (one chat tree, one catalog source, one auth model, one cache standard). Every task ends with `pnpm build` green and a commit; a broken build is never committed.

**Tech Stack:** Next.js 15 (app router), TypeScript, pnpm 9.15.4, Privy auth, react-query, zustand, Jest + Playwright, Vercel (primary deploy), Tauri (desktop, kept).

## Global Constraints

- **Worktree only**: `git -C gatewayz-frontend worktree add ../gatewayz-frontend-mvp -b refactor/mvp-north-star` — all work there. Base on master AFTER PR #995 merges (Task 0 merges it).
- **Build gate**: after every task `pnpm lint && pnpm build` must pass. Typecheck via build. Never commit a broken build.
- **Test baseline**: record `pnpm test` results at start (23 pre-existing failures known — pricing/tier fixtures, ChatInput). Zero NEW failures per task; fixing pre-existing ones is welcome but not required.
- **Backend contract source of truth**: `gatewayz-backend` at **origin/main** (NOT the possibly-stale local checkout — run `git -C ../gatewayz-backend fetch origin main` and read via `git show origin/main:<path>`).
- **One commit per task**, prefix per task; bodies end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` and the session link trailer used in sibling PRs.
- **Decisions baked in (D-FE, amendable)**: D-FE1 prepaid-only — cut subscription management UI, keep top-up checkout + webhooks. D-FE2 cut Cypress (Playwright stays). D-FE3 delete Firebase scaffold; keep Vercel primary + Railway; keep Tauri. D-FE4 keep `/start/*` + `/claude-code` marketing pages, keep game-of-life 404 easter egg. D-FE5 chat-v2 is the surviving chat tree. D-FE6 react-query is the caching standard; frontend Redis layer is retired only where it caches catalog/model data (chat-session serverside caching stays until chat-history rework).

---

## Phase 0 — Contract hotfix (ship same day, independent of refactor)

### Task 0: Merge PR #995 + branch setup
- [ ] Verify gatewayz-frontend PR #995 CI is green: `gh pr checks 995` (repo Alpaca-Network/gatewayz-frontend) → zero fail. Merge: `gh pr merge 995 --merge`.
- [ ] Create worktree from updated master (command in Global Constraints). Record test baseline: `pnpm install && pnpm test 2>&1 | tail -5` → save output to `.superpowers/baseline.txt` (untracked).

### Task 1: Fix the 8 live API bugs
**Files:**
- Modify: `src/app/api/models/popular/route.ts` (dead `/v1/models/popular`)
- Modify: `src/components/chat/model-select.tsx` (popular fallback + `?search=` param)
- Modify: `src/app/models/[...name]/utils.ts` (`getPopularModels`)
- Modify: `src/app/api/stripe/webhook/route.ts:127`, `src/app/api/payments/webhook/route.ts:87` (dead `POST /user/credits`)
- Modify: `src/app/settings/page.tsx:93,142` (dead `/user/settings`)
- Modify: `src/lib/byok-api.ts:40` (`/gateways` → `/v1/gateways`)
- Modify: `src/app/api/contact/route.ts:42` (dead `/v1/contact`)
- Modify: `src/app/organizations/[name]/page.tsx:202` (`?developer=` ignored) — NOTE: this page is cut in Task 6; only fix if trivial, else skip with comment.

Fixes (verified against backend origin/main):
1. **Popular models**: backend has `GET /v1/models/trending` and `GET /ranking/models` (real usage). Point the popular route/fallbacks at `/v1/models/trending` (same response handling — verify shape with `git show origin/main:src/routes/catalog.py` around the trending route and adapt mapping in the proxy, not the components).
2. **Search**: replace `GET /v1/models?search=${q}` with `GET /v1/models/search?q=${encodeURIComponent(q)}` (param name per `catalog.py:2401` — verify `q` vs `query` in the signature before wiring).
3. **/user/credits**: the backend's own Stripe webhook does all crediting. Delete the `POST /user/credits` sync calls from both webhook proxies; leave a comment `// crediting handled by backend /api/stripe/webhook`. Do NOT invent a replacement call.
4. **/user/settings**: back the settings page with what exists: profile via `GET/PUT /user/profile` (verify field names in `git show origin/main:src/routes/users.py`). Settings keys with no backend home → persist in localStorage with a `// backend: no endpoint` comment.
5. **BYOK prefix**: `/gateways` → `/v1/gateways`.
6. **Contact**: no backend endpoint. Change the contact form to a `mailto:` fallback or disable submission with a "email us" notice — pick whichever the existing UI supports with less code; note choice in commit.
- [ ] Test-first where a proxy has tests (`src/app/api/__tests__/` — check); otherwise verify each fix by running dev server `pnpm dev` + curl the proxy route, and record before(404)/after(200) in the commit body.
- [ ] `pnpm lint && pnpm build` → green. `pnpm test` → no new failures.
- [ ] Commit `fix(api): repair 8 dead/misrouted backend calls`. Open PR immediately (this ships before the rest): `gh pr create` base master, title `fix: repair dead backend API calls (popular models, BYOK gateways, credits sync, settings, search)`.

---

## Phase 1 — Repo hygiene (zero risk)

### Task 2: Lockfiles, dead deps, root junk
**Files:**
- Delete: `package-lock.json`, `yarn.lock` (pnpm is authoritative: package.json packageManager + Vercel/Railway/CI all pnpm)
- Delete root junk: `FRONTEND_ERROR_ANALYSIS_JAN_{7,8,13,14,16,18}_2026.md`, `CHAT_CONFLICTS_FINAL_STATUS.txt`, `CHAT_CONFLICTS_RESOLVED_FINAL.txt`, `CHAT_FIXES_CONFIRMATION.txt`, `CHAT_BOTTLENECK_SUMMARY.txt`, `AUTH_SUMMARY.txt`, `COMPLETION_SUMMARY.txt`, `FIXES_SUMMARY_JAN_8_2026.md`, `IMPLEMENTATION_SUMMARY.md`, `BACKEND_UPDATE_ANALYSIS.md`, `FRONTEND_PAGINATION_UPDATE.md`, `GITHUB_ISSUE_MODELS_FALLBACK.md`, `UNIQUE_MODELS_MIGRATION.md`, `UNIQUE_MODELS_README.md`, `PLAN_CONTEXT.md`, `plan.md`, `TODO.md`, `dev.log`, `pnpm-dev.log`, `sentry-errors-24h.json`, `welcome-email-template.html`, `test-auth-setup.html`, `resolve-chat-conflicts.sh`, `clear-cache-restart.sh`
- Move to `scripts/dev/` (create): `test-auth-session-fixes.js`, `test-chat.js`, `test-chat-cache.mjs`, `test-gemini-consolidation.js`, `test-model-cache.mjs`, `test-redis.js`, `test-redis-metrics.mjs`, `test-redis-production.js`, `test-tool-calling.ts`, `test-tool-calling-simple.ts`, `test-tool-calling-curl.sh`, `analyze-deduplication.js`, `check-arch-router.js`, `debug-api.js`, `gateway-counts.js`, `validate-chat-implementation.js`, `setup-test-user.sh` (delete instead if a script references deleted endpoints — check each with grep)
- Delete: `apphosting.yaml`, `.firebaserc`, `.idx/` (Firebase dead scaffold, D-FE3); `env.example` (keep `.env.example`); `opencode/` (redundant with `claude-code/`); `dev/` (archive scratchpads into `docs/archive/dev/`)
- Untrack + gitignore: `test-results/`, `playwright-report/`, `tsconfig.tsbuildinfo`
- package.json: remove `next-auth`, `@sampleapp.ai/sdk` (zero imports — re-verify with `grep -rn "next-auth\|sampleapp" src/`); move `@faker-js/faker` to devDependencies; remove `react-scan` from prod usage (grep its 3 imports — dev-gate or remove).
- [ ] `pnpm install` (regenerates lock state), `pnpm lint && pnpm build` green, `pnpm test` no new failures.
- [ ] Commit `chore: repo hygiene — single lockfile, dead deps, root junk purge`.

### Task 3: Cut Cypress; single E2E stack (D-FE2)
**Files:** Delete `cypress/`, `cypress.config.ts`, `.github/workflows/cypress.yml` (verify name via `ls .github/workflows/`); remove devDeps `cypress`, `@cypress/react18`, `webpack-dev-server`, `css-loader`, `style-loader`, `ts-loader` (grep each for non-cypress usage first — `ts-loader` may serve another config). Merge the lone `playwright/mobile-browser-errors.spec.ts` into `e2e/` and delete the stray `playwright/` dir + its config duplication (consolidate into `playwright.config.ts`). Delete near-empty `tests/` dir (keep `tests/streaming-validation.ts` only if imported — grep).
- [ ] `pnpm install && pnpm lint && pnpm build`; run `pnpm exec playwright test --list` → e2e specs still discovered.
- [ ] Commit `chore: single E2E stack — remove Cypress, consolidate Playwright`.

### Task 4: Delete orphan modules + macOS duplicate artifacts
**Files (Delete — re-verify zero importers first with `grep -rn "<basename>" src/ --include="*.ts*" | grep -v "<own path>\|__tests__"`):**
- macOS dupes: `src/lib/chat-performance-tracker 2.ts`, `src/lib/message-batcher 2.ts`, `src/lib/optimistic-updates 2.ts`, `src/hooks/use-client-mounted 2.ts`, `src/hooks/useVirtualScroll 2.ts`, `src/components/ui/loading-spinner 2.tsx`, `src/components/ui/empty-state 2.tsx`, `src/components/settings/settings-section 2.tsx`, `src/components/chat/performance-monitor 2.tsx`, `src/components/chat/ChatMessage 2.tsx`, `src/app/api/chat/sessions/[id]/route 2.ts`, `src/app/api/chat/sessions/[id]/route 3.ts`, `src/app/api/middleware/error-handler 2.ts`, `src/app/api/middleware/error-handler 3.ts`
- Orphans: `src/lib/streaming.ts` (1,112 — dead monolith), `src/lib/model-availability.ts`, `src/lib/optimistic-updates.ts`, `src/lib/audit-logging.ts`, `src/lib/device-fingerprint.ts`, `src/lib/message-queue.ts`, their `__tests__` files, `src/app/ai-sdk-demo/page.tsx.disabled`, `src/lib/mock_token_generation_data.json` (grep importers first), `src/app/redbeard/` (dead redirect)
- [ ] Build + tests green. Commit `refactor: delete orphan modules and duplicate-file artifacts (~6k LOC)`.

---

## Phase 2 — Feature cuts (killed backend features + unblessed surfaces)

**CUT-TEMPLATE (Tasks 5–7):** (1) delete listed page/component/api-route files; (2) grep each deleted module name across src/ → remove dead imports/nav links; (3) `pnpm lint && pnpm build` green; (4) `pnpm test` no new failures (delete tests of deleted features); (5) commit.

### Task 5: Telemetry + killed settings cluster
**Delete:** `src/app/web-vitals/` (349), `src/components/web-vitals/` (1,112), `src/app/api/vitals/` + `api/vitals/pages` (570), `src/components/analytics/` (723), `src/app/api/analytics/` (if #995 left remnants), `src/app/settings/activity/` (350), `src/app/api/user/activity/` (124), `src/app/settings/cache/` (239), `src/app/api/audit/log`, `src/app/api/insights/assets` (94), `src/app/api/redis/test`, `src/app/api/sentry-test`, `src/app/sentry-example-page/` (verify path), `src/app/test-tier-display/` (270), `src/app/email-preview/` (450). Remove `/settings/activity` from settings nav (grep the settings layout/nav component).
- [ ] Apply CUT-TEMPLATE. Commit `refactor: remove telemetry dashboards, killed settings, dev routes (~4.3k LOC)`.

### Task 6: Coding-agent surface + org dashboard
**Delete:** `src/app/inbox/` (482), `src/components/inbox/` (273), `src/app/auth/terragon/` (503), `src/app/api/terragon/` , `src/app/agent/` (218), `src/lib/store/inbox-ui-store.ts`, `src/app/organizations/` (463), `src/components/dashboard/` (455), `src/components/metrics/` (423), `src/app/api/metrics/` (chat/realtime/trends/provider/health proxies), Terragon deps in package.json if any (grep `terragon` in package.json + src).
- [ ] Apply CUT-TEMPLATE. Commit `refactor: remove coding-agent surface and org analytics dashboard (~2.9k LOC)`.

### Task 7: Prepaid-only checkout (D-FE1)
**Files:**
- Delete: `src/app/api/stripe/cancel`, `subscribe`, `upgrade`, `downgrade`, `portal`, `customer` routes (subscription management)
- Keep: `src/app/api/stripe/checkout`, `src/app/api/stripe/webhook`, `src/app/api/payments/webhook`
- Modify: `src/app/checkout/page.tsx` (721) — strip subscription plan selection; the page becomes credit-top-up only (it already links from `/settings/credits?buy`; reuse the top-up amounts UI, delete plan-tier cards). Modify `src/app/checkout/success/page.tsx` (324) — remove subscription copy. Modify `src/components/pricing/pricing-section*` — reframe as credit pricing or delete if only subscription-oriented (grep importers; landing page may use it — if landing uses it, keep the component but delete subscription CTAs).
- Grep `subscribe|subscription|upgrade|downgrade` across src/ — remove dead references (releases page has stray subscribe refs).
- [ ] Playwright: run the checkout e2e spec if one exists (`ls e2e/ | grep -i "checkout\|payment"`); manual dev-server walk of `/settings/credits → checkout` recorded in commit body otherwise.
- [ ] Commit `refactor(billing): prepaid-only checkout — remove subscription management UI (~1.9k LOC)`.

---

## Phase 3 — Consolidations

### Task 8: One catalog source of truth (highest-value task)
**Files:**
- Canonical client: `src/lib/catalog-api.ts` — extend with typed getters the hardcoded tables currently satisfy: `getModels()`, `getModel(id)`, `getProviders()`, `getGateways()` backed by backend `/v1/models`, `/v1/models/search`, `/catalog/models-db*`, `/v1/gateways`, `/providers` (verify each against origin/main `catalog.py`/`providers_management.py`). Add react-query hooks in `src/lib/hooks/use-catalog.ts` (Create): `useModels(filters)`, `useModel(id)`, `useProviders()` with `staleTime: 5*60_000`.
- Migrate the 21 importers: `src/lib/data.ts` importers (6 — grep `from "@/lib/data"`), `src/lib/models-data.ts` importers (9), `src/lib/gateway-registry.ts` importers (6) → each moves to the catalog hooks/getters. Where a component needs sync data at module scope (e.g. static params), convert to server-component fetch or route-level loader — follow the pattern already used by `src/app/catalog/models/page.tsx` (read it first).
- Delete after migration: `src/lib/data.ts` (81-model table), `src/lib/models-data.ts`, `src/lib/gateway-registry.ts` (652), `src/lib/provider-config.ts` hardcoded configs (keep only genuinely-frontend concerns like logo mappings — move those to `src/lib/provider-logos.ts` (Create) if entangled), client-side pricing math in `src/lib/model-pricing-utils.ts`/`unique-model-utils.ts` that duplicates backend pricing (display formatting stays; price COMPUTATION goes — the API returns priced offers).
- Consolidate the duplicate catalog surface: `/models` + `/models/[...name]` become the single browsing UI fed by catalog-api; `/catalog/models` + `/catalog/providers` content merges into them; `/catalog/*` routes then redirect (`next.config.ts` redirects) to `/models`. Keep provider transparency (the `/catalog/providers` table) as `/models/providers` or a tab — implementer picks the lighter integration, notes it.

**Interfaces:** Produces `useModels/useModel/useProviders` consumed by Task 9's chat model-select migration.
- [ ] TDD: Jest tests for catalog-api getters (mock fetch, assert URL + response mapping) written first, RED → GREEN.
- [ ] Per-importer migration: build green after each batch; final grep `topModels\|models-data\|gateway-registry` in src/ → zero.
- [ ] Playwright models/catalog specs pass; dev-server spot-check `/models`, one model detail, chat dropdown.
- [ ] Commit `refactor(catalog): DB-driven catalog is the single source — delete hardcoded model/provider tables (~3.5k LOC)`.

### Task 9: One chat tree (D-FE5)
**Files:** Migrate the 6 still-referenced `src/components/chat/` files into `src/components/chat-v2/`: `ChatMessage.tsx`, `ai-sdk-chat-elements.tsx`, `free-models-banner.tsx`, `guest-chat-counter.tsx`, `model-select.tsx` (1,180 — port to consume Task 8's `useModels`), `reasoning-display.tsx`. Update importers (grep `components/chat/` across src/). Then delete the remainder of `src/components/chat/` (~5–6k dead) + its tests for deleted files.
- [ ] Build green; `pnpm test` chat suites no new failures; Playwright chat e2e passes; manual dev-server chat smoke (send one message on a free model) recorded.
- [ ] Commit `refactor(chat): single chat-v2 tree — migrate 6 shared components, delete legacy (~5.5k LOC)`.

### Task 10: One chat-state home + streaming cleanup
**Files:** Keep `src/hooks/chat/` (orchestrator family) as the single home IF it's what chat-v2 uses (verify: grep chat-v2's imports). Fold the surviving pieces of `src/lib/hooks/use-chat-stream.ts` (642) and `src/features/chat/useChatController.ts` into it; delete what chat-v2 doesn't use (grep importers per file; anything imported only by the Task-9-deleted legacy tree dies). Delete `src/lib/chat-stream-handler.ts`/`stream-coordinator.ts` if orphaned post-Task-9 (grep). Keep `src/lib/streaming/` dir (live engine).
- Escalate (BLOCKED) instead of improvising if chat-v2 genuinely depends on two state systems simultaneously — report the dependency graph.
- [ ] Build + chat tests + Playwright chat spec green. Commit `refactor(chat): single chat-state system (~1.5k LOC)`.

### Task 11: Auth consolidation
**Files:** Keep `src/context/gatewayz-auth-context.tsx` as the single public auth API but slim it: extract pure logic into `src/lib/auth/auth-service.ts` (existing, keep); delete `src/lib/auth/auth-machine.ts` (xstate) IF the context doesn't import it (grep — if imported, this task becomes: pick machine XOR context internals, keep the one with more call sites, port the other; report choice); delete `src/lib/store/auth-store.ts` if its subscribers can read context (grep subscribers; zustand store dies only if ≤3 call sites, else defer + report); merge `token-refresh.ts` + `use-token-refresh.ts` dup pair into one; keep `session-cache.ts`. Remove `xstate` dep if unused after.
- This task is judgment-heavy: verify each deletion by importer count, escalate on ambiguity, never break login. Manual verification: dev-server login/logout with Privy + API-key fetch on `/settings/keys`.
- [ ] Build + auth tests green. Commit `refactor(auth): consolidate to context+service, drop parallel state models`.

### Task 12: Caching standard (D-FE6)
**Files:** Adopt react-query for catalog (done in Task 8) + settings + credits fetches (grep `useEffect.*fetch` in `src/app/settings/**` and migrate the 3–5 heaviest to hooks). Delete `src/lib/cache-strategies.ts` (557) if importers ≤2 after Task 8 (grep; else defer). Retire Redis catalog caching: in `src/lib/redis-client.ts`/`redis-metrics.ts` keep ONLY chat-session paths (grep call sites; catalog/model cache keys die with Task 8). Delete root `test-redis*.js` scripts already moved in Task 2 if their subject died. Do NOT touch chat-session Redis caching.
- [ ] Build + tests green. Commit `refactor(cache): react-query standard; retire catalog-side Redis caching`.

---

## Phase 4 — Verification + docs truth

### Task 13: Full verification sweep
- [ ] `pnpm lint && pnpm build` green. `pnpm test` → compare vs baseline (no new failures; note fixed ones). Full Playwright: `pnpm exec playwright test` → no new failures vs a baseline run recorded in Task 0.
- [ ] Dev-server manual pass recorded in commit body: landing, `/models` + detail, chat send (free model, stream), `/settings/{credits,keys,integrations}`, top-up checkout page render, login/logout.
- [ ] LOC report: `find src -name '*.ts' -o -name '*.tsx' | xargs wc -l | tail -1` → target ≤ ~135k (from 171k src). Grep sweep: `topModels\|gateway-registry\|components/chat/\|cypress\|terragon\|web-vitals` → zero live references.
- [ ] Commit `refactor: verification sweep`.

### Task 14: Docs + PR
- [ ] Update `CLAUDE.md` (frontend) to post-refactor reality (single chat tree, DB catalog, prepaid checkout, removed features). Append `## Outcome` to this plan file. Update `docs/FRONTEND_NORTH_STAR_AUDIT.md` header: status → executed.
- [ ] Push branch, `gh pr create` base master: title `refactor: MVP North Star alignment — DB catalog, single chat tree, prepaid-only (−~40k LOC)`; body = per-phase summary, D-FE1–6 decisions, verification evidence, known-deferred list. Standard trailer.

---

## Execution notes

- Task 1 ships as its own PR immediately; Tasks 2–14 ride the refactor branch/PR.
- Tasks 5–7 are independent; 8 must precede 9; 9 precedes 10; 11–12 independent of 8–10 except where grep says otherwise.
- Escalation rule everywhere: unlisted live importer → dead-branch removal only if obviously part of the cut, else skip + report.
- Frontend deploys via Vercel on merge — the Phase 0 PR is safe standalone; the big PR should be merged when someone can watch Sentry for 30 minutes after deploy.

## Deferred (post-MVP)
- Oversized-file splits (`models-client.tsx` 1,905, `gatewayz-auth-context.tsx` post-slim, `ChatInput.tsx` 1,547, credits page 1,068).
- `docs/` (265 files) pruning pass; Statsig-vs-PostHog single-telemetry decision; Tauri extraction to its own workspace; chat-history UI rework against future backend chat-session changes.

## Outcome

Shipped on `refactor/mvp-north-star` (Tasks 0–14, 21 commits): −31.5k LOC in
`src/` (171k → 139.5k), single chat-v2 tree, single auth model, single
E2E framework, prepaid-only checkout, and a DB-driven catalog surface
(`catalog-api.ts` + `use-catalog.ts`) now consumed by chat model-select and
the settings/preset pages. Verification held the 21-failed-suite/255-failed-
test baseline at every task (zero new failures); Playwright: 108 passed, 21
failed (needs live Privy creds / IndexedDB emulation — both pre-existing,
unrelated to this refactor), 140 skipped. Key audit-premise inversions
(reported honestly, not fabricated): `lib/data.ts` and `gateway-registry.ts`
were NOT hardcoded duplicates of the DB catalog — each holds data/behavior
the backend genuinely lacks — so they were kept, not deleted; three of the
plan's "three parallel chat-state systems" were already dead code, not live
duplication, so Task 10 was a deletion, not a merge. Two of the four Phase-3-
review follow-ups are done (model-select + settings pages now read
`useModels`); two remain open (synthetic dashboard charts have no backend
home; `/api/gateways` still merges frontend registry config with the
backend list rather than reading everything server-side). See per-task
`.superpowers/task-*.md` reports for full detail.
