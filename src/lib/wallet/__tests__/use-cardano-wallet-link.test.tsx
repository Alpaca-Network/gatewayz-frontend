import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useLinkCardanoWallet,
  useLinkedCardanoWallets,
  useUnlinkCardanoWallet,
} from '../use-cardano-wallet-link';

const calls: string[] = [];
const mockGet = jest.fn();
const mockNonce = jest.fn();
const mockLink = jest.fn();
const mockUnlink = jest.fn();
const mockSign = jest.fn();

jest.mock('../cardano-link-api', () => ({
  getLinkedCardanoWallets: () => mockGet(),
  requestCardanoLinkNonce: (...a: unknown[]) => mockNonce(...a),
  linkCardanoStakeAddress: (...a: unknown[]) => mockLink(...a),
  unlinkCardanoStakeAddress: (...a: unknown[]) => mockUnlink(...a),
}));
jest.mock('../cardano-wallet', () => ({
  signLinkMessage: (...a: unknown[]) => mockSign(...a),
}));

const FLAG = 'NEXT_PUBLIC_VAULT_DISCOUNT_CREDITS_ENABLED';
const original = process.env[FLAG];
const STAKE = 'stake1uabc';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

describe('use-cardano-wallet-link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
    process.env[FLAG] = 'true';
  });
  afterAll(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  it('never fetches while the build flag is off', () => {
    delete process.env[FLAG];
    const { wrapper } = setup();
    const { result } = renderHook(() => useLinkedCardanoWallets(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('fetches the linked wallets with the flag on', async () => {
    mockGet.mockResolvedValue([{ wallet_address: STAKE, verified_at: null }]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useLinkedCardanoWallets(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ wallet_address: STAKE, verified_at: null }]));
  });

  it('links in order: nonce, signature, link; then refreshes both wallet lists', async () => {
    mockNonce.mockImplementation(async () => {
      calls.push('nonce');
      return { nonce: 'n', message: 'm', payload_hex: '6d', expires_at: null };
    });
    mockSign.mockImplementation(async () => {
      calls.push('sign');
      return { signature: 'sig', key: 'key' };
    });
    mockLink.mockImplementation(async () => {
      calls.push('link');
      return { wallet_address: STAKE, chain_namespace: 'cip34' };
    });
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useLinkCardanoWallet(), { wrapper });
    const connected = { key: 'eternl', wallet: {} as never, stakeAddress: STAKE };
    await act(async () => {
      await result.current.mutateAsync({ connected, notUsCaPerson: true });
    });
    expect(calls).toEqual(['nonce', 'sign', 'link']);
    expect(mockNonce).toHaveBeenCalledWith(STAKE, true);
    expect(mockLink).toHaveBeenCalledWith({ stakeAddress: STAKE, signature: 'sig', key: 'key', notUsCaPerson: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cardano-wallets'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['linked-wallets'] });
  });

  it('does not sign when the nonce is refused', async () => {
    mockNonce.mockRejectedValue(new Error('402'));
    const { wrapper } = setup();
    const { result } = renderHook(() => useLinkCardanoWallet(), { wrapper });
    const connected = { key: 'eternl', wallet: {} as never, stakeAddress: STAKE };
    await act(async () => {
      await expect(result.current.mutateAsync({ connected, notUsCaPerson: true })).rejects.toThrow('402');
    });
    expect(mockSign).not.toHaveBeenCalled();
    expect(mockLink).not.toHaveBeenCalled();
  });

  it('unlinks and refreshes even when the backend says it was not linked', async () => {
    mockUnlink.mockRejectedValue(new Error('404'));
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useUnlinkCardanoWallet(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(STAKE)).rejects.toThrow('404');
    });
    expect(mockUnlink).toHaveBeenCalledWith(STAKE);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cardano-wallets'] });
  });
});
