"use client";

// "Save a card / auto top-up" on Settings > Credits. Renders nothing unless the
// build flag is on (src/lib/card-auto-topup/flag.ts) and the backend reports the
// feature as enabled for the account.
//
// Saving a card goes through Stripe Checkout in setup mode: the app never sees
// the card number. When the paid balance (after any discount credits) cannot
// cover a request, the backend charges the saved card for the chosen amount,
// at most the daily limit per UTC day.
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CardAutoTopUpError, type CardAutoTopUpStatus } from '@/lib/card-auto-topup/api';
import { isCardAutoTopUpEnabled } from '@/lib/card-auto-topup/flag';
import {
  useCardAutoTopUp,
  useConfirmCardSetup,
  useRemoveSavedCard,
  useSetAutoTopUp,
  useStartCardSetup,
} from '@/lib/card-auto-topup/use-card-auto-topup';

export const TITLE = 'Saved card and auto top-up';
export const DESCRIPTION =
  'When your balance cannot cover a request, we add credits by charging your saved card. ' +
  'You choose the amount and a daily limit.';

const PAUSED_TEXT: Record<string, string> = {
  declined: 'Your last automatic top-up was declined, so auto top-up is paused.',
  requires_action:
    'Your bank asked to confirm your last automatic top-up, which cannot be done automatically, so auto top-up is paused.',
  card_unusable: 'Your saved card can no longer be charged, so auto top-up is paused.',
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "20" or "20.5" -> cents; null when not a positive amount with at most 2 decimals. */
export function parseDollarsToCents(value: string): number | null {
  const v = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}

function errorText(error: unknown): string {
  if (error instanceof CardAutoTopUpError) {
    if (error.code === 'card_required') return 'Save a card first.';
    if (error.code === 'invalid_amount' || error.code === 'invalid_daily_limit') return 'That amount is outside the allowed range.';
  }
  return 'Something went wrong. Please try again.';
}

function SavedCardLine({ status }: { status: CardAutoTopUpStatus }) {
  const card = status.card;
  if (!card) return <p className="text-sm text-muted-foreground">No card saved.</p>;
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card';
  const expiry =
    card.exp_month && card.exp_year ? ` (expires ${String(card.exp_month).padStart(2, '0')}/${card.exp_year})` : '';
  return (
    <p className="text-sm">
      {brand} ending in {card.last4 ?? '••••'}
      {expiry}
    </p>
  );
}

function SettingsForm({ status }: { status: CardAutoTopUpStatus }) {
  const id = useId();
  const auto = status.auto_topup;
  const limits = status.limits;
  const [enabled, setEnabled] = useState(auto?.enabled ?? false);
  const [amount, setAmount] = useState(((auto?.amount_cents ?? limits.default_amount_cents) / 100).toFixed(2));
  const [limit, setLimit] = useState(((auto?.daily_limit_cents ?? limits.max_daily_limit_cents) / 100).toFixed(2));
  const [invalid, setInvalid] = useState<string | null>(null);
  const save = useSetAutoTopUp();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseDollarsToCents(amount);
    const limitCents = parseDollarsToCents(limit);
    if (amountCents === null || amountCents < limits.min_amount_cents || amountCents > limits.max_amount_cents) {
      setInvalid(`Top-up amount must be between ${dollars(limits.min_amount_cents)} and ${dollars(limits.max_amount_cents)}.`);
      return;
    }
    if (limitCents === null || limitCents > limits.max_daily_limit_cents) {
      setInvalid(`Daily limit must be at most ${dollars(limits.max_daily_limit_cents)}.`);
      return;
    }
    setInvalid(null);
    save.mutate({ enabled, amount_cents: amountCents, daily_limit_cents: limitCents });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={`${id}-on`}>Top up automatically</Label>
        <Switch id={`${id}-on`} checked={enabled} onCheckedChange={setEnabled} disabled={!status.card} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-amount`}>Top-up amount (USD)</Label>
          <Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {dollars(limits.min_amount_cents)} to {dollars(limits.max_amount_cents)} each time
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-limit`}>Daily limit (USD)</Label>
          <Input id={`${id}-limit`} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
          <p className="text-xs text-muted-foreground">At most {dollars(limits.max_daily_limit_cents)} per day (UTC)</p>
        </div>
      </div>
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {invalid}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(save.error)}
        </p>
      )}
      {save.isSuccess && <p className="text-sm text-muted-foreground">Saved.</p>}
      <Button type="submit" className="w-fit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}

/** Nothing at all (no hooks, no request) while the build flag is off. */
export function CardAutoTopUpCard() {
  if (!isCardAutoTopUpEnabled()) return null;
  return <CardAutoTopUpCardInner />;
}

function CardAutoTopUpCardInner() {
  const query = useCardAutoTopUp();
  const confirm = useConfirmCardSetup();
  const remove = useRemoveSavedCard();
  const start = useStartCardSetup();
  const confirmed = useRef(false);

  // Back from Stripe Checkout: store the card, then clean the URL.
  useEffect(() => {
    if (confirmed.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get('card_setup');
    if (!result) return;
    confirmed.current = true;
    const sessionId = params.get('session_id');
    if (result === 'success' && sessionId) confirm.mutate(sessionId);
    params.delete('card_setup');
    params.delete('session_id');
    const rest = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
  }, [confirm]);

  const status = query.data;
  if (!status || !status.feature_enabled) return null;

  const paused = status.auto_topup?.paused_reason;
  const chargedToday = status.auto_topup?.charged_today_cents ?? 0;

  async function onSaveCard() {
    const url = await start.mutateAsync().catch(() => null);
    if (url) window.location.assign(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{TITLE}</CardTitle>
        <CardDescription>{DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <SavedCardLine status={status} />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onSaveCard} disabled={start.isPending}>
              {status.card ? 'Replace card' : 'Save a card'}
            </Button>
            {status.card && (
              <Button variant="ghost" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Remove
              </Button>
            )}
          </div>
        </div>
        {confirm.isPending && <p className="text-sm text-muted-foreground">Saving your card…</p>}
        {(confirm.isError || start.isError || remove.isError) && (
          <p role="alert" className="text-sm text-destructive">
            Something went wrong with your card. Please try again.
          </p>
        )}
        {paused && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
            {PAUSED_TEXT[paused] ?? 'Auto top-up is paused.'} Save a card again or switch it back on to resume.
          </p>
        )}
        {chargedToday > 0 && (
          <p className="text-sm text-muted-foreground">Charged today: {dollars(chargedToday)}</p>
        )}
        <SettingsForm key={JSON.stringify(status.auto_topup)} status={status} />
      </CardContent>
    </Card>
  );
}
