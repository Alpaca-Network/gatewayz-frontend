# src/lib/wallet

Links a Cardano stake address to the signed-in Gatewayz account with a CIP-30
`signData` signature. No transactions are built or submitted, and no funds move.

No screen calls this yet; it is kept for the vault's wallet page.

## Files

- `cip30.ts`: finds the CIP-30 wallets in `window.cardano` (`detectCip30Wallets`)
  and recognises a "user said no" error (`isCip30Rejection`).
- `cardano-network.ts`: the network id and stake address prefix for mainnet and
  preprod. Preprod is kept for the vault's testnet phase.
- `cardano-wallet.ts`: connects a wallet and reads its stake address
  (`connectCardanoWallet`), signs the link message with the stake key
  (`signLinkMessage`), and turns a wallet error into copy (`describeCardanoError`).
- `cardano-link-api.ts`: the backend client (`requestCardanoLinkNonce`,
  `linkCardanoStakeAddress`), its error class and its error copy
  (`describeCardanoLinkError`).

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
- `POST /wallet/eligibility` exists on the backend and is not called yet.

## 451 refusals

The backend refuses linking with HTTP 451. `error.type` is `attestation_required`
(the account has not confirmed its eligibility yet) or `region_restricted`.
`cardanoLinkRefusalOf` reads it; an unknown future 451 type is treated as
region-restricted.
