// Build flag for the "Save a card / auto top-up" control on Settings > Credits
// (CardAutoTopUpCard). Off unless the build sets NEXT_PUBLIC_CARD_AUTO_TOPUP_ENABLED
// to exactly "true". With it on, the control still renders only when the backend
// reports the feature as enabled for the account (CARD_AUTO_TOPUP_ENABLED and
// CARD_AUTO_TOPUP_USER_IDS on the backend), and it replaces the older auto
// top-up form, which saved settings but never charged a card.
export function isCardAutoTopUpEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CARD_AUTO_TOPUP_ENABLED === 'true';
}
