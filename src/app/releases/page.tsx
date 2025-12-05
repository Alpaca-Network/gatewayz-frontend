"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReleaseWeek {
  weekOf: string;
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
    weekOf: "December 5th, 2025",
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
                  {release.weekOf}
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
                          <ul className="space-y-1 ml-4">
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
