import { redirect } from 'next/navigation';

/**
 * WAYZ staking moved off the product domain (decision 2026-09-15).
 *
 * The token is deliberately arms-length from the Gatewayz product: token.gatewayz.ai
 * carries the jurisdiction controls and counsel interlocks that beta.gatewayz.ai does
 * not. The staking UI (src/components/staking/*, the wagmi provider and
 * src/lib/wayz/*) is intentionally left in the tree so it can be ported to the token
 * site rather than rewritten.
 */
export default function StakingRedirect() {
  redirect('https://token.gatewayz.ai');
}
