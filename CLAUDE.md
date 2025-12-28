# Gatewayz Beta - Codebase Documentation

## Application Overview

**Gatewayz Beta** (beta.gatewayz.ai) is the beta version of the Gatewayz AI model management and routing platform. It provides a unified interface for accessing and working with Large Language Models (LLMs) from 60+ providers. This is a testing ground for new features before they are released to the main platform at gatewayz.ai.

### Key Objectives
- Provide early access to new features and improvements
- Test AI model integrations from 60+ providers
- Offer real-time chat interface with model switching
- Enable model performance analytics and comparisons
- Manage API keys and developer integration tools
- Support team/organization management features
- Handle billing and credits management with tiered subscription support

### Important: Cross-Domain Authentication

Users authenticate on **gatewayz.ai** (main domain) and are automatically redirected to **beta.gatewayz.ai** with their session. See **BETA_TEAM_QUICK_START.md** for session transfer implementation details.

---

## Directory Structure

```
/root/repo/src/
├── app/                           # Next.js 15 App Router pages
│   ├── layout.tsx                 # Root layout with theme & auth providers
│   ├── global-error.tsx           # Global error boundary
│   ├── api/                       # API routes for backend integration (25 directories)
│   │   ├── analytics/             # Analytics event endpoints
│   │   ├── audit/                 # Audit logging
│   │   ├── auth/                  # Authentication endpoints
│   │   ├── cache/                 # Cache management
│   │   ├── chat/                  # Chat completion proxies and session management
│   │   │   ├── ai-sdk/            # Vercel AI SDK integration
│   │   │   ├── ai-sdk-completions/# AI SDK chat completions
│   │   │   ├── completions/       # OpenAI-compatible chat completions API
│   │   │   ├── sessions/          # Chat session management
│   │   │   ├── share/             # Chat sharing functionality
│   │   │   ├── search/            # Model search functionality
│   │   │   └── stats/             # Chat statistics
│   │   ├── contact/               # Contact form handling
│   │   ├── cron/                  # Scheduled tasks
│   │   ├── gateways/              # Gateway management
│   │   ├── health/                # Health check endpoints
│   │   ├── insights/              # Asset insights API
│   │   ├── metrics/               # Metrics and monitoring
│   │   │   ├── chat/              # Chat metrics
│   │   │   ├── health/            # Health metrics
│   │   │   ├── provider/          # Provider metrics
│   │   │   ├── realtime/          # Real-time metrics
│   │   │   └── trends/            # Trend analysis
│   │   ├── middleware/            # API middleware
│   │   ├── model-logo/            # Model logo assets
│   │   ├── models/                # Model listing and discovery
│   │   ├── payments/              # Payment processing
│   │   ├── ranking/               # Model ranking API
│   │   ├── redis/                 # Redis operations
│   │   ├── sentry-test/           # Sentry error testing
│   │   ├── stripe/                # Stripe payment integration
│   │   │   ├── checkout/          # Checkout session creation
│   │   │   ├── customer/          # Customer management
│   │   │   ├── portal/            # Subscription portal
│   │   │   ├── subscribe/         # Subscription handling
│   │   │   └── webhook/           # Webhook handling
│   │   ├── sync/                  # Data synchronization
│   │   ├── user/                  # User management
│   │   │   ├── api-keys/          # API key management
│   │   │   ├── activity/          # Activity logging and statistics
│   │   │   └── me/                # Current user endpoint
│   │   ├── vitals/                # Web Vitals collection
│   │   └── webhooks/              # External webhook handlers
│   ├── ai-sdk-demo/               # AI SDK demonstration page
│   ├── catalog/                   # Model catalog browser
│   ├── chat/                      # Interactive chat interface
│   ├── checkout/                  # Checkout flow
│   ├── claude-code/               # Claude Code integration
│   ├── contact/                   # Contact page
│   ├── deck/                      # Presentation deck
│   ├── developers/                # Developer documentation & resources
│   ├── email-preview/             # Email template preview
│   ├── insights/                  # Asset insights dashboard
│   ├── model-health/              # Model health monitoring
│   ├── models/                    # Model browser and discovery
│   │   └── [...name]/             # Dynamic model detail pages
│   ├── monitoring/                # System monitoring dashboard
│   ├── onboarding/                # Onboarding flow
│   ├── organizations/             # Organization management
│   │   └── [name]/                # Dynamic org pages
│   ├── playground/                # API playground
│   ├── rankings/                  # Analytics & model performance rankings
│   ├── releases/                  # Release notes
│   ├── sentry-example-page/       # Sentry integration example
│   ├── settings/                  # User settings dashboard
│   │   ├── account/               # Account management
│   │   ├── activity/              # Activity history
│   │   ├── credits/               # Credit management
│   │   ├── integrations/          # Third-party integrations
│   │   ├── keys/                  # API key management
│   │   ├── presets/               # Preset configurations
│   │   ├── privacy/               # Privacy settings
│   │   ├── provisioning/          # Account provisioning
│   │   └── referrals/             # Referral program
│   ├── share/                     # Shared chat viewing
│   ├── signup/                    # Sign-up page
│   ├── start/                     # Getting started flow
│   ├── test-tier-display/         # Tier display testing
│   ├── v1/                        # API v1 routes
│   └── web-vitals/                # Web Vitals dashboard
├── components/                    # Reusable React components (183 files)
│   ├── ui/                        # Radix UI primitives (53 components)
│   ├── ai-sdk-elements/           # AI SDK UI elements
│   ├── analytics/                 # Analytics components
│   ├── auth/                      # Auth-related components
│   ├── chat/                      # Chat-specific components
│   ├── chat-v2/                   # Chat v2 components
│   ├── dashboard/                 # Analytics dashboard components
│   ├── dialogs/                   # Modal dialogs
│   ├── error/                     # Error handling components
│   ├── examples/                  # Example components
│   ├── layout/                    # Layout components (header, footer, nav)
│   ├── metrics/                   # Metrics display components
│   ├── model-health/              # Model health components
│   ├── models/                    # Model display components
│   ├── onboarding/                # Onboarding components
│   ├── pricing/                   # Pricing display components
│   ├── providers/                 # Context providers
│   │   ├── posthog-provider.tsx   # PostHog analytics provider
│   │   ├── privy-provider.tsx     # Privy auth provider
│   │   ├── react-scan-provider.tsx# React Scan provider
│   │   └── statsig-provider.tsx   # Statsig feature flags provider
│   ├── referral/                  # Referral components
│   ├── sections/                  # Landing page sections
│   ├── settings/                  # Settings components
│   ├── skeletons/                 # Loading skeleton components
│   ├── tier/                      # Tier/subscription components
│   └── web-vitals/                # Web Vitals components
├── context/                       # React Context for state management
│   ├── gateway-context.tsx        # Gateway routing context
│   ├── gatewayz-auth-context.tsx  # Global authentication context
│   └── gatewayz-auth-context-v2.tsx # Auth context v2
├── hooks/                         # Custom React hooks (28 files)
│   ├── chat/                      # Chat-specific hooks
│   ├── use-auth.ts                # Privy authentication hook
│   ├── use-asset-tracking.ts      # Asset tracking hook
│   ├── use-client-mounted.ts      # Client mount detection
│   ├── use-deferred-model-data.ts # Deferred model data loading
│   ├── use-health-leaderboard.ts  # Health leaderboard hook
│   ├── use-mobile.tsx             # Mobile detection hook
│   ├── use-model-health.ts        # Model health data hook
│   ├── use-model-prefetch.ts      # Model prefetching hook
│   ├── use-network-status.ts      # Network status hook
│   ├── use-provider-summary.ts    # Provider summary hook
│   ├── use-realtime-metrics.ts    # Real-time metrics hook
│   ├── use-settings-data.ts       # Settings data hook
│   ├── use-tier.ts                # Tier/subscription info hook
│   ├── use-toast.ts               # Toast notifications hook
│   ├── use-token-refresh.ts       # Token refresh hook
│   ├── use-trend-data.ts          # Trend data hook
│   ├── use-web-vitals.ts          # Web Vitals hook
│   ├── useAISDKChat.ts            # AI SDK chat integration hook
│   ├── useEagerModelPreload.ts    # Eager model preloading
│   ├── useGatewayRouter.ts        # Gateway routing hook
│   ├── useModelData.ts            # Model data fetching hook
│   ├── useRecentlyUsedModels.ts   # Recently used models hook
│   └── useVirtualScroll.ts        # Virtual scrolling hook
├── integrations/                  # External service integrations
│   └── privy/                     # Privy authentication integration
├── lib/                           # Utility functions and services (80+ files)
│   ├── auth/                      # Authentication utilities
│   ├── errors/                    # Error handling utilities
│   ├── hooks/                     # Library-level hooks
│   ├── providers/                 # Library providers
│   │   └── query-provider.tsx     # React Query provider
│   ├── store/                     # Zustand stores
│   │   ├── auth-store.ts          # Auth state store
│   │   └── chat-ui-store.ts       # Chat UI state store
│   ├── streaming/                 # Streaming utilities
│   │   ├── errors.ts              # Streaming error types
│   │   ├── sse-parser.ts          # Server-sent events parser
│   │   ├── stream-chat.ts         # Chat streaming handler
│   │   └── types.ts               # Streaming types
│   ├── ai-sdk-chat-service.ts     # AI SDK chat service
│   ├── ai-sdk-gateway.ts          # AI SDK gateway integration
│   ├── analytics.ts               # Analytics event logging
│   ├── api.ts                     # API authentication & utilities
│   ├── asset-insights-service.ts  # Asset insights service
│   ├── audit-logging.ts           # Audit logging utilities
│   ├── backend-error-tracking.ts  # Backend error tracking
│   ├── background-sync.ts         # Background sync service
│   ├── braintrust.ts              # Braintrust integration
│   ├── cache-strategies.ts        # Caching strategies
│   ├── catalog-api.ts             # Catalog API service
│   ├── chat-cache-invalidation.ts # Chat cache invalidation
│   ├── chat-history.ts            # Chat session/history management
│   ├── chat-performance-tracker.ts# Chat performance tracking
│   ├── chat-stream-handler.ts     # Chat stream handler
│   ├── circuit-breaker.ts         # Circuit breaker pattern
│   ├── config.ts                  # Configuration constants
│   ├── data.ts                    # Static data
│   ├── device-fingerprint.ts      # Device fingerprinting
│   ├── gateway-registry.ts        # Gateway registry
│   ├── global-error-handlers.ts   # Global error handlers
│   ├── guest-chat.ts              # Guest chat functionality
│   ├── guest-rate-limiter.ts      # Guest rate limiting
│   ├── message-batcher.ts         # Message batching
│   ├── message-queue.ts           # Message queue
│   ├── model-availability.ts      # Model availability checks
│   ├── model-detail-utils.ts      # Model detail utilities
│   ├── model-health-utils.ts      # Model health utilities
│   ├── model-sync-service.ts      # Model sync service
│   ├── models-data.ts             # Model definitions and metadata
│   ├── models-service.ts          # Multi-gateway model fetching service
│   ├── monitoring-service.ts      # Monitoring service
│   ├── network-error.ts           # Network error handling
│   ├── network-timeouts.ts        # Network timeout config
│   ├── network-utils.ts           # Network utilities
│   ├── optimistic-updates.ts      # Optimistic update handling
│   ├── performance-profiler.ts    # Performance profiling
│   ├── preview-hostname-handler.ts# Preview hostname handling
│   ├── pricing-config.ts          # Pricing configuration
│   ├── privy.ts                   # Privy configuration
│   ├── provider-data.ts           # Provider performance data
│   ├── proxy-fetch.ts             # Proxy fetch utilities
│   ├── redis-client.ts            # Redis client
│   ├── redis-metrics.ts           # Redis metrics
│   ├── referral-utils.ts          # Referral utilities
│   ├── referral.ts                # Referral service
│   ├── retry-utils.ts             # Retry utilities
│   ├── safe-session-storage.ts    # Safe session storage
│   ├── safe-storage.ts            # Safe localStorage wrapper
│   ├── sentry-assets-types.ts     # Sentry asset types
│   ├── sentry-error-filters.ts    # Sentry error filters
│   ├── sentry-utils.ts            # Sentry utilities
│   ├── session-cache.ts           # Session caching
│   ├── session-invalidation.ts    # Session invalidation
│   ├── share-chat.ts              # Chat sharing utilities
│   ├── stream-coordinator.ts      # Stream coordination
│   ├── streaming.ts               # Streaming API helpers
│   ├── stripe.ts                  # Stripe integration
│   ├── tier-utils.ts              # Tier system utilities
│   ├── timeout-config.ts          # Timeout configuration
│   ├── token-refresh.ts           # Token refresh utilities
│   ├── utils.ts                   # General utilities
│   ├── web-vitals-service.ts      # Web Vitals service
│   └── web-vitals-types.ts        # Web Vitals types
├── types/                         # TypeScript type definitions
│   ├── global.d.ts                # Global type declarations
│   ├── model-health.ts            # Model health types
│   └── missing-deps.d.ts          # Missing dependency types
└── styles/
    └── globals.css                # Global styles (in app/)
```

