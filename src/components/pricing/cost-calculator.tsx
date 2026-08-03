"use client";

import { useMemo, useState } from 'react';

/**
 * Cost calculator for a model page.
 *
 * Built around the coding-agent workload rather than raw token counts, because
 * "cost per million tokens" is not a number anyone can act on. The inputs are
 * things a developer knows about their own usage — sessions per day, how much
 * context they replay — and the output includes the cache split, which is where
 * the money actually goes on this workload.
 *
 * It shows the uncached comparison alongside, so the saving is visible rather
 * than asserted.
 */

type Props = {
  modelId: string;
  /** USD per input token. */
  inputPrice: number;
  /** USD per output token. */
  outputPrice: number;
  /** Whether this model supports prompt caching through the gateway. */
  supportsCaching: boolean;
  /** Cache read price as a multiple of input price. */
  cacheReadMultiplier?: number;
  /** Cache write price as a multiple of input price. */
  cacheWriteMultiplier?: number;
};

const PRESETS = [
  { label: 'Light — a few tasks a day', sessions: 5, turnsPerSession: 8 },
  { label: 'Steady — most of a working day', sessions: 15, turnsPerSession: 12 },
  { label: 'Heavy — agent running constantly', sessions: 40, turnsPerSession: 20 },
];

function usd(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

export function CostCalculator({
  modelId,
  inputPrice,
  outputPrice,
  supportsCaching,
  cacheReadMultiplier = 0.1,
  cacheWriteMultiplier = 1.25,
}: Props) {
  const [sessions, setSessions] = useState(15);
  const [turnsPerSession, setTurnsPerSession] = useState(12);
  const [contextTokens, setContextTokens] = useState(20000);
  const [outputTokens, setOutputTokens] = useState(600);
  const [useCaching, setUseCaching] = useState(supportsCaching);

  const result = useMemo(() => {
    const turnsPerDay = sessions * turnsPerSession;

    // Without caching every turn pays full input price on the whole context.
    const uncachedDaily =
      turnsPerDay * (contextTokens * inputPrice + outputTokens * outputPrice);

    // With caching the first turn of a session writes the prefix; the rest read
    // it. Only the prefix is cacheable — the varying instruction is not — so a
    // conservative 90% of context is treated as the static prefix.
    const prefix = contextTokens * 0.9;
    const varying = contextTokens - prefix;

    const writeCostPerSession = prefix * inputPrice * cacheWriteMultiplier;
    const readCostPerTurn = prefix * inputPrice * cacheReadMultiplier;

    const cachedDaily =
      sessions * writeCostPerSession +
      turnsPerDay * (readCostPerTurn + varying * inputPrice + outputTokens * outputPrice);

    const daily = useCaching && supportsCaching ? cachedDaily : uncachedDaily;
    const savings = uncachedDaily - cachedDaily;

    return {
      daily,
      monthly: daily * 30,
      uncachedMonthly: uncachedDaily * 30,
      monthlySavings: savings * 30,
      turnsPerDay,
    };
  }, [
    sessions,
    turnsPerSession,
    contextTokens,
    outputTokens,
    useCaching,
    supportsCaching,
    inputPrice,
    outputPrice,
    cacheReadMultiplier,
    cacheWriteMultiplier,
  ]);

  return (
    <div className="rounded-xl border p-6">
      <h2 className="text-lg font-semibold">What this costs you</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Estimated from a coding-agent usage pattern, not raw token counts.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setSessions(preset.sessions);
              setTurnsPerSession(preset.turnsPerSession);
            }}
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Sessions per day</span>
          <input
            type="number"
            min={1}
            value={sessions}
            onChange={(e) => setSessions(Math.max(1, Number(e.target.value) || 1))}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Turns per session</span>
          <input
            type="number"
            min={1}
            value={turnsPerSession}
            onChange={(e) => setTurnsPerSession(Math.max(1, Number(e.target.value) || 1))}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Context replayed per turn (tokens)</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={contextTokens}
            onChange={(e) => setContextTokens(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Output per turn (tokens)</span>
          <input
            type="number"
            min={0}
            step={100}
            value={outputTokens}
            onChange={(e) => setOutputTokens(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
      </div>

      {supportsCaching ? (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useCaching}
            onChange={(e) => setUseCaching(e.target.checked)}
          />
          Use prompt caching
        </label>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {modelId} does not support prompt caching through Gatewayz, so every turn pays full
          input price on the replayed context.
        </p>
      )}

      <div className="mt-6 border-t pt-6">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <p className="text-3xl font-bold">{usd(result.monthly)}</p>
            <p className="text-sm text-muted-foreground">per month</p>
          </div>
          <div>
            <p className="text-lg font-medium">{usd(result.daily)}</p>
            <p className="text-sm text-muted-foreground">per day</p>
          </div>
          <div>
            <p className="text-lg font-medium">{result.turnsPerDay.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">turns per day</p>
          </div>
        </div>

        {supportsCaching && useCaching && result.monthlySavings > 0 && (
          <p className="mt-4 text-sm">
            Without caching the same usage would cost{' '}
            <span className="font-medium">{usd(result.uncachedMonthly)}</span> — caching saves{' '}
            <span className="font-medium">{usd(result.monthlySavings)}</span> a month.
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          An estimate, not a quote. It assumes 90% of your replayed context is a stable prefix
          that caches, which is typical for a coding agent but depends on how your tool builds
          its prompt. Your bill is metered on actual tokens.
        </p>
      </div>
    </div>
  );
}
