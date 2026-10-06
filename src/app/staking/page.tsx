import Link from "next/link";
import type { Metadata } from "next";
import { TOKENS, TIERS, discountBudget, bySymbol, offeredRate, feeFor } from "@/lib/staking/tokens";
import QuoteWidget from "@/components/staking/QuoteWidget";

export const metadata: Metadata = {
  title: "Stake your tokens for cheaper AI | Gatewayz",
  description:
    "Keep earning on your crypto, and take the yield as cheaper inference on the Gatewayz gateway. ADA stays in your own wallet.",
};

export default function StakingPage() {
  const ada = bySymbol("ADA")!;
  const rest = TOKENS.filter((t) => t.symbol !== "ADA");
  const adaBudget = discountBudget(10000, ada, 12);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05]">
        Your idle crypto, as <span className="text-primary">cheaper AI</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground text-lg">
        Stake with us and your assets keep earning — but the yield comes back as the
        right to buy inference on the Gatewayz gateway at a much lower price, instead
        of as a payout you have to deal with.
      </p>

      <div className="mt-5 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <b>Preview — not an offer.</b> Nothing is for sale, no account can be opened,
        and no token exists. Yields marked <i>indicative</i> are illustrative and not
        yet sourced. <b>Not available to US persons or Canadian persons.</b>{" "}
        <Link href="/staking/terms" className="text-primary underline">
          Terms &amp; eligibility
        </Link>
      </div>

      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.16em] text-primary">
        Start here
      </h2>
      <Link href="/staking/ada"
            className="mt-3 block rounded-lg border border-emerald-500/50 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-5 hover:border-emerald-500/80">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-500">
          Recommended
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-xl font-extrabold">ADA</span>
          <span className="text-sm text-muted-foreground">Cardano</span>
        </div>
        <div className="mt-1 font-mono text-3xl text-emerald-500 tabular-nums">
          {(offeredRate(ada, 12) * 100).toFixed(2)}%
        </div>
        <div className="text-sm text-muted-foreground">
          ${adaBudget.budgetUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
          of discount per $10,000
        </div>
        <p className="mt-3 max-w-prose text-sm">
          <b>You keep 95% of what it earns</b> — the lowest fee we charge, because non-custodial costs us less to run: no custody, no insurance, no idle buffer. And it is the only asset we never touch. Cardano delegation is
          non-custodial by protocol design: your ADA stays in your wallet, is never
          locked, and leaves whenever you choose. There is nothing to lose to a hack
          here, because we never hold it.
        </p>
      </Link>

      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.16em] text-primary">
        Other assets — we hold these
      </h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-prose">
        Every asset below has to be transferred to us, because no other chain offers
        what Cardano does. Workable, but a different deal — and each page says so.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((t) => {
          const d = discountBudget(10000, t, 12);
          return (
            <Link key={t.symbol} href={`/staking/${t.symbol.toLowerCase()}`}
                  className="rounded-lg border p-4 hover:border-foreground/30">
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold">{t.symbol}</span>
                <span className="text-xs text-muted-foreground">{t.name}</span>
              </div>
              <div className="mt-1 font-mono text-2xl tabular-nums">
                {(offeredRate(t, 12) * 100).toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                ${d.budgetUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
                per $10,000
              </div>
              <div className="mt-2 inline-block rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-500">
                we hold it
              </div>
              {!t.yieldVerified && (
                <span className="ml-1.5 inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  indicative
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <h2 className="mt-12 font-mono text-xs uppercase tracking-[0.16em] text-primary">
        Try it with your own delegation
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground max-w-prose">
        Paste a Cardano stake address. We read the pool&apos;s real rewards from chain
        and show what your share would fund. Public data — entering an address proves
        nothing about ownership, and nothing is transferred.
      </p>
      <QuoteWidget />

      <h2 className="mt-12 font-mono text-xs uppercase tracking-[0.16em] text-primary">
        What you actually get
      </h2>
      <p className="mt-1 text-sm max-w-prose">
        <b>Not compute — the right to buy compute cheaply.</b> Your yield funds a
        discount budget. You still choose what to buy and when; it simply costs you
        far less. We never hand you a balance, and we never front the compute.
      </p>

      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.16em] text-primary">
        The longer you stay, the better the rate
      </h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="border-b py-2">Commitment</th>
            <th className="border-b py-2 text-right">Our fee — ADA / other</th>
            <th className="border-b py-2">Why it can be lower</th>
          </tr>
        </thead>
        <tbody>
          {TIERS.map((t) => (
            <tr key={t.label}>
              <td className="border-b py-2">{t.label}</td>
              <td className="border-b py-2 text-right font-mono tabular-nums">
                {(t.ada * 100).toFixed(0)}% / {(t.other * 100).toFixed(0)}%
              </td>
              <td className="border-b py-2 text-muted-foreground">
                {t.other < 0.20
                  ? "a smaller idle buffer is needed, so more of the capital earns"
                  : "baseline"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-sm text-muted-foreground max-w-prose">
        You can leave whenever you like — you simply stop accruing the tier. There is
        no lockup and no exit penalty.
      </p>

      <footer className="mt-14 border-t pt-5 text-xs text-muted-foreground">
        Preview. Draft, not reviewed by counsel.{" "}
        <Link href="/staking/terms" className="text-primary underline">Terms</Link>
      </footer>
    </main>
  );
}
