// Settings > Credits > Cardano wallet: link the wallet whose discount credits
// go to this account. Exists only in builds with the discount credits flag on
// (src/lib/discount-credits/flag.ts); every other build serves a 404 here.
import { notFound } from 'next/navigation';
import { CardanoWalletPanel } from '@/components/discount-credits/CardanoWalletPanel';
import { isVaultDiscountCreditsEnabled } from '@/lib/discount-credits/flag';

export default function DiscountCreditsWalletPage() {
  if (!isVaultDiscountCreditsEnabled()) notFound();
  return <CardanoWalletPanel />;
}
