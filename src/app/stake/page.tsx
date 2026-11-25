import Link from "next/link";
import type { Metadata } from "next";

// Unlisted: reachable by direct link only. noindex comes from ./layout.tsx.
// The earlier delegate-from-your-wallet flow that lived here has ended and been removed;
// the program is now a Cardano vault described at www.gatewayz.ai/yield. This
// page states no rates: the terms are to be announced.
const YIELD_URL = "https://www.gatewayz.ai/yield";

export const metadata: Metadata = {
  title: "Yield for inference: in development | Gatewayz",
  description:
    "The Gatewayz yield vault on Cardano is in development and not live. No deposits are accepted on any network. Terms will be announced before launch.",
};

export default function StakePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">In development</p>
      <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.1]">
        The Gatewayz yield vault is not live yet
      </h1>
      <p className="mt-4 text-muted-foreground text-lg">
        Gatewayz is building a vault on Cardano that is designed to turn the yield on
        deposited ADA or a supported Cardano stablecoin into discount credits that
        lower the price of requests on the Gatewayz gateway. Nothing can be deposited today, on any network.
      </p>

      <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <b>The terms are to be announced.</b> Gatewayz aims for competitive rates; the
        terms will be published before launch. The vault will open on mainnet only
        after an independent security audit and a legal review.{" "}
        <b>Not available to US persons or Canadian persons.</b>
      </div>

      <h2 className="mt-10 text-base font-semibold">What happened to ADA delegation?</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        An earlier design, where ADA was delegated from your own wallet, was shown on
        this page. It has ended and been removed, and is replaced by the vault. If you delegated
        to a pool from your own wallet, that delegation is yours to manage in your
        wallet as with any Cardano stake pool.
      </p>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <a
          href={YIELD_URL}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"
        >
          Read how the vault is planned to work
        </a>
        <Link href="/stake/terms" className="self-center text-primary underline">
          Status &amp; eligibility
        </Link>
      </div>
    </main>
  );
}
