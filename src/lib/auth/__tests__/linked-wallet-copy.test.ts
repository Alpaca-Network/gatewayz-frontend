import { isCardanoWallet, unlinkDescription } from "@/lib/auth/linked-wallet-copy";

describe("linked wallet copy", () => {
  it("detects Cardano rows by namespace or stake address prefix", () => {
    expect(isCardanoWallet({ wallet_address: "stake1uxyz", chain_namespace: "cip34" })).toBe(true);
    expect(isCardanoWallet({ wallet_address: "stake1uxyz" })).toBe(true);
    expect(isCardanoWallet({ wallet_address: "stake_test1uxyz", chain_namespace: null })).toBe(true);
    expect(isCardanoWallet({ wallet_address: "0xabc", chain_namespace: "eip155" })).toBe(false);
    expect(isCardanoWallet({ wallet_address: "0xabc" })).toBe(false);
  });

  it("does not tell Cardano users they lose sign-in", () => {
    const text = unlinkDescription({ wallet_address: "stake1uxyz", chain_namespace: "cip34" }, "stake1...uxyz");
    expect(text).not.toMatch(/no longer be able to sign in/);
    expect(text).toMatch(/not used to sign in/);
  });

  it("keeps the sign-in warning for EVM wallets", () => {
    expect(unlinkDescription({ wallet_address: "0xabc" }, "0xabc")).toBe("0xabc will no longer be able to sign in to this account.");
  });
});
