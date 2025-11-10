import { Zap, DollarSign, TrendingUp } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      icon: Zap,
      title: "Faster",
      description: "Sub-100ms routing with global edge network and intelligent caching for lightning-fast AI inference latency"
    },
    {
      icon: DollarSign,
      title: "Cheaper",
      description: "Smart model selection and quota pooling reduces inference costs by 60% on average"
    },
    {
      icon: TrendingUp,
      title: "Revenue-Shared",
      description: "Earn when others use your builds through our decentralized infrastructure model"
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
            Three key benefits that make Gatewayz the universal gateway for AI inference
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
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
