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
    const updateCount = () => {
      setRemaining(getRemainingGuestMessages());
    };

    updateCount();

    window.addEventListener("storage", updateCount);
    window.addEventListener("guest-count-updated", updateCount);

    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener("guest-count-updated", updateCount);
    };
  }, []);

  const limit = getGuestMessageLimit();
  const isLow = remaining <= 1;
  const isOut = remaining === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
        isOut
          ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400"
          : isLow
          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400"
          : "bg-muted/60 border-border text-muted-foreground",
        className
      )}
      title={
        isOut
          ? "No free messages left today. Sign in for unlimited access."
          : `${remaining} of ${limit} free guest messages left today`
      }
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      <span className="tabular-nums whitespace-nowrap">
        {isOut ? "No messages left" : `${remaining}/${limit} free`}
      </span>
    </div>
  );
}
