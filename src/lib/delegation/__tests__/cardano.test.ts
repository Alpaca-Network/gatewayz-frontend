import { detectCip30Wallets, isCip30Rejection } from '../cip30';
import { fetchCardanoAccount, fetchCardanoProtocolParams } from '../koios';
import { formatAda, formatEth, parseEthInput } from '../format';
import {
  buildDelegationTx,
  CardanoWalletError,
  connectCardanoWallet,
  signAndSubmit,
  signLinkMessage,
  type ConnectedCardanoWallet,
} from '../cardano-wallet';

const mockEnable = jest.fn();
jest.mock('@meshsdk/wallet', () => ({
  BrowserWallet: { enable: (...args: unknown[]) => mockEnable(...args) },
}));

const builderCalls: string[] = [];
jest.mock('@meshsdk/transaction', () => ({
  MeshTxBuilder: class {
    meshTxBuilderBody = { fee: '0' };
    constructor(public opts: unknown) {}
    registerStakeCertificate(addr: string) {
      builderCalls.push(`register:${addr}`);
      return this;
    }
    delegateStakeCertificate(addr: string, pool: string) {
      builderCalls.push(`delegate:${addr}:${pool}`);
      return this;
    }
    selectUtxosFrom() {
      return this;
    }
    changeAddress(addr: string) {
      builderCalls.push(`change:${addr}`);
      return this;
    }
    async complete() {
      this.meshTxBuilderBody.fee = '180000';
      return 'unsigned-cbor';
    }
  },
}));

const STAKE = 'stake1uxyz';

function fakeWallet(over: Record<string, unknown> = {}) {
  return {
    getNetworkId: jest.fn().mockResolvedValue(1),
    getRewardAddresses: jest.fn().mockResolvedValue([STAKE]),
    getUtxos: jest.fn().mockResolvedValue([{ input: {}, output: {} }]),
    getChangeAddress: jest.fn().mockResolvedValue('addr1change'),
    signData: jest.fn().mockResolvedValue({ signature: '84a4', key: 'a401' }),
    signTx: jest.fn().mockResolvedValue('signed-cbor'),
    submitTx: jest.fn().mockResolvedValue('txhash'),
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
    builderCalls.length = 0;
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

  it('registers an unregistered stake key, then delegates, and reports fee + deposit', async () => {
    const wallet = fakeWallet();
    const connected = { key: 'eternl', wallet, stakeAddress: STAKE } as unknown as ConnectedCardanoWallet;
    const tx = await buildDelegationTx(connected, { poolId: 'pool1abc', registered: false, params: null });
    expect(builderCalls).toEqual([`register:${STAKE}`, `delegate:${STAKE}:pool1abc`, 'change:addr1change']);
    expect(tx).toEqual({ unsignedTx: 'unsigned-cbor', feeLovelace: BigInt(180000), depositLovelace: BigInt(2_000_000) });
    expect(wallet.signTx).not.toHaveBeenCalled();
  });

  it('only delegates a registered key, with no deposit', async () => {
    const connected = { key: 'x', wallet: fakeWallet(), stakeAddress: STAKE } as unknown as ConnectedCardanoWallet;
    const tx = await buildDelegationTx(connected, { poolId: 'pool1abc', registered: true, params: null });
    expect(builderCalls).toEqual([`delegate:${STAKE}:pool1abc`, 'change:addr1change']);
    expect(tx.depositLovelace).toBe(BigInt(0));
  });

  it('fails clearly with no UTxOs', async () => {
    const connected = {
      key: 'x',
      wallet: fakeWallet({ getUtxos: jest.fn().mockResolvedValue([]) }),
      stakeAddress: STAKE,
    } as unknown as ConnectedCardanoWallet;
    await expect(buildDelegationTx(connected, { poolId: 'p', registered: true, params: null })).rejects.toThrow(
      /no ADA/,
    );
  });

  it('signs in the wallet and submits through it', async () => {
    const wallet = fakeWallet();
    const connected = { key: 'x', wallet, stakeAddress: STAKE } as unknown as ConnectedCardanoWallet;
    await expect(signAndSubmit(connected, 'unsigned-cbor')).resolves.toBe('txhash');
    expect(wallet.signTx).toHaveBeenCalledWith('unsigned-cbor');
    expect(wallet.submitTx).toHaveBeenCalledWith('signed-cbor');
  });
});

describe('koios', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses account_info', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ status: 'registered', delegated_pool: 'pool1abc', total_balance: '12500000' }],
    });
    await expect(fetchCardanoAccount(STAKE)).resolves.toEqual({
      registered: true,
      delegatedPool: 'pool1abc',
      totalLovelace: BigInt(12_500_000),
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.koios.rest/api/v1/account_info');
    expect(JSON.parse(init.body)).toEqual({ _stake_addresses: [STAKE] });
  });

  it('treats an unseen stake address as unregistered', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    await expect(fetchCardanoAccount(STAKE)).resolves.toMatchObject({ registered: false, delegatedPool: null });
  });

  it('maps protocol params, and falls back to null on failure', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ txFeePerByte: 44, txFeeFixed: 155381, stakeAddressDeposit: 2000000, utxoCostPerByte: 4310, maxTxSize: 16384 }),
    });
    await expect(fetchCardanoProtocolParams()).resolves.toEqual({
      minFeeA: 44,
      minFeeB: 155381,
      keyDeposit: 2000000,
      coinsPerUtxoSize: 4310,
      maxTxSize: 16384,
    });
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchCardanoProtocolParams()).resolves.toBeNull();
  });
});

describe('format', () => {
  it('formats ETH and ADA', () => {
    expect(formatEth(BigInt('1234500000000000000'))).toBe('1.2345 ETH');
    expect(formatEth(BigInt(0))).toBe('0 ETH');
    expect(formatAda(BigInt(2_180_000))).toBe('2.18 ADA');
    expect(formatAda(BigInt(1_000_000_000_000))).toBe('1,000,000 ADA');
  });

  it('parses only positive decimal ETH input', () => {
    expect(parseEthInput('0.5')).toBe(BigInt('500000000000000000'));
    expect(parseEthInput('.5')).toBe(BigInt('500000000000000000'));
    expect(parseEthInput('1.')).toBe(BigInt('1000000000000000000'));
    for (const bad of ['', '0', '-1', 'abc', '1e3', '1.2.3']) expect(parseEthInput(bad)).toBeNull();
  });
});
