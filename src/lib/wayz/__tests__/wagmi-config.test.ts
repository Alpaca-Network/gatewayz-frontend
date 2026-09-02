// @privy-io/wagmi (and its `wagmi` peer) ship ESM-only builds with no CJS/"require" condition
// in package.json#exports, so Jest's CommonJS module resolution can't load them at all —
// confirmed against the installed @privy-io/wagmi@2.1.3 (works fine in the real Next.js/webpack
// build, which resolves ESM natively; this is a Jest-only limitation). createConfig is mocked
// as a passthrough so this test still verifies OUR wiring — the exact chains/transports we pass
// — without needing the vendor's real (untestable-under-Jest) internals.
// `virtual: true` — Jest's mock resolution has the exact same "no require condition" problem
// as a real import (see above), so it can't resolve the module path even to mock it. The
// factory can't reference an outer `const` here (e.g. a `jest.fn()` to assert call args
// against): `jest.mock` calls are hoisted above the module's own `import`s, so this factory
// runs — via the `import { wagmiConfig }` below — before any later `const` would be
// initialized, throwing a TDZ ReferenceError.
jest.mock(
  "@privy-io/wagmi",
  () => ({
    createConfig: (args: any) => args,
  }),
  { virtual: true }
);

import { wagmiConfig } from "../wagmi-config";
import { FUJI_CHAIN_ID } from "../chains";

describe("wagmiConfig", () => {
  it("configures both Base and Avalanche Fuji", () => {
    const chainIds = wagmiConfig.chains.map((chain: { id: number }) => chain.id);

    expect(chainIds).toContain(8453); // Base
    expect(chainIds).toContain(FUJI_CHAIN_ID);
  });

  it("provides a transport for both configured chains", () => {
    expect(Object.keys(wagmiConfig.transports)).toEqual(
      expect.arrayContaining([String(8453), String(FUJI_CHAIN_ID)])
    );
  });
});
