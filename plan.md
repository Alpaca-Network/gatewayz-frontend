# Auth & Chat Rearchitecture Plan

## Executive Summary

This plan addresses the fundamental architectural issues in both the authentication and chat systems. The current implementations are functional but suffer from:

1. **Auth System**: Race conditions, inconsistent state management across 3 sources of truth, complex retry/timeout logic scattered across multiple files
2. **Chat System**: A 3,671-line monolithic component, multiple race conditions, inefficient re-rendering, and duplicated retry logic

The goal is to create robust, maintainable, and fluid systems that handle edge cases gracefully.

---

## Current State Analysis

### Authentication Issues (Critical)

| Issue | Severity | Impact |
|-------|----------|--------|
| Race condition in `syncWithBackend()` | HIGH | Duplicate auth attempts |
| 3 sources of truth (Privy, localStorage, Context) | HIGH | State desync |
| Dual auth hooks confusion (`useAuth` vs `useGatewayzAuth`) | HIGH | Wrong auth checks |
| Wallet error string matching | MEDIUM | False positives |
| Scattered timeout configuration | MEDIUM | Hard to maintain |
| 30s timeout vs 60s retry chain mismatch | MEDIUM | Premature failures |

### Chat Issues (Critical)

| Issue | Severity | Impact |
|-------|----------|--------|
| 3,671-line monolithic component | CRITICAL | Unmaintainable |
| 20+ useState hooks in one component | HIGH | Cascading re-renders |
| Multiple race conditions (session creation, auto-send) | HIGH | Duplicate messages, data loss |
| No error boundaries | HIGH | App crashes on errors |
| Duplicated retry logic (API routes + streaming.ts) | MEDIUM | Maintenance nightmare |
| O(n²) message deduplication | LOW | Slow with large histories |

---

## Architecture Proposal

### Auth Architecture: State Machine Pattern

Replace the current ad-hoc state management with a proper state machine:

```
┌─────────────────────────────────────────────────────────────────┐
│                     AUTH STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────┐     login()      ┌─────────────────┐            │
│    │   IDLE   │ ───────────────► │ AUTHENTICATING  │            │
│    └──────────┘                  └────────┬────────┘            │
│         ▲                                 │                     │
│         │ logout()                        │                     │
│         │                    ┌────────────┼────────────┐        │
│         │                    │            │            │        │
│         │                    ▼            ▼            ▼        │
│    ┌────┴─────┐       ┌──────────┐  ┌──────────┐ ┌─────────┐    │
│    │ UNAUTH   │       │ SYNCING  │  │  ERROR   │ │ TIMEOUT │    │
│    └──────────┘       └────┬─────┘  └────┬─────┘ └────┬────┘    │
│         ▲                  │             │            │         │
│         │                  ▼             │  retry()   │         │
│         │           ┌──────────┐         │            │         │
│         └───────────┤   AUTH   │◄────────┴────────────┘         │
│                     └──────────┘                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. **Single Source of Truth**: Auth state machine is THE authority
2. **Atomic Transitions**: No intermediate states, no race conditions
3. **Centralized Config**: All timeouts/retries in one config object
4. **Event-Driven**: Components subscribe to state changes

### Chat Architecture: Feature-Based Decomposition

Split the monolithic chat into focused, testable modules:

```
┌────────────────────────────────────────────────────────────────────┐
│                         CHAT PAGE                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    useChatOrchestrator()                     │  │
│  │  Coordinates: auth state, sessions, messages, streaming      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│         ┌────────────────────┼────────────────────┐                │
│         │                    │                    │                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐          │
│  │  SIDEBAR    │     │  MESSAGES   │     │    INPUT     │          │
│  │ useSessions │     │ useMessages │     │  useInput    │          │
│  └─────────────┘     └─────────────┘     └──────────────┘          │
│         │                    │                    │                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐          │
│  │ChatHistory  │     │useStreaming │     │ ModelSelect  │          │
│  │   API       │     └─────────────┘     └──────────────┘          │
│  └─────────────┘                                                   │
└────────────────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. **Single Responsibility**: Each hook/component does one thing well
2. **Composition**: Orchestrator combines smaller pieces
3. **Error Boundaries**: Each feature handles its own errors
4. **Testable**: Each hook can be unit tested in isolation

