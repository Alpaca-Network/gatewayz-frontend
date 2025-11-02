import { GitMerge, Code, Shield } from "lucide-react";

const items = [
  {
    title: "Unified Access",
    desc: "Proprietary + OSS in one place.",
    Icon: GitMerge,
  },
  {
    title: "Dev-Friendly SDK", 
    desc: "Drop-in integration for agents.",
    Icon: Code,
  },
  {
    title: "Future-Proof",
    desc: "Never rewrite code for new models.",
    Icon: Shield,
  },
];

export default function BenefitsAgent() {
  return (
    <section id="benefits" className="py-16 md:py-20 scroll-mt-16">
      <div className="container">
        <h2 className="text-3xl font-semibold text-center">Agent-ready benefits</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ title, desc, Icon }) => (
            <article key={title} className="rounded-xl border border-border bg-card/40 p-6 hover-scale">
              <Icon className="text-primary" />
              <h3 className="mt-3 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}