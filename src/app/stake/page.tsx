import Link from "next/link";
import type { Metadata } from "next";
import { TOKENS, discountBudget, bySymbol, offeredRate } from "@/lib/staking/tokens";
import QuoteWidget from "@/components/staking/QuoteWidget";
import { AdaDelegationJourney } from "@/components/stake/AdaDelegationJourney";

// Unlisted: reachable by direct link only. noindex comes from ./layout.tsx.
export const metadata: Metadata = {
  title: "Delegate your ADA for cheaper AI | Gatewayz",
  description:
    "Delegate ADA to the Gatewayz pool and take the yield as cheaper inference on the Gatewayz gateway. Your ADA never leaves your wallet.",
};

export default function StakePage() {
  const ada = bySymbol("ADA")!;
  const rest = TOKENS.filter((t) => t.symbol !== "ADA");
  const adaBudget = discountBudget(10000, ada, 12);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05]">
        Your idle ADA, as <span className="text-primary">cheaper AI</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground text-lg">
        Delegate your ADA to the Gatewayz pool. It keeps earning, never leaves your
        wallet, and the yield comes back as cheaper inference on the Gatewayz gateway
        instead of a payout you have to deal with.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="You keep" value={`up to ${(adaBudget.userKeeps * 100).toFixed(0)}%`} sub="of what your ADA earns" />
        <Stat label="Indicative rate" value={`${(offeredRate(ada, 12) * 100).toFixed(2)}%`} sub="after our fee, 12-month tier" />
        <Stat
          label="Per $10,000"
          value={`$${adaBudget.budgetUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr`}
          sub="of inference discount"
        />
      </div>

      <div className="mt-5 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <b>Early access.</b> Rates are set by Gatewayz, not guaranteed, and can change
        or stop. <b>Not available to US persons or Canadian persons.</b>{" "}
        <Link href="/stake/terms" className="text-primary underline">
          Terms &amp; eligibility
        </Link>
      </div>

      <Step n={1} title="See what your ADA earns today">
        <p className="mb-4 text-sm text-muted-foreground max-w-prose">
          Paste a Cardano stake address. We read your pool&apos;s real rewards from
          chain and show what that yield would fund on Gatewayz. Public data only:
          nothing is signed or transferred.
        </p>
        <QuoteWidget />
      </Step>

      <Step n={2} title="Delegate to the Gatewayz pool">
        <p className="mb-4 text-sm text-muted-foreground max-w-prose">
          Connect a Cardano wallet (Eternl, Lace, Nami or any CIP-30 wallet), link
          its stake address to your account with one signature, then delegate.
          Delegation moves no ADA: it stays in your wallet, spendable, and you can
          re-delegate at any epoch boundary.
        </p>
        <AdaDelegationJourney />
      </Step>

      <Step n={3} title="Spend it as cheaper inference">
        <p className="text-sm max-w-prose">
          From the next epoch your delegation starts funding a discount on every
          model on the gateway. <b>Not compute, the right to buy compute cheaply:</b>{" "}
          you still choose what to run and when, it simply costs less.
        </p>
        <Link
          href="/chat"
          className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Open the chat
        </Link>
      </Step>

      <Step n={4} title="Why ADA first">
        <p className="text-sm max-w-prose">
          It is the only asset we never touch. Cardano delegation is non-custodial by
          protocol design: there is no deposit, no vault and no lockup, so there is
          nothing of yours for us to lose. It is also our lowest fee, because
          non-custodial costs us less to run.{" "}
          <Link href="/stake/ada" className="text-primary underline">
            ADA details and risks
          </Link>
        </p>
      </Step>

      <h2 className="mt-14 font-mono text-xs uppercase tracking-[0.16em] text-primary">
        Other assets (preview, we would hold these)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-prose">
        These have to be transferred to us, so they are a different deal. Each page
        says how. Not open yet; yields marked <i>indicative</i> are not yet sourced.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rest.map((t) => (
          <Link
            key={t.symbol}
            href={`/stake/${t.symbol.toLowerCase()}`}
            className="rounded-lg border p-4 hover:border-foreground/30"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold">{t.symbol}</span>
              <span className="text-xs text-muted-foreground">{t.name}</span>
            </div>
            <div className="mt-1 font-mono text-xl tabular-nums">
              {(offeredRate(t, 12) * 100).toFixed(2)}%
            </div>
            {!t.yieldVerified && (
              <span className="mt-2 inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                indicative
              </span>
            )}
          </Link>
        ))}
      </div>

      <footer className="mt-14 border-t pt-5 text-xs text-muted-foreground">
        Early access. Terms are a draft, not yet reviewed by counsel.{" "}
        <Link href="/stake/terms" className="text-primary underline">Terms</Link>
      </footer>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/[0.04] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-500">{label}</div>
      <div className="mt-1 font-mono text-2xl tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="flex items-baseline gap-3 text-xl font-bold">
        <span className="font-mono text-sm text-primary">0{n}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
