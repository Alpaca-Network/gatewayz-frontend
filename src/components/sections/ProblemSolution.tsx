import { AlertCircle, CheckCircle } from "lucide-react";

export default function ProblemSolution() {
  return (
    <section id="solution" className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 scroll-mt-16 bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">The AI Inference Challenge</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Managing AI inference costs and latency shouldn't be this complicated</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Problem */}
          <div className="bg-card rounded-2xl p-8 border border-border shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mt-1">The Problem</h3>
            </div>
            <p className="text-muted-foreground text-base mb-5 leading-relaxed">
              Managing multiple AI providers means dealing with fragmented APIs, scattered billing, and unpredictable costs.
            </p>
            <ul className="space-y-3">
              {["Different APIs for each provider", "Multiple dashboards & invoices", "No cost optimization"].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-red-500/60 mt-1.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-card dark:from-primary/20 dark:via-primary/10 dark:to-card rounded-2xl p-8 border border-primary/30 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 dark:bg-primary/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mt-1">The Solution</h3>
            </div>
            <p className="text-foreground text-base mb-5 leading-relaxed">
              <strong className="text-primary font-semibold">Gatewayz</strong> unifies 10,000+ models into one API—smart routing, transparent pricing, single invoice.
            </p>
            <ul className="space-y-3">
              {["One API for all providers", "Single bill, simplified tracking", "Auto-optimized for cost & speed"].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
