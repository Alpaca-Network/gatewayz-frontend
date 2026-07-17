# Tasks 5–7 Report (Phase 2 — Feature Cuts)

Branch: `refactor/mvp-north-star`. Baseline: 23 failed suites / 261 failed tests
(`.superpowers/baseline.txt`). Bar: zero new failures.

All three tasks applied the CUT-TEMPLATE: delete listed files -> grep every
deleted module name across `src/` -> fix dead imports/links in live
importers -> `pnpm lint && pnpm build` green -> `pnpm test` no new failures
(verified by diffing against a `git stash` of each task's working-tree diff,
not just eyeballing counts) -> commit.

---

## Task 5 — Telemetry + killed settings cluster

Commit: `cf236caf refactor: remove telemetry dashboards, killed settings, dev routes (~4.3k LOC)`

**Deleted** (all present, none missing):
- `src/app/web-vitals/`, `src/components/web-vitals/` (6 files), `src/app/api/vitals/` (+ `pages/`)
- `src/app/settings/activity/`, `src/app/api/user/activity/` (`log`, `stats`)
- `src/app/settings/cache/`
- `src/app/api/audit/log/`, `src/app/api/insights/assets/` (+ `[id]/`)
- `src/app/api/redis/test/`, `src/app/api/sentry-test/`, `src/app/sentry-example-page/`
- `src/app/test-tier-display/`, `src/app/email-preview/`

**Also deleted (unlisted, but direct fallout of the cut, zero other importers):**
- `src/hooks/use-web-vitals.ts` + test, `src/lib/web-vitals-service.ts` + test,
  `src/lib/web-vitals-types.ts` — only consumers were the deleted web-vitals
  page/components.
- `src/lib/asset-insights-service.ts` — only consumers were the deleted
  `api/insights/assets` routes.

