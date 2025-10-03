# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint linting
- `npm run typecheck` - Run TypeScript type checking

### AI Development Commands
- `npm run genkit:dev` - Start Genkit AI development server (run in separate terminal)
- `npm run genkit:watch` - Start Genkit with file watching for AI flows

## Architecture Overview

### Tech Stack
- **Next.js 15** with App Router for full-stack React framework
- **TypeScript** for type safety
- **Tailwind CSS** with custom design system and dark/light theme support
- **Radix UI** components for accessible UI primitives
- **Privy** for Web3-native authentication (email, Google, GitHub)
- **Google Genkit** for AI orchestration and chat flows
- **Firebase** for backend services and database
- **Recharts** and **Chart.js** for data visualization

### Key Directory Structure
```
src/
├── ai/                     # AI integration layer
│   ├── genkit.ts          # Genkit AI configuration (gemini-2.0-flash model)
│   ├── flows/             # AI chat flows and logic
│   └── dev.ts             # Development AI server
├── app/                   # Next.js App Router pages and API routes
│   ├── api/               # Backend API endpoints
│   ├── chat/              # Chat interface with AI models
│   ├── models/            # Model browser and individual model pages
│   ├── rankings/          # Analytics dashboard
│   └── settings/          # User settings and management
├── components/            # Reusable React components
│   ├── ui/               # Base UI components (Radix UI + custom)
│   ├── auth/             # Authentication components
│   ├── chat/             # Chat-specific components
│   ├── dashboard/        # Analytics and charts
│   └── layout/           # Header, footer, navigation
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configuration
│   ├── models-data.ts    # 300+ AI model definitions
│   ├── provider-data.ts  # AI provider information
│   ├── privy.ts          # Privy auth configuration
│   ├── firebase.ts       # Firebase config and auth functions
│   └── data.ts           # Analytics and mock data
└── styles/               # Global CSS and styling
```

### Authentication System
- **Primary**: Privy authentication with email/password, Google OAuth, GitHub OAuth
- **Configuration**: Located in `src/lib/privy.ts`
- **Required env**: `NEXT_PUBLIC_PRIVY_APP_ID`
- **Components**: Authentication flows handled by `src/components/providers/privy-provider.tsx`
- **Hooks**: Use `src/hooks/use-auth.ts` for authentication state

### AI Integration
- **Framework**: Google Genkit for AI orchestration
- **Model**: Default model is `googleai/gemini-2.0-flash`
- **Configuration**: `src/ai/genkit.ts`
- **Chat Flows**: Located in `src/ai/flows/`
- **Required env**: `GOOGLE_AI_API_KEY`
- **Development**: Run `npm run genkit:dev` for AI development server

### Database & Backend
- **Firebase**: Used for authentication and database services
- **Configuration**: `src/lib/firebase.ts` (includes Firebase config with project ID: oxvoidmain-gatewayz)
- **API Routes**: Database initialization and testing endpoints in `src/app/api/`
- **Database utilities**: `src/lib/database.ts`

### UI System
- **Base Components**: Radix UI primitives in `src/components/ui/`
- **Styling**: Tailwind CSS with custom design system
- **Theme**: Dark/light mode support via `src/components/theme-provider.tsx`
- **Custom Colors**: Extended color palette including gradients and custom variables
- **Responsive**: Mobile-first design with `src/hooks/use-mobile.tsx`

### Model Management
- **Data Source**: `src/lib/models-data.ts` contains 300+ AI model definitions
- **Providers**: Provider information in `src/lib/provider-data.ts`
- **Categories**: Models organized by capabilities, modality, and pricing
- **Dynamic Pages**: Individual model pages at `/models/[name]`

## Environment Variables

### Required
```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
GOOGLE_AI_API_KEY=your-google-ai-api-key
```

### Privy Setup
- Create app at dashboard.privy.io
- Configure login methods: email, Google, GitHub OAuth
- Set authorized domains for production

## Development Workflow

### Starting Development
1. `npm install` - Install dependencies
2. Set up environment variables in `.env.local`
3. `npm run dev` - Start Next.js development server
4. `npm run genkit:dev` - Start AI development server (separate terminal)

### Code Quality
- Always run `npm run lint` before committing
- Always run `npm run typecheck` to ensure type safety
- Follow existing patterns in component structure and styling

### Component Patterns
- Use Radix UI components from `src/components/ui/` as base
- Follow the established folder structure for new components
- Use TypeScript interfaces for all props
- Implement responsive design with Tailwind CSS classes
- Use custom hooks for state management and side effects

### AI Development
- AI chat flows are defined in `src/ai/flows/`
- Use Genkit development server for testing AI integrations
- Model selection handled in `src/components/chat/model-select.tsx`
- Chat interface styling in `src/app/chat/chat.css`

## Important Notes

### Authentication Flow
- Privy handles the complete authentication flow
- Firebase is configured but Privy is the primary auth provider
- User state managed through `src/hooks/use-auth.ts`

### Model Data
- Model definitions include capabilities, pricing, context limits
- Provider data includes logos, descriptions, and categories
- Analytics data for rankings and charts in `src/lib/data.ts`

### Styling System
- Custom Tailwind configuration with design tokens
- CSS variables for theme support
- Radix UI for accessible component primitives
- Custom animations and gradients defined in Tailwind config

### Database Operations
- Use Firebase Firestore for data persistence
- Database utilities available in `src/lib/database.ts`
- API routes for database operations in `src/app/api/`