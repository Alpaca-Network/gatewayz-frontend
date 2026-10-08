"use client";

// /rewards: the public explainer for holdings rewards plus, once signed in,
// the wallet-link flow and the account's HoldingsRewardsCard. Product language
// is "holdings rewards" only; __tests__/language.test.ts enforces the
// backend's word policy on this file.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { HoldingsRewardsCard } from '@/components/holdings/HoldingsRewardsCard';
import { REWARDS_HEADLINE } from '@/components/holdings/HoldingsRewardsSummaryCard';
import { HoldingsWalletLink } from '@/components/holdings/HoldingsWalletLink';
import { HOLDINGS_RULES } from '@/lib/holdings/status';
import { HOLDINGS_SUPPORTED_CHAINS } from '@/lib/holdings/supported-tokens';

const STEPS = [
  {
    title: 'Keep your tokens in your own wallet',
    detail: 'Nothing is deposited or moved. We never take custody and never ask for a transaction.',
  },
  {
    title: 'Link the wallet with one signature',
    detail: 'Sign a message to prove the wallet is yours. It is free: no gas, and no network switch.',
  },
  {
    title: `We check balances ${HOLDINGS_RULES.sweepsPerDay} times a day`,
    detail: 'We read public balances of the supported tokens below. Each day counts at its lowest measured value.',
  },
  {
    title: `Credits arrive daily, from day ${HOLDINGS_RULES.minWalletAgeDays + 1}`,
    detail: `A newly linked wallet is first measured after ${HOLDINGS_RULES.minWalletAgeDays} days. After that, inference credits are added to your account every day.`,
  },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="flex flex-col gap-4">
      <h2 id="how-it-works" className="text-xl font-semibold">
        How it works
      </h2>
      <ol className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3 rounded-lg border bg-card p-4">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        Daily credits are limited by what your account spent on inference over the last{' '}
        {HOLDINGS_RULES.usageLookbackDays} days and by a per-account daily cap. Rates are set by Gatewayz and can
        change or stop at any time. Signed in, you can see the current rates and cap below.
      </p>
    </section>
  );
}

function SupportedTokens() {
  return (
    <section aria-labelledby="supported-tokens" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="supported-tokens" className="text-xl font-semibold">
          Supported tokens
        </h2>
        <p className="text-sm text-muted-foreground">
          Only these tokens, on these networks, are counted. Anything else in the wallet is ignored.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HOLDINGS_SUPPORTED_CHAINS.map((chain) => (
          <div key={chain.chainId} className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-medium">{chain.name}</h3>
            <ul className="flex flex-wrap gap-2" aria-label={`Tokens counted on ${chain.name}`}>
              {chain.tokens.map((token) => (
                <li key={token}>
                  <Badge variant="secondary" className="font-mono">
                    {token}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function AccountSection() {
  const { status, login } = useGatewayzAuth();

  if (status === 'authenticated') {
    return (
      <div className="flex flex-col gap-6">
        <HoldingsWalletLink />
        <HoldingsRewardsCard />
      </div>
    );
  }

  if (status === 'unauthenticated' || status === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            Sign in to link a wallet and see what your holdings earn. Inference credits are added to your Gatewayz
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => login()}>Sign in to start</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6" aria-busy="true">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

export function RewardsPageClient() {
  return (
    <div className="container mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{REWARDS_HEADLINE}</h1>
        <p className="max-w-2xl text-muted-foreground">
          Hold ETH, stablecoins and other major tokens in your own wallet, link it to Gatewayz, and get inference
          credits every day. Your tokens never leave your wallet.
        </p>
      </header>
      <HowItWorks />
      <AccountSection />
      <SupportedTokens />
    </div>
  );
}
