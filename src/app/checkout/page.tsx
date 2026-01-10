"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Gift, CheckCircle, Share2, Users, Sparkles, CreditCard, Check, Shield, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { makeAuthenticatedRequest, getUserData } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { tierConfigs, creditPackages } from '@/lib/pricing-config';

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  // Get URL parameters
  const tier = searchParams.get('tier') || '';
  const creditPackageId = searchParams.get('package') || '';
  const mode = searchParams.get('mode') || 'subscription'; // 'subscription' or 'credits'

  const [referralCode, setReferralCode] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine what we're purchasing
  const isSubscription = mode === 'subscription' && tier;
  const isCreditPurchase = mode === 'credits' && creditPackageId;

  const currentTier = tier ? tierConfigs[tier.toLowerCase()] : null;
  const currentPackage = creditPackageId ? creditPackages[creditPackageId] : null;

  useEffect(() => {
    const fetchReferralData = async () => {
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

      try {
        // Fetch referral code
        const codeResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/referral/code`);

        if (codeResponse.ok) {
          const codeData = await codeResponse.json();
          setReferralCode(codeData.referral_code || '');
          setReferralLink(`${window.location.origin}/signup?ref=${codeData.referral_code}`);
        }
      } catch (error) {
        console.error('Error fetching referral data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Referral link copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

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

      if (isSubscription && currentTier) {
        // Handle subscription checkout
        if (!currentTier.stripePriceId) {
          toast({
            title: "Subscription not configured",
            description: "Please contact support.",
            variant: "destructive",
          });
          return;
        }

        const response = await fetch('/api/stripe/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId: currentTier.stripePriceId,
            productId: currentTier.stripeProductId,
            userEmail: userData.email,
            userId: userData.user_id,
            apiKey: userData.api_key,
            tier: tier,
            plan: currentTier.name,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start subscription');
        }

        const data = await response.json();

        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      } else if (isCreditPurchase && currentPackage) {
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
        // Fallback: Mode/parameter mismatch - show error and redirect to pricing
        toast({
          title: "Invalid checkout configuration",
          description: "Please select a plan from our pricing page.",
          variant: "destructive",
        });
        router.push('/settings/credits');
        return;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Show authentication required message if not authenticated
  if (!loading && !isAuthenticated) {
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

  // Show error if no valid tier or package selected
  if (!loading && !currentTier && !currentPackage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No Plan Selected</h3>
                <p className="text-muted-foreground mt-2">
                  Please select a plan from our pricing page
                </p>
              </div>
              <Button onClick={() => router.push('/settings/credits')}>
                View Plans
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Plan/Package */}
              {currentTier && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${currentTier.bgColor}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className={`text-xl font-bold ${currentTier.color}`}>
                          {currentTier.name} Plan
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {currentTier.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{currentTier.price}</p>
                        {currentTier.priceValue > 0 && (
                          <p className="text-sm text-muted-foreground">/month</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {currentTier.originalPrice && currentTier.discount && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground line-through">{currentTier.originalPrice}</span>
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full font-medium">
                        {currentTier.discount}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="font-medium text-sm">What's included:</p>
                    {currentTier.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentPackage && (
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
                </div>
              )}

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
                disabled={isProcessing || loading}
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

          {/* Referral CTA */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Gift className="h-6 w-6 text-primary" />
                Earn Free Credits!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-base">
                  Share your referral link with colleagues and friends to earn <span className="font-bold text-primary">bonus credits</span> for every sign-up!
                </p>
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Users className="h-8 w-8 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Both you and your friend get rewarded</p>
                    <p className="text-sm text-muted-foreground">When they sign up and make their first purchase</p>
                  </div>
                </div>
              </div>

              {/* Referral Link Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Referral Link</label>
                <div className="flex gap-2">
                  <Input
                    value={loading ? "Loading..." : referralLink}
                    readOnly
                    className="text-sm bg-background"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(referralLink)}
                    disabled={loading || !referralLink}
                    className={copied ? "bg-green-100 border-green-500" : ""}
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Share Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(referralLink)}
                disabled={loading || !referralLink}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Referral Link
              </Button>

              {/* Referral Code Display */}
              {referralCode && (
                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Or share your referral code: <span className="font-mono font-bold text-foreground">{referralCode}</span>
                  </p>
                </div>
              )}
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
