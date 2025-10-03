# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

Use pnpm (preferred) or npm.

- Dev server: pnpm dev
- Build: pnpm build
- Start (prod): pnpm start
- Lint: pnpm lint
- Typecheck: pnpm typecheck
- AI dev server (run in separate terminal): pnpm genkit:dev
- AI dev server with watch: pnpm genkit:watch

Notes
- This project uses Next.js 15 (App Router). The dev server runs on http://localhost:3000 by default.
- next.config.ts is configured to ignore TypeScript and ESLint errors during build. Run pnpm typecheck and pnpm lint locally to catch issues.

## Environment

Create a .env.local at repo root with the following keys (no values here):
- GOOGLE_AI_API_KEY
- FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID (and any other required Firebase keys used in src/lib/firebase.ts)
- NEXT_PUBLIC_PRIVY_APP_ID (Privy auth)
- NEXT_PUBLIC_API_BASE_URL (if your app consumes a backend)

## Architecture overview

High level
- Framework: Next.js 15 with the App Router (src/app).
- Language/Styling: TypeScript + Tailwind CSS (tailwind.config.ts), Radix UI components.
- AI integration: Google Genkit with a dev entrypoint for flows.
- Backend services: Firebase (auth and backend services per README), Privy auth (per CLAUDE.md).

Key areas
- App shell and routing: src/app/
  - Root layout and global providers live in src/app/layout.tsx.
  - The landing experience is in src/app/page.tsx.
  - Feature routes are organized under src/app/chat, src/app/models, src/app/rankings, src/app/settings, src/app/developers (see README structure).
- Components: src/components/
  - Base UI components under src/components/ui.
  - Layout and feature-specific components under src/components/layout, src/components/chat, src/components/dashboard.
- AI/Genkit layer: src/ai/
  - Genkit setup in src/ai/genkit.ts.
  - Flows (e.g., chat) under src/ai/flows/.
  - Dev entry in src/ai/dev.ts (used by pnpm genkit:dev and pnpm genkit:watch).
- Utilities and data: src/lib/
  - Data sources and model metadata in files like models-data.ts and data.ts (see README).
  - Firebase configuration in src/lib/firebase.ts.
  - CLAUDE.md also references provider-data.ts and privy.ts for provider metadata and Privy configuration.
- Styling: Tailwind config in tailwind.config.ts; global styles in src/app/globals.css; theme provider in src/components/theme-provider.tsx.

Important nuances
- Merge conflict markers are present in src/app/layout.tsx that must be resolved before reliable builds. Suggested check: git --no-pager diff src/app/layout.tsx or open the file to clean up <<<<<<< / ======= / >>>>>>> sections.
- Image optimization allows remote images from placehold.co (next.config.ts images.remotePatterns).
- apphosting.yaml config indicates Firebase Hosting; the run command builds then starts the Next.js server.

## Developing the AI flows

- Start the Next dev server: pnpm dev
- In a separate terminal, start Genkit: pnpm genkit:dev
- Edit flows under src/ai/flows/ and the Genkit bootstrap in src/ai/dev.ts. Use pnpm genkit:watch for live reload.

## Build and deploy

- Local production build: pnpm build, then pnpm start
- Firebase Hosting: apphosting.yaml executes pnpm run build && pnpm run start on deploy. Ensure required env vars are configured in your hosting environment.

## Cross-references

- README.md contains feature overview, scripts, and environment setup highlights.
- CLAUDE.md includes additional architectural notes: Privy-based authentication (env: NEXT_PUBLIC_PRIVY_APP_ID), Genkit defaults (googleai/gemini-2.0-flash), Firebase usage, and where key data/config files are expected.