**Total Files:** 528 TypeScript/TSX files

---

## Key Features

### 1. Unified Model Access
- Browse 300+ models from 60+ providers
- Support for 17+ gateway/provider integrations
- Real-time model discovery with search
- Model catalog with advanced filtering
- Model health monitoring and availability tracking

### 2. Interactive Chat Interface
- Multi-model support with seamless switching
- Session management with chat history
- Persistent local storage and backend sync
- Support for streaming responses (SSE)
- AI SDK integration for unified chat experience
- Message markdown rendering with math (KaTeX support)
- Code syntax highlighting
- Image upload/support
- Reasoning display for models supporting chain-of-thought
- Chat sharing functionality
- Guest chat with rate limiting

### 3. Model Management
- Advanced filtering (by modality, context length, pricing, capabilities)
- Dynamic model detail pages
- Performance metrics tracking
- Provider comparison views
- Model-specific configuration parameters
- Model sync service for background updates

### 4. Analytics & Rankings
- Performance comparisons across model categories
- Usage statistics (token generation, model usage)
- Trend analysis with interactive charts
- Category filtering and time range selection
- Statsig integration for feature flags and analytics
- Client-side and server-side event tracking
- Asset insights dashboard
- Real-time metrics monitoring

### 5. Developer Tools
- API key management
- Chat session API endpoints
- Model search functionality
- Activity logging and statistics
- Integration guides
- API playground for testing
- AI SDK demo page