---

## Implementation Phases

### Phase 1: Auth Foundation (Priority: Critical)

**Goal**: Create a robust auth state machine that eliminates race conditions

#### 1.1 Create Auth State Machine
- **New File**: `src/lib/auth/auth-machine.ts`
- Implements formal state machine with defined transitions
- Single source of truth for auth state
- Atomic state transitions (no intermediate states)

#### 1.2 Create Unified Auth Config
- **New File**: `src/lib/auth/auth-config.ts`
- Centralizes ALL timeout and retry configuration
- Network-adaptive timeout calculation
- Clear documentation of each value

#### 1.3 Create Auth Service
- **New File**: `src/lib/auth/auth-service.ts`
- Handles Privy → Backend sync
- Manages token retrieval with proper timeout
- Implements retry logic in one place
- Returns Result<T, Error> pattern for explicit error handling

#### 1.4 Simplify Auth Context
- **Refactor**: `src/context/gatewayz-auth-context.tsx`
- Remove complex retry/timeout logic (moved to service)
- Subscribe to state machine events
- Expose simple API: `login()`, `logout()`, `refresh()`
- Single `useGatewayzAuth()` hook (deprecate `useAuth()`)

#### 1.5 Fix Auth API Routes
- **Refactor**: `src/app/api/auth/route.ts`
- Remove retry logic (handled by service layer)
- Add request validation with Zod
- Standardized error responses

**Files to Create:**
- `src/lib/auth/auth-machine.ts` (~200 lines)
- `src/lib/auth/auth-config.ts` (~80 lines)
- `src/lib/auth/auth-service.ts` (~300 lines)
- `src/lib/auth/types.ts` (~50 lines)
- `src/lib/auth/index.ts` (exports)

**Files to Refactor:**
- `src/context/gatewayz-auth-context.tsx` (reduce from ~1000 to ~300 lines)
- `src/app/api/auth/route.ts`
- `src/hooks/use-auth.ts` (deprecate or redirect to unified hook)

---

### Phase 2: Chat Decomposition (Priority: Critical)

**Goal**: Break down the monolithic chat into manageable, testable pieces

#### 2.1 Create Chat Hooks Layer
- **New File**: `src/hooks/chat/use-sessions.ts`
  - Session CRUD operations
  - Session list with virtual scrolling
  - Active session management

- **New File**: `src/hooks/chat/use-messages.ts`
  - Message list management
  - Message deduplication (O(1) with Set)
  - Optimistic updates

- **New File**: `src/hooks/chat/use-streaming.ts`
  - Stream lifecycle management
  - Chunk processing
  - Error recovery with retry
  - Timing metrics

- **New File**: `src/hooks/chat/use-chat-input.ts`
  - Input state management
  - File attachment handling
  - Send validation

#### 2.2 Create Chat Orchestrator
- **New File**: `src/hooks/chat/use-chat-orchestrator.ts`
  - Coordinates all chat hooks
  - Handles cross-cutting concerns (auth state, URL params)
  - Initialization sequence state machine

#### 2.3 Create Chat Components
- **New File**: `src/components/chat/chat-sidebar.tsx`
  - Session list rendering
  - Virtual scrolling
  - Session actions (rename, delete)

- **New File**: `src/components/chat/chat-messages.tsx`
  - Message list rendering
  - Auto-scroll management
  - Loading states

- **New File**: `src/components/chat/chat-input-area.tsx`
  - Input field
  - Model selector
  - Send button
  - File attachments

- **New File**: `src/components/chat/chat-error-boundary.tsx`
  - Feature-specific error handling
  - Recovery options

#### 2.4 Simplify Main Chat Page
- **Refactor**: `src/app/chat/page.tsx`
  - Reduce from 3,671 lines to ~200 lines
  - Use orchestrator hook
  - Compose feature components
  - Add error boundaries

