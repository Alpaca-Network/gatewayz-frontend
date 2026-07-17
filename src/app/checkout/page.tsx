"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, CreditCard, Shield, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getUserMessage } from '@/lib/errors';
import { getUserData } from '@/lib/api';
import { creditPackages } from '@/lib/pricing-config';

// Prepaid-only checkout: this page handles credit top-ups exclusively
// (subscription management — subscribe/upgrade/downgrade/cancel — was
// removed; see D-FE1 in docs/superpowers/plans/2026-07-17-frontend-mvp-refactor.md).
// Entry point: /settings/credits -> /checkout?package=<id>&mode=credits[&amount=<custom>]
function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  // Get URL parameters
  const creditPackageId = searchParams.get('package') || '';
  const customAmountParam = searchParams.get('amount') || '';

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle custom package with dynamic amount from URL
  // Min $5 to meet Stripe requirements, max $10,000 for safety
  const MIN_CUSTOM_AMOUNT = 5;
  const MAX_CUSTOM_AMOUNT = 10000;

  const currentPackage = creditPackageId ? (() => {
    const pkg = creditPackages[creditPackageId];
    if (creditPackageId === 'custom' && customAmountParam) {
      const customAmount = parseFloat(customAmountParam);
      if (!isNaN(customAmount) && customAmount >= MIN_CUSTOM_AMOUNT && customAmount <= MAX_CUSTOM_AMOUNT) {
        return {
          ...pkg,
          creditValue: customAmount,
          price: customAmount, // Custom amounts have no discount
          discount: 'No discount',
        };
      }
    }
    return pkg;
  })() : null;

  // Check auth immediately without polling - user data should be available from the auth provider
  useEffect(() => {
    const userData = getUserData();
    setIsAuthenticated(!!userData);
  }, []);

  const handleProceedToPayment = async () => {
    setIsProcessing(true);

    try {
      const userData = getUserData();

      if (!userData || !userData.api_key) {
        toast({
          title: "Please sign in to continue",
          variant: "destructive",
        });
        router.push('/signup');
        return;
      }

      if (currentPackage) {
        // Handle credit purchase checkout
        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: currentPackage.price,
            creditValue: currentPackage.creditValue,
            userEmail: userData.email,
            userId: userData.user_id,
            apiKey: userData.api_key,
            plan: currentPackage.name,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create checkout session');
        }

        const data = await response.json();

        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      } else {
        // Fallback: no valid package selected - show error and redirect to credits
        toast({
          title: "Invalid checkout configuration",
          description: "Please select a credit package from the credits page.",
          variant: "destructive",
        });
        router.push('/settings/credits');
        return;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout failed",
        description: getUserMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Show authentication required message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Authentication Required</h3>
                <p className="text-muted-foreground mt-2">
                  Please log in to complete your purchase
                </p>
              </div>
              <Button onClick={() => router.push('/signup')}>
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if no valid package selected
  if (!currentPackage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No Package Selected</h3>
                <p className="text-muted-foreground mt-2">
                  Please select a credit package from the credits page
                </p>
              </div>
              <Button onClick={() => router.push('/settings/credits')}>
                View Credit Packages
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Confirm Your Order</h1>
          <p className="text-muted-foreground text-lg">
            Review your selection before proceeding to payment
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Order Summary */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Credit Package */}
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-blue-600">
                        {currentPackage.name} Credit Package
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        ${currentPackage.creditValue} in credits
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">${currentPackage.price}</p>
                      <p className="text-sm text-muted-foreground">one-time</p>
                    </div>
                  </div>
                </div>

                {currentPackage.price < currentPackage.creditValue && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground line-through">${currentPackage.creditValue}</span>
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full font-medium">
                        {currentPackage.discount}
                      </span>
                    </div>

                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <p>
                        <span className="font-semibold">You save: </span>
                        ${currentPackage.creditValue - currentPackage.price}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Trust Badges */}
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span>Secure payment powered by Stripe</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-yellow-600" />
                  <span>Instant activation after payment</span>
                </div>
              </div>

              {/* Proceed Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleProceedToPayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="animate-spin mr-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </span>
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Proceed to Payment
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
