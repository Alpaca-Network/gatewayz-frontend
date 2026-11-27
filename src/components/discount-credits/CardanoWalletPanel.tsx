"use client";

// The discount credits wallet page: the account's linked Cardano stake
// addresses (with unlink), and linking one: pick a CIP-30 wallet, connect it
// (the network is checked there), confirm the US / Canada attestation, sign
// one message with the stake key (CIP-8) and link. Rendered by
// src/app/settings/credits/wallet/page.tsx only while the discount credits
// build flag is on (src/lib/discount-credits/flag.ts).
import Link from 'next/link';
import { useCallback, useEffect, useId, useState } from 'react';
import { ArrowLeft, Copy, ShieldCheck, Wallet as WalletIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  cardanoLinkRefusalOf,
  describeCardanoLinkError,
  describeCardanoUnlinkError,
  isPaymentMethodRequired,
  CardanoLinkApiError,
  type LinkedCardanoWallet,
} from '@/lib/wallet/cardano-link-api';
import { connectCardanoWallet, describeCardanoError, type ConnectedCardanoWallet } from '@/lib/wallet/cardano-wallet';
import { detectCip30Wallets, type Cip30WalletInfo } from '@/lib/wallet/cip30';
import {
  useLinkCardanoWallet,
  useLinkedCardanoWallets,
  useUnlinkCardanoWallet,
} from '@/lib/wallet/use-cardano-wallet-link';
import * as copy from './wallet-copy';

/** Wallet extensions inject `window.cardano.*` after page load; look again a little later. */
const REDETECT_DELAYS_MS = [400, 1500];

type Problem =
  | { kind: 'payment_method' }
  | { kind: 'region'; message: string }
  | { kind: 'attestation'; message: string }
  | { kind: 'error'; message: string };

function problemFromLinkError(error: unknown): Problem {
  if (isPaymentMethodRequired(error)) return { kind: 'payment_method' };
  const refusal = cardanoLinkRefusalOf(error);
  if (refusal === 'region_restricted') return { kind: 'region', message: describeCardanoLinkError(error) };
  if (refusal === 'attestation_required') return { kind: 'attestation', message: describeCardanoLinkError(error) };
  // Wallet-side failures (wrong network, cancelled, script address) have their own copy.
  if (error instanceof CardanoLinkApiError) return { kind: 'error', message: describeCardanoLinkError(error) };
  return { kind: 'error', message: describeCardanoError(error) };
}

