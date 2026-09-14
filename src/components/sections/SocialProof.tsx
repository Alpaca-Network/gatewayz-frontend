import { Users, Zap } from "lucide-react";

interface SocialProofProps {
  compact?: boolean;
  className?: string;
  showText?: boolean;
}

export default function SocialProof({ compact = false, className = "", showText = false }: SocialProofProps) {
  const Wrapper: any = compact ? "div" : "section";

  // Every figure here must be one we can point at a source for. The three
  // this replaced -- "10,000+ Developers in Beta", "50M+ API Calls Processed"
  // and "99.9% Uptime SLA / Enterprise-grade reliability" -- were unsourced,
  // and we do not offer an SLA at all. They sat under a heading promising
  // real data. #203 removed exactly this class from the landing site.
  const stats = [
    {
      icon: Users,
      // Live catalog count (GET /v1/models), verified 2026-09-14. A hardcoded
      // number drifts -- this said "10,000+" and the truth was 68. Fetch it
      // if this section ever becomes load-bearing.
      value: "68",
      label: "Models Available",
      description: "OpenAI, Anthropic, Meta, Moonshot and xAI through one catalog"
    },
    {
      icon: Zap,
      value: "1",
      label: "API To Integrate",
      description: "One OpenAI-compatible endpoint across every provider we route to"
    }
  ];

  return (
    <Wrapper className={compact ? className : "py-12 md:py-16 w-full bg-gradient-to-b from-background to-muted/20"}>
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid sm:grid-cols-2 gap-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-8 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 mx-auto rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                <stat.icon className="w-7 h-7 text-primary" />
              </div>
              <div className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-sm font-semibold text-foreground mb-1">
                {stat.label}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Wrapper>
  );
}
