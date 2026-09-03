"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLinkedWallets } from '@/lib/hooks/use-linked-wallets';
import { useRegisterGpuProvider } from '@/lib/hooks/use-gpu-provider';
import { GpuProviderApiError, describeGpuProviderError } from '@/lib/gpu/provider-api';

/** Truncates a 0x-address to `0x1234...abcd` (mirrors settings/wallets/page.tsx). */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function RegisterProviderForm() {
  const { toast } = useToast();
  const { data: wallets, isLoading: walletsLoading } = useLinkedWallets();
  const registerMutation = useRegisterGpuProvider();

  const [displayName, setDisplayName] = useState('');
  const [payoutWallet, setPayoutWallet] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [regionDefault, setRegionDefault] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !payoutWallet) return;

    try {
      await registerMutation.mutateAsync({
        display_name: displayName.trim(),
        payout_wallet_address: payoutWallet,
        ...(contactEmail.trim() ? { contact_email: contactEmail.trim() } : {}),
        ...(regionDefault.trim() ? { region_default: regionDefault.trim() } : {}),
      });
      toast({ title: 'Provider registration submitted', description: "We'll review it shortly." });
    } catch (error) {
      const description =
        error instanceof GpuProviderApiError ? describeGpuProviderError(error) : "Something went wrong. Please try again.";
      toast({ title: 'Could not register', description, variant: 'destructive' });
    }
  };

  if (!walletsLoading && (!wallets || wallets.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Become a GPU provider</CardTitle>
          <CardDescription>You&apos;ll need a linked wallet to receive WAYZ payouts.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/settings/wallets">Link a wallet</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Become a GPU provider</CardTitle>
        <CardDescription>
          Register to serve open-weight models from your own GPU. Requests only route to your node when a caller
          explicitly asks for a <code>community/&lt;model&gt;</code> id — never by auto-routing or failover.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gpu-display-name">Display name</Label>
            <Input
              id="gpu-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Acme GPUs"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gpu-payout-wallet">Payout wallet</Label>
            <Select value={payoutWallet} onValueChange={setPayoutWallet}>
              <SelectTrigger id="gpu-payout-wallet">
                <SelectValue placeholder={walletsLoading ? 'Loading wallets…' : 'Select a linked wallet'} />
              </SelectTrigger>
              <SelectContent>
                {(wallets ?? []).map((wallet) => (
                  <SelectItem key={wallet.wallet_address} value={wallet.wallet_address}>
                    {truncateAddress(wallet.wallet_address)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gpu-contact-email">Contact email (optional)</Label>
            <Input
              id="gpu-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gpu-region">Default region (optional)</Label>
            <Input
              id="gpu-region"
              value={regionDefault}
              onChange={(e) => setRegionDefault(e.target.value)}
              placeholder="us-east"
            />
          </div>

          <Button type="submit" disabled={registerMutation.isPending || !displayName.trim() || !payoutWallet}>
            {registerMutation.isPending ? 'Registering…' : 'Register'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
