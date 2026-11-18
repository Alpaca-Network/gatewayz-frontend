import Link from "next/link";
import type { Metadata } from "next";

const YIELD_URL = "https://www.gatewayz.ai/yield";

export const metadata: Metadata = {
  title: "Yield vault status & eligibility | Gatewayz",
  description:
    "The Gatewayz yield vault is in development and not live. The earlier ADA delegation program is switched off. Vault terms will be published before launch.",
};

export default function StakingTerms() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/stake" className="text-sm text-primary">← back</Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Status &amp; eligibility</h1>
      <p className="mt-1 font-mono text-xs text-muted-foreground">Last updated 2026-11-18</p>

      <S n="1" t="Nothing is offered here today">
        <p><b>The Gatewayz yield vault is in development and is not live.</b> No
        deposits are accepted on any network, and nothing on these pages is open,
        offered or for sale. No Gatewayz token exists.</p>
        <p>The earlier program described on this page, in which ADA was delegated
        from the holder&apos;s own wallet in exchange for an inference discount, is
        <b> switched off</b> and is replaced by the vault. The early-access terms
        published here on 2026-10-14 applied to that program only and do not
        describe the vault.</p>
      </S>

      <S n="2" t="What is planned">
        <p>A vault on Cardano: a smart contract that holds a deposit of ADA or a
        supported Cardano stablecoin, with the yield it actually receives turned
        into inference credits on the Gatewayz gateway. The vault is planned to
        open on mainnet only after an independent security audit and a legal
        review.</p>
        <p><b>The terms are to be announced.</b> The vault&apos;s terms, including
        its margin, how long credits last and how withdrawals work, will be
        published before launch. The current description is at{" "}
        <a href={YIELD_URL} className="text-primary underline">gatewayz.ai/yield</a>.</p>
      </S>

      <S n="3" t="Who it will not be available to">
        <p>The program is <b>not available to, and must not be used by</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>United States persons</b>, including US citizens and residents
          wherever located, and entities organised under US law;</li>
          <li><b>Canadian persons</b>, including Canadian citizens and residents
          wherever located, and entities organised under Canadian law;</li>
          <li>persons in any jurisdiction where use would be unlawful, and persons
          subject to applicable sanctions.</li>
        </ul>
      </S>

      <S n="4" t="No guaranteed return">
        <p>Inference credits will be a share of yield the vault actually receives.
        That yield is variable and may be zero. <b>Nothing here is a promise of
        yield, income, return, or any particular amount of inference.</b></p>
      </S>

      <S n="5" t="Not advice, not a security">
        <p>Nothing here is financial, investment, tax or legal advice, a
        recommendation, or a solicitation. Nothing here is an offer of a security or
        a collective investment scheme in any jurisdiction. We make no
        representation about the tax treatment of anything described here.</p>
      </S>

      <S n="6" t="Keys and seed phrases">
        <p>We never ask for, and must never be given, a seed phrase or private
        key.</p>
      </S>

      <footer className="mt-12 border-t pt-5 text-xs text-muted-foreground">
        Pending legal review; we may update this page.{" "}
        <Link href="/stake" className="text-primary underline">Back</Link>
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
