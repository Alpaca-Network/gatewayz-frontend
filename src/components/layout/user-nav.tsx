"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Copy } from "lucide-react";
import { useTier } from "@/hooks/use-tier";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";

interface UserNavProps {
  user: any; // Privy user object
}

export function UserNav({ user }: UserNavProps) {
  const { logout } = useGatewayzAuth();
  const { toast } = useToast();
  const { tier, tierDisplayName } = useTier();

  const handleSignOut = async () => {
    try {
      await logout();
      toast({ title: "Signed out successfully" });
    } catch (error) {
      toast({
        title: "Error signing out",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const getInitials = (user: any) => {
    if (user?.email?.address) return user.email.address[0].toUpperCase();
    if (user?.google?.email) return user.google.email[0].toUpperCase();
    if (user?.github?.username) return user.github.username[0].toUpperCase();
    return "U";
  };

  const getWalletAddress = (user: any) => {
    try {
      if(!user) return '';
      // Get the first wallet address from linked accounts
      const walletAccount = user?.linkedAccounts?.find((account: any) => account.type === 'wallet');
      return walletAccount?.address || '';
    } catch (error) {
      console.log('Error getting wallet address:', error);
      return '';
    }
  }

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Wallet copied to clipboard" });
    } catch (error) {
      toast({
        title: "Failed to copy wallet",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="relative h-10 w-10 rounded-lg bg-card border-border hover:bg-muted/50 p-0">
          <div className="h-7 w-7 rounded-full bg-card flex items-center justify-center border border-border">
            <span className="text-foreground text-lg">{getInitials(user)}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 mt-2" align="end" forceMount>
        <DropdownMenuLabel className="font-normal py-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2 flex-wrap flex-1">
                <p className="text-sm font-medium leading-none">
                  {user?.email?.address || user?.google?.email || user?.github?.email || user?.github?.name || "User"}
                </p>
                {(user?.email?.address || user?.google?.email || user?.github?.email || user?.github?.username) && (
                  <p className="text-xs leading-none text-muted-foreground">
                    ({user?.email?.address || user?.google?.email || user?.github?.email || user?.github?.username})
                  </p>
                )}
              </div>
              {tier !== 'basic' && (
                <div className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                  tier === 'pro'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                    : 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                }`}>
                  {tierDisplayName}
                </div>
              )}
            </div>
            {getWalletAddress(user) && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground font-mono">
                  {formatAddress(getWalletAddress(user))}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(getWalletAddress(user));
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link href="/settings/account">
            <DropdownMenuItem>Account</DropdownMenuItem>
          </Link>
          <Link href="/settings/credits">
            <DropdownMenuItem>Credits</DropdownMenuItem>
          </Link>
          <Link href="/settings/referrals">
            <DropdownMenuItem>Referrals</DropdownMenuItem>
          </Link>
          <Link href="/settings/keys">
            <DropdownMenuItem>API Keys</DropdownMenuItem>
          </Link>
          <Link href="/settings/activity">
            <DropdownMenuItem>Activity</DropdownMenuItem>
          </Link>
          <Link href="/settings/presets">
            <DropdownMenuItem>Presets</DropdownMenuItem>
          </Link>
          <Link href="/settings/provisioning">
            <DropdownMenuItem>Provisioning Keys</DropdownMenuItem>
          </Link>
          <Link href="/settings/integrations">
            <DropdownMenuItem>Integrations (BYOK)</DropdownMenuItem>
          </Link>
          <Link href="/settings/privacy">
            <DropdownMenuItem>Privacy</DropdownMenuItem>
          </Link>
          <Link href="/settings">
            <DropdownMenuItem>Settings</DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
