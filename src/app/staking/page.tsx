import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { StakingPageClient } from '@/components/staking/StakingPageClient';
import { isWayzConfigured } from '@/lib/wayz/addresses';

// Same gate the header nav uses (src/components/layout/app-header.tsx). The nav
// link was hidden when the token addresses were unset, but the route itself
// stayed reachable: /staking returned 200 and carried an indexable title, so the
// page was still public and still findable. A hidden entry point is not a hidden
// page — gate the route on the same condition as the link.
// Rendered per request so the gate below emits a real 404 status. As a
// statically generated route, notFound() still served the not-found page but
// with HTTP 200 — a soft 404, which crawlers treat as a live page and which
// makes "is the gate deployed?" impossible to answer from the status code.
export const dynamic = 'force-dynamic';

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
