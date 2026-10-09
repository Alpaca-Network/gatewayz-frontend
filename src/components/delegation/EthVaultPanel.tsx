"use client";

// ETH tab: deposit into, exit from, and claim from the StakeWise V3 vault at
// status.eth.vault_address on Ethereum mainnet, from the user's own wallet.
// The wallet switches to Ethereum only when the user presses the switch button
// here; nothing else in the app changes network.
import { useMemo, useState, type FormEvent } from 'react';
import { usePrivy, useWallets, type ConnectedWallet } from '@privy-io/react-auth';
import { isAddress, type Address } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { HoldingsWalletLink } from '@/components/holdings/HoldingsWalletLink';
import { useLinkedWallets } from '@/lib/hooks/use-linked-wallets';
import { truncateAddress } from '@/lib/holdings/format';
import type { DelegationStatus } from '@/lib/delegation/api';
import {
  assetsToShares,
  describeVaultError,
  estimateNetworkFee,
  ETHEREUM_MAINNET_ID,
  type ExitRequest,
} from '@/lib/delegation/eth-vault';
import { formatDateTime, formatEth, parseEthInput } from '@/lib/delegation/format';
import {
  argsFor,
  chainIdOf,
  publicClientFor,
  switchToEthereum,
  useEthVaultAction,
  useEthVaultState,
  type VaultAction,
} from '@/lib/delegation/use-eth-vault';
import { useDelegationRewards } from '@/lib/delegation/use-delegation';
import { ConfirmTxDialog, type ConfirmRow } from './ConfirmTxDialog';

const ETHERSCAN = 'https://etherscan.io';

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-semibold">{value}</span>
    </div>
  );
}

interface PendingConfirm {
  action: VaultAction;
  title: string;
  description: string;
  rows: ConfirmRow[];
  confirmLabel: string;
}

export function EthVaultPanel({ status }: { status: DelegationStatus }) {
  const vault = status.eth.vault_address && isAddress(status.eth.vault_address) ? (status.eth.vault_address as Address) : null;
  const { ready: privyReady, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const linkedQuery = useLinkedWallets();
  const [selected, setSelected] = useState<string | null>(null);

  const linkedSet = useMemo(
    () => new Set((linkedQuery.data ?? []).map((w) => w.wallet_address.toLowerCase())),
    [linkedQuery.data],
  );
  const wallet: ConnectedWallet | null =
    wallets.find((w) => w.address.toLowerCase() === selected) ??
    wallets.find((w) => linkedSet.has(w.address.toLowerCase())) ??
    wallets[0] ??
    null;

  if (!vault) {
    return <p className="text-sm text-muted-foreground">The ETH vault is not configured yet.</p>;
  }

  if (!privyReady || linkedQuery.isLoading) {
    return (
      <Panel>
        <Skeleton className="h-10 w-full" aria-busy="true" />
      </Panel>
    );
  }

  if (!wallet) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          Connect the Ethereum wallet you want to stake from. Your ETH goes from that wallet straight into the vault;
          Gatewayz never holds it.
        </p>
        <div>
          <Button onClick={() => connectWallet()}>Connect a wallet</Button>
        </div>
      </Panel>
    );
  }

  const isLinked = linkedSet.has(wallet.address.toLowerCase());

  return (
    <Panel>
      <WalletPicker wallets={wallets} current={wallet} linkedSet={linkedSet} onSelect={setSelected} />
      {!isLinked ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Link {truncateAddress(wallet.address)} to your Gatewayz account first, so the inference allowance from
            this wallet reaches you. It takes one free signature.
          </p>
          <HoldingsWalletLink />
        </div>
      ) : chainIdOf(wallet) !== ETHEREUM_MAINNET_ID ? (
        <SwitchNetwork wallet={wallet} />
      ) : (
        <VaultControls wallet={wallet} vault={vault} feePercent={status.eth.fee_percent} />
      )}
    </Panel>
  );
}

function WalletPicker({
  wallets,
  current,
  linkedSet,
  onSelect,
}: {
  wallets: ConnectedWallet[];
  current: ConnectedWallet;
  linkedSet: Set<string>;
  onSelect: (address: string) => void;
}) {
  const { connectWallet } = usePrivy();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Wallet</span>
      {wallets.length > 1 ? (
        <select
          aria-label="Wallet to stake from"
          className="rounded-md border bg-background px-2 py-1 font-mono text-sm"
          value={current.address.toLowerCase()}
          onChange={(e) => onSelect(e.target.value)}
        >
          {wallets.map((w) => (
            <option key={w.address} value={w.address.toLowerCase()}>
              {truncateAddress(w.address)} {linkedSet.has(w.address.toLowerCase()) ? '(linked)' : ''}
            </option>
          ))}
        </select>
      ) : (
        <span className="font-mono" title={current.address}>
          {truncateAddress(current.address)}
        </span>
      )}
      {linkedSet.has(current.address.toLowerCase()) && <Badge>Linked</Badge>}
      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => connectWallet()}>
        Use another wallet
      </Button>
    </div>
  );
}

