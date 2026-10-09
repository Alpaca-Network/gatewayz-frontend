import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardanoPoolPanel } from '../CardanoPoolPanel';
import { useDelegationRewards } from '@/lib/delegation/use-delegation';
import { linkCardanoStakeAddress, requestCardanoLinkNonce, type DelegationStatus } from '@/lib/delegation/api';
import {
  buildDelegationTx,
  connectCardanoWallet,
  signAndSubmit,
  signLinkMessage,
} from '@/lib/delegation/cardano-wallet';
import { fetchCardanoAccount, fetchCardanoProtocolParams } from '@/lib/delegation/koios';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('@/lib/delegation/use-delegation', () => {
  const actual = jest.requireActual('@/lib/delegation/use-delegation');
  return { ...actual, useDelegationRewards: jest.fn() };
});
jest.mock('@/lib/delegation/api', () => {
  const actual = jest.requireActual('@/lib/delegation/api');
  return { ...actual, requestCardanoLinkNonce: jest.fn(), linkCardanoStakeAddress: jest.fn() };
});
jest.mock('@/lib/delegation/cardano-wallet', () => {
  const actual = jest.requireActual('@/lib/delegation/cardano-wallet');
  return {
    ...actual,
    connectCardanoWallet: jest.fn(),
    signLinkMessage: jest.fn(),
    buildDelegationTx: jest.fn(),
    signAndSubmit: jest.fn(),
  };
});
jest.mock('@/lib/delegation/koios', () => ({ fetchCardanoAccount: jest.fn(), fetchCardanoProtocolParams: jest.fn() }));

const POOL = 'pool1gatewayzpoolxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const STAKE = 'stake1u9ylzsgxaa6xctf4juup682ar3juj85n8tx3hthnljg47zctvm3rc';
const STATUS: DelegationStatus = {
  enabled: true,
  eth: { vault_address: null, chain_id: 1, fee_percent: null },
  cardano: { pool_id: POOL },
  allowance_rates: [],
  disclaimer: '',
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CardanoPoolPanel status={STATUS} />
    </QueryClientProvider>,
  );
}

const enable = () => Promise.resolve({});

describe('CardanoPoolPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window as unknown as { cardano?: unknown }).cardano = {
      eternl: { name: 'eternl', icon: 'data:image/png;base64,AA', enable },
      lace: { name: 'lace', icon: null, enable },
    };
    (useDelegationRewards as jest.Mock).mockReturnValue({ data: { positions: [] } });
    (connectCardanoWallet as jest.Mock).mockResolvedValue({ key: 'eternl', wallet: {}, stakeAddress: STAKE });
    (fetchCardanoAccount as jest.Mock).mockResolvedValue({ registered: false, delegatedPool: null, totalLovelace: BigInt(0) });
    (fetchCardanoProtocolParams as jest.Mock).mockResolvedValue(null);
    (requestCardanoLinkNonce as jest.Mock).mockResolvedValue({ nonce: 'n', message: 'Link stake1u...', expires_at: null });
    (signLinkMessage as jest.Mock).mockResolvedValue({ signature: '84a4', key: 'a401' });
    (linkCardanoStakeAddress as jest.Mock).mockResolvedValue(undefined);
    (buildDelegationTx as jest.Mock).mockResolvedValue({
      unsignedTx: 'cbor',
      feeLovelace: BigInt(180_000),
      depositLovelace: BigInt(2_000_000),
    });
    (signAndSubmit as jest.Mock).mockResolvedValue('a'.repeat(64));
  });
  afterEach(() => {
    delete (window as unknown as { cardano?: unknown }).cardano;
  });

  it('says so when no CIP-30 wallet is installed', async () => {
    delete (window as unknown as { cardano?: unknown }).cardano;
    renderPanel();
    expect(await screen.findByText(/No Cardano wallet found/)).toBeInTheDocument();
  });

  it('connects, links via nonce -> signData -> link, then delegates with a confirmed fee', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Connect eternl/ }));
    await waitFor(() => expect(connectCardanoWallet).toHaveBeenCalledWith('eternl'));
    expect(await screen.findByText('Not delegated to any pool yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Link with a signature' }));
    await waitFor(() => expect(linkCardanoStakeAddress).toHaveBeenCalledWith({ stakeAddress: STAKE, signature: '84a4', key: 'a401' }));
    expect(requestCardanoLinkNonce).toHaveBeenCalledWith(STAKE);
    expect(signLinkMessage).toHaveBeenCalledWith(expect.objectContaining({ stakeAddress: STAKE }), 'Link stake1u...');

    fireEvent.click(await screen.findByRole('button', { name: 'Delegate to Gatewayz' }));
    expect(await screen.findByText('0.18 ADA + 2 ADA refundable deposit')).toBeInTheDocument();
    expect(buildDelegationTx).toHaveBeenCalledWith(expect.anything(), { poolId: POOL, registered: false, params: null });
    expect(signAndSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in wallet' }));
    await waitFor(() => expect(signAndSubmit).toHaveBeenCalledWith(expect.anything(), 'cbor'));
    expect(await screen.findByText(/View .* on Cardanoscan/)).toBeInTheDocument();
  });

  it('treats an address with an ADA position as linked and shows current delegation to our pool', async () => {
    (useDelegationRewards as jest.Mock).mockReturnValue({
      data: { positions: [{ asset: 'ADA', wallet_address: STAKE, amount: 10, usd_value: 3, measured_at: null }] },
    });
    (fetchCardanoAccount as jest.Mock).mockResolvedValue({
      registered: true,
      delegatedPool: POOL,
      totalLovelace: BigInt(10_000_000),
    });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Connect eternl/ }));
    expect(await screen.findByText(/Delegating 10 ADA to the Gatewayz pool/)).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.getByText('Delegated to Gatewayz')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link with a signature' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delegate to Gatewayz' })).not.toBeInTheDocument();
  });

  it('reports a declined signature without linking', async () => {
    (signLinkMessage as jest.Mock).mockRejectedValue({ code: 3, info: 'user declined' });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Connect eternl/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Link with a signature' }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not link', description: 'The signature request was cancelled.' }),
      ),
    );
    expect(linkCardanoStakeAddress).not.toHaveBeenCalled();
  });
});