### 6. User Authentication & Authorization
- Multi-provider auth (Email, Google, GitHub, Wallet)
- Secure session management
- User profile management
- Role-based access control
- Cross-domain session transfer

### 7. Billing & Credits
- Tiered subscription system (Basic, Pro, Max)
- Credit-based pay-per-use model
- Stripe integration for payments
- Subscription management
- Credit purchase and tracking
- Checkout flow with confirmation

### 8. Organization Features
- Team/organization management
- Shared resource access
- Organization billing

### 9. Performance & Monitoring
- Web Vitals tracking and dashboard
- Error monitoring with Sentry
- Redis caching for improved performance
- Circuit breaker for fault tolerance
- Performance profiling tools

### 10. Referral Program
- Referral tracking and management
- Referral rewards system

---

## Technology Stack

### Frontend Framework
- **Next.js 15.3.8** - React framework with App Router
- **React 18.3.1** - UI library
- **TypeScript 5.9** - Type safety

### AI & LLM Integration
- **ai 5.0** (Vercel AI SDK) - Unified AI SDK for streaming chat
- **@ai-sdk/anthropic 2.0** - Anthropic provider for AI SDK
- **@ai-sdk/google 2.0** - Google provider for AI SDK
- **@ai-sdk/openai 2.0** - OpenAI provider for AI SDK
- **@ai-sdk/react 2.0** - React hooks for AI SDK
- **braintrust 0.4** - AI evaluation and tracing

