# Gatewayz Frontend - Codebase Documentation

## Application Overview

**Gatewayz** is a comprehensive AI model management and routing platform that provides a unified interface for accessing and working with Large Language Models (LLMs) from 60+ providers. It serves as an AI router and gateway solution that helps teams manage, compare, and utilize 300+ AI models from multiple providers through a single, unified interface.

### Key Objectives
- Provide access to 300+ AI models from multiple providers
- Offer real-time chat interface with model switching
- Enable model performance analytics and comparisons
- Manage API keys and developer integration tools
- Support team/organization management features
- Handle billing and credits management with tiered subscription support

---

## Directory Structure

```
/root/repo/src/
├── app/                           # Next.js 15 App Router pages
│   ├── layout.tsx                 # Root layout with theme & auth providers
│   ├── api/                       # API routes for backend integration
│   │   ├── auth/                  # Authentication endpoints
│   │   ├── chat/                  # Chat completion proxies and session management
│   │   │   ├── completions/       # OpenAI-compatible chat completions API
│   │   │   ├── sessions/          # Chat session management
│   │   │   ├── search/            # Model search functionality
│   │   │   └── stats/             # Chat statistics
│   │   ├── models/                # Model listing and discovery
│   │   ├── stripe/                # Stripe payment integration
│   │   │   ├── checkout/          # Checkout session creation
│   │   │   ├── customer/          # Customer management
│   │   │   ├── portal/            # Subscription portal
│   │   │   └── webhook/           # Webhook handling
│   │   ├── user/                  # User management
│   │   │   ├── api-keys/          # API key management
│   │   │   └── activity/          # Activity logging and statistics
│   │   └── payments/              # Payment processing
│   ├── chat/                      # Interactive chat interface
│   ├── models/                    # Model browser and discovery
│   │   └── [...name]/             # Dynamic model detail pages
│   ├── rankings/                  # Analytics & model performance rankings
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
│   ├── organizations/             # Organization management
│   │   └── [name]/                # Dynamic org pages
│   ├── developers/                # Developer documentation & resources
│   ├── onboarding/                # Onboarding flow
│   ├── signup/                    # Sign-up page
│   ├── claude-code/               # Claude Code integration
│   └── email-preview/             # Email template preview
├── components/                    # Reusable React components (110+ files)
│   ├── ui/                        # Radix UI primitives (button, dialog, etc.)
│   ├── auth/                      # Auth-related components
│   ├── chat/                      # Chat-specific components
│   ├── dashboard/                 # Analytics dashboard components
│   ├── layout/                    # Layout components (header, footer, nav)
│   ├── models/                    # Model display components
│   ├── dialogs/                   # Modal dialogs
│   ├── onboarding/                # Onboarding components
│   ├── providers/                 # Context providers
│   ├── sections/                  # Landing page sections
│   ├── tier/                      # Tier/subscription components
│   └── analytics/                 # GTM integration
├── context/                       # React Context for state management
│   └── gatewayz-auth-context.tsx  # Global authentication context
├── hooks/                         # Custom React hooks
│   ├── use-auth.ts                # Privy authentication hook
│   ├── use-tier.ts                # Tier/subscription info hook
│   ├── use-mobile.tsx             # Mobile detection hook
│   ├── use-toast.ts               # Toast notifications hook
│   └── useModelData.ts            # Model data fetching hook
├── lib/                           # Utility functions and services
│   ├── api.ts                     # API authentication & utilities
│   ├── analytics.ts               # Analytics event logging
│   ├── chat-history.ts            # Chat session/history management
│   ├── config.ts                  # Configuration constants
│   ├── data.ts                    # Static data
│   ├── models-data.ts             # Model definitions and metadata
│   ├── models-service.ts          # Multi-gateway model fetching service
│   ├── privy.ts                   # Privy configuration
│   ├── provider-data.ts           # Provider performance data
│   ├── stripe.ts                  # Stripe integration
│   ├── tier-utils.ts              # Tier system utilities
│   ├── utils.ts                   # General utilities
│   └── streaming.ts               # Streaming API helpers
└── styles/
    └── globals.css                # Global styles
```

**Total Files:** 176 TypeScript/TSX files

---

## Key Features

### 1. Unified Model Access
- Browse 300+ models from 60+ providers
- Support for 16+ gateway/provider integrations
- Real-time model discovery with search

### 2. Interactive Chat Interface
- Multi-model support with seamless switching
- Session management with chat history
- Persistent local storage and backend sync
- Support for streaming responses
- Message markdown rendering with math (KaTeX support)
- Image upload/support
- Reasoning display for models supporting chain-of-thought

### 3. Model Management
- Advanced filtering (by modality, context length, pricing, capabilities)
- Dynamic model detail pages
- Performance metrics tracking
- Provider comparison views
- Model-specific configuration parameters

### 4. Analytics & Rankings
- Performance comparisons across model categories
- Usage statistics (token generation, model usage)
- Trend analysis with interactive charts
- Category filtering and time range selection

### 5. Developer Tools
- API key management
- Chat session API endpoints
- Model search functionality
- Activity logging and statistics
- Integration guides

### 6. User Authentication & Authorization
- Multi-provider auth (Email, Google, GitHub, Wallet)
- Secure session management
- User profile management
- Role-based access control

### 7. Billing & Credits
- Tiered subscription system (Basic, Pro, Max)
- Credit-based pay-per-use model
- Stripe integration for payments
- Subscription management
- Credit purchase and tracking

### 8. Organization Features
- Team/organization management
- Shared resource access
- Organization billing

