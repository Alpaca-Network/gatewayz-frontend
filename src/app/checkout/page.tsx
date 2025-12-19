"use client";

/**
 * Checkout Page - Intermediate page for analytics tracking
 *
 * This page serves as an intermediate step in the checkout flow to allow
 * analytics tools (Google Analytics, Google Ads, X Ads, etc.) to track
 * conversion events when users initiate checkout.
 *
 * Flow:
 * 1. User clicks "Buy Credits" or subscription button
 * 2. User is redirected to /checkout with purchase details in URL params
 * 3. Analytics can track this page view as a "begin_checkout" conversion
 * 4. User clicks "Proceed to Payment" to go to Stripe
 * 5. After payment, user is redirected to /checkout/confirmation
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CreditCard, Shield, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { getUserData } from '@/lib/api';

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get checkout details from URL params
  const type = searchParams?.get('type') || 'credits'; // 'credits' or 'subscription'
  const amount = searchParams?.get('amount');
  const creditValue = searchParams?.get('creditValue'); // Credits to add (may differ from amount due to discounts)
  const tier = searchParams?.get('tier');
  const priceId = searchParams?.get('priceId');
  const productId = searchParams?.get('productId');

  // Determine what's being purchased
  const isSubscription = type === 'subscription';
  const credits = creditValue || amount;
  const displayAmount = isSubscription
    ? (tier === 'pro' ? '$10' : tier === 'max' ? '$75' : `$${amount}`)
    : `$${amount}`;
  const displayName = isSubscription
    ? `${tier?.charAt(0).toUpperCase()}${tier?.slice(1)} Plan`
    : `$${credits} Credits`;

  const handleProceedToPayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const userData = getUserData();

      if (!userData || !userData.api_key) {
        setError('Please sign in to continue with checkout');
        setIsLoading(false);
        return;
      }

      let response;

      if (isSubscription) {
        // Subscription checkout
        response = await fetch('/api/stripe/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId,
            productId,
            userEmail: userData.email,
            userId: userData.user_id,
            apiKey: userData.api_key,
            tier,
          }),
        });
      } else {
        // Credits checkout
        response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: parseFloat(amount || '0'),
            creditValue: parseFloat(creditValue || amount || '0'), // Credits to add
            userEmail: userData.email,
            userId: userData.user_id,
            apiKey: userData.api_key,
          }),
        });
      }

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
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  // If no valid checkout params, redirect back
  useEffect(() => {
    if (!amount && !tier) {
      router.push('/settings/credits');
    }
  }, [amount, tier, router]);

  if (!amount && !tier) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Back link */}
        <Link
          href="/settings/credits"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Credits
        </Link>

        {/* Main checkout card */}
        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Checkout</CardTitle>
            <CardDescription>
              Review your purchase before proceeding to payment
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Order summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Item</span>
                <span className="font-medium">{displayName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">
                  {isSubscription ? 'Monthly Subscription' : 'One-time Purchase'}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold">{displayAmount}</span>
              </div>
              {isSubscription && (
                <p className="text-xs text-muted-foreground text-center">
                  Billed monthly. Cancel anytime.
                </p>
              )}
            </div>

            {/* Features/benefits */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Instant credit activation</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Secure payment via Stripe</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Email receipt included</span>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Proceed button */}
            <Button
              className="w-full h-12 text-lg"
              onClick={handleProceedToPayment}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Redirecting to payment...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  Proceed to Payment
                </>
              )}
            </Button>

            {/* Security note */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Secured by Stripe. Your payment info is never stored on our servers.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading checkout...</p>
        </div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
