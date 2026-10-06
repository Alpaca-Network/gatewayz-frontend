import { NextRequest, NextResponse } from 'next/server';

/**
 * Entitlement quote for a Cardano stake address.
 *
 * Reads the delegation and the pool's actual rewards from a public indexer and
 * averages the delegator's share across recent SETTLED epochs.
 *
 * Two things this gets right that a naive version would not:
 *  1. It averages across epochs. A pool's rewards swing with how many blocks it
 *     happens to mint — the same delegation measured 27.03 ADA one epoch and
 *     91.52 the next, a 3.4x difference. A single epoch would mislead.
 *  2. It distinguishes a NULL from a zero. The indexer returns NULL aggregates
 *     for settled epochs on some instances; a single read therefore drops
 *     epochs at random and the headline number moves on reload (measured: a 28%
 *     swing). So each epoch is retried. A genuine zero — no blocks minted — is
 *     KEPT in the average, because the delegator genuinely received nothing.
 */
const KOIOS = 'https://api.koios.rest/api/v1';
const EPOCHS_PER_YEAR = 73;
const ADA_USD = Number(process.env.STAKING_ADA_USD ?? '0.207');

async function koios(path: string, body?: unknown) {
  const res = await fetch(`${KOIOS}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`indexer ${res.status}`);
  return res.json();
}

export async function POST(request: NextRequest) {
  let stakeAddress: string;
  try {
    ({ stakeAddress } = await request.json());
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  stakeAddress = (stakeAddress ?? '').trim();

  if (/^0x[0-9a-fA-F]{40}$/.test(stakeAddress)) {
    return NextResponse.json({
      error:
        'That is an Ethereum/Avalanche address. Cardano stake addresses begin with stake1.',
    });
  }
  if (!/^stake1[0-9a-z]{40,}$/.test(stakeAddress)) {
    return NextResponse.json({ error: 'Enter a Cardano stake address (stake1…).' });
  }

  try {
    const acc = await koios('account_info', { _stake_addresses: [stakeAddress] });
    if (!acc?.length) return NextResponse.json({ error: 'Address not found on chain.' });
    const pool = acc[0].delegated_pool;
    const stake = Number(acc[0].total_balance ?? 0);
    if (!pool)
      return NextResponse.json({ error: 'This stake address is not delegated to any pool.' });

    const tip = (await koios('tip'))[0].epoch_no as number;
    const shares: number[] = [];
    const epochs: number[] = [];
    let unavailable = 0;

    for (let ep = tip - 2; ep > tip - 8; ep--) {
      let row: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const rows = await koios(`pool_history?_pool_bech32=${pool}&_epoch_no=${ep}`);
        const cand = rows?.[0] ?? null;
        if (cand && cand.deleg_rewards !== null) { row = cand; break; }
        row = row ?? cand;
      }
      if (!row) continue;
      if (row.deleg_rewards === null) { unavailable++; continue; }

      const D = Number(row.active_stake ?? 0);
      const N = Number(row.deleg_rewards);
      const blocks = Number(row.block_cnt ?? 0);
      if (N === 0 && blocks > 0) continue;        // blocks but no rewards: no data
      if (!D) continue;
      shares.push(Math.floor((N * stake) / D));   // genuine zero stays in
      epochs.push(ep);
    }

    if (!shares.length)
      return NextResponse.json({ error: 'This pool has no settled rewards in recent epochs.' });

    const avg = Math.floor(shares.reduce((a, b) => a + b, 0) / shares.length);
    const adaPerEpoch = avg / 1e6;
    return NextResponse.json({
      pool,
      stakeAda: stake / 1e6,
      epochs,
      sharesAda: shares.map((s) => s / 1e6),
      avgShareAda: adaPerEpoch,
      minShareAda: Math.min(...shares) / 1e6,
      maxShareAda: Math.max(...shares) / 1e6,
      zeroRewardEpochs: shares.filter((s) => s === 0).length,
      epochsUnavailable: unavailable,
      usdPerMonth: (adaPerEpoch * ADA_USD * EPOCHS_PER_YEAR) / 12,
      usdPerYear: adaPerEpoch * ADA_USD * EPOCHS_PER_YEAR,
      adaPrice: ADA_USD,
    });
  } catch (e) {
    return NextResponse.json({ error: `Could not read the chain: ${(e as Error).message}` });
  }
}
