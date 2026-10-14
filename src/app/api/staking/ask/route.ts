import { NextRequest, NextResponse } from 'next/server';

/**
 * Spend a quoted entitlement on inference through the Gatewayz gateway.
 *
 * ⚠️ CAPS ARE NOT OPTIONAL. This endpoint is backed by a real API key, so an
 * uncapped public route is a stranger's budget to spend. A global cap, a
 * per-IP window and hard prompt/token limits are enforced here, server-side.
 *
 * ⚠️ The key never reaches the browser. That is the whole reason this route
 * exists rather than calling the gateway from the page.
 */
const GATEWAYZ = 'https://api.gatewayz.ai/v1/chat/completions';
const MODEL = process.env.STAKING_DEMO_MODEL ?? 'gpt-4o-mini';
const GLOBAL_CAP = Number(process.env.STAKING_DEMO_GLOBAL_CAP ?? '300');
const PER_IP_IN_WINDOW = 4;
const WINDOW_MS = 60_000;
const MAX_PROMPT = 500;
const MAX_TOKENS = 200;

const g = globalThis as unknown as {
  __stakingCalls?: number;
  __stakingIps?: Map<string, number[]>;
};
g.__stakingCalls ??= 0;
g.__stakingIps ??= new Map();

export async function POST(request: NextRequest) {
  const key = process.env.GATEWAYZ_API_KEY;
  if (!key)
    return NextResponse.json({ error: 'Inference is not configured on this deployment.' });

  let prompt: string, attested: boolean;
  try {
    ({ prompt, attested } = await request.json());
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  // Eligibility gate. A checkbox is the MINIMUM, not real geo-blocking — this
  // page should inherit the fail-closed edge blocklist before being promoted.
  if (!attested)
    return NextResponse.json({ error: 'Please confirm the eligibility statement first.' });

  prompt = (prompt ?? '').trim().slice(0, MAX_PROMPT);
  if (!prompt) return NextResponse.json({ error: 'Empty prompt.' });

  if ((g.__stakingCalls ?? 0) >= GLOBAL_CAP)
    return NextResponse.json({ error: 'Demo call budget reached — this is a capped preview.' });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const hits = (g.__stakingIps!.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= PER_IP_IN_WINDOW)
    return NextResponse.json({ error: 'Slow down — a few calls a minute per visitor.' });

  // Reserve the slot BEFORE the paid call, with no await between check and
  // reserve, so a concurrent burst on this instance cannot all pass the checks.
  // These counters are per serverless instance; the hard ceiling across
  // instances is the credit balance on the dedicated GATEWAYZ_API_KEY.
  hits.push(now);
  g.__stakingIps!.set(ip, hits);
  g.__stakingCalls = (g.__stakingCalls ?? 0) + 1;
  const release = () => {
    g.__stakingCalls = Math.max(0, (g.__stakingCalls ?? 1) - 1);
    const kept = g.__stakingIps!.get(ip) ?? [];
    const i = kept.indexOf(now);
    if (i !== -1) kept.splice(i, 1);
  };

  try {
    const res = await fetch(GATEWAYZ, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: MAX_TOKENS,
      }),
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) {
      release();
      return NextResponse.json({
        error: `The gateway refused the request (${res.status}).`,
        detail: typeof data?.error?.message === 'string' ? data.error.message : undefined,
      });
    }

    const usage = data.usage ?? {};
    return NextResponse.json({
      reply: data.choices?.[0]?.message?.content ?? '',
      usage,
      spentLovelace: Math.max(1, (usage.total_tokens ?? 1) * 10),
      model: data.model ?? MODEL,
      callsLeft: GLOBAL_CAP - (g.__stakingCalls ?? 0),
    });
  } catch (e) {
    release();
    return NextResponse.json({ error: `Gateway unreachable: ${(e as Error).message}` });
  }
}
