"use client";

// "Stake for inference" on /rewards. Dark by default: renders nothing unless
// NEXT_PUBLIC_DELEGATED_STAKING_ENABLED=true AND GET /delegation/status says
// it is enabled with a vault address and/or pool id. Each asset tab renders
// only when its own target is configured. With payout_model "reward_share"
// (v3) the copy describes the inference discount instead of the allowance, and
// the discount card renders once the backend's discount switch is on. Kept out of src/components/holdings
// because that feature's copy policy forbids these words. Visitors in a
// restricted country (src/lib/delegation/region.ts) see it only if they already
// have a stake, and then only to view and leave it. Starting a new stake (link,
// stake, delegate) needs the eligibility attestation; leaving never does.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { useIsTauri } from '@/lib/desktop/hooks';
import type { DelegationStatus } from '@/lib/delegation/api';
import { isCardanoPoolLive, isDelegationLive, isEthVaultLive, isRewardShareModel } from '@/lib/delegation/flags';
import { useDelegationRewards, useDelegationStatus } from '@/lib/delegation/use-delegation';
import { useDelegationRegionBlocked } from '@/lib/delegation/use-region';
import { CardanoPoolPanel } from './CardanoPoolPanel';
import { DelegationPositionCard } from './DelegationPositionCard';
import { rewardShareDescription, rewardShareFootnote, rewardSharePoints } from './discount-copy';
import { EthVaultPanel } from './EthVaultPanel';
import { InferenceDiscountCard } from './InferenceDiscountCard';

export const DELEGATION_ANCHOR = 'stake-for-inference';

function rateFor(status: DelegationStatus, asset: string): number | null {
  const rate = status.allowance_rates.find((r) => r.asset === asset);
  return rate ? rate.credits_per_1k_usd_per_day : null;
}

const STAKE_POINT = {
  title: 'Stake from your own wallet',
  detail: 'ETH goes into a StakeWise vault you hold the shares of; ADA is delegated in place and never moves.',
};
const EXIT_POINT = {
  title: 'Exit any time',
  detail:
    'ETH: join the vault exit queue and claim it back once released. ADA: re-delegate whenever you like; funds are never locked.',
};

function Explainer({ status }: { status: DelegationStatus }) {
  if (isRewardShareModel(status)) return <RewardShareExplainer status={status} />;

  const points = [
    STAKE_POINT,
    {
      title: 'Inference at 99% off',
      detail:
        'Gatewayz keeps the staking rewards and in return gives you inference at 99% off, up to an allowance that grows with what you stake.',
    },
    EXIT_POINT,
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
          ? ` The ETH vault takes a ${status.eth.fee_percent}% fee on staking rewards; that is how Gatewayz collects the rewards that fund your allowance.`
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

function RewardShareExplainer({ status }: { status: DelegationStatus }) {
  const points = [STAKE_POINT, ...rewardSharePoints(status), EXIT_POINT];
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {points.map((p) => (
          <li key={p.title} className="flex flex-col gap-1 rounded-lg border bg-card p-4">
            <h3 className="font-medium">{p.title}</h3>
            <p className="text-sm text-muted-foreground">{p.detail}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{rewardShareFootnote(status, isEthVaultLive(status))}</p>
      {status.disclaimer && (
        <p className="whitespace-pre-line rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          {status.disclaimer}
        </p>
      )}
    </div>
  );
}

function AccountArea({ status, allowNewStake = true }: { status: DelegationStatus; allowNewStake?: boolean }) {
  const { status: authStatus, login } = useGatewayzAuth();
  const isDesktop = useIsTauri();
  const eth = isEthVaultLive(status);
  const ada = isCardanoPoolLive(status);

  const rewardShare = isRewardShareModel(status);

  if (isDesktop) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Staking needs a browser wallet. Open beta.gatewayz.ai/rewards in your browser to stake; the{' '}
          {rewardShare ? 'discount' : 'allowance'} then counts for this account everywhere.
        </p>
        {authStatus === 'authenticated' && <InferenceDiscountCard status={status} shownDisclaimer={status.disclaimer} />}
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">
          Sign in to stake and see your {rewardShare ? 'discount' : 'allowance'}.
        </p>
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
            <EthVaultPanel status={status} allowNewStake={allowNewStake} />
          </TabsContent>
        )}
        {ada && (
          <TabsContent value="ada" className="pt-4">
            <CardanoPoolPanel status={status} allowNewStake={allowNewStake} />
          </TabsContent>
        )}
      </Tabs>
      <InferenceDiscountCard status={status} shownDisclaimer={status.disclaimer} />
      <DelegationPositionCard shownDisclaimer={status.disclaimer} rewardShare={rewardShare} />
    </div>
  );
}

export function DelegationSection() {
  const statusQuery = useDelegationStatus();
  const status = statusQuery.data;
  const regionBlocked = useDelegationRegionBlocked();
  const { status: authStatus } = useGatewayzAuth();
  // Only a restricted visitor needs this here: to find an existing stake to show.
  const rewardsQuery = useDelegationRewards({ enabled: regionBlocked === true && authStatus === 'authenticated' });
  if (regionBlocked === undefined) return null;
  if (!status || !isDelegationLive(status)) return null;
  if (regionBlocked) {
    const rewards = rewardsQuery.data;
    const hasStake = !!rewards && (rewards.positions.length > 0 || rewards.linked_wallets.length > 0);
    return hasStake ? <ExistingStakeSection status={status} /> : null;
  }

  return (
    <section id={DELEGATION_ANCHOR} aria-labelledby="stake-for-inference-title" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle id="stake-for-inference-title" className="text-xl">
            Stake for inference
          </CardTitle>
          <CardDescription>
            {isRewardShareModel(status)
              ? rewardShareDescription(status)
              : 'Stake ETH or ADA from your own wallet and get inference at 99% off, up to your allowance.'}
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

/** Restricted region with an existing stake: view, exit and claim only. */
function ExistingStakeSection({ status }: { status: DelegationStatus }) {
  return (
    <section id={DELEGATION_ANCHOR} aria-labelledby="stake-for-inference-title" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle id="stake-for-inference-title" className="text-xl">
            Your stake
          </CardTitle>
          <CardDescription>
            New stakes are not available in your region. You can view and exit your existing position at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          <AccountArea status={status} allowNewStake={false} />
        </CardContent>
      </Card>
    </section>
  );
}
