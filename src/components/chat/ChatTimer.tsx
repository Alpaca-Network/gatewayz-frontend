"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { useChatUIStore } from "@/lib/store/chat-ui-store";

/**
 * Formats elapsed time in milliseconds to a human-readable string
 * - Under 1 second: "Xms" (e.g., "500ms", "750ms")
 * - 1-60 seconds: "X.XXs" (e.g., "1.50s", "45.25s")
 * - 60+ seconds: "Xm X.XXs" (e.g., "1m 30.50s", "2m 5.25s")
 */
function formatElapsedTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const totalSeconds = ms / 1000;

  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(2)}s`;
  }

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs.toFixed(2)}s`;
}

/**
 * ChatTimer Component
 * Displays elapsed time since a message was sent while streaming is active.
 * Updates every millisecond and shows a clock icon with the elapsed time.
 */
export function ChatTimer() {
  const messageStartTime = useChatUIStore((state) => state.messageStartTime);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    // If no start time, reset and don't run timer
    if (!messageStartTime) {
      setElapsedMs(0);
      return;
    }

    // Calculate initial elapsed time
    const calculateElapsed = () => {
      return Date.now() - messageStartTime;
    };

    // Set initial value
    setElapsedMs(calculateElapsed());

    // Update every 1ms for real-time millisecond display
    const interval = setInterval(() => {
      setElapsedMs(calculateElapsed());
    }, 1);

    return () => clearInterval(interval);
  }, [messageStartTime]);

  // Don't render if no timer is active
  if (!messageStartTime) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>{formatElapsedTime(elapsedMs)}</span>
    </div>
  );
}
