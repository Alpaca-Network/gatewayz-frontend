export default function ProblemSolutionSaas() {
  return (
    <section id="solution" className="py-16 md:py-20 scroll-mt-16 animate-fade-in">
      <div className="container">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-xl border border-border bg-card/40 p-6">
            <h2 className="text-2xl md:text-3xl font-semibold">SaaS teams face messy vendor management</h2>
            <p className="mt-3 text-muted-foreground">
              Product teams lose time and money managing multiple AI providers with unpredictable billing and integration overhead.
            </p>
            <ul className="mt-4 list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Finance hates unpredictable API bills</li>
              <li>Engineers lose time switching SDKs</li>
              <li>OpenRouter adds fees without controls</li>
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card/40 p-6">
            <h2 className="text-2xl md:text-3xl font-semibold">Gatewayz = one integration, every model</h2>
            <p className="mt-3 text-muted-foreground">
              Unified billing, consistent APIs, and enterprise controls make AI integration predictable for SaaS teams.
            </p>
            <ul className="mt-4 list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Normalized billing across 500+ models</li>
              <li>Exportable logs for finance</li>
              <li>Enterprise-ready dashboard with spend caps</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}