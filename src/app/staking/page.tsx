import type { Metadata } from 'next';
import { StakingPageClient } from '@/components/staking/StakingPageClient';

export const metadata: Metadata = {
  title: 'WAYZ Staking | Gatewayz',
  description:
    'Stake WAYZ, manage unstake requests, and claim testnet WAYZ from the Gatewayz faucet on Avalanche Fuji.',
};

export default function StakingPage() {
  return <StakingPageClient />;
}
