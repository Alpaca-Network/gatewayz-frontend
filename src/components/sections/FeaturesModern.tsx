import { Card } from "@/components/ui/card";
import { Zap, Shield, Globe, Code } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Smart Routing",
    description: "Automatically selects the fastest and most cost-efficient model for your request",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-grade encryption with SOC 2 compliance and dedicated infrastructure",
  },
  {
    icon: Globe,
    title: "Global Scale",
    description: "Worldwide infrastructure with 99.9% uptime SLA and sub-100ms latency",
  },
  {
    icon: Code,
    title: "Developer First",
    description: "Comprehensive SDKs, detailed docs, and responsive support for your team",
  },
];

export function FeaturesModern() {
  return (
    <section id="features" className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">Decentralized Infrastructure for AI</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to build and scale AI-powered applications with superior developer experience
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