function ProblemAlert({ problem }: { problem: Problem }) {
  if (problem.kind === 'payment_method') {
    return (
      <Alert>
        <AlertTitle>{copy.PAYMENT_METHOD_TITLE}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <p>{copy.PAYMENT_METHOD_BODY}</p>
          <Button asChild size="sm">
            <Link href={copy.ADD_PAYMENT_METHOD_PATH}>{copy.PAYMENT_METHOD_CTA}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (problem.kind === 'region') {
    return (
      <Alert variant="destructive">
        <AlertTitle>{copy.REGION_TITLE}</AlertTitle>
        <AlertDescription>{problem.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertTitle>{copy.LINK_FAILED}</AlertTitle>
      <AlertDescription>{problem.message}</AlertDescription>
    </Alert>
  );
}

function WalletLogo({ icon }: { icon: string | null }) {
  // Wallet icons are data: URIs the extension provides; anything else is not loaded.
  if (icon && icon.startsWith('data:image/')) {
    return <img src={icon} alt="" className="h-8 w-8 shrink-0 rounded-md" />;
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted" aria-hidden="true">
      <WalletIcon className="h-4 w-4 text-muted-foreground" />
    </span>
  );
}

function LinkedWalletRow({ wallet, onUnlink }: { wallet: LinkedCardanoWallet; onUnlink: (address: string) => void }) {
  const { toast } = useToast();
  const since = copy.formatLinkedDate(wallet.verified_at);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(wallet.wallet_address);
      toast({ title: copy.COPIED });
    } catch {
      // Clipboard can be blocked; the address is still shown in full on hover / to screen readers.
    }
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
          <WalletIcon className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-sm" title={wallet.wallet_address}>
            <span aria-hidden="true">{copy.shortStakeAddress(wallet.wallet_address)}</span>
            <span className="sr-only">{wallet.wallet_address}</span>
          </span>
          {since && (
            <span className="text-xs text-muted-foreground">
              {copy.LINKED_SINCE} {since}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onCopy} aria-label={copy.COPY_ADDRESS}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-10 text-destructive hover:text-destructive"
          onClick={() => onUnlink(wallet.wallet_address)}
        >
          {copy.UNLINK}
        </Button>
      </div>
    </li>
  );
}

function LinkedWallets({
  wallets,
  isLoading,
  isError,
  onUnlink,
}: {
  wallets: LinkedCardanoWallet[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onUnlink: (address: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{copy.LINKED_TITLE}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive">{copy.LINKED_LOAD_FAILED}</p>
        ) : !wallets || wallets.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{copy.LINKED_NONE}</p>
        ) : (
          <ul className="divide-y rounded-lg border" aria-label={copy.LINKED_TITLE}>
            {wallets.map((w) => (
              <LinkedWalletRow key={w.wallet_address} wallet={w} onUnlink={onUnlink} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StepHeading({ n, children, id }: { n: number; children: React.ReactNode; id?: string }) {
  return (
    <h3 id={id} className="flex items-center gap-2 text-sm font-semibold">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground" aria-hidden="true">
        {n}
      </span>
      {children}
    </h3>
  );
}

function LinkFlow({ hasLinked }: { hasLinked: boolean }) {
  const id = useId();
  const { toast } = useToast();
  const link = useLinkCardanoWallet();
  const [wallets, setWallets] = useState<Cip30WalletInfo[] | null>(null);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
  const [connected, setConnected] = useState<ConnectedCardanoWallet | null>(null);
  const [attested, setAttested] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const detect = useCallback(() => setWallets(detectCip30Wallets()), []);

  useEffect(() => {
    detect();
    const timers = REDETECT_DELAYS_MS.map((ms) => setTimeout(detect, ms));
    return () => timers.forEach(clearTimeout);
  }, [detect]);

  async function onChoose(wallet: Cip30WalletInfo) {
    setProblem(null);
    setConnectingKey(wallet.key);
    try {
      setConnected(await connectCardanoWallet(wallet.key));
    } catch (error) {
      setProblem({ kind: 'error', message: describeCardanoError(error) });
    } finally {
      setConnectingKey(null);
    }
  }

  function onReset() {
    setConnected(null);
    setProblem(null);
    link.reset();
  }

  async function onSign() {
    if (!connected || !attested) return;
    setProblem(null);
    try {
      await link.mutateAsync({ connected, notUsCaPerson: true });
      toast({ title: copy.LINKED_OK, description: copy.shortStakeAddress(connected.stakeAddress) });
      setConnected(null);
      setAttested(false);
    } catch (error) {
      setProblem(problemFromLinkError(error));
    }
  }

  const regionBlocked = problem?.kind === 'region';
  const names = wallets ?? [];
  const chosenName = connected ? names.find((w) => w.key === connected.key)?.name ?? connected.key : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{hasLinked ? copy.LINK_ANOTHER_TITLE : copy.LINK_TITLE}</CardTitle>
        <CardDescription className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{copy.WALLET_SAFETY_NOTE}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {problem && problem.kind !== 'attestation' && <ProblemAlert problem={problem} />}

        {!regionBlocked && !connected && (
          <section aria-labelledby={`${id}-choose`} className="flex flex-col gap-3">
            <StepHeading n={1} id={`${id}-choose`}>{copy.STEP_CHOOSE}</StepHeading>
            <p className="text-sm text-muted-foreground">{copy.NETWORK_NOTE}</p>
            {wallets === null ? (
              <p className="text-sm text-muted-foreground">{copy.DETECTING}</p>
            ) : names.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4">
                <div>
                  <p className="text-sm font-medium">{copy.NO_WALLETS_TITLE}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{copy.NO_WALLETS_BODY}</p>
                </div>
                <Button variant="outline" size="sm" className="h-10" onClick={detect}>
                  {copy.CHECK_AGAIN}
                </Button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {names.map((w) => (
                  <li key={w.key}>
                    <Button
                      variant="outline"
                      className="h-14 w-full justify-start gap-3 px-3 text-left"
                      disabled={connectingKey !== null}
                      onClick={() => onChoose(w)}
                    >
                      <WalletLogo icon={w.icon} />
                      <span className="truncate">{connectingKey === w.key ? copy.CONNECTING : w.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!regionBlocked && connected && (
          <section aria-labelledby={`${id}-confirm`} className="flex flex-col gap-4">
            <StepHeading n={2} id={`${id}-confirm`}>{copy.STEP_CONFIRM}</StepHeading>
            <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-4">
              <span className="text-xs text-muted-foreground">
                {copy.CONNECTED_AS}
                {chosenName ? ` · ${chosenName}` : ''}
              </span>
              <span className="break-all font-mono text-sm">{connected.stakeAddress}</span>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id={`${id}-attest`}
                checked={attested}
                onCheckedChange={(v) => setAttested(v === true)}
                aria-invalid={problem?.kind === 'attestation'}
                aria-describedby={problem?.kind === 'attestation' ? `${id}-attest-error` : undefined}
                className="mt-0.5 h-5 w-5"
              />
              <Label htmlFor={`${id}-attest`} className="text-sm font-normal leading-snug">
                {copy.ATTESTATION_LABEL}
              </Label>
            </div>
            {problem?.kind === 'attestation' && (
              <p id={`${id}-attest-error`} role="alert" className="text-sm text-destructive">{problem.message}</p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="h-11 sm:h-10" onClick={onReset} disabled={link.isPending}>
                {copy.USE_ANOTHER_WALLET}
              </Button>
              <Button className="h-11 sm:h-10" onClick={onSign} disabled={!attested || link.isPending}>
                {link.isPending ? copy.SIGNING : copy.SIGN_AND_LINK}
              </Button>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

export function CardanoWalletPanel() {
  const { toast } = useToast();
  const linked = useLinkedCardanoWallets();
  const unlink = useUnlinkCardanoWallet();
  const [toUnlink, setToUnlink] = useState<string | null>(null);

  async function onConfirmUnlink() {
    const target = toUnlink;
    setToUnlink(null);
    if (!target) return;
    try {
      await unlink.mutateAsync(target);
      toast({ title: copy.UNLINKED, description: copy.shortStakeAddress(target) });
    } catch (error) {
      toast({ title: copy.UNLINK_FAILED, description: describeCardanoUnlinkError(error), variant: 'destructive' });
    }
  }

  const hasLinked = (linked.data?.length ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href={copy.DISCOUNT_CARD_PATH}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {copy.WALLET_BACK}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{copy.WALLET_PAGE_TITLE}</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{copy.WALLET_PAGE_DESCRIPTION}</p>
        </div>
      </div>

      <LinkedWallets wallets={linked.data} isLoading={linked.isLoading} isError={linked.isError} onUnlink={setToUnlink} />

      <LinkFlow hasLinked={hasLinked} />

      <AlertDialog open={toUnlink !== null} onOpenChange={(open) => !open && setToUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.UNLINK_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>
              {toUnlink && <span className="mb-2 block break-all font-mono text-xs">{toUnlink}</span>}
              {copy.UNLINK_BODY}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.CANCEL}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmUnlink} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {copy.UNLINK}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
