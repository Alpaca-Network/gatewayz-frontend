/**
 * Copy for `useLinkAccount({ onError })` failures (M2 W3b follow-up — review of PR #1011).
 *
 * Shared by every link-account CTA (`guest-upgrade-banner.tsx`, `user-nav.tsx`) so the two
 * don't drift, the same lesson `build-auth-request.ts` already encodes for the sync body.
 *
 * `PrivyErrorCode` (`node_modules/@privy-io/react-auth/dist/dts/types-B4eMcjTQ.d.ts`) is a real
 * runtime enum, but the installed `@privy-io/react-auth@3.10.2`'s public entry
 * (`dist/cjs/index.js`) only re-exports it as a *type* — the string is absent from the runtime
 * module's exports. So this takes `string`, not the enum, and switches on the enum's known
 * string values directly (verified against the same file).
 */
export function describeLinkAccountError(error: string): string | null {
  switch (error) {
    // The visitor closed Privy's modal or declined the OAuth prompt themselves — that's not a
    // failure worth a toast, it's just "never mind."
    case 'exited_link_flow': // PrivyErrorCode.USER_EXITED_LINK_FLOW
    case 'oauth_user_denied': // PrivyErrorCode.OAUTH_USER_DENIED
      return null;
    case 'linked_to_another_user': // PrivyErrorCode.LINKED_TO_ANOTHER_USER
      return 'That account is already linked to a different Gatewayz account.';
    case 'cannot_link_more_of_type': // PrivyErrorCode.CANNOT_LINK_MORE_OF_TYPE
      return "You've already linked an account of that type.";
    default:
      return 'Something went wrong linking your account. Please try again.';
  }
}