function SwitchNetwork({ wallet }: { wallet: ConnectedWallet }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const handleSwitch = async () => {
    setBusy(true);
    try {
      await switchToEthereum(wallet);
    } catch (error) {
      toast({ title: 'Could not switch network', description: describeVaultError(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        The vault is on Ethereum mainnet. Switch this wallet to Ethereum to see your position and stake. Only this step
        changes your wallet&apos;s network.
      </p>
      <Button onClick={handleSwitch} disabled={busy}>
        {busy ? 'Waiting for wallet...' : 'Switch to Ethereum'}
      </Button>
    </div>
  );
}

function VaultControls({
  wallet,
  vault,
  feePercent,
}: {
  wallet: ConnectedWallet;
  vault: Address;
  feePercent: number | null;
}) {
  const { toast } = useToast();
  const account = wallet.address as Address;
  const rewardsQuery = useDelegationRewards();
  const stateQuery = useEthVaultState(wallet, vault, rewardsQuery.data?.exit_requests);
  const action = useEthVaultAction(wallet, vault);
  const [depositInput, setDepositInput] = useState('');
  const [exitInput, setExitInput] = useState('');
  const [exitAll, setExitAll] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  if (stateQuery.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }
  if (stateQuery.isError || !stateQuery.data) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t read the vault through your wallet. {describeVaultError(stateQuery.error)}
        </p>
        <Button variant="outline" size="sm" onClick={() => stateQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { position, balance, exits, exitsError } = stateQuery.data;
  const busy = action.isPending;
  const vaultRow: ConfirmRow = { label: 'Vault', value: truncateAddress(vault) };

  const estimate = (a: VaultAction) => async () => {
    try {
      const client = await publicClientFor(wallet);
      const { functionName, args, value } = argsFor(a, account);
      const { fee } = await estimateNetworkFee(client, { vault, account, functionName, args, value });
      return `up to ${formatEth(fee, 6)}`;
    } catch (error) {
      throw new Error(describeVaultError(error));
    }
  };

  const run = async (a: VaultAction, success: string) => {
    setPending(null);
    try {
      const hash = await action.mutateAsync(a);
      toast({ title: success, description: `Transaction ${hash.slice(0, 10)}... confirmed. ${ETHERSCAN}/tx/${hash}` });
      if (a.kind === 'deposit') setDepositInput('');
      if (a.kind === 'exit') {
        setExitInput('');
        setExitAll(false);
      }
    } catch (error) {
      toast({ title: 'Transaction not sent', description: describeVaultError(error), variant: 'destructive' });
    }
  };

  const handleDeposit = (event: FormEvent) => {
    event.preventDefault();
    const value = parseEthInput(depositInput);
    if (value === null) {
      toast({ title: 'Enter an amount greater than zero', variant: 'destructive' });
      return;
    }
    if (value >= balance) {
      toast({ title: 'Not enough ETH', description: 'Leave some ETH in the wallet for the network fee.', variant: 'destructive' });
      return;
    }
    if (position.remainingCapacity !== null && value > position.remainingCapacity) {
      toast({
        title: 'Over the vault capacity',
        description: `The vault can take up to ${formatEth(position.remainingCapacity)} more.`,
        variant: 'destructive',
      });
      return;
    }
    if (position.stateUpdateRequired) {
      toast({ title: 'Vault is updating', description: describeVaultError(new Error('NotHarvested')), variant: 'destructive' });
      return;
    }
    setPending({
      action: { kind: 'deposit', value },
      title: 'Stake ETH',
      description:
        'Your ETH goes from this wallet into the vault, and the vault shares come back to this wallet. You can exit any time through the exit queue.',
      rows: [{ label: 'Amount', value: formatEth(value) }, vaultRow, ...(feePercent !== null ? [{ label: 'Vault fee', value: `${feePercent}% of rewards` }] : [])],
      confirmLabel: 'Confirm in wallet',
    });
  };

  const handleExit = async (event: FormEvent) => {
    event.preventDefault();
    let shares = position.shares;
    let assets = position.assets;
    if (!exitAll) {
      const requested = parseEthInput(exitInput);
      if (requested === null) {
        toast({ title: 'Enter an amount greater than zero', variant: 'destructive' });
        return;
      }
      if (requested > position.assets) {
        toast({ title: 'More than your position', description: `You have ${formatEth(position.assets)} staked.`, variant: 'destructive' });
        return;
      }
      try {
        shares = await assetsToShares(await publicClientFor(wallet), vault, requested, position.shares);
      } catch (error) {
        toast({ title: 'Could not prepare the exit', description: describeVaultError(error), variant: 'destructive' });
        return;
      }
      assets = requested;
    }
    if (shares <= BigInt(0)) {
      toast({ title: 'Nothing to exit', variant: 'destructive' });
      return;
    }
    setPending({
      action: { kind: 'exit', shares },
      title: 'Exit the vault',
      description:
        'This joins the vault exit queue. Once validators release the ETH (usually a few days), you claim it here back to this wallet. Your inference allowance for this amount stops when you exit.',
      rows: [{ label: 'Amount', value: `about ${formatEth(assets)}` }, vaultRow],
      confirmLabel: 'Confirm in wallet',
    });
  };

  const handleClaim = (request: ExitRequest) => {
    setPending({
      action: { kind: 'claim', request },
      title: 'Claim exited ETH',
      description: 'Sends the exited ETH from the vault back to this wallet.',
      rows: [{ label: 'Amount', value: formatEth(request.exitedAssets) }, vaultRow],
      confirmLabel: 'Confirm in wallet',
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Staked in the vault" value={formatEth(position.assets, 4)} />
        <Stat label="Wallet balance" value={formatEth(balance, 4)} />
        <Stat label="Exiting" value={formatEth(exits.reduce((sum, r) => sum + r.queuedAssets + r.exitedAssets, BigInt(0)), 4)} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={handleDeposit} className="flex flex-col gap-2" aria-label="Stake ETH">
          <Label htmlFor="eth-deposit-amount">Stake ETH</Label>
          <div className="flex gap-2">
            <Input
              id="eth-deposit-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
              disabled={busy}
            />
            <Button type="submit" disabled={busy || depositInput.trim() === ''}>
              Stake
            </Button>
          </div>
          {position.stateUpdateRequired && (
            <p className="text-xs text-muted-foreground">
              The vault is updating its rewards and will accept deposits again shortly.
            </p>
          )}
        </form>

        <form onSubmit={handleExit} className="flex flex-col gap-2" aria-label="Exit the vault">
          <Label htmlFor="eth-exit-amount">Exit (ETH)</Label>
          <div className="flex gap-2">
            <Input
              id="eth-exit-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              value={exitAll ? formatEth(position.assets).replace(' ETH', '') : exitInput}
              onChange={(e) => {
                setExitAll(false);
                setExitInput(e.target.value);
              }}
              disabled={busy || position.shares === BigInt(0)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setExitAll(true)}
              disabled={busy || position.shares === BigInt(0)}
            >
              Max
            </Button>
            <Button type="submit" variant="secondary" disabled={busy || position.shares === BigInt(0)}>
              Exit
            </Button>
          </div>
        </form>
      </div>

      <section aria-labelledby="eth-exit-queue" className="flex flex-col gap-2">
        <h4 id="eth-exit-queue" className="text-sm font-semibold">
          Exit queue
        </h4>
        {exitsError && (
          <p className="text-sm text-muted-foreground">
            Your wallet&apos;s network provider couldn&apos;t list past exits. Pending exits are still safe in the vault;
            you can also see and claim them in the{' '}
            <a
              className="underline"
              href={`https://app.stakewise.io/vault/mainnet/${vault}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              StakeWise app
            </a>
            .
          </p>
        )}
        {!exitsError && exits.length === 0 && <p className="text-sm text-muted-foreground">No exits in progress.</p>}
        {exits.length > 0 && (
          <ul className="divide-y rounded-md border">
            {exits.map((r) => (
              <li key={r.positionTicket.toString()} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="flex flex-col">
                  <span className="font-mono">{formatEth(r.queuedAssets + r.exitedAssets, 4)}</span>
                  <span className="text-xs text-muted-foreground">Requested {formatDateTime(Number(r.timestamp))}</span>
                </div>
                {r.status === 'claimable' ? (
                  <Button size="sm" onClick={() => handleClaim(r)} disabled={busy}>
                    Claim {formatEth(r.exitedAssets, 4)}
                  </Button>
                ) : r.status === 'processing' ? (
                  <Badge variant="outline">Claimable after {formatDateTime(r.claimableAt)}</Badge>
                ) : (
                  <Badge variant="outline">In queue</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Waiting for your wallet and the network...
        </p>
      )}

      {pending && (
        <ConfirmTxDialog
          open
          title={pending.title}
          description={pending.description}
          rows={pending.rows}
          confirmLabel={pending.confirmLabel}
          estimateFee={estimate(pending.action)}
          onConfirm={() =>
            run(
              pending.action,
              pending.action.kind === 'deposit' ? 'Staked' : pending.action.kind === 'exit' ? 'Exit requested' : 'Claimed',
            )
          }
          onOpenChange={(open) => !open && setPending(null)}
        />
      )}
    </div>
  );
}
