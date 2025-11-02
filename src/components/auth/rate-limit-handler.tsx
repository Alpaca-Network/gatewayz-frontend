"use client";

import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Clock } from 'lucide-react';

interface RateLimitHandlerProps {
  show: boolean;
  onDismiss?: () => void;
}

export function RateLimitHandler({ show, onDismiss }: RateLimitHandlerProps) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!show) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onDismiss?.();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Too Many Requests</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Rate limit exceeded (100 requests/minute, burst of 20). Please wait a moment before trying again.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            <span>Please wait {countdown} seconds</span>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
