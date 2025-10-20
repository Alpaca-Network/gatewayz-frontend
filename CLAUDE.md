# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint linting
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run Jest tests (configured with --passWithNoTests)

### Package Management
- **Package Manager**: pnpm (version 10.17.1) is the preferred package manager
- Use `pnpm install` for dependencies (npm also works)

## Architecture Overview

### Tech Stack
- **Next.js 15** with App Router (server actions enabled)
- **TypeScript** with ES2017 target and strict mode
- **Tailwind CSS** with custom design system and dark/light theme support
- **Radix UI** components for accessible UI primitives
- **Privy** for Web3-native authentication (email, Google, GitHub)
- **PostHog** for product analytics and user behavior tracking
- **Stripe** for payment processing and credit purchases
- **Firebase** for backend services and database
- **Recharts** and **Chart.js** for data visualization

### Next.js Configuration Notes
- **React Strict Mode**: Disabled (`reactStrictMode: false`) to fix layout router mounting issues with providers
- **TypeScript/ESLint**: Build errors are ignored (`ignoreBuildErrors: true`, `ignoreDuringBuilds: true`)
- **Webpack**: Custom config to handle Handlebars module resolution issues and Windows casing problems
- **Image Optimization**: Configured for placehold.co and upload.wikimedia.org domains
- **Source Maps**: Disabled in production (`productionBrowserSourceMaps: false`)

### Key Directory Structure
```
src/
├── app/                   # Next.js App Router pages and API routes
│   ├── api/
│   │   ├── chat/          # Chat completions proxy, sessions, messages, stats
│   │   ├── stripe/        # Stripe checkout, portal, customer, webhook
│   │   ├── models/        # Model data API
│   │   ├── user/          # User activity logging and stats
│   │   └── init-db/       # Database initialization
│   ├── chat/              # Chat interface with model selection
│   ├── models/            # Model browser with [name] and [...name] dynamic routes
│   ├── rankings/          # Analytics dashboard
│   ├── settings/          # User settings (account, activity, credits, keys, etc.)
│   ├── organizations/     # Organization management with [name] routes
│   └── start/             # Onboarding flows (api, claude-code, chat)
├── components/
│   ├── ui/               # Base Radix UI components
│   ├── auth/             # Authentication components
│   ├── chat/             # Chat-specific components
│   ├── dashboard/        # Analytics and charts
│   ├── layout/           # Header, footer, navigation
│   ├── models/           # Model-related components
│   └── providers/        # Context providers (Privy, PostHog, Theme)
├── hooks/                # Custom React hooks (use-auth, use-mobile, use-toast, useModelData)
├── lib/                  # Core utilities and configuration
│   ├── api.ts            # API key management, authenticated requests, auth response processing
│   ├── chat-history.ts   # ChatHistoryAPI class for session/message management
│   ├── models-data.ts    # 300+ AI model definitions with pricing and capabilities
│   ├── provider-data.ts  # AI provider information
│   ├── privy.ts          # Privy auth configuration
│   ├── firebase.ts       # Firebase config (project: oxvoidmain-gatewayz)
│   ├── stripe.ts         # Stripe client initialization
│   ├── streaming.ts      # SSE streaming utilities
│   └── database.ts       # Database utilities
└── styles/               # Global CSS (globals.css) and chat.css
```

## Authentication & API Integration

### Authentication Flow
1. **Privy Authentication**: Primary auth provider supporting email/password, Google OAuth, and GitHub OAuth
2. **Backend API Authentication**: After Privy login, the app calls the Gatewayz backend API which returns an `AuthResponse` with:
   - `api_key`: Backend API key for authenticated requests
   - `user_id`: Numeric user ID in the backend system
   - `privy_user_id`: Privy user identifier for linking
   - `credits`: User's credit balance
   - `is_new_user`: Flag for triggering welcome dialogs
3. **Storage**: API key and user data stored in localStorage via `src/lib/api.ts` functions
4. **Usage**: Use `getApiKey()` from `src/lib/api.ts` or `makeAuthenticatedRequest()` for authenticated API calls

