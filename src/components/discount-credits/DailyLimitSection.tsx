"use client";

// The daily limit on discount credits: how much of the balance has been used
// today (UTC), a pending higher limit, and a form to change the limit.
// Rendered by DiscountCreditsCard only when the backend sends a daily limit.
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { DAILY_CAP_MAX_USD, type DiscountCreditsDailyCap } from '@/lib/discount-credits/api';
import { useSetDiscountCreditsDailyCap } from '@/lib/discount-credits/use-discount-credits';
import {
  DAILY_LIMIT_HELP,
  DAILY_LIMIT_INPUT_LABEL,
  DAILY_LIMIT_INVALID,
  DAILY_LIMIT_RESETS,
  DAILY_LIMIT_SAVE,
  DAILY_LIMIT_SAVE_FAILED,
  DAILY_LIMIT_SAVED_NOW,
  DAILY_LIMIT_SAVED_SCHEDULED,
  DAILY_LIMIT_TITLE,
  dailyLimitPendingLine,
  dailyLimitUsedLine,
} from './discount-copy';

/** The same range the backend accepts: 0 to 1,000,000 with up to 6 decimals. */
function isValidLimit(value: string): boolean {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return false;
  return Number(value) <= DAILY_CAP_MAX_USD;
}

/** Share of today's limit already used, 0..100. A limit of 0 is reached from the start. */
function usedPercent(cap: DiscountCreditsDailyCap): number {
  if (cap.daily_cap_usd <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((cap.used_today_usd / cap.daily_cap_usd) * 100)));
}

export function DailyLimitSection({ dailyCap }: { dailyCap: DiscountCreditsDailyCap }) {
  const id = useId();
  const [value, setValue] = useState(String(dailyCap.daily_cap_usd));
  const [invalid, setInvalid] = useState(false);
  const save = useSetDiscountCreditsDailyCap();

  const usedLine = dailyLimitUsedLine(dailyCap.used_today_usd, dailyCap.daily_cap_usd);
  const percent = usedPercent(dailyCap);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = value.trim();
    if (!isValidLimit(next)) {
      save.reset();
      setInvalid(true);
      return;
    }
    setInvalid(false);
    save.mutate(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 id={`${id}-title`} className="text-sm font-semibold">{DAILY_LIMIT_TITLE}</h4>

      <div className="flex flex-col gap-1">
        <p className="text-sm tabular-nums">{usedLine}</p>
        <Progress
          value={percent}
          aria-labelledby={`${id}-title`}
          aria-valuenow={percent}
          aria-valuetext={usedLine}
          className="h-2"
        />
        <p className="text-xs text-muted-foreground">{DAILY_LIMIT_RESETS}</p>
        {dailyCap.next_daily_cap_usd !== null && (
          <p className="text-xs text-muted-foreground">
            {dailyLimitPendingLine(dailyCap.next_daily_cap_usd, dailyCap.next_daily_cap_at, dailyCap.next_daily_cap_from)}
          </p>
        )}
      </div>

      {/* noValidate: the range check below gives one message for every browser. */}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-2">
        <Label htmlFor={`${id}-input`}>{DAILY_LIMIT_INPUT_LABEL}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-input`}
            type="number"
            inputMode="decimal"
            min={0}
            max={DAILY_CAP_MAX_USD}
            step={0.01}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={invalid}
            aria-describedby={`${id}-help`}
            className="max-w-40"
          />
          <Button type="submit" size="sm" disabled={save.isPending}>{DAILY_LIMIT_SAVE}</Button>
        </div>
        <p id={`${id}-help`} className="text-xs text-muted-foreground">{DAILY_LIMIT_HELP}</p>
        {invalid && <p role="alert" className="text-sm text-destructive">{DAILY_LIMIT_INVALID}</p>}
        {!invalid && save.isError && <p role="alert" className="text-sm text-destructive">{DAILY_LIMIT_SAVE_FAILED}</p>}
        {!invalid && save.isSuccess && (
          <p role="status" className="text-sm text-muted-foreground">
            {save.data.status === 'scheduled' ? DAILY_LIMIT_SAVED_SCHEDULED : DAILY_LIMIT_SAVED_NOW}
          </p>
        )}
      </form>
    </div>
  );
}
