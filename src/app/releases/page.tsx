"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReleaseWeek {
  date: string;
  features: string[];
  bugFixes: {
    category: string;
    items: string[];
  }[];
  infrastructure: string[];
  documentation: string[];
}

const releaseNotes: ReleaseWeek[] = [
  {
    date: "February 1, 2026",
    features: [
      "Mobile-Friendly Models Table: Responsive layout for the models table on mobile devices with compact MobileModelRow and MobileProviderSubRow components",
      "Expand/Collapse All: New button to expand or collapse all model rows at once, with all rows expanded by default for better visibility",
      "Parallel Model Fetching Optimization: Reduced cold catalog build time from ~120s to ~60s with increased thread pool and as_completed() processing",
      "Code Review Feedback Integration: Integrated PR feedback indicators and address feedback dialogs for improved code review workflow",
      "Kanban Task Management: Added Kanban view with task panels, sidebar view toggle, and improved mobile kanban support",
    ],
    bugFixes: [
      {
        category: "Gatewayz Chat",
        items: [
          "Fixed auth timeout issues and auth event listener handling",
          "Fixed models page only loading 18 models instead of full catalog",
          "Optimized checkout rendering for faster plan switching",
          "Fixed CI build issues for models page",
        ],
      },
      {
        category: "Gatewayz API",
        items: [
          "Added Stripe PRO activation reconciliation workflow to fix trial status mismatches",
          "Fixed Butter.dev provider configuration",
          "Fixed Helicone and Vercel AI Gateway pricing data",
          "Fixed provider credit monitoring issues",
          "Added diagnostic tooling for missing PRO Stripe linkage",
        ],
      },
    ],
    infrastructure: [],
    documentation: [],
  },
  {
    date: "January 25, 2026",
    features: [
      "Credit Usage Progress Bar: Visual indicator in the header showing remaining credits with color-coded status (green/yellow/red) and quick-access \"Add Credits\" button",
      "Models Table View: New OpenRouter-style table view for the Models page with improved data density, provider column, and formatted context lengths",
      "Interactive 404 Page: Conway's Game of Life themed 404 page with play/pause controls, speed adjustment, and auto-starting \"404\" pattern",
      "Smart Auto-Router: New prompt-level router (auto, auto:price, auto:quality, auto:fast) that intelligently selects models optimized for price/performance with fail-open design",
      "New Providers: Added Nosana GPU provider, Sybil provider, and Canopy Wave provider integrations",
      "Infron AI Rebrand: OneRouter provider rebranded to Infron AI with updated endpoints and improved model routing",
    ],
    bugFixes: [
      {
        category: "Gatewayz Chat",
        items: [
          "Fixed tiered credits authentication and localStorage issues with proper legacy fallback support",
          "Fixed PostHog initialization configuration errors",
          "Fixed wallet extension conflicts with pre-configured ethereum property",
        ],
      },
      {
        category: "Gatewayz API",
        items: [
          "OpenAI and Anthropic models now prioritize native provider connections for improved reliability",
          "Fixed Windows installer freeze issue when run via irm | iex for OpenCode",
          "Improved Claude Code model ID aliases for better compatibility",
          "Fixed Next.js security vulnerabilities (updated to 15.5.9)",
        ],
      },
    ],
    infrastructure: [],
    documentation: [],
  },
  {
    date: "January 18, 2026",
    features: [
      "Automatic Web Search: Chat now automatically searches the web for queries that benefit from real-time information (travel questions, current prices, news) without any manual toggle needed",
      "Desktop App Improvements: Beta testing Desktop apps for MacOS, Windows and Linux. Improved overall desktop stability",
      "New Provider - Morpheus API: Added Morpheus as a new model provider with optimized inference capabilities",
      "FAL Models Integration: Dynamic FAL model fetching from REST API for up-to-date model availability",
    ],
    bugFixes: [
      {
        category: "Gatewayz Chat",
        items: [
          "Credits now properly removed after trial expiration without payment",
        ],
      },
      {
        category: "Gatewayz API",
        items: [
          "Fixed pricing normalization to consistently display $/million tokens across all providers",
          "Fixed Statsig 401 errors when client key is missing or disabled",
          "Fixed CORS for Tauri desktop application requests",
        ],
      },
    ],
    infrastructure: [],
    documentation: [],
  },
  {
    date: "January 11, 2026",
    features: [
      "Discounted Credit Packages: New discounted credit package options are now available",
    ],
    bugFixes: [
      {
        category: "Gatewayz Chat",
        items: [
          "Fixed duplicate words appearing in voice transcription results",
          "Fixed issue where account tier wasn't updating immediately after upgrading to PRO/MAX",
        ],
      },
      {
        category: "Gatewayz API",
        items: [
          "Added support for AiHubMix and Simplismart with highly optimized text, image, and voice models",
          "Added developer role for enhanced API access control",
          "Better HTTP/2 error handling and automatic retry logic for more reliable API calls",
          "Enhanced provider failover when encountering payment-related errors (402)",
          "Fixed issue where paid API users were incorrectly marked as trial users",
        ],
      },
    ],
    infrastructure: [],
    documentation: [],
  },
  {
    date: "January 4, 2026",
    features: [
      "OpenAI & Anthropic Direct Providers: Added direct API access to OpenAI (GPT models) and Anthropic (Claude models) with connection pool clients, pre-warming support, and manual pricing data",
      "Surprise Me Feature: Added \"Surprise me\" button that generates and sends random interesting prompts from a curated list of fun questions",
      "Image Model Auto-Switch: Automatically switches to image generation model when \"Create Image\" chip is clicked in chat",
      "OpenCode & Claude Code Setup: Added multi-platform setup scripts and READMEs for OpenCode and Claude Code development environments",
    ],
    bugFixes: [
      {
        category: "Backend Fixes",
        items: [
          "Fixed streaming middleware \"No response returned\" issue with pure ASGI middleware conversion",
          "Added AIMO circuit breaker to handle API fetch errors gracefully",
          "Fixed Braintrust NoneType content error with deep sanitization",
          "Fixed Vertex AI streaming issues after submodule bump",
          "Fixed health-service column name mismatches (current_status → last_status, last_check_at → last_called_at)",
        ],
      },
      {
        category: "Frontend Fixes",
        items: [
          "Fixed max plan display error",
          "Added provider configs for OpenAI and Anthropic in model detail page",
          "Added provider names and logos for new AI providers",
          "Extracted modelIdFormat functions to testable utility module",
          "Fixed duplicate model definition in use-auto-model-switch.ts",
        ],
      },
      {
        category: "CI/CD Fixes",
        items: [
          "Fixed PR comment step in auto-merge workflow to be non-fatal",
          "Fixed PR lookup for forked PRs with correct head_repository.owner.login",
          "Added null check for headBranch to prevent posting to unrelated PRs",
          "Fixed workflow names in workflow-notification.yml",
          "Improved unknown submodule handling in subrepo-ci-notification workflow",
        ],
      },
    ],
    infrastructure: [
      "Multiple submodule updates to keep frontend and backend in sync",
      "Added comprehensive error reporting documentation for backend monitoring",
      "Added CI notification workflows for enhanced visibility and automated alerting",
      "Gateway pricing cross-reference from OpenRouter to prevent credit drain",
    ],
    documentation: [
      "Added Backend Error Review documentation for January 2-4, 2026",
      "Added ERROR_REPORT_2026-01-04 with streaming middleware analysis and fix tracking",
    ],
  },
  {
    date: "December 28, 2025",
    features: [
      "Web Search Integration: Added real-time web search capability to chat with Tavily API integration, search results UI component, and toggle control",
      "ChatGPT History Import: Import your ChatGPT conversations with drag-and-drop file upload, supporting both .zip and .json export formats with automatic memory extraction",
      "AI Memory System: Added cross-session AI memory that learns user preferences from conversations, with a dedicated settings page to view and manage memories",
      "Camera & Audio Recording: Camera button now opens device camera directly on mobile; audio button triggers live microphone recording with visual feedback",
      "Attachment UI Redesign: Updated chat input with [+] button, larger input area, and prompt chips for improved UX",
      "Image/Video Model Category: Added dedicated Image/Video section in model dropdown for easy multimodal model discovery",
      "Auto-Switch to Multimodal: Automatically switches to a multimodal model when users upload images, videos, audio, or documents",
      "Free Models List: Display all free models for users with updated backend and frontend support",
      "Trial Credit System Overhaul: Restructured trial credits to $1/day with $5 total cap (3-day trial period)",
    ],
    bugFixes: [
      {
        category: "Backend Fixes",
        items: [
          "Fixed share chat API endpoints returning 404 errors",
          "Added HTTP/2 retry logic and Featherless message sanitization",
          "Restored 402 failover code and improved c10x model routing to Featherless",
          "Fixed handling of missing rate_limit tables with improved error handling",
          "Fixed gateway pricing issues in backend",
          "Fixed Google Vertex model loading",
          "Fixed DeepSeek model mapping",
          "Fixed Privy email handling",
          "Fixed Fireworks model ID fallback",
          "Resolved composite key deduplication issues",
          "Added 402 to failover codes for better provider switching",
        ],
      },
      {
        category: "Frontend Fixes",
        items: [
          "Eliminated N+1 API calls when fetching models for better performance",
          "Fixed Privy passwordless network errors with graceful handling",
          "Fixed PostHog provider loading issues",
          "Fixed message format conversion",
          "Updated chat dropdown to show \"Load all 10,000+ models\"",
          "Fixed Invalid hook call error in PrivyProviderWrapper",
          "Fixed crypto.randomUUID compatibility issues",
          "Fixed Google gateway ID mismatch",
        ],
      },
      {
        category: "CI/CD Fixes",
        items: [
          "Added permissions and handling for null head_commit in workflows",
          "Fixed SUBREPO_DISPATCH_TOKEN usage for submodule checkout",
          "Added GitHub Actions workflow to auto-sync PR branches with main",
          "Verified token access and refactored PR search in auto-merge",
          "Sped up test-subrepos workflow",
        ],
      },
    ],
    infrastructure: [
      "Multiple submodule updates to keep frontend and backend in sync",
      "Added server-side tools documentation (TOOLS.md, TOOLS_IMPLEMENTATION.md)",
      "LinkedIn Insight Tag integration",
      "Improved API alignment with OpenAI docs for /messages and /responses endpoints",
      "Added Statsig integration for frontend",
    ],
    documentation: [
      "Added Visual Regression Testing guide with baseline steps",
      "Added pending migrations documentation for missing rate limit tables",
    ],
  },
  {
    date: "December 21, 2025",
    features: [
      "Share Chat with Unique URLs: Added ability to share chat conversations via unique URLs for easy collaboration and sharing",
      "Floating New Chat Button (Mobile): Added floating New Chat button for mobile users, hidden on /chat page for cleaner UX",
      "Checkout & Confirmation Pages: Added checkout and confirmation pages for improved conversion tracking",
      "Cerebras Model Support: Added complete Cerebras model support including Qwen-3-32b",
      "Provider Pricing Audit System: Implemented dynamic provider pricing with 4-layer fallback across 4 providers, including standardized pricing registry",
      "Privy User Reconciliation: Added scheduled user reconciliation tooling between Privy and Supabase with bulk API key regeneration support",
      "Credit Package Updates: Updated credit page to three monthly tiers, removed Starter tier",
    ],
    bugFixes: [
      {
        category: "Mobile & Responsiveness",
        items: [
          "Fixed mobile chat responsiveness improvements",
          "Fixed table scrolling improvements in frontend",
          "Improved floating button visibility and z-index handling",
        ],
      },
      {
        category: "Model & Provider Fixes",
        items: [
          "Fixed Cerebras Qwen-3-32b chat functionality",
          "Fixed Gemini model configuration (2.1-pro → 2.5-pro)",
          "Fixed Google Vertex AI model initialization at startup",
          "Fixed OneRouter models display with authenticated /v1/models endpoint",
          "Removed Kimi-K2-Thinking from NEAR AI model lists",
          "Fixed context_length default detection for 4096 token models",
          "Preserved multimodal info and fixed context_length defaults",
        ],
      },
      {
        category: "Security Fixes",
        items: [
          "Fixed command injection vulnerability in validation scripts",
          "Removed wildcard CORS configuration from OTEL collector",
          "Improved wildcard detection and fixed false positives in validation",
        ],
      },
      {
        category: "API & Backend Fixes",
        items: [
          "Fixed API key generation to remove special characters for compatibility",
          "Improved forbidden error messages in chat",
          "Set default gateway to 'all' for /models endpoint",
          "Fixed API key verification improvements",
          "Fixed SQL query to return both users in verification",
        ],
      },
      {
        category: "Frontend Fixes",
        items: [
          "Fixed referred user chat send issue",
          "Eliminated N+1 API calls when fetching models",
          "Improved Sentry error visibility with balanced rate limits",
          "Added early error suppressor for Ethereum property conflicts",
          "Fixed JSX structure issues",
        ],
      },
      {
        category: "CI/CD Fixes",
        items: [
          "Increased Node.js memory limit in Vercel build steps",
          "Added write permissions for submodule update job",
          "Fixed Jest mock hoisting for FloatingNewChatButton tests",
        ],
      },
    ],
    infrastructure: [
      "Release email notification system with Resend API integration",
      "Provider pricing audit implementation with comprehensive documentation",
      "Multiple submodule updates to keep frontend and backend in sync",
      "Improved pricing enrichment validation and logging",
    ],
    documentation: [
      "Added visibility debugging guide for FloatingNewChatButton",
      "Added comprehensive pricing audit documentation",
      "Fixed documentation paths and removed time-based estimates",
    ],
  },
  {
    date: "December 14, 2025",
    features: [
      "Incognito Mode: Added incognito mode with NEAR models (GLM-4.6 by default)",
      "Visual Regression Testing: Added Playwright-based visual regression testing",
      "Model Dropdown Virtualization: Optimized model dropdown with virtualization for better performance",
      "Rate Limit Retry Button: Added retry button UI when users encounter rate limit (429) errors",
      "Test Coverage Integration: Added Codecov integration for frontend and backend test coverage",
    ],
    bugFixes: [
      {
        category: "Streaming Fixes",
        items: [
          "Fixed SSE streaming buffering issues",
          "Fixed StopIteration error in streaming (PEP 479 compliance)",
          "Reduced streaming timeout from 10 minutes to 1 minute max",
        ],
      },
      {
        category: "Model & Routing Fixes",
        items: [
          "Fixed NEAR model routing and improved OpenRouter error logging",
          "Fixed auto-router bad request issues",
          "Fixed trial validation in backend",
        ],
      },
      {
        category: "Frontend Fixes",
        items: [
          "Fixed pricing/contact links",
          "Fixed speech recognition error handling and cleanup",
        ],
      },
    ],
    infrastructure: [],
    documentation: [],
  },
  {
    date: "December 7, 2025",
    features: [
      "Auto-Merge Workflow: Added GitHub Actions workflow to automatically merge subrepo PRs when the corresponding monorepo PR is merged",
      "New Chat Button Styling: Updated New Chat button styling in the sidebar for improved UX",
      "PR Preview Deployments: Added GitHub Actions workflow for automated PR preview deployments with Vercel and Railway integration",
      "Document Upload: Added document upload feature to chat interface",
      "Voice Transcription: Added voice transcription feature to frontend",
    ],
    bugFixes: [
      {
        category: "Security Fixes",
        items: [
          "Addressed security vulnerabilities in auto-merge workflow",
          "Fixed CVE-2025-55182 in frontend dependencies",
          "Fixed chat failure for unauthenticated users with invalid API key header",
        ],
      },
      {
        category: "Image Handling",
        items: [
          "Fixed image compression improvements in frontend",
          "Fixed image load failure handling and multimodal chat content",
          "Fixed image attachment errors",
        ],
      },
      {
        category: "Streaming Improvements",
        items: [
          "Optimized streaming startup time",
          "Fixed anonymous user streaming errors",
          "Added adaptive timeouts for mobile network support",
          "Fixed chat streaming optimizations",
        ],
      },
      {
        category: "Provider & Model Fixes",
        items: [
          "Fixed Google, Nebius, and Alpaca model listings in backend",
          "Fixed Alibaba models loading",
          "Fixed gateway model counts showing zero",
          "Fixed INVALID_API_KEY error handling",
        ],
      },
      {
        category: "CI/CD Fixes",
        items: [
          "Improved change detection for PR merge commits in deploy workflow",
          "Fixed npm ci failures with package-lock.json updates",
          "Added checks to detect dirty git submodules in workflows",
          "Fixed Node.js heap memory limits for frontend preview builds",
          "Added pnpm setup for frontend preview deployment",
        ],
      },
      {
        category: "Frontend Fixes",
        items: [
          "Fixed bullet alignment in UI components",
          "Fixed Redis graceful degradation",
          "Fixed PostHog SDK v6.x compatibility",
        ],
      },
    ],
    infrastructure: [
      "Multiple submodule updates to keep frontend and backend in sync",
      "Improved submodule consistency and conflict resolution",
      "Enhanced deployment workflow reliability with symmetric empty checks and push retry logic",
    ],
    documentation: [],
  },
  {
    date: "December 5, 2025",
    features: [
      "Streaming Standardization: Implemented unified streaming response format across the backend with stream_normalizer to standardize all provider responses",
      "CI/CD Pipeline: Added GitHub Actions workflow and scripts to test subrepos",
      "Superpowers Sync: Added script to sync .claude folder from superpowers repository",
    ],
    bugFixes: [
      {
        category: "Streaming Fixes",
        items: [
          "Fixed 429 rate limit errors in /chat streaming endpoint",
          "Fixed streaming errors for non-authenticated chat sessions",
          "Fixed streaming and reasoning format issues",
          "Fixed frontend streaming debugging issues",
        ],
      },
      {
        category: "UI/UX Fixes",
        items: [
          "Fixed double scrollbar issues in settings page",
          "Fixed double scroll on referrals page",
          "Fixed copy button functionality",
          "Fixed provider naming inconsistencies",
        ],
      },
      {
        category: "Backend Fixes",
        items: [
          "Fixed Alibaba Cloud API key error with region failover support",
          "Fixed temporary API key warning in auth flow",
          "Handled 429 Too Many Requests errors gracefully",
        ],
      },
      {
        category: "CI Fixes",
        items: [
          "Excluded documentation files from merge conflict checks",
          "Used non-recursive submodule init to avoid nested submodule issues",
        ],
      },
    ],
    infrastructure: [
      "Initial setup with frontend and backend as git submodules",
      "Multiple submodule updates to keep frontend and backend in sync",
      "Reasoning persistence improvements in frontend",
    ],
    documentation: [
      "Added streaming standardization plan documentation",
      "Addressed review feedback in streaming-standardization-plan",
    ],
  },
];

