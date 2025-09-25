
"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
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
import { usePrivy } from "@privy-io/react-auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

interface UserNavProps {
  user: any; // Privy user object
}

export function UserNav({ user }: UserNavProps) {
  const { logout } = usePrivy();
  const { toast } = useToast();
  const router = useRouter();

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="relative h-10 w-10 rounded-lg bg-white border-gray-200 hover:bg-white p-0">
          <div className="h-7 w-7 rounded-full bg-card flex items-center justify-center border border-gray-300">
            <span className="text-black text-lg">{getInitials(user)}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user?.email?.address || user?.google?.email || user?.github?.email || user?.github?.name || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email?.address || user?.google?.email || user?.github?.email || user?.github?.username || ""}
            </p>
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
          <Link href="/settings/keys">
            <DropdownMenuItem>Keys</DropdownMenuItem>
          </Link>
          <Link href="/settings/activity">
            <DropdownMenuItem>Activity</DropdownMenuItem>
          </Link>
          <Link href="/settings">
            <DropdownMenuItem>Settings</DropdownMenuItem>
          </Link>
          <DropdownMenuItem>Enterprise</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
