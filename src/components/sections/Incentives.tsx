import { CheckCircle2 } from "lucide-react";

export default function Incentives() {
  const perks = [
    "Priority onboarding",
    "Bonus usage credits",
    "Direct line to the product team",
  ];

  return (
    <section className="py-16 md:py-20">
      <div className="container">
        <h2 className="text-3xl font-semibold text-center">Early access perks</h2>
        <ul className="mx-auto mt-8 max-w-2xl space-y-4">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4">
              <CheckCircle2 className="mt-0.5 text-primary" />
              <span className="text-muted-foreground">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