### UI & Styling
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives (accordion, dialog, dropdown, select, etc.)
- **shadcn/ui** - Component library built on Radix UI
- **Lucide React 0.475** - Icon library
- **Embla Carousel 8.6** - Carousel component
- **class-variance-authority 0.7** - Variant management
- **tailwind-merge 3.0** - Tailwind CSS merge utility
- **tailwindcss-animate 1.0** - Animation utilities

### State Management
- **Zustand 5.0** - Lightweight state management
- **@tanstack/react-query 5.90** - Server state management
- **React Context** - Component state sharing

### Data Visualization
- **Recharts 2.15** - React charting library

### Form & Validation
- **React Hook Form 7.54** - Form state management
- **@hookform/resolvers 4.1** - Form validation resolvers
- **Zod 3.24** - TypeScript-first schema validation

### Content Rendering
- **React Markdown 10.1** - Markdown parser
- **react-syntax-highlighter 16.1** - Code syntax highlighting
- **remark-gfm 4.0** - GitHub Flavored Markdown support
- **remark-math 6.0** - LaTeX math support
- **rehype-katex 7.0** - KaTeX renderer for math

### Authentication
- **@privy-io/react-auth 3.0.1** - Web3-native auth provider
- **@privy-io/wagmi 2.0** - Wallet integration
- **NextAuth.js 4.24** - Additional auth support

### Payments & Billing
- **@stripe/stripe-js 8.0** - Stripe payment processing
- **Stripe 19.1** - Stripe server-side SDK

### Analytics & Telemetry
- **@statsig/react-bindings 3.27** - Feature flagging & A/B testing
- **@statsig/session-replay 3.27** - Session replay
- **@statsig/web-analytics 3.27** - Web analytics
- **posthog-js 1.275** - Product analytics (client)
- **posthog-node 5.9** - Product analytics (server)
- **@vercel/analytics 1.5** - Vercel analytics
- **@vercel/speed-insights 1.2** - Performance monitoring
- **web-vitals 5.1** - Core Web Vitals measurement

### Error Monitoring
- **@sentry/nextjs 10.24** - Error tracking and performance monitoring

### Backend Services
- **ioredis 5.8** - Redis client for caching and sessions
- **undici 7.16** - HTTP client

### Utilities
- **date-fns 3.6** - Date manipulation
- **clsx 2.1** - Conditional className utility
- **cmdk 1.0** - Command menu component
- **react-day-picker 8.10** - Date picker component
- **@faker-js/faker 8.4** - Mock data generation
- **dotenv 16.5** - Environment variable management

### Development Tools
- **ESLint 8.57** - Code linting
- **eslint-config-next 15.5** - Next.js ESLint config
- **PostCSS 8** - CSS processing
- **Jest 30.2** - Testing framework
- **@testing-library/react 16.3** - React component testing
- **@testing-library/jest-dom 6.9** - DOM matchers
- **@testing-library/user-event 14.6** - User event simulation
- **@playwright/test 1.56** - E2E testing
- **Cypress 15.7** - Component and E2E testing
- **tsx 4.20** - TypeScript execution
- **TypeScript 5.9** - Type checking
- **pnpm 10.17** - Package manager
- **patch-package 8.0** - NPM package patching
- **react-scan 0.4** - React performance debugging

---

## Services and Integrations

### External Services

#### 1. Privy (Authentication)
- Email/password authentication
- Google OAuth
- GitHub OAuth
- Wallet connection support
- **Location:** `src/components/providers/privy-provider.tsx`

#### 2. Stripe (Payments)
- Checkout session management
- Subscription billing (Pro, Max tiers)
- Payment webhooks
- Customer portal
- **Location:** `src/app/api/stripe/`

#### 3. AI Model Gateways (17+ providers)
- **OpenRouter** - Multi-provider aggregator
- **Portkey** - Gateway (deprecated)
- **Featherless** - Open-source models
- **Groq** - Fast inference
- **Together** - Fine-tuning & inference
- **Fireworks** - Fast inference
- **Chutes** - Model hosting
- **DeepInfra** - Model hosting
- **Google** - Genkit integration
- **Cerebras** - Fast inference
- **Nebius** - Model hosting
- **xAI** - Grok models
- **Novita** - GPU inference
- **Hugging Face** - Open-source models
- **AiMo** - Research models
- **NEAR** - Decentralized AI
- **Alpaca Network** - AI model gateway
- **Location:** `src/lib/models-service.ts`, `src/lib/gateway-registry.ts`

#### 4. Vercel AI SDK Integration
- Unified streaming chat interface
- Multi-provider support (OpenAI, Anthropic, Google)
- React hooks for chat state management
- **Location:**
  - Gateway: `src/lib/ai-sdk-gateway.ts`
  - Chat service: `src/lib/ai-sdk-chat-service.ts`
  - Hooks: `src/hooks/useAISDKChat.ts`
  - API routes: `src/app/api/chat/ai-sdk/`, `src/app/api/chat/ai-sdk-completions/`