### Backend API Integration
- **Base URL**: `https://api.gatewayz.ai` (configurable via `NEXT_PUBLIC_API_BASE_URL`)
- **Chat Completions Proxy**: `/api/chat/completions` proxies requests to `https://api.gatewayz.ai/v1/chat/completions`
  - Handles both streaming and non-streaming responses
  - Streaming timeout: 120 seconds
  - Non-streaming timeout: 30 seconds
  - Includes detailed error handling for timeouts, network errors, and backend failures
- **Session Management**: `/api/chat/sessions` endpoints for creating, retrieving, updating, and deleting chat sessions
- **Chat History**: `ChatHistoryAPI` class in `src/lib/chat-history.ts` provides typed interface for all chat operations

### Payment Integration
- **Stripe**: Used for credit purchases via Checkout Sessions
- **Webhook**: `/api/stripe/webhook` handles `checkout.session.completed` events
  - Verifies webhook signature
  - Extracts credits and user info from session metadata
  - Calls backend API to credit user account
- **Environment Variables**: Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`

## Model Management System

### Model Data Structure
- **Location**: `src/lib/models-data.ts`
- **Type Definition**: `Model` interface with fields:
  - `name`, `developer`, `description`
  - `isFree`, `tokens`, `category`, `series`
  - `context` (context window), `inputCost`, `outputCost` (per 1M tokens)
  - `modalities` (Text, Image, Audio, Video, File)
  - `supportedParameters` (tools, temperature, top_p, etc.)
- **Count**: 300+ AI models from 60+ providers
- **Dynamic Routes**: Individual model pages at `/models/[name]` and `/models/[...name]` for nested paths

### Provider Data
- **Location**: `src/lib/provider-data.ts`
- Contains provider logos, descriptions, and categorization

## UI & Styling System

### Component Architecture
- **Base Components**: Radix UI primitives wrapped in `src/components/ui/`
- **Theme System**: Dark/light mode via `src/components/theme-provider.tsx` using CSS variables
- **Responsive Design**: Mobile-first with `use-mobile.tsx` hook
- **Icons**: Lucide React icon library

### Tailwind Configuration
- Extended color palette with gradients and custom variables
- Custom animations defined in Tailwind config
- Typography plugin enabled (`@tailwindcss/typography`)
- Optimized for package imports: `lucide-react`, `@radix-ui/react-icons`

## Testing & Code Quality

### Type Checking
- Run `npm run typecheck` before commits
- Note: Build errors are currently ignored in next.config.ts

### Linting
- Run `npm run lint` before commits
- ESLint configured with Next.js config

### Testing
- Jest configured with `--passWithNoTests` flag
- Testing libraries: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- Environment: jsdom

## Environment Variables

### Required for Core Functionality
```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai
```

### Optional Services
```bash
# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Stripe Payments
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Google AI (if using Genkit)
GOOGLE_AI_API_KEY=your-google-ai-api-key
```

## Important Architectural Patterns

### API Request Flow
1. Frontend makes requests to `/api/*` Next.js API routes (proxy layer)
2. API routes forward to Gatewayz backend API at `https://api.gatewayz.ai`
3. Include `Authorization: Bearer ${apiKey}` header from localStorage
4. Handle streaming responses for chat completions
5. Process errors with appropriate status codes (401, 502, 504, etc.)

### Chat Session Management
1. Create session: `chatHistoryAPI.createSession(title, model)`
2. Save user message: `chatHistoryAPI.saveMessage(sessionId, 'user', content)`
3. Stream AI response from `/api/chat/completions`
4. Save assistant message: `chatHistoryAPI.saveMessage(sessionId, 'assistant', content, model, tokens)`
5. Sessions linked to users via `user_id` and `privy_user_id`

### New User Onboarding
1. Backend returns `is_new_user: true` in auth response
2. Frontend dispatches `NEW_USER_WELCOME_EVENT` custom event
3. Welcome dialog shows credit allocation
4. User routed through `/start/*` onboarding flows

### Credit System
- Credits stored in backend database
- Tracked per user via `user_id`
- Updated via Stripe webhook on successful payment
- Displayed in UI from user data in localStorage (synced with backend)