"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { getRemainingGuestMessages, getGuestMessageLimit } from "@/lib/guest-chat";
import { cn } from "@/lib/utils";

interface GuestChatCounterProps {
  className?: string;
}

export function GuestChatCounter({ className }: GuestChatCounterProps) {
  const [remaining, setRemaining] = useState<number>(getGuestMessageLimit());

  useEffect(() => {
    // Update remaining count on mount and when localStorage changes
    const updateCount = () => {
      setRemaining(getRemainingGuestMessages());
    };

    updateCount();

    // Listen for storage events (cross-tab sync)
    window.addEventListener("storage", updateCount);

    // Custom event for same-tab updates (dispatched after sending a message)
    window.addEventListener("guest-count-updated", updateCount);

    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener("guest-count-updated", updateCount);
    };
  }, []);

  const limit = getGuestMessageLimit();
  const percentage = (remaining / limit) * 100;

  // Color changes based on remaining messages
  const getColorClass = () => {
    if (remaining <= 2) return "text-red-600 dark:text-red-400";
    if (remaining <= 5) return "text-yellow-600 dark:text-yellow-400";
    return "text-muted-foreground";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
        getColorClass(),
        className
      )}
      title={`${remaining} of ${limit} free messages remaining`}
    >
      <MessageSquare className="h-3.5 w-3.5" />
      <span className="tabular-nums">
        {remaining}/{limit}
      </span>
    </div>
  );
}
