import { Users, Zap, TrendingUp } from "lucide-react";

interface SocialProofProps {
  compact?: boolean;
  className?: string;
  showText?: boolean;
}

export default function SocialProof({ compact = false, className = "", showText = false }: SocialProofProps) {
  const Wrapper: any = compact ? "div" : "section";

  const stats = [
    {
      icon: Users,
      value: "10,000+",
      label: "Developers in Beta",
      description: "Join thousands building with Gatewayz"
    },
    {
      icon: Zap,
      value: "50M+",
      label: "API Calls Processed",
      description: "Trusted for production workloads"
    },
    {
      icon: TrendingUp,
      value: "99.9%",
      label: "Uptime SLA",
      description: "Enterprise-grade reliability"
    }
  ];

  return (
    <Wrapper className={compact ? className : "py-12 md:py-16 w-full bg-gradient-to-b from-background to-muted/20"}>
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid sm:grid-cols-3 gap-8">
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
