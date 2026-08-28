# Phase 0 Discovery — beta.gatewayz.ai

**PRD:** `prd-estate-seo-geo-implementation.md` §3 · **Workstream:** WS-A (FR-A6.5 only) · **Session:** A0
**Repo:** `Alpaca-Network/gatewayz-frontend` (public) · **Local:** `~/gatewayz-frontend`
**Date of findings:** 2026-08-27 · **Method:** live HTTP fetches + repo inspection

> Scope note: per PRD §2.3 this surface is *"only touched for title/meta unification (A6.5)."* This discovery is deliberately narrow — it establishes what FR-A6.5 has to change and nothing more.

---

## D1. Stack + build

| Item | Finding |
|---|---|
| Framework | **Next.js 15.3.8**, App Router (`src/app`). |
| Rendering | Server-rendered shell + heavy client hydration. Homepage returns 66 KB of HTML but only **45 characters of crawlable text** and **0 `<h1>`** — the marketing content is client-rendered. |
| Host | Vercel. `x-matched-path: /`. |
| Extras | Sentry, Tauri desktop target (`src-tauri`, `NEXT_STATIC_EXPORT` static-export mode), bundle analyzer. |
| Note | `typescript.ignoreBuildErrors: true` and eslint relaxed in `next.config.ts` — CI additions from PRD §8.4 cannot rely on type-checking as a gate here. |

## D2. Current SEO state

Metadata is centralised already, in `src/app/metadata.ts`, re-exported by `layout.tsx:27`. That is the file FR-A6.5 edits.

| Signal | Current value |
|---|---|
| `title` | `Gatewayz - One Interface To Work With Any LLM` |
| `description` | `From Idea To Production, Gatewayz Gives AI Teams The Toolkit, Savings, And Reliability They Need.` |
| `robots` | `index: true, follow: true` (+ permissive googleBot directives) |
| `metadataBase` | `https://beta.gatewayz.ai` |
| `canonical` | **none** |
| JSON-LD | **none** |
| `robots.txt` | **404** — no `src/app/robots.ts` |
| `sitemap.xml` | **404** — no `src/app/sitemap.ts` |
| `llms.txt` | 404 |
| Real 404s | ✅ `/nope-xyz123` → **404** (unlike gatewayz.ai, this surface has correct status codes) |

### D2.1 The entity conflict FR-A6.5 exists to fix

Two live surfaces define the same brand differently, and both are indexable:

| | `www.gatewayz.ai` | `beta.gatewayz.ai` |
|---|---|---|
| Title | Gatewayz \| One API for Any AI Model | Gatewayz - One Interface To Work With Any LLM |
| Description | "…blazing-fast, OpenAI-compatible API. Lowest latency, lowest cost." | "From Idea To Production…Toolkit, Savings, And Reliability" |
| `robots` | absent (defaults to indexable) | explicit `index, follow` |
| Canonical | `/` (relative — broken) | none |

Neither matches the PRD's canonical positioning (`Gatewayz — One API for Every AI Model | AI Inference Router`, FR-A6.1). With no canonical on beta and a broken one on www, search engines pick their own winner for brand queries — exactly risk **R7**.

### D2.2 beta owns `/models` today

`www.gatewayz.ai/models` and `/models/*` 307-redirect here (see the gatewayz.ai discovery doc, D2.5). FR-A5.1 reclaims `/models` for the marketing domain. **That is an RG-4 decision that affects this repo**: if the marketing `/models` index ships on the apex, this app's `/models` route either moves behind `/app` or `/dashboard`, or the two coexist with explicit cross-canonicals. Do not implement either until Joaquim rules on §7.3 of the gatewayz.ai discovery doc.

## D3. Content infrastructure

None relevant — this is the product app, not a content surface. Routes present: `chat`, `checkout`, `claude-code`, `code`, `contact`, `deck`, `developers`, `login`, `model-health`, `models`, `monitoring`, `onboarding`.

Of note: **`model-health` exists as a route in this app.** Given that the public `/v1/models` API returns `health_status: "unknown"` for all 64 models (see gatewayz.ai discovery, D4), this route may front a richer internal data source. **Worth investigating for FR-A5.9** — it could be the shortest path to real latency/uptime data.

## D4. Data access

Not applicable to this workstream, but see D3 above regarding `model-health`.

## D5. Analytics

`@vercel/analytics` ^1.5.0 + Sentry. GA4 is not present here (it is on www). Cross-domain measurement of the apex↔beta journey will need attention once FR-A6.8 lands; GA4's `linker` config on www already lists cross-domain intent.

## D6. Constraints

1. **Static-export mode exists** for the Tauri desktop build (`NEXT_STATIC_EXPORT=true` → `output: 'export'`). Any `robots.ts`/`sitemap.ts` added must not break that build path — Next's metadata route handlers behave differently under `output: export`.
2. **Build gates are relaxed** (`ignoreBuildErrors`). PRD §8.4 CI checks must be their own job, not assumed to run via `next build`.
3. Public repo — no secrets in anything added here.

---

## 7. Findings for FR-A6.5

**Ready to implement** (single small PR, RG-1 for copy + RG-4 for canonical):

1. Align `title`/`description`/OG in `src/app/metadata.ts` to the canonical positioning from FR-A6.1.
2. Add a self-referencing canonical, and a canonical to the apex for any *marketing* page duplicated on both surfaces.
3. Add `src/app/robots.ts` — beta is an app surface; decide with Joaquim whether app routes should be indexable at all. Recommendation: allow the marketing-ish routes, disallow `/dashboard`, `/checkout`, `/onboarding`, `/login`.
4. Add `Organization` JSON-LD matching the estate entity graph (PRD §8.1) so both surfaces assert the same entity.

**Blocked / needs decision:**

- `/models` ownership — see D2.2, gated on the gatewayz.ai §7.3 decision.
- Whether beta should be indexable at all. Removing `index, follow` and canonicalising everything to the apex is the cleanest fix for R7, but it is a real traffic decision, not a technical one. → **RG-4, Joaquim.**