#### 5. Sentry (Error Monitoring)
- Client-side error tracking
- Server-side error tracking
- Performance monitoring
- Session replay
- Release tracking
- **Location:**
  - Utils: `src/lib/sentry-utils.ts`
  - Error filters: `src/lib/sentry-error-filters.ts`
  - Global error page: `src/app/global-error.tsx`

#### 6. Statsig (Feature Flags & Analytics)
- User identification with Privy integration
- Auto-capture plugin for automatic event tracking
- Session replay plugin for user behavior analysis
- Server-side event logging through backend API
- Client-side React hooks for feature flags
- **Location:**
  - Provider: `src/components/providers/statsig-provider.tsx`
  - Analytics service: `src/lib/analytics.ts`
  - API endpoints: `src/app/api/analytics/`

#### 7. PostHog (Product Analytics)
- Page view tracking
- Event capturing
- User behavior analysis
- **Location:** `src/components/providers/posthog-provider.tsx`

#### 8. Redis (Caching & Sessions)
- Model data caching
- Session management
- Rate limiting
- Metrics storage
- **Location:**
  - Client: `src/lib/redis-client.ts`
  - Metrics: `src/lib/redis-metrics.ts`
  - API: `src/app/api/redis/`

#### 9. Braintrust (AI Evaluation)
- Model evaluation and tracing
- Performance benchmarking
- **Location:** `src/lib/braintrust.ts`

#### 10. Vercel (Performance & Hosting)
- Web Analytics
- Speed Insights
- App deployment

#### 11. Google Analytics (via GTM)
- Traffic tracking
- Conversion tracking
- User journey analysis

### Backend API Integration

**Base URL:** `https://api.gatewayz.ai` (configurable via `NEXT_PUBLIC_API_BASE_URL`)

**Authentication:** Bearer token (API keys stored in localStorage)

**Key Endpoints:**
- `/v1/models` - Model listing with pagination
- `/v1/chat/completions` - OpenAI-compatible chat API
- `/v1/chat/sessions` - Session management
- `/v1/analytics/events` - Event logging
- `/v1/metrics/*` - Metrics endpoints
- User authentication endpoint
- Payment processing endpoints

---

## Data Model & Core Types

### User & Authentication Types
```typescript
// src/lib/api.ts
type UserTier = 'basic' | 'pro' | 'max'
type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'inactive'

interface AuthResponse {
  success: boolean
  user_id: number
  api_key: string
  auth_method: string
  privy_user_id: string
  is_new_user: boolean
  display_name: string
  email: string
  credits: number
  tier?: UserTier
  subscription_status?: SubscriptionStatus
  subscription_end_date?: number  // Unix timestamp
}

interface UserData {
  user_id: number
  api_key: string
  display_name: string
  email: string
  credits: number
  tier?: UserTier
  subscription_status?: SubscriptionStatus
}
```

### Model Types
```typescript
// src/lib/models-data.ts
type Model = {
  name: string
  isFree: boolean
  tokens: string
  category: string
  description: string
  developer: string
  context: number
  inputCost: number
  outputCost: number
  modalities: string[]
  series: string
  supportedParameters: string[]
  requiredTier?: UserTier
}
```

### Chat Types
```typescript
// src/lib/chat-history.ts
interface ChatMessage {
  id: number
  session_id: number
  role: 'user' | 'assistant'
  content: string
  model?: string
  tokens?: number
  created_at: string
}

interface ChatSession {
  id: number
  user_id: number
  title: string
  model: string
  created_at: string
  updated_at: string
  is_active: boolean
  messages?: ChatMessage[]
}

interface ChatStats {
  total_sessions: number
  total_messages: number
  active_sessions: number
  total_tokens: number
}
```

### Provider Data
```typescript
// src/lib/provider-data.ts
type ProviderInfo = {
  name: string
  location: string
  quantization: string
  context: number
  maxOutput: number
  inputCost: number
  outputCost: number
  latency: number | null
  throughput: number | null
  uptime: number  // 0 to 1
}
```

### Tier Configuration
```typescript
// src/lib/tier-utils.ts
TIER_CONFIG = {
  basic: {
    name: 'Basic'
    monthlyPrice: null  // Pay-per-use
    isSubscription: false
  }
  pro: {
    name: 'Pro'
    monthlyPrice: 1500  // $15/month in cents
    isSubscription: true
  }
  max: {
    name: 'Max'
    monthlyPrice: 7500  // $75/month in cents
    creditAllocation: 15000
    isSubscription: true
  }
}
```

---

## Authentication Flow

1. **User initiates login** via Privy provider (Email, Google, GitHub, or Wallet)
2. **Privy authenticates** user and returns Privy user ID
3. **Frontend sends** Privy user info to backend `/api/auth` endpoint
4. **Backend validates** Privy token and creates/retrieves user account
5. **API key generated** and returned to frontend
6. **Frontend stores** API key and user data in localStorage
7. **Context provider** makes user data available throughout app via `GatewayzAuthContext`
8. **Protected routes** check authentication status before rendering

**Storage:**
- API Key: `localStorage['gatewayz_api_key']`
- User Data: `localStorage['gatewayz_user_data']`

---

## Key Architectural Details

### State Management
- **Global Auth Context** (`GatewayzAuthContext`) for user state
- **Gateway Context** (`GatewayContext`) for routing configuration
- **Zustand Stores** for chat UI and auth state (`src/lib/store/`)
- **React Query** for server state management
- **Local Component State** via React hooks
- **URL Search Parameters** for filters and navigation
- **localStorage** for persistence

