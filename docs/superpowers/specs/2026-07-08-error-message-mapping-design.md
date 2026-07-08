# Error message mapping — design

**Date**: 2026-07-08
**Scope**: Frontend only (`gatewayz-frontend`). Backend error-shape inconsistencies are documented as audit findings, not fixed here.

## Problem

Users see raw backend/JS exception text (e.g. `"Failed to fetch models: Not Found"`, raw FastAPI `detail` strings) instead of friendly messages. Root cause, confirmed by audit:

1. A safe error utility already exists (`src/lib/errors/index.ts`, exports `getUserMessage()`) but is imported in exactly 1 of ~180 call sites that surface errors to users. Everywhere else does the equivalent of `toast({ description: error.message })`.
2. Even where it's used, most call sites throw/catch plain `Error(string)` objects by the time they reach display — the fetch layer (`src/lib/api.ts`, `src/lib/byok-api.ts`, `src/lib/catalog-api.ts`) collapses the backend's JSON error body into a bare string before the display code ever sees it, so there's nothing left to classify.
3. The backend itself emits 5 distinct error-body shapes depending on origin (full envelope, partial pass-through envelope, non-standard string-`error` 429 variant, raw middleware `JSONResponse`, untouched FastAPI 422 `{detail: [...]}`), plus inline SSE error events during chat streaming. No existing parser handles all of them.

## Approach

Two layers, both required — fixing only the display layer would make every message generic ("something went wrong"); fixing only the classifier without wiring it in changes nothing.

### Layer 1 — Extend the classifier (`src/lib/errors/index.ts`)

Add, without removing existing exports (call sites already depend on `AppError`, `getUserMessage`, etc.):

- New `ErrorCode` values: `API_PAYMENT_REQUIRED` (402 — insufficient credits), `API_RATE_LIMITED` (429 outside an auth context — chat/messages hit this too, not just login).
- `classifyApiError(status: number, body: unknown, opts?: { retryAfter?: string; context?: string }): AppError` — pure function, given a parsed (or unparseable) JSON body and HTTP status, returns the right `AppError` subtype. **Refined per the backend's canonical error contract** (`docs/api/errors.md`, found via the `~/Gateways` vault: every full-envelope error carries an UPPER_SNAKE_CASE `code`, e.g. `INSUFFICIENT_CREDITS`, `MODEL_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`, `PROVIDER_ERROR`, `INVALID_API_KEY`) — classify in this order:
  1. `body.error.code` matches a known code → use a `CODE_MESSAGE_MAP: Record<string, string>` covering all codes in the doc's Error Code Quick Reference (`MODEL_NOT_FOUND`, `MODEL_UNAVAILABLE`, `MODEL_DEPRECATED`, `MISSING_REQUIRED_FIELD`, `PARAMETER_OUT_OF_RANGE`, `CONTEXT_LENGTH_EXCEEDED`, `INVALID_API_KEY`, `API_KEY_EXPIRED`, `API_KEY_REVOKED`, `IP_RESTRICTED`, `TRIAL_EXPIRED`, `PLAN_LIMIT_REACHED`, `INSUFFICIENT_CREDITS`, `RATE_LIMIT_EXCEEDED`, `DAILY_QUOTA_EXCEEDED`, `TOKEN_RATE_LIMIT`, `PROVIDER_ERROR`, `PROVIDER_TIMEOUT`, `ALL_PROVIDERS_FAILED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`). Unrecognized codes fall through to step 4.
  2. `body.error` is an object with `message`/`type` but no known `code` → covers the partial pass-through shape; classify by status (step 4) but keep `body.error.message` as internal detail only.
  3. `body.error` is a string (api_keys.py/auth.py 429 variant), or `body.detail` is an array of `{type, loc, msg}` (untouched FastAPI 422 default) → classify by status (step 4); use the array's first entry for an internal field-specific detail.
  4. Status-only fallback: 401→`AUTH_EXPIRED`, 402→`API_PAYMENT_REQUIRED`, 403→`AUTH_INVALID`, 404→`API_NOT_FOUND`, 422→`API_VALIDATION_ERROR`, 429→`API_RATE_LIMITED`, 5xx→`API_SERVER_ERROR`, else `API_ERROR`.
  - If a retry-after value is available (`context.retry_after`, `body.retry_after`, or `Retry-After` header), append it to the rate-limit message ("try again in Ns").
  - Raw body/detail/context/suggestions are preserved on `AppError.details` for logging only — never surfaced via `getUserMessage()`.
- `parseErrorResponse(response: Response, context?: string): Promise<AppError>` — reads the body (`json()`, falling back to `text()`), reads the `Retry-After` header, calls `classifyApiError`. Replaces `fromResponse` as the primary entry point for real HTTP responses (`fromResponse` stays for any caller that truly has no body).
- `classifySseErrorChunk(chunk: { type?: string; message?: string }): AppError` — for mid-stream chat errors (`rate_limit_error`, `auth_error`, `capacity_error`, `provider_error` per `chat_streaming.py`), mapped to the same `ErrorCode` set.

`getUserMessage()`'s existing safety guarantee is unchanged: non-`AppError` errors still fall back to a generic message, never echo `.message`. This layer makes more errors arrive as properly-classified `AppError`s so the specific mapped copy actually gets used.

### Layer 2 — Wire it into the fetch layer and display call sites

- `src/lib/api.ts` (`makeAuthenticatedRequest`), `src/lib/byok-api.ts`, `src/lib/catalog-api.ts`: on non-ok response, `throw await parseErrorResponse(response, context)` instead of throwing a plain `Error(detail)`.
- `src/lib/chat-history.ts`'s `handleApiError()` (used by `useChatController.ts`): replace the ad-hoc "401/404/500" string-matching with `getUserMessage(fromUnknown(error))`; keep the function signature so call sites don't need to change.
- Chat streaming: route SSE error chunks through `classifySseErrorChunk` + `getUserMessage` instead of using the chunk's raw message field directly.
- Remaining leak sites (settings/integrations, checkout, API key management, login, catalog providers/models pages, account/session context files, settings/referrals, settings/memory, `use-model-health.ts`, `use-text-to-speech.ts`, `pricing-section.tsx`): replace `err instanceof Error ? err.message : '...'` / `errorData.detail` with `getUserMessage(err)`.
- `pricing-section.tsx`'s native `alert(error.message)`: pass `getUserMessage(err)` into the existing `alert()` call. Not migrating this one call site to the toast system — out of scope, keeps the diff mechanical.

### Explicitly out of scope (audit findings only)

- Fixing the broken `ModelsAPI` endpoint paths in `catalog-api.ts`.
- The `"DELETE"` vs `"DELETE_KEY"` confirmation-string mismatch.
- Backend-side error shape unification, the missing 422 exception handler, or the no-auth `providers_management.py` router.
- The duplicate `" 2"/" 3"` stray files.

## Testing

- Unit tests for `classifyApiError` covering all 5 body shapes + status-only fallback + retry-after formatting (new, TDD — write these first).
- Unit test for `classifySseErrorChunk` covering the 4 known chunk types.
- Existing jest setup (`jest.config.mjs`) — no new tooling needed.
- Manual spot-check after implementation: trigger a 404 (nonexistent catalog path), a 422 (bad chat payload), and a rate-limited request against the local dev server; confirm the toast shows mapped copy, not raw JSON/exception text.

## Risk

Low. Additive to `errors/index.ts` (no existing exports removed/changed in signature). Fetch-layer changes are localized to 3 files' error branches. Display-site changes are mechanical one-line swaps. Worst case for any single missed site: falls back to the existing generic-message safety net, not a regression from today's raw-text behavior.
