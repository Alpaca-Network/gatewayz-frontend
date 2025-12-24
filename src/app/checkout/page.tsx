"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, CreditCard, Shield, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getUserData, getApiKey } from '@/lib/api';
import { redirectToCheckout } from '@/lib/stripe';

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  // Get URL parameters
  const tier = searchParams.get('tier') || 'pro';
  const priceId = searchParams.get('priceId') || '';
  const amount = searchParams.get('amount') || '';
  const credits = searchParams.get('credits') || amount;

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<number | undefined>();

  // Tier display configuration
  const tierConfig: Record<string, { name: string; color: string; bgColor: string; description: string }> = {
    starter: {
      name: 'Starter',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      description: 'Perfect for getting started with AI'
    },
    pro: {
      name: 'Pro',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'For professionals who need more power'
    },
    max: {
      name: 'Max',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Maximum capabilities for power users'
    },
    enterprise: {
      name: 'Enterprise',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      description: 'Custom solutions for large teams'
    },
    credits: {
      name: 'Credits',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Add credits to your account'
    },
  };

  const currentTier = tierConfig[tier.toLowerCase()] || tierConfig.credits;

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

      if (!userData) {
        setLoading(false);
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);
      setUserEmail(userData.email);
      setUserId(userData.user_id);
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleProceedToPayment = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      toast({
        title: "Invalid amount",
        description: "Please go back and select a valid plan.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const amountValue = parseFloat(amount);
      const creditsValue = credits ? parseFloat(credits) : amountValue;

      await redirectToCheckout(amountValue, userEmail, userId, creditsValue);
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Failed to proceed to payment. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading checkout...</p>
        </div>
      </div>
    );
  }

  // Show authentication required message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground" />
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

  // Show error if no amount provided
  if (!amount || isNaN(parseFloat(amount))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No Items Selected</h3>
                <p className="text-muted-foreground mt-2">
                  Please select a plan or credit package to purchase.
                </p>
              </div>
              <Button onClick={() => router.push('/settings/credits')}>
                Browse Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const amountValue = parseFloat(amount);
  const creditsValue = credits ? parseFloat(credits) : amountValue;
  const hasDiscount = creditsValue > amountValue;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={handleGoBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Confirm Your Order</h1>
          <p className="text-muted-foreground">
            Review your purchase before proceeding to payment
          </p>
        </div>

        {/* Order Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order Summary
            </CardTitle>
            <CardDescription>
              {currentTier.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Plan Details */}
            <div className="flex justify-between items-center py-3">
              <div>
                <p className="font-medium">Plan</p>
                <p className="text-sm text-muted-foreground">Gatewayz AI Credits</p>
              </div>
              <span className={`font-semibold px-3 py-1 rounded-full text-sm ${currentTier.bgColor} ${currentTier.color}`}>
                {currentTier.name}
              </span>
            </div>

            <Separator />

            {/* Credits */}
            <div className="flex justify-between items-center py-3">
              <p className="text-muted-foreground">Credits</p>
              <p className="font-semibold text-lg">${creditsValue.toFixed(2)}</p>
            </div>

            {/* Discount (if applicable) */}
            {hasDiscount && (
              <>
                <div className="flex justify-between items-center py-2 text-green-600">
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Discount Applied
                  </p>
                  <p className="font-medium">-${(creditsValue - amountValue).toFixed(2)}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Total */}
            <div className="flex justify-between items-center py-3">
              <p className="font-semibold text-lg">Total</p>
              <div className="text-right">
                <p className="font-bold text-2xl">${amountValue.toFixed(2)}</p>
                {hasDiscount && (
                  <p className="text-sm text-muted-foreground line-through">${creditsValue.toFixed(2)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-sm">Secure Payment</p>
                <p className="text-sm text-muted-foreground">
                  Your payment is processed securely by Stripe. We never store your card details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proceed Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleProceedToPayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Redirecting to Payment...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Proceed to Payment
            </>
          )}
        </Button>

        {/* Terms */}
        <p className="text-center text-xs text-muted-foreground">
          By proceeding, you agree to our Terms of Service and Privacy Policy.
        </p>
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
