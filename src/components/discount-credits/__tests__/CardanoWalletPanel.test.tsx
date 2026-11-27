import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardanoLinkApiError, type LinkedCardanoWallet } from '@/lib/wallet/cardano-link-api';
import { CardanoWalletError } from '@/lib/wallet/cardano-wallet';
import { CardanoWalletPanel } from '../CardanoWalletPanel';

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span />,
  Check: () => <span />,
  Copy: () => <span />,
  ShieldCheck: () => <span />,
  Wallet: () => <span />,
}));

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  );
  return MockLink;
});

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

const mockDetect = jest.fn();
jest.mock('@/lib/wallet/cip30', () => ({
  ...jest.requireActual('@/lib/wallet/cip30'),
  detectCip30Wallets: () => mockDetect(),
}));

const mockConnect = jest.fn();
jest.mock('@/lib/wallet/cardano-wallet', () => ({
  ...jest.requireActual('@/lib/wallet/cardano-wallet'),
  connectCardanoWallet: (...args: unknown[]) => mockConnect(...args),
}));

let mockLinked: { data: LinkedCardanoWallet[] | undefined; isLoading: boolean; isError: boolean };
const mockLink = jest.fn();
const mockUnlink = jest.fn();
jest.mock('@/lib/wallet/use-cardano-wallet-link', () => ({
  useLinkedCardanoWallets: () => mockLinked,
  useLinkCardanoWallet: () => ({ mutateAsync: mockLink, isPending: false, reset: jest.fn() }),
  useUnlinkCardanoWallet: () => ({ mutateAsync: mockUnlink, isPending: false }),
}));

const STAKE = 'stake1u9f9v0z5zzlldgx58n8tklphu8mf7h4jvp2j2gddluemnssjfnkzz';
const ETERNL = { key: 'eternl', name: 'Eternl', icon: null };
const LACE = { key: 'lace', name: 'Lace', icon: 'data:image/png;base64,AAAA' };

async function connectEternl(user: ReturnType<typeof userEvent.setup>) {
  mockConnect.mockResolvedValueOnce({ key: 'eternl', wallet: {}, stakeAddress: STAKE });
  await user.click(await screen.findByRole('button', { name: /Eternl/ }));
  await screen.findByText(STAKE);
}

describe('CardanoWalletPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLinked = { data: [], isLoading: false, isError: false };
    mockDetect.mockReturnValue([ETERNL, LACE]);
  });

  it('says no wallet is linked and lists the installed wallets', async () => {
    render(<CardanoWalletPanel />);
    expect(screen.getByRole('heading', { name: 'Cardano wallet', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('No wallet linked yet.')).toBeInTheDocument();
    expect(screen.getByText('Link a wallet')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Eternl/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lace/ })).toBeInTheDocument();
    expect(screen.getByText(/sends no transaction and moves no funds/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to credits/ })).toHaveAttribute('href', '/settings/credits#discount-credits');
  });

  it('explains what to do when no wallet is installed, and looks again on request', async () => {
    mockDetect.mockReturnValue([]);
    const user = userEvent.setup();
    render(<CardanoWalletPanel />);
    expect(await screen.findByText('No Cardano wallet found')).toBeInTheDocument();
    mockDetect.mockReturnValue([ETERNL]);
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByRole('button', { name: /Eternl/ })).toBeInTheDocument();
  });

  it('shows the wallet error when the wallet is on the wrong network', async () => {
    const user = userEvent.setup();
    mockConnect.mockRejectedValueOnce(new CardanoWalletError('Switch your wallet to Cardano mainnet and connect again.'));
    render(<CardanoWalletPanel />);
    await user.click(await screen.findByRole('button', { name: /Eternl/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Switch your wallet to Cardano mainnet and connect again.');
    expect(mockConnect).toHaveBeenCalledWith('eternl');
  });

  it('needs the attestation before signing, then links and confirms', async () => {
    const user = userEvent.setup();
    mockLink.mockResolvedValueOnce({ wallet_address: STAKE, chain_namespace: 'cip34' });
    render(<CardanoWalletPanel />);
    await connectEternl(user);

    const sign = screen.getByRole('button', { name: 'Sign and link' });
    expect(sign).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /not a resident or citizen of the United States or Canada/ }));
    expect(sign).toBeEnabled();
    await user.click(sign);

    expect(mockLink).toHaveBeenCalledWith({
      connected: expect.objectContaining({ stakeAddress: STAKE }),
      notUsCaPerson: true,
    });
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Wallet linked' })));
    // Back to choosing a wallet for a next link.
    expect(await screen.findByRole('button', { name: /Eternl/ })).toBeInTheDocument();
  });

  it('asks for a payment method when the backend requires one, with a link to add it', async () => {
    const user = userEvent.setup();
    mockLink.mockRejectedValueOnce(new CardanoLinkApiError(402, 'Add a payment method', 'payment_method_required'));
    render(<CardanoWalletPanel />);
    await connectEternl(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Sign and link' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Add a payment method first')).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: 'Add a payment method' })).toHaveAttribute(
      'href',
      '/settings/credits#buy-credits',
    );
    // The connected wallet stays, so the user can try again after adding one.
    expect(screen.getByRole('button', { name: 'Sign and link' })).toBeInTheDocument();
  });

  it('stops the flow for a restricted region', async () => {
    const user = userEvent.setup();
    mockLink.mockRejectedValueOnce(new CardanoLinkApiError(451, 'No', 'region_restricted'));
    render(<CardanoWalletPanel />);
    await connectEternl(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Sign and link' }));

    expect(await screen.findByText('Not available in your region')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign and link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eternl/ })).not.toBeInTheDocument();
  });

  it('shows a cancelled signature as such', async () => {
    const user = userEvent.setup();
    mockLink.mockRejectedValueOnce({ code: 3, info: 'user declined' });
    render(<CardanoWalletPanel />);
    await connectEternl(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Sign and link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The request was cancelled in your wallet.');
  });

  it('lists a linked wallet and unlinks it after confirmation', async () => {
    const user = userEvent.setup();
    mockLinked = { data: [{ wallet_address: STAKE, verified_at: '2026-11-20T10:00:00Z' }], isLoading: false, isError: false };
    mockUnlink.mockResolvedValueOnce(undefined);
    render(<CardanoWalletPanel />);

    const list = screen.getByRole('list', { name: 'Linked wallet' });
    expect(within(list).getByText(STAKE)).toBeInTheDocument();
    expect(within(list).getByText(/Linked Nov 20, 2026/)).toBeInTheDocument();
    expect(screen.getByText('Link another wallet')).toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: 'Unlink' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/will no longer go to this account/)).toBeInTheDocument();
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Unlink' }));
    });
    expect(mockUnlink).toHaveBeenCalledWith(STAKE);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Wallet unlinked' }));
  });

  it('reports a failed unlink', async () => {
    const user = userEvent.setup();
    mockLinked = { data: [{ wallet_address: STAKE, verified_at: null }], isLoading: false, isError: false };
    mockUnlink.mockRejectedValueOnce(new CardanoLinkApiError(503, 'x'));
    render(<CardanoWalletPanel />);
    await user.click(screen.getByRole('button', { name: 'Unlink' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Unlink' }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not unlink wallet', variant: 'destructive' }),
      ),
    );
  });

  it('says when the linked wallets cannot be loaded', () => {
    mockLinked = { data: undefined, isLoading: false, isError: true };
    render(<CardanoWalletPanel />);
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
  });
});