### API Communication
- **Authenticated Requests:** Bearer token in Authorization header
- **CORS Handling:** Frontend API routes act as proxy to backend
- **Streaming:** Server-sent events for chat completions (SSE parser in `src/lib/streaming/`)
- **Pagination:** Limit/offset parameters for large datasets
- **Circuit Breaker:** Fault tolerance for API calls (`src/lib/circuit-breaker.ts`)
- **Retry Logic:** Automatic retries with exponential backoff (`src/lib/retry-utils.ts`)

### Model Fetching Strategy
- **Multi-Gateway Support:** Fetches from 16+ providers in parallel
- **Deduplication:** Combines and deduplicates models by ID
- **Redis Caching:** Server-side caching for improved performance
- **Fallback:** Static model data when API fails
- **Pagination:** Handles up to 50k models per request with offset
- **Model Sync Service:** Background synchronization (`src/lib/model-sync-service.ts`)

### Performance Optimizations
- **Image Optimization:** Next.js Image component with AVIF/WebP
- **Code Splitting:** Next.js automatic route splitting
- **Lazy Loading:** Suspense boundaries for slow components
- **Server-Side Rendering:** App Router with server components
- **Compression:** gzip compression enabled
- **Virtual Scrolling:** Efficient rendering of large lists (`useVirtualScroll`)
- **Model Prefetching:** Eager loading of model data (`useEagerModelPreload`)
- **Web Vitals Monitoring:** Real-time performance tracking (`src/lib/web-vitals-service.ts`)

### Security
- **API Keys:** Stored in secure localStorage, passed via Bearer token
- **CORS:** Backend handles CORS policies
- **Webhook Verification:** Stripe webhooks verified with signatures
- **Type Safety:** Full TypeScript coverage
- **Device Fingerprinting:** For fraud detection (`src/lib/device-fingerprint.ts`)
- **Audit Logging:** Security event tracking (`src/lib/audit-logging.ts`)
- **Guest Rate Limiting:** Prevents abuse (`src/lib/guest-rate-limiter.ts`)

---

## Main Pages & Routes

| Route | Purpose | Features |
|-------|---------|----------|
| `/` | Home/Landing | Featured models, platform overview |
| `/chat` | Interactive Chat | Multi-model chat, session management |
| `/models` | Model Browser | Search, filter, compare models |
| `/models/[name]` | Model Details | Model info, provider comparison |
| `/catalog` | Model Catalog | Extended model catalog browser |
| `/rankings` | Analytics | Performance metrics, trends |
| `/insights` | Asset Insights | Asset performance analytics |
| `/model-health` | Model Health | Model availability monitoring |
| `/monitoring` | System Monitoring | System health dashboard |
| `/playground` | API Playground | Interactive API testing |
| `/web-vitals` | Web Vitals | Performance metrics dashboard |
| `/settings` | Settings Home | Settings overview page |
| `/settings/account` | Account Management | Profile, password, preferences |
| `/settings/activity` | Activity Log | User activity history |
| `/settings/credits` | Credit Management | Balance, purchase history |
| `/settings/keys` | API Keys | Key management, creation |
| `/settings/integrations` | Integrations | Third-party service config |
| `/settings/privacy` | Privacy Settings | Data preferences |
| `/settings/presets` | Chat Presets | Saved configurations |
| `/settings/provisioning` | Account Provisioning | Account setup |
| `/settings/referrals` | Referral Program | Referral tracking |
| `/organizations/[name]` | Org Management | Team/organization features |
| `/developers` | Developer Docs | API docs, examples |
| `/onboarding` | Onboarding | First-time user setup |
| `/signup` | Sign Up | New user registration |
| `/checkout` | Checkout | Payment checkout flow |
| `/start` | Getting Started | New user getting started flow |
| `/share/[id]` | Shared Chat | View shared chat conversations |
| `/claude-code` | Claude Code | Claude integration |
| `/contact` | Contact | Contact form |
| `/deck` | Presentation | Platform presentation deck |
| `/releases` | Release Notes | Version release history |
| `/ai-sdk-demo` | AI SDK Demo | AI SDK demonstration page |

---

## Environment Variables

