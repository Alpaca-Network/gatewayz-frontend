
"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetTrigger, SheetOverlay, SheetPortal, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UserNav } from "./user-nav";
import { SearchBar } from "./search-bar";
import { Separator } from "@/components/ui/separator";
import { GetCreditsButton } from "./get-credits-button";
import { CreditsDisplay } from "./credits-display";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";

const getWalletAddress = (user: any) => {
  try {
    if (!user) return "";
    const walletAccount = user?.linkedAccounts?.find((account: any) => account.type === "wallet");
    return walletAccount?.address || "";
  } catch (error) {
    console.log("Error getting wallet address:", error);
    return "";
  }
};

export function AppHeader() {
  const { privyUser: user, login, logout, status } = useGatewayzAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const walletAddress = useMemo(() => getWalletAddress(user), [user]);
  const isAuthenticating = status === "authenticating";

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Address copied to clipboard" });
    } catch (error) {
      toast({
        title: "Failed to copy address",
        variant: "destructive",
      });
    }
  };

  const toUnixSeconds = useCallback((value: unknown): number | undefined => {
    if (!value) return undefined;

    if (typeof value === 'number') {
      return Math.floor(value);
    }

    if (value instanceof Date) {
      return Math.floor(value.getTime() / 1000);
    }

    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return Math.floor(parsed / 1000);
      }
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        return Math.floor(numeric);
      }
    }

    return undefined;
  }, []);

  const mapLinkedAccount = useCallback((account: Record<string, unknown>) => {
    const get = (key: string) =>
      Object.prototype.hasOwnProperty.call(account, key)
        ? (account as Record<string, unknown>)[key]
        : undefined;

    const stripUndefined = <T,>(value: T): T => {
      if (Array.isArray(value)) {
        return value.map(stripUndefined) as unknown as T;
      }

      if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, stripUndefined(v)]);
        return Object.fromEntries(entries) as unknown as T;
      }

      return value;
    };

    return stripUndefined({
      type: get('type') as string | undefined,
      subject: get('subject') as string | undefined,
      email: get('email') as string | undefined,
      name: get('name') as string | undefined,
      address: get('address') as string | undefined,
      chain_type: get('chainType') as string | undefined,
      wallet_client_type: get('walletClientType') as string | undefined,
      connector_type: get('connectorType') as string | undefined,
      verified_at: toUnixSeconds(get('verifiedAt')),
      first_verified_at: toUnixSeconds(get('firstVerifiedAt')),
      latest_verified_at: toUnixSeconds(get('latestVerifiedAt')),
    });
  }, [toUnixSeconds]);

  return (
    <header className="sticky top-0 z-[60] w-full h-[65px] border-b bg-header flex items-center">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8 mx-auto">
        <div className="flex items-center mr-auto">
          <Link href="/" className="flex items-center space-x-2 w-[45px] h-[45px] shrink-0">
            <img src="/logo_black.svg" alt="Gatewayz" className="w-[45px] h-[45px] object-contain dark:hidden" />
            <img src="/logo_white.png" alt="Gatewayz" className="w-[45px] h-[45px] object-contain hidden dark:block" />
          </Link>
           <div className="relative hidden sm:block w-full max-w-sm pl-6">
             <SearchBar />
           </div>
        </div>
        
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <GetCreditsButton />
            <Link href="/models" className="transition-colors hover:text-foreground/80 ">Models</Link>
            <Link href="/chat" className="transition-colors hover:text-foreground/80 ">Chat</Link>
            <Link href="/developers" className="transition-colors hover:text-foreground/80 ">Researchers</Link>
            <Link href="/rankings" className="transition-colors hover:text-foreground/80 ">Ranking</Link>
            <Link href="https://docs.gatewayz.ai/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground/80 ">Docs</Link>
          </nav>

          {/* Desktop: Theme toggle and auth */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <CreditsDisplay />
                <UserNav user={user} />
              </>
            ) : (
              <Button variant="outline" onClick={() => login()}>Sign In</Button>
            )}
            <ThemeToggle />
          </div>

          {/* Mobile: Credits, Profile, and Menu */}
          <div className="md:hidden flex items-center gap-2">
            {user && (
              <>
                <CreditsDisplay />
                <UserNav user={user} />
              </>
            )}
            {!user && (
              <Button variant="outline" size="sm" onClick={() => login()}>Sign In</Button>
            )}
          </div>
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[100dvw] sm:w-[400px] overflow-y-auto top-[65px] h-[calc(100dvh-65px)]" overlayClassName="top-[65px]">
                <SheetHeader className="sr-only">
                  <SheetTitle>Mobile Navigation Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col py-6">
                  <nav className="flex flex-col gap-4 text-base">
                    <Link
                      href="/models"
                      className="transition-colors hover:text-foreground/80 text-foreground/60 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Models
                    </Link>
                    <Link
                      href="/chat"
                      className="transition-colors hover:text-foreground/80 text-foreground/60 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Chat
                    </Link>
                    <Link
                      href="/developers"
                      className="transition-colors hover:text-foreground/80 text-foreground/60 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Researchers
                    </Link>
                    <Link
                      href="/rankings"
                      className="transition-colors hover:text-foreground/80 text-foreground/60 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Ranking
                    </Link>
                    <Link
                      href="https://docs.gatewayz.ai/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-foreground/80 text-foreground/60 py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Docs
                    </Link>
                  </nav>

                  {user && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex flex-col gap-2">
                        <div className="px-2">
                          <CreditsDisplay />
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase px-2 mt-4">
                          Wallet Address
                        </p>
                        <div className="flex items-center gap-2 px-2 py-2 bg-muted/50 rounded-lg">
                          <span className="text-xs text-muted-foreground font-mono flex-1">
                            {formatAddress(getWalletAddress(user))}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => copyToClipboard(getWalletAddress(user))}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase px-2 mt-4">
                          Account
                        </p>
                        <Link
                          href="/settings/account"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Account
                        </Link>
                        <Link
                          href="/settings/credits"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Credits
                        </Link>
                        <Link
                          href="/settings/referrals"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Referrals
                        </Link>
                        <Link
                          href="/settings/keys"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          API Keys
                        </Link>
                        <Link
                          href="/settings/activity"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Activity
                        </Link>
                        <Link
                          href="/settings/presets"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Presets
                        </Link>
                        <Link
                          href="/settings/provisioning"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Provisioning Keys
                        </Link>
                        <Link
                          href="/settings/integrations"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Integrations (BYOK)
                        </Link>
                        <Link
                          href="/settings/privacy"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Privacy
                        </Link>
                        <Link
                          href="/settings"
                          className="transition-colors hover:text-foreground/80 text-foreground/60 py-2 px-2 rounded-md hover:bg-accent"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Settings
                        </Link>
                      </div>
                      <Separator className="my-4" />
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          logout();
                          setMobileMenuOpen(false);
                        }}
                      >
                        Sign Out
                      </Button>
                    </>
                  )}

                  {!user && (
                    <>
                      <Separator className="my-4" />
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={isAuthenticating}
                        onClick={() => {
                          login();
                          setMobileMenuOpen(false);
                        }}
                      >
                        {isAuthenticating ? "Connecting..." : "Sign In"}
                      </Button>
                    </>
                  )}

                  <div className="mt-auto pt-4">
                    <ThemeToggle />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