**Files to Create:**
- `src/hooks/chat/use-sessions.ts` (~200 lines)
- `src/hooks/chat/use-messages.ts` (~150 lines)
- `src/hooks/chat/use-streaming.ts` (~250 lines)
- `src/hooks/chat/use-chat-input.ts` (~100 lines)
- `src/hooks/chat/use-chat-orchestrator.ts` (~200 lines)
- `src/hooks/chat/types.ts` (~100 lines)
- `src/hooks/chat/index.ts` (exports)
- `src/components/chat/chat-sidebar.tsx` (~300 lines)
- `src/components/chat/chat-messages.tsx` (~250 lines)
- `src/components/chat/chat-input-area.tsx` (~200 lines)
- `src/components/chat/chat-error-boundary.tsx` (~80 lines)

**Files to Refactor:**
- `src/app/chat/page.tsx` (reduce from 3,671 to ~200 lines)

---

### Phase 3: Streaming Consolidation (Priority: High)

**Goal**: Single, robust streaming implementation

#### 3.1 Refactor Streaming Module
- **Refactor**: `src/lib/streaming.ts`
  - Extract SSE parsing into testable function
  - Extract retry logic into reusable utility
  - Simplify response format handling
  - Add proper TypeScript types for all formats

#### 3.2 Remove Duplicate Retry Logic
- **Refactor**: `src/app/api/chat/completions/route.ts`
  - Remove retry logic (handled by streaming module)
  - Simplify to pure proxy

#### 3.3 Create Stream Coordinator Service
- **Refactor**: `src/lib/stream-coordinator.ts`
  - Proper cleanup on unmount
  - Handle auth refresh mid-stream
  - Backpressure handling

**Files to Refactor:**
- `src/lib/streaming.ts` (reduce from 799 to ~400 lines)
- `src/app/api/chat/completions/route.ts`
- `src/lib/stream-coordinator.ts`

---

### Phase 4: Error Handling & Recovery (Priority: High)

**Goal**: Graceful error handling throughout

#### 4.1 Create Error Types
- **New File**: `src/lib/errors/index.ts`
  - `AuthError`, `NetworkError`, `StreamError`, `SessionError`
  - Error codes for each type
  - User-friendly messages

#### 4.2 Create Error Boundary Components
- **New File**: `src/components/error/auth-error-boundary.tsx`
- **New File**: `src/components/error/chat-error-boundary.tsx`
- Recovery options for each error type

#### 4.3 Standardize API Error Responses
- All API routes return consistent error format:
```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}
```

**Files to Create:**
- `src/lib/errors/index.ts` (~150 lines)
- `src/lib/errors/auth-errors.ts` (~80 lines)
- `src/lib/errors/chat-errors.ts` (~80 lines)
- `src/components/error/auth-error-boundary.tsx` (~100 lines)
- `src/components/error/chat-error-boundary.tsx` (~100 lines)

---

### Phase 5: Testing & Documentation (Priority: Medium)

**Goal**: Ensure stability with comprehensive tests

#### 5.1 Unit Tests
- Auth state machine transitions
- Streaming chunk parsing
- Session CRUD operations
- Error handling paths

#### 5.2 Integration Tests
- Full auth flow (login → sync → authenticated)
- Chat flow (create session → send message → receive stream)
- Error recovery flows

#### 5.3 E2E Tests
- Happy path: Login → Chat → Logout
- Error path: Network failure → Recovery
- Edge cases: Tab switching, page refresh

**Test Files to Create:**
- `src/lib/auth/__tests__/auth-machine.test.ts`
- `src/lib/auth/__tests__/auth-service.test.ts`
- `src/hooks/chat/__tests__/use-sessions.test.ts`
- `src/hooks/chat/__tests__/use-streaming.test.ts`
- `src/lib/__tests__/streaming.test.ts`

---

## Migration Strategy

### Approach: Parallel Implementation

To minimize risk, we'll implement the new architecture alongside the existing code:

1. **Phase 1-2**: Create new modules without touching existing code
2. **Phase 3**: Wire up new modules behind feature flag
3. **Phase 4**: A/B test new vs old implementation
4. **Phase 5**: Remove old code after validation

### Feature Flag Strategy

```typescript
// src/lib/feature-flags.ts
export const USE_NEW_AUTH = process.env.NEXT_PUBLIC_NEW_AUTH === 'true';
export const USE_NEW_CHAT = process.env.NEXT_PUBLIC_NEW_CHAT === 'true';
```

### Rollback Plan