### Required
- `NEXT_PUBLIC_PRIVY_APP_ID` - Privy authentication app ID
- `NEXT_PUBLIC_API_BASE_URL` - Backend API base URL (default: https://api.gatewayz.ai)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key

### Optional
- `STRIPE_SECRET_KEY` - Stripe server-side key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature verification
- `NEXT_PUBLIC_POSTHOG_KEY` - PostHog analytics key
- `NEXT_PUBLIC_POSTHOG_HOST` - PostHog API host
- `NEXT_PUBLIC_STATSIG_CLIENT_KEY` - Statsig feature flag key
- `SENTRY_DSN` - Sentry error tracking DSN
- `SENTRY_AUTH_TOKEN` - Sentry release upload token
- `REDIS_URL` - Redis connection URL
- `HF_API_KEY` / `NEXT_PUBLIC_HF_API_KEY` - Hugging Face API auth
- `NEAR_API_KEY` / `NEXT_PUBLIC_NEAR_API_KEY` - NEAR API auth

---

## Development

### Setup
```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Build with Sentry release
pnpm build:with-sentry

# Start production server
pnpm start

# Run linter
pnpm lint

# Type check
pnpm typecheck

# Run unit tests
pnpm test

# Run E2E tests (Playwright)
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Run Cypress tests
pnpm cypress:run

# Run all tests
pnpm test:all

# Check subscription config
pnpm check-subscription
```

### PM2 Process Management
```bash
# Start production server with PM2
pnpm pm2:start

# Start development server with PM2
pnpm pm2:start:dev

# Stop PM2 processes
pnpm pm2:stop

# Restart PM2 processes
pnpm pm2:restart

# View PM2 logs
pnpm pm2:logs

# Monitor PM2 processes
pnpm pm2:monit
```

### Monitoring & Performance
```bash
# Test chat performance
pnpm test:chat

# Monitor logs
pnpm monitor:logs

# View performance dashboard
pnpm dashboard

# View performance alerts
pnpm alerts

# Generate performance report
pnpm report

# Monitor errors
pnpm monitor:errors
```

### Deployment
- **Platform:** Firebase App Hosting
- **Build Command:** `pnpm run build && pnpm run start`
- **Node Version:** 18+
- **Package Manager:** pnpm
- **Configuration:** `apphosting.yaml`, `ecosystem.config.js`

---

## Notable Patterns & Conventions

1. **Server/Client Boundaries:** Explicit "use client" directives for interactive components
2. **Error Boundaries:** ErrorBoundary component for graceful error handling (`src/components/error-boundary.tsx`)
3. **Global Error Handling:** Sentry integration with error suppression (`src/lib/global-error-handlers.ts`)
4. **Custom Hooks:** Extraction of business logic into reusable hooks (28+ hooks)
5. **Component Composition:** Breaking UI into small, composable pieces
6. **Type Safety:** Comprehensive TypeScript coverage throughout (528 files)
7. **API Abstraction:** Service classes (ChatHistoryAPI, models-service, catalog-api) for API calls
8. **Event System:** Custom events for auth refresh and cross-tab sync
9. **Context Providers:** Nested providers for auth, theme, analytics, gateway routing
10. **Zustand Stores:** Lightweight state management for UI state (`src/lib/store/`)
11. **React Query:** Server state management with automatic caching
12. **Responsive Design:** Mobile-first approach with Tailwind utilities
13. **Accessibility:** Radix UI components for WCAG compliance
14. **Circuit Breaker Pattern:** Fault tolerance for external API calls
15. **SSE Streaming:** Custom server-sent events parser for chat streaming
16. **Optimistic Updates:** UI updates before server confirmation
17. **Virtual Scrolling:** Efficient rendering for large lists
18. **Performance Monitoring:** Web Vitals tracking and reporting

---

## Contributing

When contributing to this codebase:

1. **Type Safety:** Always use TypeScript and add proper type definitions
2. **Component Structure:** Follow the established component hierarchy
3. **Styling:** Use Tailwind CSS classes, avoid custom CSS when possible
4. **Testing:** Add tests for new features
5. **Documentation:** Update this file when making significant changes
6. **Accessibility:** Ensure components are keyboard navigable and screen reader friendly
7. **Performance:** Consider code splitting and lazy loading for large components

---

## Cross-Domain Session Transfer

### Overview

Users authenticate on **gatewayz.ai** (main domain) and are automatically redirected to **beta.gatewayz.ai** with their authentication token. This enables seamless cross-domain authentication without requiring a second login.

### Session Transfer Flow

```
gatewayz.ai (Main Domain)
    ↓
User authenticates via Privy
    ↓
Backend returns API key
    ↓
Automatic redirect to:
https://beta.gatewayz.ai?token=<API_KEY>&userId=<USER_ID>
    ↓
beta.gatewayz.ai (This Domain)
    ↓
SessionInitializer receives token
    ↓
User automatically authenticated ✅
```

### Beta Team Implementation

The beta domain implements session transfer via the `SessionInitializer` component:

**Location**: `src/components/SessionInitializer.tsx`

**Responsibilities**:
1. Detects URL parameters from main domain redirect
2. Extracts and validates session token and user ID
3. Stores token in sessionStorage (10-minute expiry)
4. Saves API key to localStorage
5. Syncs authentication context
6. Cleans URL parameters from browser history
7. Redirects to dashboard or specified return URL

**Integration**: Added to `src/app/layout.tsx` root layout

### Shared Modules

The following modules are shared between main and beta domains:

- `src/integrations/privy/auth-session-transfer.ts` - Session transfer utilities
- `src/integrations/privy/auth-sync.ts` - Authentication sync module
- `src/context/gatewayz-auth-context.tsx` - Enhanced auth context with session transfer support

### Documentation

For implementation details, see:
- **BETA_TEAM_QUICK_START.md** - Quick start guide (~20 minutes to implement)
- **BETA_AUTH_TRANSFER.md** - Complete implementation guide with all details

### Security

- **Token Handling**: Passed in URL during redirect, immediately cleaned from history
- **SessionStorage**: Domain-specific, auto-expires after 10 minutes
- **localStorage**: API key persisted for session duration
- **Bearer Token**: Used for all authenticated API requests
- **401 Handling**: Invalid tokens automatically cleared

### Key Points

✅ Automatic session transfer from main domain
✅ No second login required on beta domain
✅ Secure token handling with auto-expiry
✅ Backward compatible with manual Privy login
✅ One-way flow (main → beta only)
✅ Proper separation of concerns

---

---

## Claude Code Task Management Workflow

### Overview

The project includes a comprehensive Claude Code infrastructure system with skills auto-activation, hooks automation, dev docs workflow, specialized agents, and slash commands. See `.claude/README.md` for complete details.

### Starting Large Tasks

When beginning any feature or large task:

1. **Enter Plan Mode** or use `/dev-docs [feature description]`
   - Agent researches the codebase
   - Creates comprehensive plan with phases, risks, timeline
   - Generates three supporting documents

2. **Review the Plan**
   - Read plan.md carefully
   - Look for any issues or missing pieces
   - Catch mistakes early before implementation

3. **Create Task Files**
   - Approve the plan
   - Run `/create-dev-docs`
   - Generates three files in `/dev/active/[task-name]/`:
     - `[task-name]-plan.md` - Implementation plan
     - `[task-name]-context.md` - Key context and decisions
     - `[task-name]-tasks.md` - Checklist of all tasks

4. **Implement Section by Section**
   - Don't try to do everything at once
   - Implement one or two phases at a time
   - Review code between sections: `/code-review`

5. **Update Documentation**
   - Mark tasks complete immediately as you finish them
   - Update context file with relevant decisions
   - This prevents context loss during long implementations

### Continuing Tasks

When continuing work on a feature:

1. **Check `/dev/active/`** for existing tasks
2. **Read all three files** before proceeding:
   - plan.md - Refresh implementation plan
   - context.md - Review key decisions and what's been done
   - tasks.md - See what's completed vs remaining
3. **Update files as you work** - Keep context fresh
4. **Before compacting**: Run `/dev-docs-update` to update docs with progress

### Skills System

Skills auto-activate based on:
- **Keywords in your prompt**: "component", "API", "test", etc.
- **Files you're editing**: Relevant skill loads automatically
- **Intent patterns**: Detects what you're trying to do

**You don't need to manually invoke skills** - the hook system handles it automatically!

### Quality Checks

Automated checks run after each Claude response:

1. **Build Checker**
   - Runs `pnpm typecheck`
   - Catches TypeScript errors immediately
   - Shows errors or recommends `/build-and-fix`

2. **Error Handling Reminder**
   - Gentle reminder for risky code patterns
   - Suggests error handling improvements
   - Non-blocking awareness system

### Code Reviews

Use `/code-review` regularly during implementation to catch:
- Best practice violations
- Security issues
- Performance problems
- Inconsistent patterns
- Missing error handling

### Testing

For comprehensive testing:
- `/test-unit` - Run Jest unit tests
- `/test-e2e` - Run Playwright E2E tests
- `/test-api [route]` - Test specific API routes

### Build Validation

When build fails or has errors:
```
/build-and-fix
```

Automatically fixes:
- TypeScript compilation errors
- Import path issues
- Type mismatches
- Unused variables

### Key Commands

**Planning**:
- `/dev-docs [description]` - Create strategic plan
- `/dev-docs-update` - Update docs before compaction
- `/create-dev-docs` - Generate task files

**Quality & Review**:
- `/code-review` - Review code architecture
- `/build-and-fix` - Fix all TypeScript errors

**Testing**:
- `/test-unit` - Run unit tests
- `/test-e2e` - Run E2E tests
- `/test-api [route]` - Test API route

**Research**:
- `/route-research [feature]` - Map affected API routes

### Dev Docs Structure

```
dev/
├── active/
│   ├── [task-name]/
│   │   ├── [task-name]-plan.md      # Implementation plan
│   │   ├── [task-name]-context.md   # Key context and decisions
│   │   └── [task-name]-tasks.md     # Task checklist
│   └── [other-task]/
└── completed/
    └── (archived tasks)
```

### Sample Workflow

```
1. /dev-docs Add dark mode support
   → Agent researches and creates plan

2. Review plan.md, approve approach

3. /create-dev-docs
   → Generates three files in dev/active/dark-mode/

4. Implement Phase 1
   → Skill for "theme" or "styling" auto-activates
   → Error checker runs after each response
   → Update tasks.md as you complete items

5. /code-review
   → Review Phase 1 code

6. /test-unit
   → Run tests

7. Before compacting: /dev-docs-update
   → Updates context with progress

8. Compact conversation

9. New session: "continue"
   → Read dev docs files
   → Continue from where you left off
```

### Best Practices

✅ **DO**:
- Use `/dev-docs` to plan features
- Review plans before implementing
- Run `/code-review` before pushing
- Use `/build-and-fix` regularly
- Keep dev docs updated
- Let skills activate naturally
- Trust the error checker
- Test with `/test-*` commands

❌ **DON'T**:
- Ignore TypeScript errors
- Skip code reviews
- Leave dev docs stale
- Try to fix everything at once
- Push without testing
- Manually activate skills
- Ignore error handling reminders

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs/primitives)
- [Privy Documentation](https://docs.privy.io)
- [Stripe Documentation](https://stripe.com/docs)
- **BETA_TEAM_QUICK_START.md** - Session transfer quick start guide
- **BETA_AUTH_TRANSFER.md** - Complete session transfer documentation
- **IMPLEMENTATION_VERIFICATION.md** - Architecture verification
- **.claude/README.md** - Claude Code infrastructure documentation
