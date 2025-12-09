"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { useChatUIStore } from "@/lib/store/chat-ui-store";

/**
 * Formats elapsed time in seconds to a human-readable string
 * - Under 60 seconds: "Xs" (e.g., "5s", "45s")
 * - 60+ seconds: "Xm Ys" (e.g., "1m 30s", "2m 5s")
 */
function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

/**
 * ChatTimer Component
 * Displays elapsed time since a message was sent while streaming is active.
 * Updates every second and shows a clock icon with the elapsed time.
 */
export function ChatTimer() {
  const messageStartTime = useChatUIStore((state) => state.messageStartTime);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    // If no start time, reset and don't run timer
    if (!messageStartTime) {
      setElapsedSeconds(0);
      return;
    }

    // Calculate initial elapsed time
    const calculateElapsed = () => {
      return Math.floor((Date.now() - messageStartTime) / 1000);
    };

    // Set initial value
    setElapsedSeconds(calculateElapsed());

    // Update every second
    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [messageStartTime]);

  // Don't render if no timer is active
  if (!messageStartTime) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>{formatElapsedTime(elapsedSeconds)}</span>
    </div>
  );
}
