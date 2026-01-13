"use client";

import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import { UserNav } from "./user-nav";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

export function DesktopAppHeader() {
  const { privyUser: user, login } = useGatewayzAuth();

  const getWalletAddress = (user: any) => {
    try {
      if (!user) return "";
      const walletAccount = user?.linkedAccounts?.find(
        (account: any) => account.type === "wallet"
      );
      return walletAccount?.address || "";
    } catch (error) {
      console.log("Error getting wallet address:", error);
      return "";
    }
  };

  const walletAddress = useMemo(() => getWalletAddress(user), [user]);

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] w-full h-[65px] border-b bg-header">
      <div className="w-full h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo/Title */}
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5" />
          <span className="font-semibold text-lg">Chat</span>
        </div>

        {/* Right: User Account */}
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {walletAddress && (
                <div className="text-sm text-muted-foreground">
                  {formatAddress(walletAddress)}
                </div>
              )}
              <UserNav user={user} />
            </>
          ) : (
            <Button variant="outline" onClick={() => login()}>
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