Each phase can be independently rolled back:
- Phase 1: Revert to old auth context (feature flag)
- Phase 2: Revert to old chat page (feature flag)
- Phase 3: Revert streaming changes
- Phase 4: Error boundaries are additive (no rollback needed)

---

## Risk Assessment

### High Risk Items

| Risk | Mitigation |
|------|------------|
| Breaking auth for all users | Feature flag, extensive testing |
| Chat data loss during migration | Parallel implementation, no data schema changes |
| Regression in streaming | Keep existing streaming as fallback |

### Medium Risk Items

| Risk | Mitigation |
|------|------------|
| Performance regression | Benchmark before/after |
| Memory leaks in new hooks | Proper cleanup in useEffect |
| State desync during transition | Clear state on feature flag toggle |

---

## Success Criteria

### Auth System
- [ ] No race conditions in auth flow
- [ ] Single source of truth for auth state
- [ ] Auth completes within 60s on slow networks
- [ ] Clear error messages for all failure modes
- [ ] <5s auth time on fast networks

### Chat System
- [ ] Chat page <500 lines (down from 3,671)
- [ ] Each hook <300 lines
- [ ] No duplicate messages
- [ ] Graceful error recovery
- [ ] <100ms input latency
- [ ] Smooth streaming (no jank)

### Overall
- [ ] Zero increase in Sentry errors
- [ ] TypeScript strict mode passes
- [ ] All existing E2E tests pass
- [ ] New unit tests with >80% coverage on new code

---

## File Summary

### New Files (23 files)

**Auth Module:**
- `src/lib/auth/auth-machine.ts`
- `src/lib/auth/auth-config.ts`
- `src/lib/auth/auth-service.ts`
- `src/lib/auth/types.ts`
- `src/lib/auth/index.ts`

**Chat Hooks:**
- `src/hooks/chat/use-sessions.ts`
- `src/hooks/chat/use-messages.ts`
- `src/hooks/chat/use-streaming.ts`
- `src/hooks/chat/use-chat-input.ts`
- `src/hooks/chat/use-chat-orchestrator.ts`
- `src/hooks/chat/types.ts`
- `src/hooks/chat/index.ts`

**Chat Components:**
- `src/components/chat/chat-sidebar.tsx`
- `src/components/chat/chat-messages.tsx`
- `src/components/chat/chat-input-area.tsx`
- `src/components/chat/chat-error-boundary.tsx`

**Error Handling:**
- `src/lib/errors/index.ts`
- `src/lib/errors/auth-errors.ts`
- `src/lib/errors/chat-errors.ts`
- `src/components/error/auth-error-boundary.tsx`
- `src/components/error/chat-error-boundary.tsx`

**Tests:**
- `src/lib/auth/__tests__/auth-machine.test.ts`
- `src/lib/auth/__tests__/auth-service.test.ts`
- `src/hooks/chat/__tests__/use-sessions.test.ts`
- `src/hooks/chat/__tests__/use-streaming.test.ts`

### Files to Refactor (8 files)

- `src/context/gatewayz-auth-context.tsx` (1000 → 300 lines)
- `src/app/api/auth/route.ts`
- `src/hooks/use-auth.ts`
- `src/app/chat/page.tsx` (3671 → 200 lines)
- `src/lib/streaming.ts` (799 → 400 lines)
- `src/app/api/chat/completions/route.ts`
- `src/lib/stream-coordinator.ts`
- `src/lib/chat-history.ts`

---

## Questions for User

Before proceeding, I'd like to clarify:

1. **Feature Flags**: Do you have an existing feature flag system (Statsig?) that we should integrate with, or should we use simple env vars?

2. **Testing Priority**: Should we prioritize unit tests or E2E tests? (I recommend unit tests for the state machine and hooks)

3. **Migration Timeline**: Do you want to implement this incrementally (ship Phase 1 first) or complete all phases before deploying?

4. **Existing Auth Timeout Work**: I noticed there's existing dev docs at `dev/active/auth-timeout-retry/`. Should we incorporate those timeout fixes as part of Phase 1, or treat them separately?

5. **Breaking Changes**: Are you okay with deprecating `useAuth()` in favor of `useGatewayzAuth()`, or do we need to maintain backward compatibility?
