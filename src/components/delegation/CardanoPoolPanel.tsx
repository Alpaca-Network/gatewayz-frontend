"use client";

// ADA tab: connect a CIP-30 wallet, link its stake address to the Gatewayz
// account (nonce -> signData -> link), then delegate to our pool with a
// certificate transaction. Delegating moves no ADA: it stays in the wallet,
// spendable, and can be re-delegated any time.
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  describeCardanoLinkError,
  linkCardanoStakeAddress,
  requestCardanoLinkNonce,
  type DelegationStatus,
} from '@/lib/delegation/api';
import {
  buildDelegationTx,
  connectCardanoWallet,
  describeCardanoError,
  signAndSubmit,
  signLinkMessage,
  type ConnectedCardanoWallet,
  type DelegationTx,
} from '@/lib/delegation/cardano-wallet';
import { detectCip30Wallets, isCip30Rejection, type Cip30WalletInfo } from '@/lib/delegation/cip30';
import { formatAda } from '@/lib/delegation/format';
import { fetchCardanoAccount, fetchCardanoProtocolParams } from '@/lib/delegation/koios';
import { delegationQueryKeys, useDelegationRewards } from '@/lib/delegation/use-delegation';
import { truncateAddress } from '@/lib/holdings/format';
import { ConfirmTxDialog } from './ConfirmTxDialog';

const CARDANOSCAN = 'https://cardanoscan.io';

function shortId(id: string): string {
  return id.length > 20 ? `${id.slice(0, 10)}...${id.slice(-6)}` : id;
}

