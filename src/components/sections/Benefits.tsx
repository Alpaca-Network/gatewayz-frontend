import { Zap, Shield, DollarSign } from "lucide-react";

const items = [
  {
    title: "Unified API",
    desc: "Access 10,000+ models through one simple interface",
    Icon: Zap,
  },
  {
    title: "Smart Routing",
    desc: "Auto-select the best model for cost and performance",
    Icon: DollarSign,
  },
  {
    title: "Secure & Reliable",
    desc: "Enterprise-grade security with 99.9% uptime",
    Icon: Shield,
  },
];

export default function Benefits() {
  return (
    <section id="benefits" className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 scroll-mt-16 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Built for Developer Experience</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Everything you need to integrate AI into your applications with superior developer experience</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {items.map(({ title, desc, Icon }) => (
            <div key={title} className="group text-center p-8 rounded-2xl bg-card border border-border hover:border-primary/30 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 mx-auto rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-all duration-300 group-hover:scale-110">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
