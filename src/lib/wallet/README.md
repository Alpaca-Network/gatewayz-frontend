# src/lib/wallet

Links a Cardano stake address to the signed-in Gatewayz account with a CIP-30
`signData` signature. No transactions are built or submitted, and no funds move.

The discount credits wallet page uses it: Settings > Credits > Cardano wallet
(`src/app/settings/credits/wallet/page.tsx`, UI in
`src/components/discount-credits/CardanoWalletPanel.tsx`). That page exists only
in builds with `NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED=true`; other builds
serve a 404 there.

## Files

- `cip30.ts`: finds the CIP-30 wallets in `window.cardano` (`detectCip30Wallets`)
  and recognises a "user said no" error (`isCip30Rejection`).
- `cardano-network.ts`: the network id and stake address prefix for mainnet and
  preprod. Preprod is kept for the vault's testnet phase.
- `cardano-wallet.ts`: connects a wallet and reads its stake address
  (`connectCardanoWallet`), signs the link message with the stake key
  (`signLinkMessage`), and turns a wallet error into copy (`describeCardanoError`).
- `cardano-link-api.ts`: the backend client (`requestCardanoLinkNonce`,
  `linkCardanoStakeAddress`, `getLinkedCardanoWallets`,
  `unlinkCardanoStakeAddress`), its error class and its error copy
  (`describeCardanoLinkError`, `describeCardanoUnlinkError`).
- `use-cardano-wallet-link.ts`: React Query hooks for the page
  (`useLinkedCardanoWallets`, `useLinkCardanoWallet`, `useUnlinkCardanoWallet`).
  Nothing is fetched while the build flag is off.

## Call order

1. `detectCip30Wallets()`: list the installed wallets.
2. `connectCardanoWallet(key)`: enable one and read its stake address.
3. `requestCardanoLinkNonce(stakeAddress, notUsCaPerson)`: get the message to sign.
4. `signLinkMessage(connected, nonce)`: sign it in the wallet.
5. `linkCardanoStakeAddress({ stakeAddress, signature, key, notUsCaPerson })`:
   send the signature to the backend.

## Backend endpoints

- `POST /auth/wallet/cardano/nonce`
- `POST /auth/wallet/cardano/link`
- `GET /auth/wallets` (Cardano rows have `chain_namespace` `cip34`)
- `DELETE /auth/wallets/{stake_address}`
- `POST /wallet/eligibility` exists on the backend and is not called: the
  attestation is sent with the nonce and link calls instead.

## 402: payment method required

Linking needs a payment method (discount credits plan, step 1.5). Without one the
backend answers the nonce and link calls with HTTP 402, `error.type`
`payment_method_required`. `isPaymentMethodRequired` reads it; the wallet page
then links to buying credits (`/settings/credits#buy-credits`).

## 451 refusals

The backend refuses linking with HTTP 451. `error.type` is `attestation_required`
(the account has not confirmed its eligibility yet) or `region_restricted`.
`cardanoLinkRefusalOf` reads it; an unknown future 451 type is treated as
region-restricted.