export function CardanoPoolPanel({ status }: { status: DelegationStatus }) {
  const poolId = status.cardano.pool_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [available, setAvailable] = useState<Cip30WalletInfo[] | null>(null);
  const [connected, setConnected] = useState<ConnectedCardanoWallet | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [justLinked, setJustLinked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTx, setSubmittedTx] = useState<string | null>(null);
  const builtTx = useRef<DelegationTx | null>(null);

  const rewardsQuery = useDelegationRewards();
  const stakeAddress = connected?.stakeAddress ?? null;
  const accountQuery = useQuery({
    queryKey: [...delegationQueryKeys.cardanoAccount, stakeAddress],
    queryFn: () => fetchCardanoAccount(stakeAddress as string),
    enabled: !!stakeAddress,
    staleTime: 30_000,
    retry: 1,
  });

  // Wallet extensions inject window.cardano shortly after load; look twice.
  useEffect(() => {
    setAvailable(detectCip30Wallets());
    const timer = setTimeout(() => setAvailable(detectCip30Wallets()), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!poolId) {
    return <p className="text-sm text-muted-foreground">The Cardano pool is not configured yet.</p>;
  }

  const linkedAddresses = new Set(
    [...(rewardsQuery.data?.linked_wallets ?? []), ...(rewardsQuery.data?.positions ?? [])]
      .filter((w) => w.asset === 'ADA')
      .map((w) => w.wallet_address),
  );
  const isLinked = justLinked || (!!stakeAddress && linkedAddresses.has(stakeAddress));
  const account = accountQuery.data;
  const delegatedHere = !!account && account.delegatedPool === poolId;

  const handleConnect = async (key: string) => {
    setConnecting(key);
    try {
      const wallet = await connectCardanoWallet(key);
      setConnected(wallet);
      setJustLinked(false);
      setSubmittedTx(null);
    } catch (error) {
      toast({ title: 'Could not connect', description: describeCardanoError(error, isCip30Rejection), variant: 'destructive' });
    } finally {
      setConnecting(null);
    }
  };

  const handleLink = async () => {
    if (!connected) return;
    setLinking(true);
    try {
      const nonce = await requestCardanoLinkNonce(connected.stakeAddress);
      const { signature, key } = await signLinkMessage(connected, nonce);
      await linkCardanoStakeAddress({ stakeAddress: connected.stakeAddress, signature, key });
      setJustLinked(true);
      queryClient.invalidateQueries({ queryKey: delegationQueryKeys.rewards });
      toast({ title: 'Stake address linked', description: shortId(connected.stakeAddress) });
    } catch (error) {
      const description = isCip30Rejection(error)
        ? 'The signature request was cancelled.'
        : describeCardanoLinkError(error);
      toast({ title: 'Could not link', description, variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  const estimate = async (): Promise<string> => {
    if (!connected || !account) throw new Error('Connect a wallet first.');
    try {
      const params = await fetchCardanoProtocolParams();
      const tx = await buildDelegationTx(connected, { poolId, registered: account.registered, params });
      builtTx.current = tx;
      return tx.depositLovelace > BigInt(0)
        ? `${formatAda(tx.feeLovelace)} + ${formatAda(tx.depositLovelace)} refundable deposit`
        : formatAda(tx.feeLovelace);
    } catch (error) {
      builtTx.current = null;
      throw new Error(describeCardanoError(error, isCip30Rejection));
    }
  };

  const handleDelegate = async () => {
    setConfirmOpen(false);
    const tx = builtTx.current;
    if (!connected || !tx) return;
    setSubmitting(true);
    try {
      const hash = await signAndSubmit(connected, tx.unsignedTx);
      setSubmittedTx(hash);
      toast({ title: 'Delegation submitted', description: `It takes effect from the next epoch boundary. ${CARDANOSCAN}/transaction/${hash}` });
      queryClient.invalidateQueries({ queryKey: delegationQueryKeys.cardanoAccount });
    } catch (error) {
      toast({ title: 'Delegation not sent', description: describeCardanoError(error, isCip30Rejection), variant: 'destructive' });
    } finally {
      builtTx.current = null;
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Delegating points your stake key at the Gatewayz pool ({shortId(poolId)}). Your ADA never leaves your wallet
        and stays spendable; there is no lock-up, and you can re-delegate any time.
      </p>

      {!connected && (
        <div className="flex flex-col gap-3">
          {available === null ? (
            <Skeleton className="h-10 w-full" aria-busy="true" />
          ) : available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Cardano wallet found in this browser. Install Eternl, Lace, Nami or another CIP-30 wallet, then reload
              this page.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cardano wallets">
              {available.map((w) => (
                <Button
                  key={w.key}
                  variant="outline"
                  onClick={() => handleConnect(w.key)}
                  disabled={connecting !== null}
                  className="gap-2"
                >
                  {w.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.icon} alt="" width={18} height={18} className="h-[18px] w-[18px]" />
                  )}
                  {connecting === w.key ? 'Connecting...' : `Connect ${w.name}`}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {connected && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Stake address</span>
            <span className="font-mono" title={connected.stakeAddress}>
              {shortId(connected.stakeAddress)}
            </span>
            {isLinked && <Badge>Linked</Badge>}
            {delegatedHere && <Badge variant="secondary">Delegated to Gatewayz</Badge>}
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setConnected(null)}>
              Use another wallet
            </Button>
          </div>

          {accountQuery.isLoading && <Skeleton className="h-6 w-64" aria-busy="true" />}
          {accountQuery.isError && (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t read this stake address from the Cardano network. Please try again.
            </p>
          )}
          {account && (
            <p className="text-sm text-muted-foreground">
              {account.delegatedPool
                ? delegatedHere
                  ? `Delegating ${formatAda(account.totalLovelace)} to the Gatewayz pool. It stays spendable in your wallet.`
                  : `Currently delegated to ${shortId(account.delegatedPool)}. Delegating to Gatewayz switches it; your ADA does not move.`
                : 'Not delegated to any pool yet.'}
            </p>
          )}

          {!isLinked ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm">
                First, link this stake address to your Gatewayz account so the allowance reaches you. Your wallet asks
                you to sign a message: free, no transaction.
              </p>
              <Button onClick={handleLink} disabled={linking}>
                {linking ? 'Waiting for signature...' : 'Link with a signature'}
              </Button>
            </div>
          ) : (
            !delegatedHere &&
            account && (
              <div className="flex flex-col items-start gap-2">
                <Button onClick={() => setConfirmOpen(true)} disabled={submitting || !!submittedTx}>
                  {submitting ? 'Waiting for wallet...' : submittedTx ? 'Delegation submitted' : 'Delegate to Gatewayz'}
                </Button>
                {!account.registered && (
                  <p className="text-xs text-muted-foreground">
                    First delegation from this stake key also registers it, with a 2 ADA deposit you get back if you
                    ever deregister.
                  </p>
                )}
              </div>
            )
          )}

          {submittedTx && (
            <p role="status" className="text-sm">
              Submitted.{' '}
              <a
                className="underline"
                href={`${CARDANOSCAN}/transaction/${submittedTx}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                View {truncateAddress(submittedTx)} on Cardanoscan
              </a>
              . Delegation takes effect from the next epoch boundary.
            </p>
          )}
        </div>
      )}

      <ConfirmTxDialog
        open={confirmOpen}
        title="Delegate to the Gatewayz pool"
        description="This signs a delegation certificate with your stake key. No ADA is sent to Gatewayz; it stays in your wallet and spendable."
        rows={[
          { label: 'Pool', value: shortId(poolId) },
          ...(connected ? [{ label: 'Stake address', value: shortId(connected.stakeAddress) }] : []),
        ]}
        estimateFee={estimate}
        confirmLabel="Sign in wallet"
        onConfirm={handleDelegate}
        onOpenChange={setConfirmOpen}
      />
    </div>
  );
}