---

## Technology Stack

### Frontend Framework
- **Next.js 15.3.3** - React framework with App Router
- **React 18.3.1** - UI library
- **TypeScript 5** - Type safety

### UI & Styling
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives (accordion, dialog, dropdown, select, etc.)
- **shadcn/ui** - Component library built on Radix UI
- **Lucide React 0.475** - Icon library
- **Embla Carousel 8.6** - Carousel component
- **class-variance-authority 0.7** - Variant management
- **tailwind-merge 3.0** - Tailwind CSS merge utility
- **tailwindcss-animate 1.0** - Animation utilities

### Data Visualization
- **Recharts 2.15** - React charting library
- **Chart.js 4.5** - Advanced charting
- **react-chartjs-2 5.3** - Chart.js React wrapper

### Form & Validation
- **React Hook Form 7.54** - Form state management
- **@hookform/resolvers 4.1** - Form validation resolvers
- **Zod 3.24** - TypeScript-first schema validation

### Content Rendering
- **React Markdown 10.1** - Markdown parser
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

### Utilities
- **date-fns 3.6** - Date manipulation
- **clsx 2.1** - Conditional className utility
- **cmdk 1.0** - Command menu component
- **@faker-js/faker 8.4** - Mock data generation
- **dotenv 16.5** - Environment variable management

### Development Tools
- **ESLint 8.57** - Code linting
- **eslint-config-next 15.5** - Next.js ESLint config
- **PostCSS 8** - CSS processing
- **Jest 30** - Testing framework
- **@testing-library/react 16.3** - React component testing
- **@testing-library/jest-dom 6.9** - DOM matchers
- **@playwright/test 1.56** - E2E testing
- **TypeScript Compiler** - Type checking
- **pnpm 10.17** - Package manager
- **patch-package 8.0** - NPM package patching

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
- Subscription billing
- Payment webhooks
- Customer portal
- **Location:** `src/app/api/stripe/`

#### 3. AI Model Gateways (16+ providers)
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
- **Location:** `src/lib/models-service.ts`

#### 4. Statsig (Feature Flags & Analytics)
- User identification
- Auto-capture plugin
- Session replay plugin
- **Location:** `src/components/providers/statsig-provider.tsx`

#### 5. PostHog (Product Analytics)
- Page view tracking
- Event capturing
- User behavior analysis
- **Location:** `src/components/providers/posthog-provider.tsx`

#### 6. Vercel (Performance & Hosting)
- Web Analytics
- Speed Insights
- App deployment

#### 7. Google Analytics (via GTM)
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
- **Local Component State** via React hooks
- **URL Search Parameters** for filters and navigation
- **localStorage** for persistence

### API Communication
- **Authenticated Requests:** Bearer token in Authorization header
- **CORS Handling:** Frontend API routes act as proxy to backend
- **Streaming:** Server-sent events for chat completions
- **Pagination:** Limit/offset parameters for large datasets

### Model Fetching Strategy
- **Multi-Gateway Support:** Fetches from 16+ providers in parallel
- **Deduplication:** Combines and deduplicates models by ID
- **Caching:** 5-minute cache for improved performance
- **Fallback:** Static model data when API fails
- **Pagination:** Handles up to 50k models per request with offset

### Performance Optimizations
- **Image Optimization:** Next.js Image component with AVIF/WebP
- **Code Splitting:** Next.js automatic route splitting
- **Lazy Loading:** Suspense boundaries for slow components
- **Server-Side Rendering:** App Router with server components
- **Compression:** gzip compression enabled

### Security
- **API Keys:** Stored in secure localStorage, passed via Bearer token
- **CORS:** Backend handles CORS policies
- **Webhook Verification:** Stripe webhooks verified with signatures
- **Type Safety:** Full TypeScript coverage

---

## Main Pages & Routes

| Route | Purpose | Features |
|-------|---------|----------|
| `/` | Home/Landing | Featured models, platform overview |
| `/chat` | Interactive Chat | Multi-model chat, session management |
| `/models` | Model Browser | Search, filter, compare models |
| `/models/[name]` | Model Details | Model info, provider comparison |
| `/rankings` | Analytics | Performance metrics, trends |
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
| `/claude-code` | Claude Code | Claude integration |

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

# Start production server
pnpm start

# Run linter
pnpm lint

# Type check
pnpm typecheck

# Run tests
pnpm test
```

### Deployment
- **Platform:** Firebase App Hosting
- **Build Command:** `pnpm run build && pnpm run start`
- **Node Version:** 18+
- **Package Manager:** pnpm
- **Configuration:** `apphosting.yaml`

---

## Notable Patterns & Conventions

1. **Server/Client Boundaries:** Explicit "use client" directives for interactive components
2. **Error Boundaries:** ErrorBoundary component for graceful error handling
3. **Custom Hooks:** Extraction of business logic into reusable hooks
4. **Component Composition:** Breaking UI into small, composable pieces
5. **Type Safety:** Comprehensive TypeScript coverage throughout
6. **API Abstraction:** Service classes (ChatHistoryAPI, models-service) for API calls
7. **Event System:** Custom events for auth refresh and cross-tab sync
8. **Context Providers:** Nested providers for auth, theme, analytics
9. **Responsive Design:** Mobile-first approach with Tailwind utilities
10. **Accessibility:** Radix UI components for WCAG compliance

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

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs/primitives)
- [Privy Documentation](https://docs.privy.io)
- [Stripe Documentation](https://stripe.com/docs)
