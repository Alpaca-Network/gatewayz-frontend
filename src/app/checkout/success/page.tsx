"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, CheckCircle, Sparkles } from "lucide-react";
import { getUserData } from '@/lib/api';

// Google Ads Purchase Conversion ID
const GOOGLE_ADS_PURCHASE_CONVERSION_ID = 'AW-17515449277/fsG3CMPGlt8bEL2XgqBB';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const conversionTrackedRef = useRef(false);

  // Get URL parameters. This page is credit-top-up only (D-FE1); the
  // Stripe checkout success_url always sets tier=credits (see
  // src/app/api/stripe/checkout/route.ts).
  const rawPlan = searchParams.get('plan') || '';
  // Sanitize plan parameter - only allow alphanumeric, spaces, and basic punctuation
  const plan = rawPlan.replace(/[^a-zA-Z0-9\s\-_.]/g, '');
  const sessionId = searchParams.get('session_id') || '';

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Track Google Ads purchase conversion on page load
  useEffect(() => {
    if (conversionTrackedRef.current) return;
    conversionTrackedRef.current = true;

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        'send_to': GOOGLE_ADS_PURCHASE_CONVERSION_ID,
        'transaction_id': sessionId || undefined,
      });
    }
  }, [sessionId]);

  const currentTier = { name: 'Credit Package', color: 'text-green-600', bgColor: 'bg-green-100' };
  // Use plan parameter if provided, otherwise fall back to the default name
  const displayPlanName = plan || currentTier.name;

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);

      // Wait for authentication with retries
      let userData = getUserData();
      let retries = 0;
      const maxRetries = 5;

      while (!userData && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        userData = getUserData();
        retries++;
      }

      setIsAuthenticated(!!userData);
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Show authentication required message if not authenticated
  if (!loading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Authentication Required</h3>
                <p className="text-muted-foreground mt-2">
                  Please log in to view your purchase details
                </p>
              </div>
              <Button onClick={() => window.location.href = '/signup'}>
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold">Thank You for Your Purchase!</h1>
          <p className="text-muted-foreground text-lg">
            Your credits have been added to your account.
          </p>
        </div>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Purchase</span>
                <span className={`font-semibold px-3 py-1 rounded-full text-sm ${currentTier.bgColor} ${currentTier.color}`}>
                  {displayPlanName}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Status</span>
                <span className="flex items-center gap-2 text-green-600 font-semibold">
                  <CheckCircle className="h-4 w-4" />
                  Completed
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => window.location.href = '/chat'}
          >
            Start Using Gatewayz
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
