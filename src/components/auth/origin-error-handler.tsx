"use client";

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OriginErrorHandlerProps {
  show: boolean;
  onDismiss?: () => void;
}

/**
 * Origin Error Handler
 *
 * Displays a helpful message when Privy OAuth fails due to the application's
 * origin (domain) not being configured in the Privy dashboard's allowed origins list.
 *
 * This error occurs when:
 * - The domain (e.g., beta.gatewayz.ai) is not added to Privy's allowed origins
 * - A new deployment is made to a domain not yet registered with Privy
 */
export function OriginErrorHandler({ show, onDismiss }: OriginErrorHandlerProps) {
  if (!show) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';

  return (
    <div className="fixed top-4 right-4 z-50 max-w-lg animate-in slide-in-from-top">
      <Alert variant="destructive" className="relative">
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="pr-8">OAuth Configuration Error</AlertTitle>
        <AlertDescription className="space-y-3 mt-2">
          <p>
            Login via Google or GitHub is temporarily unavailable. The application&apos;s domain
            needs to be configured in the authentication provider.
          </p>
          <div className="text-xs bg-muted p-2 rounded font-mono">
            Origin: {currentOrigin}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">For administrators:</p>
            <ol className="text-xs list-decimal list-inside space-y-1">
              <li>Go to the Privy Dashboard</li>
              <li>Navigate to Settings → Allowed Origins</li>
              <li>Add <code className="bg-muted px-1 rounded">{currentOrigin}</code></li>
              <li>Save and try again</li>
            </ol>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <a
              href="https://dashboard.privy.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline hover:no-underline"
            >
              Open Privy Dashboard <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            In the meantime, you can try logging in with email instead.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
