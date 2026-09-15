import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { StakingPageClient } from '@/components/staking/StakingPageClient';
import { isWayzConfigured } from '@/lib/wayz/addresses';

// Same gate the header nav uses (src/components/layout/app-header.tsx). The nav
// link was hidden when the token addresses were unset, but the route itself
// stayed reachable: /staking returned 200 and carried an indexable title, so the
// page was still public and still findable. A hidden entry point is not a hidden
// page — gate the route on the same condition as the link.
const SHOW_STAKING =
  isWayzConfigured() || process.env.NEXT_PUBLIC_WAYZ_STAKING_PREVIEW === 'true';

export const metadata: Metadata = {
  title: 'Staking | Gatewayz',
  description: 'Stake and manage your positions.',
  robots: { index: false, follow: false },
};

export default function StakingPage() {
  if (!SHOW_STAKING) {
    notFound();
  }

  return <StakingPageClient />;
}
