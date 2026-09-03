import { render, screen, fireEvent } from "@testing-library/react";
import { GuestUpgradeBanner } from "../guest-upgrade-banner";
import { AUTH_REFRESH_EVENT } from "@/lib/api";

const mockUsePrivy = jest.fn();
const mockUseLinkAccount = jest.fn();
const mockLinkEmail = jest.fn();
const mockLinkGoogle = jest.fn();
const mockLinkWallet = jest.fn();

jest.mock("@privy-io/react-auth", () => ({
  usePrivy: () => mockUsePrivy(),
  useLinkAccount: (...args: unknown[]) => mockUseLinkAccount(...args),
}));

jest.mock("lucide-react", () => ({
  UserPlus: () => <span data-testid="user-plus-icon" />,
  X: () => <span data-testid="x-icon" />,
}));

describe("GuestUpgradeBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockUseLinkAccount.mockReturnValue({
      linkEmail: mockLinkEmail,
      linkGoogle: mockLinkGoogle,
      linkWallet: mockLinkWallet,
    });
  });

  it("renders nothing when the Privy user isn't a guest", () => {
    mockUsePrivy.mockReturnValue({ user: { isGuest: false } });
    const { container } = render(<GuestUpgradeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no Privy user", () => {
    mockUsePrivy.mockReturnValue({ user: null });
    const { container } = render(<GuestUpgradeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows for isGuest accounts", () => {
    mockUsePrivy.mockReturnValue({ user: { isGuest: true } });
    render(<GuestUpgradeBanner />);
    expect(screen.getByText(/guest account/i)).toBeInTheDocument();
  });

  it("invokes linkEmail when the Sign in CTA is clicked", () => {
    mockUsePrivy.mockReturnValue({ user: { isGuest: true } });
    render(<GuestUpgradeBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mockLinkEmail).toHaveBeenCalledTimes(1);
  });

  it("invokes linkGoogle and linkWallet from their respective CTAs", () => {
    mockUsePrivy.mockReturnValue({ user: { isGuest: true } });
    render(<GuestUpgradeBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Wallet" }));

    expect(mockLinkGoogle).toHaveBeenCalledTimes(1);
    expect(mockLinkWallet).toHaveBeenCalledTimes(1);
  });

  it("triggers a resync (AUTH_REFRESH_EVENT) when useLinkAccount reports a successful link", () => {
    mockUsePrivy.mockReturnValue({ user: { isGuest: true } });
    const handler = jest.fn();
    window.addEventListener(AUTH_REFRESH_EVENT, handler);

    render(<GuestUpgradeBanner />);
    // Simulate Privy invoking the onSuccess callback it was configured with.
    const options = mockUseLinkAccount.mock.calls[0]?.[0];
    options.onSuccess();

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_REFRESH_EVENT, handler);
  });

  it("dismiss hides the banner for the rest of the session", () => {
    mockUsePrivy.mockReturnValue({ user: { isGuest: true } });
    const { unmount } = render(<GuestUpgradeBanner />);

    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText(/guest account/i)).not.toBeInTheDocument();

    // A remount within the same session (e.g. navigating within chat) must stay dismissed.
    unmount();
    render(<GuestUpgradeBanner />);
    expect(screen.queryByText(/guest account/i)).not.toBeInTheDocument();
  });
});
