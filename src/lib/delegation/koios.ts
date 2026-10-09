// Read-only Cardano chain lookups via Koios's public, keyless API. Used for the
// two facts a CIP-30 wallet cannot tell us: whether the stake key is already
// registered (a registration certificate and its 2 ADA deposit are needed if
// not) and which pool it delegates to now. api.koios.rest is allowed in the CSP
// connect-src for exactly this.
export const KOIOS_BASE_URL = 'https://api.koios.rest/api/v1';

export interface CardanoAccountInfo {
  registered: boolean;
  /** Bech32 pool id the stake key delegates to, or null. */
  delegatedPool: string | null;
  /** Total controlled ADA in lovelace (UTxOs + rewards). */
  totalLovelace: bigint;
}

export interface CardanoProtocolParams {
  minFeeA: number;
  minFeeB: number;
  keyDeposit: number;
  coinsPerUtxoSize: number;
  maxTxSize: number;
}

async function koiosPost(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${KOIOS_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Koios ${path} returned ${response.status}`);
  return response.json();
}

export async function fetchCardanoAccount(stakeAddress: string): Promise<CardanoAccountInfo> {
  const rows = await koiosPost('/account_info', { _stake_addresses: [stakeAddress] });
  const row = (Array.isArray(rows) ? rows[0] : null) as
    | { status?: unknown; delegated_pool?: unknown; total_balance?: unknown }
    | null;
  // An address that has never been seen on chain is not returned at all.
  if (!row) return { registered: false, delegatedPool: null, totalLovelace: BigInt(0) };
  let totalLovelace = BigInt(0);
  try {
    totalLovelace = BigInt(String(row.total_balance ?? '0'));
  } catch {
    totalLovelace = BigInt(0);
  }
  return {
    registered: row.status === 'registered',
    delegatedPool: typeof row.delegated_pool === 'string' && row.delegated_pool ? row.delegated_pool : null,
    totalLovelace,
  };
}

/** Current-epoch fee parameters; null when Koios is unreachable (Mesh's defaults apply). */
export async function fetchCardanoProtocolParams(): Promise<CardanoProtocolParams | null> {
  try {
    const response = await fetch(`${KOIOS_BASE_URL}/cli_protocol_params`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const p = (await response.json()) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const minFeeA = num(p.txFeePerByte);
    const minFeeB = num(p.txFeeFixed);
    const keyDeposit = num(p.stakeAddressDeposit);
    const coinsPerUtxoSize = num(p.utxoCostPerByte);
    const maxTxSize = num(p.maxTxSize);
    if (minFeeA === null || minFeeB === null || keyDeposit === null || coinsPerUtxoSize === null || maxTxSize === null) {
      return null;
    }
    return { minFeeA, minFeeB, keyDeposit, coinsPerUtxoSize, maxTxSize };
  } catch {
    return null;
  }
}
