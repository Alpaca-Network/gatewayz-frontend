import type { Metadata } from 'next';
import { RewardsPageClient } from '@/components/holdings/RewardsPageClient';

// Static and indexable: the explainer renders without a session, and the
// signed-in parts load client-side, so this also builds for the desktop
// static export.
export const metadata: Metadata = {
  title: 'Earn free inference on what you hold | Gatewayz',
  description:
    'Link a wallet with one signature and get daily inference credits for ETH, stablecoins and other major tokens you hold. Non-custodial: your tokens never leave your wallet.',
  alternates: { canonical: '/rewards' },
  openGraph: {
    title: 'Earn free inference on what you hold | Gatewayz',
    description:
      'Daily inference credits for tokens you keep in your own wallet. Link it with one signature; we never take custody.',
    url: '/rewards',
  },
};

export default function RewardsPage() {
  return <RewardsPageClient />;
}
