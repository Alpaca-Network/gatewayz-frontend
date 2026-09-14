import { Card } from "@/components/ui/card";
import { Zap, Shield, Globe, Code } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "One key, one endpoint",
    description: "OpenAI-compatible chat completions and native Anthropic Messages. Claude Code works with ANTHROPIC_BASE_URL=https://api.gatewayz.ai.",
  },
  {
    icon: Shield,
    title: "No stored content",
    description: "Plain API calls store no prompt or completion content.",
  },
  {
    icon: Globe,
    title: "Five providers, one catalog",
    description: "Models from OpenAI, Anthropic, xAI, Moonshot and Meta. The live list, with per-model prices, is in the catalog and at GET /v1/models.",
  },
  {
    icon: Code,
    title: "Developer First",
    description: "Docs, setup guides for Claude Code, Cline, Aider, OpenCode and Continue, and a catalog that lists each model's supported parameters.",
  },
];

export function FeaturesModern() {
  return (
    <section id="features" className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">One endpoint for every agent you run</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            What you get when you point an agent at Gatewayz
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="group p-10 bg-card border border-border hover:shadow-2xl transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 rounded-2xl">
              <div className="w-14 h-14 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-all duration-300 group-hover:scale-110">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-base">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
