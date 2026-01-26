"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Privacy</h1>

      <div>
        <h3 className="text-xl font-semibold mb-4">How Gatewayz Handles Your Data</h3>
        <ul className="text-sm text-muted-foreground space-y-3 list-disc list-inside">
          <li>
            <strong>API Requests:</strong> Your prompts are forwarded to the LLM providers you
            select. Each provider has their own data retention and training policies.
          </li>
          <li>
            <strong>Request Logging:</strong> Gatewayz logs metadata (tokens, costs, latency) for
            billing and analytics, but does not store your prompt content long-term.
          </li>
          <li>
            <strong>Provider Policies:</strong> Some providers may use anonymized data for model
            improvement. Check each provider&apos;s terms for details.
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Prompt Caching</h3>
        <p className="text-sm text-muted-foreground">
          If you enable prompt caching, your requests are routed through a caching proxy. Manage
          this setting in{" "}
          <Link href="/settings/cache" className="text-primary underline">
            Prompt Cache
          </Link>
          .
        </p>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Local Storage</h3>
        <p className="text-sm text-muted-foreground">
          Any chat history or preferences stored locally on your device can be cleared through your
          browser settings. Gatewayz does not sync local chat history to our servers.
        </p>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Questions?</h3>
        <p className="text-sm text-muted-foreground">
          For privacy concerns or data deletion requests, contact us at{" "}
          <a href="mailto:support@gatewayz.ai" className="text-primary underline">
            support@gatewayz.ai
          </a>
          .
        </p>
      </div>
    </div>
  );
}
