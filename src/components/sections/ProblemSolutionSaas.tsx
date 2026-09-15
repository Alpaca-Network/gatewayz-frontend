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
              <li>Every provider shapes errors differently</li>
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card/40 p-6">
            <h2 className="text-2xl md:text-3xl font-semibold">Gatewayz = one integration, one model-agnostic endpoint</h2>
            <p className="mt-3 text-muted-foreground">
              One balance, consistent APIs, and per-key spend caps make AI integration predictable for SaaS teams.
            </p>
            <ul className="mt-4 list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Per-model, cost-plus prices in one catalog</li>
              <li>Exportable logs for finance</li>
              <li>Per-key spend caps</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}