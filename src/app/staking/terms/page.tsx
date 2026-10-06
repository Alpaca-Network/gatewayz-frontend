import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staking terms & eligibility | Gatewayz",
  description: "Terms and eligibility for the staking-to-inference preview.",
};

export default function StakingTerms() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/staking" className="text-sm text-primary">← back</Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Terms &amp; eligibility</h1>
      <p className="mt-1 font-mono text-xs text-muted-foreground">DRAFT · 2026-10-06</p>

      <div className="mt-5 rounded-md border border-amber-500/50 bg-amber-500/5 p-4 text-sm">
        <b className="text-amber-500">⚠️ DRAFT — NOT LEGAL ADVICE, NOT REVIEWED BY COUNSEL.</b>{" "}
        No lawyer has read this page. It is written to be reviewed, not relied on,
        and must not be published as binding terms until counsel has approved it.
      </div>

      <S n="1" t="What this is">
        <p>A <b>preview</b>. It reads public Cardano chain data, calculates what a
        delegation&apos;s staking rewards would be worth, and spends a notional
        credit on an inference request.</p>
        <p><b>It is not an offer, a product, or an invitation to invest.</b> No token
        exists. Nothing is for sale. No account is created. We are not operating a
        stake pool, so no staking margin is being earned — the inference shown is
        paid for by us.</p>
      </S>

      <S n="2" t="Who may not use it">
        <p>This preview is <b>not available to, and must not be used by</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>United States persons</b>, including US citizens and residents
          wherever located, and entities organised under US law;</li>
          <li><b>Canadian persons</b>, including Canadian citizens and residents
          wherever located, and entities organised under Canadian law;</li>
          <li>persons in any jurisdiction where use would be unlawful, and persons
          subject to applicable sanctions.</li>
        </ul>
        <p>By continuing you confirm you are none of the above. We may block access
        by region and may withdraw access at any time.</p>
      </S>

      <S n="3" t="Custody — and a distinction that matters">
        <div className="rounded-md border border-l-2 border-l-emerald-500 bg-muted/30 p-4 mb-3">
          <b>For ADA delegation, we never hold your assets.</b> Cardano delegation is
          non-custodial by design: your ADA never leaves your wallet, is never
          locked, and can be re-delegated at any epoch. We cannot move, freeze,
          spend or lose it, because we never have it.
        </div>
        <div className="rounded-md border border-l-2 border-l-amber-500 bg-muted/30 p-4">
          <b>Every other asset is different.</b> No asset other than ADA has that
          property. Staking any other token requires transferring it to us, and we
          stake it through a third-party provider. <b>While we hold it, it can be
          lost</b> — and the loss and custody terms in §5 apply to it. They do not
          meaningfully apply to ADA delegation, because there is nothing for us to
          lose.
        </div>
      </S>

      <S n="4" t="No guaranteed return">
        <p>Returns are <b>variable and may be zero</b>. A pool earns only when it
        produces blocks, and small pools frequently produce none. Measured on a real
        pool across five recent epochs, one delegation&apos;s share ranged from
        <b> 0 ADA to 94 ADA per epoch</b> — a genuine zero included.</p>
        <p>Figures shown are an <b>average over several recent epochs</b>,
        historical, and not a forecast. Any rate we quote is a rate we choose to
        offer, not a pass-through of what your asset earns, and it may change.
        <b> Nothing here is a promise of yield, income, return, or any particular
        amount of inference.</b></p>
      </S>

      <S n="5" t="Risk, and limitation of liability">
        <p>Use at your own risk. To the maximum extent permitted by law, we accept
        <b> no liability for any loss</b>, including loss of assets, rewards, data or
        profits, arising from or connected with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>security incidents, hacks, exploits, key compromise or theft,
          including of any assets held by us under any custodial arrangement;</li>
          <li>failure, downtime, mis-operation or de-registration of any stake pool,
          validator or liquidity pool;</li>
          <li>bugs or errors in our software or in third-party software we rely on;</li>
          <li>failures of any blockchain network, protocol changes, chain
          reorganisations, or third-party bridges, wallets, indexers, venues or
          infrastructure;</li>
          <li>changes in the value of any asset, and stablecoin depegs.</li>
        </ul>
        <p>Everything is provided <b>&ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;</b>, without warranty of any kind.</p>
      </S>

      <S n="6" t="Withdrawal and queuing">
        <p>For ADA there is nothing to withdraw from us: re-delegate in your own
        wallet at any time.</p>
        <p>For custodial assets we aim to return them within <b>24 hours</b>. The
        underlying networks take longer to unbond — up to <b>28 days</b> — and we
        cover the difference from a liquidity buffer. <b>If redemption requests
        exceed that buffer, they are queued and met in the order received as
        positions unbond.</b> We do not guarantee 24 hours in all conditions, and
        anyone who does on a 28-day asset is not being straight with you.</p>
      </S>

      <S n="7" t="Not advice, not a security">
        <p>Nothing here is financial, investment, tax or legal advice, a
        recommendation, or a solicitation. Nothing here is an offer of a security or
        a collective investment scheme in any jurisdiction. <b>We make no
        representation about the tax treatment of anything described here</b>; if
        you need advice, take it from someone qualified in your jurisdiction.</p>
      </S>

      <S n="8" t="What we can and cannot see">
        <p>A stake address you enter is public chain data and is used only to read
        your delegation. <b>Entering an address proves nothing about ownership</b> —
        anyone can enter anyone&apos;s. We never ask for, and must never be given, a
        seed phrase or private key. Prompts you submit are sent to our inference
        gateway and to its upstream model providers.</p>
      </S>

      <footer className="mt-12 border-t pt-5 text-xs text-muted-foreground">
        Draft for counsel review. Not binding. Not published as terms.{" "}
        <Link href="/staking" className="text-primary underline">Back to staking</Link>
      </footer>
    </main>
  );
}

function S({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold">
        <span className="font-mono text-primary text-sm mr-2">{n}</span>{t}
      </h2>
      <div className="mt-1.5 space-y-2.5 text-sm text-muted-foreground [&_b]:text-foreground">
        {children}
      </div>
    </section>
  );
}
