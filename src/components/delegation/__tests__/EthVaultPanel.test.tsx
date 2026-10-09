import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { EthVaultPanel } from '../EthVaultPanel';
import { useLinkedWallets } from '@/lib/hooks/use-linked-wallets';
import { useDelegationRewards } from '@/lib/delegation/use-delegation';
import {
  publicClientFor,
  switchToEthereum,
  useEthVaultAction,
  useEthVaultState,
} from '@/lib/delegation/use-eth-vault';
import { estimateNetworkFee } from '@/lib/delegation/eth-vault';
import type { DelegationStatus } from '@/lib/delegation/api';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('@privy-io/react-auth', () => ({ usePrivy: jest.fn(), useWallets: jest.fn() }));
jest.mock('@/lib/hooks/use-linked-wallets', () => ({ useLinkedWallets: jest.fn() }));
jest.mock('@/lib/delegation/use-delegation', () => ({ useDelegationRewards: jest.fn() }));
jest.mock('@/components/holdings/HoldingsWalletLink', () => ({ HoldingsWalletLink: () => <div>wallet-link-card</div> }));
jest.mock('@/lib/delegation/use-eth-vault', () => {
  const actual = jest.requireActual('@/lib/delegation/use-eth-vault');
  return {
    ...actual,
    useEthVaultState: jest.fn(),
    useEthVaultAction: jest.fn(),
    publicClientFor: jest.fn(),
    switchToEthereum: jest.fn(),
  };
});
jest.mock('@/lib/delegation/eth-vault', () => {
  const actual = jest.requireActual('@/lib/delegation/eth-vault');
  return { ...actual, estimateNetworkFee: jest.fn(), assetsToShares: jest.fn() };
});

const VAULT = '0x1111111111111111111111111111111111111111';
const USER = '0x2222222222222222222222222222222222222222';
const ETH = BigInt(10) ** BigInt(18);
const STATUS: DelegationStatus = {
  enabled: true,
  eth: { vault_address: VAULT, chain_id: 1, fee_percent: 99 },
  cardano: { pool_id: null },
  allowance_rates: [],
  disclaimer: '',
};

const wallet = (chainId = 'eip155:1') => ({ address: USER, chainId, walletClientType: 'metamask' });

describe('EthVaultPanel', () => {
  const connectWallet = jest.fn();
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePrivy as jest.Mock).mockReturnValue({ ready: true, connectWallet });
    (useWallets as jest.Mock).mockReturnValue({ wallets: [wallet()] });
    (useLinkedWallets as jest.Mock).mockReturnValue({ isLoading: false, data: [{ wallet_address: USER }] });
    (useDelegationRewards as jest.Mock).mockReturnValue({ data: undefined });
    (useEthVaultAction as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
    (useEthVaultState as jest.Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        position: { shares: ETH, assets: (ETH * BigInt(11)) / BigInt(10), stateUpdateRequired: false, remainingCapacity: null },
        balance: BigInt(5) * ETH,
        exits: [
          {
            positionTicket: BigInt(7),
            timestamp: BigInt(1_700_000_000),
            exitQueueIndex: BigInt(3),
            queuedAssets: BigInt(0),
            exitedAssets: ETH / BigInt(2),
            status: 'claimable',
            claimableAt: 1_700_054_000,
          },
        ],
        exitsError: false,
      },
    });
    (publicClientFor as jest.Mock).mockResolvedValue({});
    (estimateNetworkFee as jest.Mock).mockResolvedValue({ gas: BigInt(100000), fee: BigInt(2_000_000_000_000_000) });
    mutateAsync.mockResolvedValue('0xabc123');
  });

  it('asks for a wallet when none is connected', () => {
    (useWallets as jest.Mock).mockReturnValue({ wallets: [] });
    render(<EthVaultPanel status={STATUS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect a wallet' }));
    expect(connectWallet).toHaveBeenCalled();
  });

  it('requires linking the depositing wallet first', () => {
    (useLinkedWallets as jest.Mock).mockReturnValue({ isLoading: false, data: [] });
    render(<EthVaultPanel status={STATUS} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Link 0x2222...2222 to your Gatewayz account first/);
    expect(screen.getByText('wallet-link-card')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stake ETH')).not.toBeInTheDocument();
  });

  it('switches to Ethereum only on request', async () => {
    (useWallets as jest.Mock).mockReturnValue({ wallets: [wallet('eip155:8453')] });
    render(<EthVaultPanel status={STATUS} />);
    expect(switchToEthereum).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Ethereum' }));
    await waitFor(() => expect(switchToEthereum).toHaveBeenCalled());
  });

  it('shows the position and exit queue', () => {
    render(<EthVaultPanel status={STATUS} />);
    expect(screen.getByText('1.1 ETH')).toBeInTheDocument();
    expect(screen.getByText('5 ETH')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim 0.5 ETH' })).toBeInTheDocument();
  });

  it('confirms a deposit with the fee estimate before sending it', async () => {
    render(<EthVaultPanel status={STATUS} />);
    fireEvent.change(screen.getByLabelText('Stake ETH', { selector: 'input' }), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Stake' }));

    expect(await screen.findByText('up to 0.002 ETH')).toBeInTheDocument();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('0.5 ETH')).toBeInTheDocument();
    expect(within(dialog).getByText('99% of rewards')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ kind: 'deposit', value: ETH / BigInt(2) }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Staked' })));
  });

  it('blocks confirmation when the estimate shows the transaction would fail', async () => {
    (estimateNetworkFee as jest.Mock).mockRejectedValue(new Error('execution reverted: NotHarvested()'));
    render(<EthVaultPanel status={STATUS} />);
    fireEvent.change(screen.getByLabelText('Stake ETH', { selector: 'input' }), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Stake' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/updating its rewards/);
    expect(screen.getByRole('button', { name: 'Confirm in wallet' })).toBeDisabled();
  });

  it('rejects a deposit that leaves nothing for gas', () => {
    render(<EthVaultPanel status={STATUS} />);
    fireEvent.change(screen.getByLabelText('Stake ETH', { selector: 'input' }), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Stake' }));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Not enough ETH' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('exits the full position with Max, and reports a wallet rejection', async () => {
    mutateAsync.mockRejectedValue({ code: 4001 });
    render(<EthVaultPanel status={STATUS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    await screen.findByText('up to 0.002 ETH');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ kind: 'exit', shares: ETH }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'The request was cancelled in your wallet.', variant: 'destructive' }),
      ),
    );
  });

  it('claims an exited request with its ticket, timestamp and queue index', async () => {
    render(<EthVaultPanel status={STATUS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Claim 0.5 ETH' }));
    await screen.findByText('up to 0.002 ETH');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm in wallet' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'claim', request: expect.objectContaining({ positionTicket: BigInt(7) }) }),
      ),
    );
  });
});
