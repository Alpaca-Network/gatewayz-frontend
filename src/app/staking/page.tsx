import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { StakingPageClient } from '@/components/staking/StakingPageClient';
import { isStakingEnabled } from '@/lib/wayz/addresses';

// Rendered per request so the gate below emits a real 404 status. As a
// statically generated route, notFound() still served the not-found page but
// with HTTP 200 — a soft 404, which crawlers treat as a live page and which
// makes "is the gate deployed?" impossible to answer from the status code.
export const dynamic = 'force-dynamic';

// Reachable on production too, but unlisted: the header link is hidden there
// (shouldShowStakingNav) and the page is noindex.
const SHOW_STAKING = isStakingEnabled();

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
