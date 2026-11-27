// User-facing copy for linking a Cardano wallet to discount credits. Same
// rules as ./discount-copy.ts (checked by __tests__/discount-language.test.ts):
// the product is "discount credits", and no copy states an amount, a rate or
// a date for them.

/** The wallet page, under Settings > Credits. */
export const WALLET_PAGE_PATH = '/settings/credits/wallet';
/** Back to the discount credits card on Settings > Credits. */
export const DISCOUNT_CARD_PATH = '/settings/credits#discount-credits';
/** Where a payment method is added: buying credits on Settings > Credits. */
export const ADD_PAYMENT_METHOD_PATH = '/settings/credits#buy-credits';

export const WALLET_PAGE_TITLE = 'Cardano wallet';
export const WALLET_PAGE_DESCRIPTION = 'Discount credits for a linked wallet go to this Gatewayz account.';
export const WALLET_BACK = 'Back to credits';
export const WALLET_SAFETY_NOTE =
  'Linking asks your wallet to sign one message. It sends no transaction and moves no funds.';

// Linked wallets.
export const LINKED_TITLE = 'Linked wallet';
export const LINKED_NONE = 'No wallet linked yet.';
export const LINKED_LOAD_FAILED = 'Your linked wallets could not be loaded. Try again.';
export const LINKED_SINCE = 'Linked';
export const COPY_ADDRESS = 'Copy stake address';
export const COPIED = 'Stake address copied';
export const UNLINK = 'Unlink';
export const UNLINK_TITLE = 'Unlink this wallet?';
export const UNLINK_BODY = 'Discount credits for this wallet will no longer go to this account.';
export const UNLINKED = 'Wallet unlinked';
export const UNLINK_FAILED = 'Could not unlink wallet';
export const CANCEL = 'Cancel';

// Linking.
export const LINK_TITLE = 'Link a wallet';
export const LINK_ANOTHER_TITLE = 'Link another wallet';
export const STEP_CHOOSE = 'Choose your wallet';
export const STEP_CONFIRM = 'Confirm and sign';
export const NETWORK_NOTE = 'Your wallet must be on Cardano mainnet.';
export const DETECTING = 'Looking for Cardano wallets in this browser…';
export const NO_WALLETS_TITLE = 'No Cardano wallet found';
export const NO_WALLETS_BODY =
  'Install a Cardano wallet extension such as Eternl, Lace or Vespr, then check again. On a phone, open this page in your wallet app’s browser.';
export const CHECK_AGAIN = 'Check again';
export const CONNECTING = 'Connecting…';
export const CONNECTED_AS = 'Connected stake address';
export const USE_ANOTHER_WALLET = 'Use another wallet';
/** The backend's attestation wording (eligibility.py ATTESTATION_TEXT), verbatim. */
export const ATTESTATION_LABEL = 'I am not a resident or citizen of the United States or Canada.';
export const SIGN_AND_LINK = 'Sign and link';
export const SIGNING = 'Check your wallet…';
export const LINKED_OK = 'Wallet linked';
export const LINK_FAILED = 'Could not link wallet';

// Refusals.
export const PAYMENT_METHOD_TITLE = 'Add a payment method first';
export const PAYMENT_METHOD_BODY =
  'Part of each request is always charged to you, so a payment method is needed before you link a wallet. Buy credits with a card, then try again.';
export const PAYMENT_METHOD_CTA = 'Add a payment method';
export const REGION_TITLE = 'Not available in your region';

// The summary on the discount credits card.
export const SUMMARY_TITLE = 'Cardano wallet';
export const SUMMARY_NONE = 'Link the Cardano wallet whose discount credits should go to this account.';
export const SUMMARY_LINK = 'Link a wallet';
export const SUMMARY_MANAGE = 'Manage wallet';

/** "stake1u8a…9x7k2q": enough to recognise, short enough for a phone. */
export function shortStakeAddress(address: string): string {
  return address.length <= 20 ? address : `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/** "Nov 27, 2026", or '' when the date is missing or unreadable. */
export function formatLinkedDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
