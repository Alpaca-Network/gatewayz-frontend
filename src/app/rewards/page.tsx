import Link from 'next/link';
import type { Metadata } from 'next';

// Holdings rewards (credits for tokens held in a linked wallet) is no longer
// offered. This page used to advertise it; it now says so and points to the
// one program Gatewayz is building, the Cardano vault. The explainer and the
// signed-in panels that lived here are in @/components/holdings and are not
// rendered anywhere.
const VAULT_URL = 'https://www.gatewayz.ai/yield';

export const metadata: Metadata = {
  title: 'Holdings rewards have ended | Gatewayz',
  description:
    'Holdings rewards are no longer offered. Gatewayz is building a vault on Cardano; it is in development and not live.',
  robots: { index: false, follow: false },
};

export default function RewardsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Ended</p>
      <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.1]">
        Holdings rewards are no longer offered
      </h1>
      <p className="mt-4 text-muted-foreground text-lg">
        Gatewayz no longer adds credits for tokens held in a linked wallet. Credits
        that were already added to your balance stay there and work as before.
      </p>

      <h2 className="mt-10 text-base font-semibold">What is next</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Gatewayz is building a vault on Cardano. It is in development and is not
        live: nothing can be deposited today, on any network, and its terms are to
        be announced.
      </p>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <a href={VAULT_URL} className="font-medium text-primary underline underline-offset-4">
          Read about the vault
        </a>
        <Link href="/settings/credits" className="text-muted-foreground underline underline-offset-4">
          Your credits
        </Link>
      </div>
    </main>
  );
}
