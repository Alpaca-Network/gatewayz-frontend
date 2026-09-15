import { Scale, Braces, Ruler } from "lucide-react";

// The three pillars. Every sentence here describes behaviour the API has
// today -- no latency figures, cost-reduction percentages or SLAs. A number we
// cannot source is removed, never restated.
export default function HowItWorks() {
  const steps = [
    {
      icon: Scale,
      title: "Model agnostic",
      description: "We have no model of our own to steer you toward. Resolution, never substitution: an unknown model id returns a 400, never a quiet swap to the nearest model."
    },
    {
      icon: Braces,
      title: "Machine-legible",
      description: "Errors software can act on: unknown model → 400 model_not_found, spent key cap → 402 request_cap_exhausted, no credits → 402 insufficient_credits. A stream that fails upstream ends with an explicit error event."
    },
    {
      icon: Ruler,
      title: "Measured, not claimed",
      description: "We publish only what we measure. Prices are per model in the catalog — cost-plus over what the provider charges — not a blanket discount."
    }
  ];

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How Gatewayz Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Three commitments that make Gatewayz an inference layer you can put under an agent
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.title}
              className="relative bg-card rounded-2xl p-8 border border-border hover:border-primary/30 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{step.title}</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
