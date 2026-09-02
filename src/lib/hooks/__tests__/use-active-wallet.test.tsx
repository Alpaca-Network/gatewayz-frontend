import { renderHook, act } from "@testing-library/react";
import { useActiveWallet } from "../use-active-wallet";

const mockUsePrivy = jest.fn();
const mockUseWallets = jest.fn();

jest.mock("@privy-io/react-auth", () => ({
  usePrivy: () => mockUsePrivy(),
  useWallets: () => mockUseWallets(),
}));

const mockIsTauriDesktop = jest.fn(() => false);
jest.mock("@/lib/browser-detection", () => ({
  isTauriDesktop: () => mockIsTauriDesktop(),
}));

function makeWallet(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    address: "0xabc0000000000000000000000000000000abcd",
    chainId: "eip155:43113",
    walletClientType: "metamask",
    switchChain: jest.fn().mockResolvedValue(undefined),
    sign: jest.fn().mockResolvedValue("0xsignature"),
    ...overrides,
  };
}

describe("useActiveWallet", () => {
  const mockLogin = jest.fn();
  const mockConnectWallet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauriDesktop.mockReturnValue(false);
    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: false,
      login: mockLogin,
      connectWallet: mockConnectWallet,
    });
    mockUseWallets.mockReturnValue({ wallets: [] });
  });

  it("reports isReady:false until Privy has initialised", () => {
    mockUsePrivy.mockReturnValue({
      ready: false,
      authenticated: false,
      login: mockLogin,
      connectWallet: mockConnectWallet,
    });

    const { result } = renderHook(() => useActiveWallet());

    expect(result.current.isReady).toBe(false);
  });

  it("reports a disconnected wallet when there are no wallets", () => {
    const { result } = renderHook(() => useActiveWallet());

    expect(result.current.address).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.chainId).toBeNull();
    expect(result.current.walletClientType).toBeNull();
  });

  it("resolves the active wallet's address and chain id from CAIP-2 formatting", () => {
    const wallet = makeWallet();
    mockUseWallets.mockReturnValue({ wallets: [wallet] });

    const { result } = renderHook(() => useActiveWallet());

    expect(result.current.address).toBe(wallet.address);
    expect(result.current.chainId).toBe(43113);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.walletClientType).toBe("metamask");
  });

  it("switchToFuji calls wallet.switchChain(43113)", async () => {
    const wallet = makeWallet();
    mockUseWallets.mockReturnValue({ wallets: [wallet] });

    const { result } = renderHook(() => useActiveWallet());
    await act(async () => {
      await result.current.switchToFuji();
    });

    expect(wallet.switchChain).toHaveBeenCalledWith(43113);
  });

  it("switchToFuji rejects when no wallet is connected", async () => {
    const { result } = renderHook(() => useActiveWallet());

    await expect(result.current.switchToFuji()).rejects.toThrow(/no wallet connected/i);
  });

  it("signMessage performs personal_sign via wallet.sign", async () => {
    const wallet = makeWallet();
    mockUseWallets.mockReturnValue({ wallets: [wallet] });

    const { result } = renderHook(() => useActiveWallet());
    const signature = await act(async () => result.current.signMessage("hello"));

    expect(wallet.sign).toHaveBeenCalledWith("hello");
    expect(signature).toBe("0xsignature");
  });

  it("connect() logs in with the wallet method when unauthenticated", async () => {
    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: false,
      login: mockLogin,
      connectWallet: mockConnectWallet,
    });

    const { result } = renderHook(() => useActiveWallet());
    await act(async () => {
      await result.current.connect();
    });

    expect(mockLogin).toHaveBeenCalledWith({ loginMethods: ["wallet"] });
    expect(mockConnectWallet).not.toHaveBeenCalled();
  });

  it("connect() opens the connect-wallet flow when already authenticated", async () => {
    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      login: mockLogin,
      connectWallet: mockConnectWallet,
    });

    const { result } = renderHook(() => useActiveWallet());
    await act(async () => {
      await result.current.connect();
    });

    expect(mockConnectWallet).toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("returns a disconnected, ready object without throwing when Privy isn't mounted (Tauri desktop)", () => {
    mockIsTauriDesktop.mockReturnValue(true);

    const { result } = renderHook(() => useActiveWallet());

    expect(result.current).toMatchObject({
      address: null,
      chainId: null,
      isConnected: false,
      isReady: true,
      walletClientType: null,
    });
  });
});