**Skipped/not applicable:**
- `src/app/api/analytics/` — already gone (#995 left no remnants, matches plan's caveat).
- `api/vitals/pages` (repo-root path) — doesn't exist; the real file is
  `src/app/api/vitals/pages/route.ts`, which was deleted.
- No `src/app/sitemap.ts` or `robots.ts` exist in this repo — nothing to check there.

**Nav/dead-link cleanup:**
- `src/app/layout.tsx` — removed `WebVitalsReporter` import + mount.
- `src/app/settings/layout.tsx` — removed Activity, Prompt Cache, Web Vitals
  nav entries.
- `src/components/layout/user-nav.tsx`, `src/components/layout/app-header.tsx`
  — removed Activity dropdown/mobile-menu links.
- `src/app/settings/privacy/page.tsx` — removed the "Prompt Cache" link
  (and now-unused `Link` import).

**Explicitly NOT touched (load-bearing for a KEEP surface):**
- `src/components/analytics/` (`google-analytics.tsx`, `twitter-pixel.tsx`,
  `gtm.tsx`, `gtm-loader.tsx`) — the plan lists this dir under Task 5, but it
  is **not** a telemetry dashboard; it's live marketing/conversion-tracking
  code (Google Ads signup conversion, Twitter pixel, GTM) wired into
  `layout.tsx`, `gatewayz-auth-context.tsx`, `signup/page.tsx`,
  `WaitlistForm.tsx`, `PricingSection.tsx`, `app-header.tsx`,
  `get-credits-button.tsx`. Deleting it would break signup conversion
  tracking on live KEEP surfaces. Left fully intact — plan/reality mismatch,
  flagging for the plan author.

**Test fix:** `src/components/layout/__tests__/user-nav.test.tsx` asserted an
"Activity" dropdown item — removed that one assertion (feature deleted).

**Verification:** `pnpm lint` green (pre-existing unrelated a11y warning only).
`pnpm build` green, all deleted routes absent from the route manifest.
`pnpm test`: 23 failed / 261 failed — exactly matches baseline.

---

## Task 6 — Coding-agent surface + org dashboard

Commit: `74e85f2d refactor: remove coding-agent surface and org analytics dashboard (~2.9k LOC)`

**Deleted** (all present):
- `src/app/inbox/` (6 files), `src/components/inbox/` (3 files)
- `src/app/auth/terragon/` (3 files), `src/app/api/terragon/` (`auth/` + test)
- `src/app/agent/` (3 files)
- `src/lib/store/inbox-ui-store.ts` + test
- `src/app/organizations/` (`[name]/layout.tsx`, `page.tsx`, test)
- `src/components/metrics/` (`realtime-metrics-card.tsx`, `health-leaderboard.tsx`)
- `src/app/api/metrics/` (`chat`, `realtime`, `trends`, `health/leaderboard`, `provider/summary`)
- `src/components/dashboard/{model-insights-dashboard,token-generation-chart,top-models-table}.tsx`
  (partial — see below)
- No `terragon` string in `package.json` — nothing to remove there.

**Kept out of `src/components/dashboard/`:** `top-apps-table.tsx`. It is
imported by `src/app/models/[...name]/page.tsx` (lazy import) and
`src/hooks/useModelData.ts` (type-only import) — both live model-detail-page
code, not org-dashboard-specific. Deleting it would have broken the models
page. The plan lists the whole `components/dashboard/` dir for deletion;
verified per-file importers first and kept only this one file.

**Nav/dead-link cleanup:**
- `src/components/layout/app-footer.tsx` — removed the `isAgentPage` /
  `isInboxPage` state, their `pathname.startsWith` setters, and the
  "hide footer on agent/inbox pages" early returns (dead now that those
  routes are gone).
- `src/app/developers/page.tsx` — removed the "View Profile" CTA
  (`CardFooter` + `Link` to `/organizations/[author]`) that pointed at the
  now-deleted org-profile page; dropped the now-unused `CardFooter`,
  `ArrowRight`, and `Link` imports.
- `src/components/layout/__tests__/app-footer.test.tsx` — removed the
  "should not render on agent pages" test (feature deleted).

**Explicitly left alone (judgment calls, reported not fixed):**
- `src/config/redirects.ts` — the `/inbox`, `/code`, and `/terragon` ->
  `TERRAGON_DASHBOARD_URL` redirects are untouched. They don't import any
  deleted file (pure string constants), so nothing breaks the build. Bigger
  finding: `/code` is a real KEEP marketing page (`src/app/code/page.tsx`
  re-exports `src/app/claude-code/page.tsx`, D-FE4), but the `/code` redirect
  in `next.config.ts` currently shadows it — a **pre-existing** conflict,
  not something this cut introduced or was asked to fix. `next-config-redirects.test.ts`
  and `next-config-headers.test.ts` (CSP-embedding tests for `/agent`,
  `/inbox`) still test this untouched config and continue to pass.
- `src/context/gatewayz-auth-context.tsx` — has a generic
  `sessionStorage.getItem("auth_bridge_active")` check (comment: "e.g.
  Terragon") that's now permanently false/dead since only the deleted
  `auth/terragon/page.tsx` ever set that key. Left alone: core auth logic,
  not in Task 6's file list, harmless as dead code (falls through to normal
  onboarding redirect, which is correct post-cut).
- `src/hooks/{use-trend-data,use-provider-summary,use-health-leaderboard,
  use-realtime-metrics}.ts` and `src/lib/chat-performance-tracker.ts` — now
  fully orphaned (fetch from the deleted `/api/metrics/*` routes, zero
  remaining importers after `components/metrics/` and
  `components/chat/performance-monitor.tsx`'s only caller chain died). Left
  in place — not explicitly listed, no build/runtime breakage since nothing
  imports them; candidates for a future orphan-cleanup pass (Task 4-style).

**Verification:** `pnpm lint` green. `pnpm build` green — `/inbox`, `/agent`,
`/organizations/[name]`, `/auth/terragon` routes gone from the manifest.
`pnpm test`: 22 failed / 257 failed (down from 23/261 — the reduction is
suites that were deleted, e.g. `organizations/[name]/pricing-display.test.tsx`;
confirmed via `git stash` diff that no suite newly failed).

---

## Task 7 — Prepaid-only checkout (D-FE1)

Commit: `refactor(billing): prepaid-only checkout — remove subscription management UI (~1.9k LOC)`

Read `src/app/checkout/page.tsx` in full before editing (604 lines). It was
one component handling 5 mutually-exclusive flows selected by URL params:
`cancel` -> `/api/stripe/cancel`, `downgrade` -> `/api/stripe/downgrade`,
`upgrade` -> `/api/stripe/upgrade`, new subscription -> `/api/stripe/subscribe`,
and credit top-up -> `/api/stripe/checkout`. These were cleanly separable by
the `mode`/`action` query params (not entangled in shared state beyond the
top-level `if` branches), so this was a straightforward strip rather than a
"keep a slimmed component" situation.

**Deleted:**
- `src/app/api/stripe/{cancel,subscribe,upgrade,downgrade}/` (+ their tests).
  Verified zero importers anywhere in `src/` besides the checkout page itself
  (which no longer calls them) before deleting.
- `src/components/pricing/pricing-section.tsx` + test. This component (tier
  cards with Get Started/Upgrade/Downgrade/Cancel CTAs -> `/checkout?tier=...`)
  had exactly one importer: `src/app/settings/credits/page.tsx`. The landing
  page (`src/app/page.tsx`) does **not** import it (verified — the plan's
  "landing page may use it" caveat doesn't apply here). Since its only
  purpose is subscription-tier CTAs and its only consumer needed the same
  cut, deleted the whole component per the plan's own fallback
  ("delete if only subscription-oriented").
  - Note: `src/components/sections/PricingSection.tsx` is a *different*,
    already-orphaned file (zero importers, unrelated) — left untouched,
    out of scope.

**Modified:**
- `src/app/checkout/page.tsx` — rewritten to only handle the credit-package
  flow (`currentPackage` / `isCreditPurchase` branch). Removed: tier
  state/selection, quantity selector ("Number of Licenses"), the plan-switcher
  grid, `tierConfigs`/`TierConfig` import, and the cancel/downgrade/upgrade/
  subscribe fetch branches. Kept: auth gate, credit-package summary card,
  discount/savings display, trust badges, back button, `/api/stripe/checkout`
  call. Entry path `/settings/credits` -> `?buy` dialog -> `/checkout?package=<id>&mode=credits[&amount=]`
  preserved verbatim (`src/app/settings/credits/page.tsx`'s `router.push` calls
  were not touched).
- `src/app/checkout/success/page.tsx` — removed the `starter`/`pro`/`max`/
  `enterprise` tier-config branches and the `tier`/`priceId`/`quantity`
  URL-param reads (subscription-only); now always renders the credits
  copy/status. Backend confirmed compatible: `src/app/api/stripe/checkout/route.ts`
  already sets `success_url` with `tier=credits` (the only path that still
  reaches this page).
- `src/app/settings/credits/page.tsx` — removed the `<PricingSection />`
  import/render. Left the rest of the page untouched: the informational
  "Subscription Plan" / `TierInfoCard`, and the Pro/Max "credit breakdown"
  cards that read `userData.subscription_status`/`subscription_allowance`
  are read-only displays of existing tier state, not purchase actions — kept
  per the instruction to only cut *management* UI.

**Tests rewritten to match the new credit-only page** (not just patched):
`src/app/checkout/__tests__/page.test.tsx` (was 100% subscription-flow
tests — tier/mode=subscription mocks, plan switcher, quantity selector,
discount-visibility — none of which apply anymore; rewrote to mock
`package`/`mode=credits` params and assert the credit-package flow),
`src/app/checkout/success/__tests__/page.test.tsx` (3 tests expected
"Pro"/"Active" tier copy — updated to expect the default "Credit Package"
name and "Completed" status), `src/app/settings/credits/__tests__/page.test.tsx`
(removed the `PricingSection` mock + its one test).
`src/app/checkout/__tests__/credit-package-discount.test.tsx` needed no
changes — it already only exercised the credit-purchase path.

**Entanglement found and reported (per Task 7's explicit judgment-call ask):**
- `src/app/settings/account/page.tsx` (a KEEP page, not in Task 7's file
  list) calls `/api/stripe/customer` (fetch saved payment methods/customer
  name for the "Billing Details" section) and `/api/stripe/portal` (opens
  Stripe's customer billing portal for "Manage Payment Methods"). The plan's
  Task 7 delete list names `portal` and `customer` alongside
  cancel/subscribe/upgrade/downgrade as "subscription management" routes.
  Verified: unlike the other four, these two **do** have a live KEEP-surface
  importer. Since Stripe's customer portal is also the standard mechanism for
  viewing/updating a saved card even without an active subscription, and
  since deleting these routes would break a page entirely outside Task 7's
  stated scope, **left `src/app/api/stripe/{portal,customer}/route.ts`
  in place** rather than risk-editing an unrelated settings page. Flagging
  per plan instructions rather than guessing; a follow-up task should decide
  whether "Billing Details" (saved card display) survives as-is or needs its
  own slimming once Stripe's portal config is confirmed subscription-free.
- Broader, out-of-scope observation: `src/components/layout/credits-display.tsx`,
  `src/components/tier/tier-access-guard.tsx`, and
  `src/components/tier/tier-info-card.tsx` still show "Upgrade to Pro/Max"
  prompts linking to `/settings/credits` or `/settings?tab=billing`. Since
  the subscribe path is gone, these are now soft dead-ends (page loads fine,
  just no more upgrade CTA there) rather than broken links/imports. Not
  touched — these files aren't in Task 7's list and touching them means
  editing the app-wide tier-gating system, out of this task's scope.
- `src/app/releases/page.tsx` (changelog) has two textual mentions of past
  "Subscribe"/"Upgrade/downgrade" features in historical release-note copy.
  Left as-is — treating it like a CHANGELOG, not live UI; rewriting history
  to erase mentions of later-cut features seemed wrong. Flagging in case the
  plan author meant something more specific by "stray subscribe refs."
- `src/lib/pricing-config.ts` — `tierConfigs`/`TierConfig`/`pricingTiers`
  exports are now fully unused (only consumer was the old checkout page).
  Left the file in place since `creditPackages`/`CreditPackage` (used by the
  new checkout page) live in the same file — a follow-up could split or trim
  it, not done here to minimize risk.

**Verification:**
- `pnpm lint` green (same pre-existing a11y warning as Tasks 5/6, unrelated).
- `pnpm build` green — `/api/stripe/{cancel,subscribe,upgrade,downgrade}`
  gone from the route manifest; `/api/stripe/{checkout,webhook,portal,customer}`
  and `/api/payments/webhook` present as required.
- `pnpm test`: 21 failed / 255 failed (down from 22/257 post-Task-6; verified
  via `git stash` diff of the Task 7 working-tree changes that the deltas are
  entirely deleted test files, e.g. `pricing-section.test.tsx` and the
  cancel/upgrade/downgrade route tests — no suite gained failures).
  `settings/credits/__tests__/page.test.tsx`'s 8 pre-existing failures
  (custom-amount decimal input, Pro/Max credit-breakdown display) are
  unchanged before/after this task's edit (confirmed by stash-diff on that
  file alone) — unrelated to the `PricingSection` removal.
- `ls e2e/ | grep -i "checkout\|payment\|credit"` — no matching spec exists
  in `e2e/`. Fell back to a `pnpm dev` manual walk (Playwright browser tool,
  `.env.local` present):
  - `GET /checkout?package=tier2&mode=credits` -> "Confirm Your Order",
    "Growth Credit Package", "$100 in credits", "$75 one-time", "25% off",
    "You save: $25", trust badges, "Proceed to Payment" — all correct.
  - `GET /checkout` (no params) -> "No Package Selected" fallback renders
    correctly with a "View Credit Packages" button back to `/settings/credits`.
  - `GET /settings/credits` -> renders with the "Subscription Plan"
    informational card (kept) and Buy Credits flow, **no** `PricingSection`
    tier cards/CTAs present (confirms the cut).
  - Clicked "Buy Credits" -> "Purchase Credits" dialog opened showing
    Starter/Growth/Scale packages (unchanged, local data in
    `settings/credits/page.tsx`, not from the deleted `pricing-config`
    tiers). Selected "Growth" -> button updated to "Buy $100 Credits for
    $75", confirming the full `/settings/credits` -> checkout entry path is
    intact end-to-end.

---

## Overall

3 commits on `refactor/mvp-north-star`:
1. `cf236caf` — Task 5
2. `74e85f2d` — Task 6
3. (Task 7, committed after this report)

No task introduced a new test failure relative to baseline (23 failed / 261
failed); the running total actually decreased each task as feature-specific
suites were deleted. Every `pnpm build` in the sequence stayed green.
