'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertCircle } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  className?: string;
  showWhenOnline?: boolean;
  pendingMessages?: number;
  failedMessages?: number;
  onRetryFailed?: () => void;
}

export function ConnectionStatus({
  className,
  showWhenOnline = false,
  pendingMessages = 0,
  failedMessages = 0,
  onRetryFailed,
}: ConnectionStatusProps) {
  const { isOnline, isChecking } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track when we come back online to show reconnection message
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Don't render anything if online and no special states
  if (isOnline && !showWhenOnline && !showReconnected && pendingMessages === 0 && failedMessages === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300',
          {
            'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300': !isOnline,
            'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300': isOnline && showReconnected,
            'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300': isOnline && pendingMessages > 0,
            'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300': isOnline && failedMessages > 0,
            'bg-muted text-muted-foreground': isOnline && showWhenOnline && !showReconnected && pendingMessages === 0,
          },
          className
        )}
      >
        {isChecking ? (
          <>
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Checking connection...</span>
          </>
        ) : !isOnline ? (
          <>
            <WifiOff className="h-3 w-3" />
            <span>Offline - messages will be sent when reconnected</span>
          </>
        ) : showReconnected ? (
          <>
            <Wifi className="h-3 w-3" />
            <span>Back online!</span>
          </>
        ) : failedMessages > 0 ? (
          <>
            <AlertCircle className="h-3 w-3" />
            <span>{failedMessages} message{failedMessages > 1 ? 's' : ''} failed</span>
            {onRetryFailed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-xs"
                    onClick={onRetryFailed}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Retry sending failed messages</p>
                </TooltipContent>
              </Tooltip>
            )}
          </>
        ) : pendingMessages > 0 ? (
          <>
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Sending {pendingMessages} message{pendingMessages > 1 ? 's' : ''}...</span>
          </>
        ) : (
          <>
            <Wifi className="h-3 w-3" />
            <span>Connected</span>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
