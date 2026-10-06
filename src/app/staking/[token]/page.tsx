import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TOKENS, TIERS, bySymbol, discountBudget } from "@/lib/staking/tokens";

export function generateStaticParams() {
  return TOKENS.map((t) => ({ token: t.symbol.toLowerCase() }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params;
  const t = bySymbol(token);
  if (!t) return { title: "Not found | Gatewayz" };
  return {
    title: `Stake ${t.symbol} for cheaper inference | Gatewayz`,
    description: t.blurb,
  };
}

export default async function TokenPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const t = bySymbol(token);
  if (!t) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/staking" className="text-sm text-primary">← all assets</Link>
      <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">
        Stake {t.symbol} for <span className="text-primary">cheaper inference</span>
      </h1>
      <p className="mt-3 max-w-prose text-muted-foreground">{t.blurb}</p>

      <div className="mt-4 flex flex-wrap gap-2 font-mono text-[11px]">
        <span className="rounded border px-2 py-1">{t.chain}</span>
        <span className="rounded border px-2 py-1">
          we offer {(t.offered * 100).toFixed(2)}%
        </span>
        <span className={`rounded border px-2 py-1 ${t.yieldVerified
          ? "border-emerald-500/50 text-emerald-500"
          : "border-amber-500/50 text-amber-500"}`}>
          {t.yieldVerified ? "underlying yield measured by us" : "underlying yield indicative"}
        </span>
      </div>

      <div className="mt-5 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <b>Preview — not an offer.</b> Nothing is for sale and no account can be
        opened. <b>Not available to US persons or Canadian persons.</b>{" "}
        <Link href="/staking/terms" className="text-primary underline">Terms</Link>
      </div>

      {t.model === "non-custodial" ? (
        <Box tone="good" label="We never touch it">
          Cardano delegation is non-custodial by protocol design. Your ADA never
          leaves your wallet and is never locked. We cannot move, freeze, spend or
          lose it, because we never have it. No deposit, no vault, no contract
          holding your principal — <b>and so nothing for us to lose.</b>
        </Box>
      ) : (
        <Box tone="warn" label="We take custody">
          You transfer your {t.symbol} to us, and we stake it through {t.provider}.
          <b> While we hold it, it can be lost</b> — to a security incident here or
          at the provider. You are trusting two parties, not zero. You could also
          stake directly with a provider yourself; what we add is the bulk pricing on
          compute and the way the return reaches you.
        </Box>
      )}

      {t.model === "non-custodial" ? (
        <Box tone="good" label="Getting out">
          Instantly, at any epoch boundary, by re-delegating in your own wallet. No
          unbonding, no queue, no buffer, and no permission needed from us.
        </Box>
      ) : (
        <Box tone="plain" label="Getting out">
          We aim to return your {t.symbol} within <b>24 hours</b>. {t.chain}{" "}
          unbonding actually takes <b>{t.unbonding}</b>, so the difference is covered
          from a liquidity buffer we hold. <b>If redemptions exceed that buffer they
          are queued</b>, in the order the terms set out. Anyone promising instant
          exit on a {t.unbonding} asset without saying this is not being straight
          with you.
        </Box>
      )}

      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.16em] text-primary">
        What $10,000 of {t.symbol} earns you
      </h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="border-b py-2">Commitment</th>
            <th className="border-b py-2 text-right">Our fee</th>
            <th className="border-b py-2 text-right">Discount / yr</th>
            <th className="border-b py-2 text-right">per month</th>
          </tr>
        </thead>
        <tbody>
          {TIERS.map((tier) => {
            const d = discountBudget(10000, t, tier.months);
            return (
              <tr key={tier.label}>
                <td className="border-b py-2">{tier.label}</td>
                <td className="border-b py-2 text-right font-mono tabular-nums">
                  {(tier.fee * 100).toFixed(0)}%
                </td>
                <td className="border-b py-2 text-right font-mono tabular-nums">
                  ${d.budgetUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="border-b py-2 text-right font-mono tabular-nums">
                  ${d.perMonthUsd.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-sm text-muted-foreground max-w-prose">
        A discount budget, not a payout: it reduces what you pay for inference on the
        gateway.{" "}
        {t.yieldVerified
          ? "The underlying yield is measured by us: median of 12 mainnet pools, epochs 630–653."
          : <b>The underlying yield figure is indicative and has not been sourced.</b>}
      </p>

      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.16em] text-primary">Risks</h2>
      <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
        {t.risks.map((r) => <li key={r}>{r}</li>)}
      </ul>

      <footer className="mt-14 border-t pt-5 text-xs text-muted-foreground">
        Preview. Draft, not reviewed by counsel.{" "}
        <Link href="/staking/terms" className="text-primary underline">Terms</Link> ·{" "}
        <Link href="/staking" className="text-primary underline">All assets</Link>
      </footer>
    </main>
  );
}

function Box({ tone, label, children }: {
  tone: "good" | "warn" | "plain"; label: string; children: React.ReactNode;
}) {
  const border = tone === "good" ? "border-l-emerald-500"
    : tone === "warn" ? "border-l-amber-500" : "border-l-primary";
  return (
    <div className={`mt-4 rounded-md border border-l-2 ${border} bg-muted/30 p-4 text-sm`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className="max-w-prose">{children}</div>
    </div>
  );
}
