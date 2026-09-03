import { renderHook, waitFor } from "@testing-library/react";
import { isGuestAccountsEnabled, useEnsureGuestAccount } from "../guest-account";

const mockUsePrivy = jest.fn();
const mockUseGuestAccounts = jest.fn();
const mockCreateGuestAccount = jest.fn();
const mockCaptureMessage = jest.fn();

jest.mock("@privy-io/react-auth", () => ({
  usePrivy: () => mockUsePrivy(),
  useGuestAccounts: () => mockUseGuestAccounts(),
}));

jest.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

const mockIsTauriDesktop = jest.fn(() => false);
jest.mock("@/lib/browser-detection", () => ({
  isTauriDesktop: () => mockIsTauriDesktop(),
}));

const FLAG_KEY = "NEXT_PUBLIC_PRIVY_GUEST_ACCOUNTS";

describe("guest-account", () => {
  const originalFlag = process.env[FLAG_KEY];

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockIsTauriDesktop.mockReturnValue(false);
    mockUseGuestAccounts.mockReturnValue({ createGuestAccount: mockCreateGuestAccount });
    mockCreateGuestAccount.mockResolvedValue({ id: "guest-1", isGuest: true });
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env[FLAG_KEY];
    } else {
      process.env[FLAG_KEY] = originalFlag;
    }
  });

  describe("isGuestAccountsEnabled", () => {
    it('is true only when the env var is exactly "true"', () => {
      process.env[FLAG_KEY] = "true";
      expect(isGuestAccountsEnabled()).toBe(true);

      process.env[FLAG_KEY] = "false";
      expect(isGuestAccountsEnabled()).toBe(false);

      delete process.env[FLAG_KEY];
      expect(isGuestAccountsEnabled()).toBe(false);
    });
  });

  describe("useEnsureGuestAccount", () => {
    it("does not call createGuestAccount when the flag is off", async () => {
      delete process.env[FLAG_KEY];
      mockUsePrivy.mockReturnValue({ ready: true, authenticated: false });

      const { result } = renderHook(() => useEnsureGuestAccount());

      expect(result.current.status).toBe("idle");
      expect(mockCreateGuestAccount).not.toHaveBeenCalled();
    });

    it("calls createGuestAccount once when flag on, ready, and unauthenticated", async () => {
      process.env[FLAG_KEY] = "true";
      mockUsePrivy.mockReturnValue({ ready: true, authenticated: false });

      const { result } = renderHook(() => useEnsureGuestAccount());

      await waitFor(() => expect(mockCreateGuestAccount).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(result.current.status).toBe("created"));
    });

    it("does not call createGuestAccount again on remount (sessionStorage guard)", async () => {
      process.env[FLAG_KEY] = "true";
      mockUsePrivy.mockReturnValue({ ready: true, authenticated: false });

      const first = renderHook(() => useEnsureGuestAccount());
      await waitFor(() => expect(mockCreateGuestAccount).toHaveBeenCalledTimes(1));
      first.unmount();

      renderHook(() => useEnsureGuestAccount());

      // Give any errant effect a tick to fire before asserting it didn't.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockCreateGuestAccount).toHaveBeenCalledTimes(1);
    });

    it("sets status to unavailable and logs to Sentry (info) on rejection, without throwing", async () => {
      process.env[FLAG_KEY] = "true";
      mockUsePrivy.mockReturnValue({ ready: true, authenticated: false });
      mockCreateGuestAccount.mockRejectedValue(new Error("guest accounts disabled"));

      const { result } = renderHook(() => useEnsureGuestAccount());

      await waitFor(() => expect(result.current.status).toBe("unavailable"));
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        expect.stringContaining("Guest account"),
        expect.objectContaining({
          level: "info",
          tags: expect.objectContaining({ auth_error: "guest_account_unavailable" }),
        })
      );
    });

    it("does not call createGuestAccount on Tauri desktop", async () => {
      process.env[FLAG_KEY] = "true";
      mockIsTauriDesktop.mockReturnValue(true);
      mockUsePrivy.mockReturnValue({ ready: true, authenticated: false });

      renderHook(() => useEnsureGuestAccount());

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockCreateGuestAccount).not.toHaveBeenCalled();
    });

    it("does not call createGuestAccount when already authenticated", async () => {
      process.env[FLAG_KEY] = "true";
      mockUsePrivy.mockReturnValue({ ready: true, authenticated: true });

      renderHook(() => useEnsureGuestAccount());

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockCreateGuestAccount).not.toHaveBeenCalled();
    });

    it("does not call createGuestAccount before Privy is ready", async () => {
      process.env[FLAG_KEY] = "true";
      mockUsePrivy.mockReturnValue({ ready: false, authenticated: false });

      renderHook(() => useEnsureGuestAccount());

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockCreateGuestAccount).not.toHaveBeenCalled();
    });
  });
});
