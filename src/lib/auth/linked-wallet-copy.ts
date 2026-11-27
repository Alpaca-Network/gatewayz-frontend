import type { LinkedWallet } from "@/lib/auth/wallet-auth-api";

type WalletIdentity = Pick<LinkedWallet, "wallet_address" | "chain_namespace">;

/**
 * Cardano stake addresses are linked for discount credits, not for signing in.
 * The backend tags them `chain_namespace: "cip34"`; the address prefix covers
 * responses without the field.
 */
export function isCardanoWallet(wallet: WalletIdentity): boolean {
  return wallet.chain_namespace === "cip34" || /^stake(_test)?1/.test(wallet.wallet_address);
}

/**
 * Text for the Settings > Wallets unlink confirmation. Only sign-in wallets
 * lose the ability to sign in; a Cardano stake address never could.
 */
export function unlinkDescription(wallet: WalletIdentity, displayAddress: string): string {
  return isCardanoWallet(wallet)
    ? `${displayAddress} will be removed from this account. Cardano stake addresses are not used to sign in, so how you sign in does not change.`
    : `${displayAddress} will no longer be able to sign in to this account.`;
}
