"use client";

// "Stake for inference" on /rewards. Dark by default: renders nothing unless
// NEXT_PUBLIC_DELEGATED_STAKING_ENABLED=true AND GET /delegation/status says
// it is enabled with a vault address and/or pool id. Each asset tab renders
// only when its own target is configured. Kept out of src/components/holdings
// because that feature's copy policy forbids these words.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useIsTauri } from '@/lib/desktop/hooks';
import type { DelegationStatus } from '@/lib/delegation/api';
import { isCardanoPoolLive, isDelegationLive, isEthVaultLive } from '@/lib/delegation/flags';
import { useDelegationStatus } from '@/lib/delegation/use-delegation';
import { CardanoPoolPanel } from './CardanoPoolPanel';
import { DelegationPositionCard } from './DelegationPositionCard';
import { EthVaultPanel } from './EthVaultPanel';

export const DELEGATION_ANCHOR = 'stake-for-inference';

function rateFor(status: DelegationStatus, asset: string): number | null {
  const rate = status.allowance_rates.find((r) => r.asset === asset);
  return rate ? rate.credits_per_1k_usd_per_day : null;
}

function Explainer({ status }: { status: DelegationStatus }) {
  const points = [
    {
      title: 'Stake from your own wallet',
      detail: 'ETH goes into a StakeWise vault you hold the shares of; ADA is delegated in place and never moves.',
    },
    {
      title: 'Inference at 99% off',
      detail:
        'Gatewayz keeps the staking rewards and in return gives you inference at 99% off, up to an allowance that grows with what you stake.',
    },
    {
      title: 'Exit any time',
      detail:
        'ETH: join the vault exit queue and claim it back once released. ADA: re-delegate whenever you like; funds are never locked.',
    },
  ];
  const ethRate = rateFor(status, 'ETH');
  const adaRate = rateFor(status, 'ADA');

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 sm:grid-cols-3">
        {points.map((p) => (
          <li key={p.title} className="flex flex-col gap-1 rounded-lg border bg-card p-4">
            <h3 className="font-medium">{p.title}</h3>
            <p className="text-sm text-muted-foreground">{p.detail}</p>
          </li>
        ))}
      </ul>
      {(ethRate !== null || adaRate !== null) && (
        <p className="text-sm">
          Current allowance:{' '}
          {[
            ethRate !== null && isEthVaultLive(status) ? `ETH ${ethRate} credits per $1,000 staked per day` : null,
            adaRate !== null && isCardanoPoolLive(status) ? `ADA ${adaRate} credits per $1,000 delegated per day` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          .
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Rates are current, set by Gatewayz, and not guaranteed; they can change or stop.
        {status.eth.fee_percent !== null && isEthVaultLive(status)
          ? ` The ETH vault charges a ${status.eth.fee_percent}% fee on staking rewards.`
          : ''}
      </p>
      {status.disclaimer && (
        <p className="whitespace-pre-line rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          {status.disclaimer}
        </p>
      )}
    </div>
  );
}

function AccountArea({ status }: { status: DelegationStatus }) {
  const { status: authStatus, login } = useGatewayzAuth();
  const isDesktop = useIsTauri();
  const eth = isEthVaultLive(status);
  const ada = isCardanoPoolLive(status);

  if (isDesktop) {
    return (
      <p className="text-sm text-muted-foreground">
        Staking needs a browser wallet. Open beta.gatewayz.ai/rewards in your browser to stake; the allowance then
        counts for this account everywhere.
      </p>
    );
  }

  if (authStatus !== 'authenticated') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">Sign in to stake and see your allowance.</p>
        <Button onClick={() => login()} disabled={authStatus === 'authenticating' || authStatus === 'idle'}>
          Sign in to start
        </Button>
      </div>
    );
  }

  const defaultTab = eth ? 'eth' : 'ada';
  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue={defaultTab}>
        <TabsList aria-label="Asset">
          {eth && <TabsTrigger value="eth">ETH</TabsTrigger>}
          {ada && <TabsTrigger value="ada">ADA</TabsTrigger>}
        </TabsList>
        {eth && (
          <TabsContent value="eth" className="pt-4">
            <EthVaultPanel status={status} />
          </TabsContent>
        )}
        {ada && (
          <TabsContent value="ada" className="pt-4">
            <CardanoPoolPanel status={status} />
          </TabsContent>
        )}
      </Tabs>
      <DelegationPositionCard />
    </div>
  );
}

export function DelegationSection() {
  const statusQuery = useDelegationStatus();
  const status = statusQuery.data;
  if (!status || !isDelegationLive(status)) return null;

  return (
    <section id={DELEGATION_ANCHOR} aria-labelledby="stake-for-inference-title" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle id="stake-for-inference-title" className="text-xl">
            Stake for inference
          </CardTitle>
          <CardDescription>
            Stake ETH or ADA from your own wallet and get inference at 99% off, up to your allowance.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          <Explainer status={status} />
          <AccountArea status={status} />
        </CardContent>
      </Card>
    </section>
  );
}