export default function ReleasesPage() {
  return (
    <div className="min-h-screen bg-background" style={{ marginTop: '-65px' }}>
      <div data-page-content className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-8 pt-32 has-onboarding-banner:pt-40" style={{ transition: 'padding-top 0.3s ease' }}>
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-2xl lg:text-4xl font-bold tracking-tight">Release Notes</h1>
          <p className="mt-2 text-sm lg:text-lg text-muted-foreground">
            Weekly updates and changes to GatewayZ
          </p>
        </header>

        {/* Release Notes */}
        <div className="space-y-8">
          {releaseNotes.map((release, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <CardTitle className="text-xl lg:text-2xl">
                  {release.date}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Features */}
                {release.features.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-green-600 dark:text-green-400">
                      Features
                    </h3>
                    <ul className="space-y-2">
                      {release.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400 text-sm">+</span>
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bug Fixes */}
                {release.bugFixes.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400">
                      Bug Fixes
                    </h3>
                    <div className="space-y-4">
                      {release.bugFixes.map((category, i) => (
                        <div key={i}>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            {category.category}
                          </h4>
                          <ul className="space-y-1">
                            {category.items.map((item, j) => (
                              <li key={j} className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 text-sm">-</span>
                                <span className="text-sm">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Infrastructure */}
                {release.infrastructure.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-purple-600 dark:text-purple-400">
                      Infrastructure
                    </h3>
                    <ul className="space-y-2">
                      {release.infrastructure.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-purple-600 dark:text-purple-400 text-sm">*</span>
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Documentation */}
                {release.documentation.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-orange-600 dark:text-orange-400">
                      Documentation
                    </h3>
                    <ul className="space-y-2">
                      {release.documentation.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-orange-600 dark:text-orange-400 text-sm">#</span>
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
