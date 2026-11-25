import { detectCip30Wallets, isCip30Rejection } from '../cip30';
import { cardanoNetworkConfig, toCardanoNetwork } from '../cardano-network';
import {
  CardanoWalletError,
  connectCardanoWallet,
  describeCardanoError,
  signLinkMessage,
  type ConnectedCardanoWallet,
} from '../cardano-wallet';

const mockEnable = jest.fn();
jest.mock('@meshsdk/wallet', () => ({
  BrowserWallet: { enable: (...args: unknown[]) => mockEnable(...args) },
}));

const STAKE = 'stake1uxyz';

function fakeWallet(over: Record<string, unknown> = {}) {
  return {
    getNetworkId: jest.fn().mockResolvedValue(1),
    getRewardAddresses: jest.fn().mockResolvedValue([STAKE]),
    signData: jest.fn().mockResolvedValue({ signature: '84a4', key: 'a401' }),
    ...over,
  };
}

describe('detectCip30Wallets', () => {
  it('lists CIP-30 wallets, preferred first, and drops aliases and non-wallets', () => {
    const enable = () => Promise.resolve({});
    const wallets = detectCip30Wallets({
      cardano: {
        zzz: { name: 'Zed', icon: 'data:z', enable },
        lace: { name: 'lace', icon: 'data:l', enable },
        eternl: { name: 'eternl', icon: 'data:e', enable },
        ccvault: { name: 'eternl', icon: 'data:e', enable },
        cip95: { enable },
        broken: { name: 'Broken' },
      },
    });
    expect(wallets.map((w) => w.key)).toEqual(['eternl', 'lace', 'zzz']);
  });

  it('returns nothing without window.cardano', () => {
    expect(detectCip30Wallets({})).toEqual([]);
    expect(detectCip30Wallets(undefined)).toEqual([]);
  });

  it('recognizes CIP-30 refusals', () => {
    expect(isCip30Rejection({ code: -3, info: 'user declined' })).toBe(true);
    expect(isCip30Rejection({ code: 2 })).toBe(true);
    expect(isCip30Rejection({ code: -2, info: 'internal' })).toBe(false);
  });
});

describe('cardano wallet actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('connects on mainnet and reads the stake address', async () => {
    mockEnable.mockResolvedValue(fakeWallet());
    const connected = await connectCardanoWallet('eternl');
    expect(mockEnable).toHaveBeenCalledWith('eternl');
    expect(connected.stakeAddress).toBe(STAKE);
  });

  it('refuses a testnet wallet', async () => {
    mockEnable.mockResolvedValue(fakeWallet({ getNetworkId: jest.fn().mockResolvedValue(0) }));
    await expect(connectCardanoWallet('lace')).rejects.toBeInstanceOf(CardanoWalletError);
  });

  it('connects on preprod only when asked for preprod', async () => {
    const testStake = 'stake_test1uqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    mockEnable.mockResolvedValue(
      fakeWallet({
        getNetworkId: jest.fn().mockResolvedValue(0),
        getRewardAddresses: jest.fn().mockResolvedValue([testStake]),
      }),
    );
    await expect(connectCardanoWallet('lace', 'preprod')).resolves.toMatchObject({ stakeAddress: testStake });
    await expect(connectCardanoWallet('lace')).rejects.toThrow(/mainnet/);
  });

  it('refuses a mainnet wallet on preprod', async () => {
    mockEnable.mockResolvedValue(fakeWallet());
    await expect(connectCardanoWallet('eternl', 'preprod')).rejects.toThrow(/preprod/);
  });

  it('refuses a script stake address, which cannot sign', async () => {
    mockEnable.mockResolvedValue(
      fakeWallet({ getRewardAddresses: jest.fn().mockResolvedValue(['stake17yqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr0rjsu']) }),
    );
    await expect(connectCardanoWallet('lace')).rejects.toThrow(/script stake address/);
  });

  it("signs the backend's payload_hex as-is with the stake address", async () => {
    const wallet = fakeWallet();
    const connected = { key: 'eternl', wallet, stakeAddress: STAKE } as unknown as ConnectedCardanoWallet;
    await expect(signLinkMessage(connected, { message: 'Link this', payload_hex: '4c696e6b2074686973' })).resolves.toEqual({
      signature: '84a4',
      key: 'a401',
    });
    expect(wallet.signData).toHaveBeenCalledWith('4c696e6b2074686973', STAKE, false);
  });

  it('falls back to the UTF-8 message when payload_hex is missing', async () => {
    const wallet = fakeWallet();
    const connected = { key: 'eternl', wallet, stakeAddress: STAKE } as unknown as ConnectedCardanoWallet;
    await signLinkMessage(connected, { message: 'Link this', payload_hex: null });
    expect(wallet.signData).toHaveBeenCalledWith('Link this', STAKE);
  });

  it('describes connect and signature failures', () => {
    expect(describeCardanoError(new CardanoWalletError('Switch networks.'))).toBe('Switch networks.');
    expect(describeCardanoError({ code: -3 })).toMatch(/cancelled in your wallet/);
    expect(describeCardanoError(new Error('boom'))).toMatch(/Something went wrong/);
  });
});

describe('cardano network', () => {
  it('treats anything but "preprod" as mainnet', () => {
    expect(toCardanoNetwork('preprod')).toBe('preprod');
    for (const network of ['mainnet', 'preview', 'PREPROD', '', null, 1]) {
      expect(toCardanoNetwork(network)).toBe('mainnet');
    }
  });

  it('knows each network id and stake address prefix', () => {
    expect(cardanoNetworkConfig()).toEqual({ walletNetworkId: 1, stakeAddressPrefix: 'stake1u' });
    expect(cardanoNetworkConfig('preprod')).toEqual({ walletNetworkId: 0, stakeAddressPrefix: 'stake_test1u' });
  });
});
