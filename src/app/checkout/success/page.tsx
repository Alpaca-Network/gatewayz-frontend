"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Gift, CheckCircle, Share2, Users, Sparkles, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { makeAuthenticatedRequest, getUserData } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get URL parameters
  const sessionId = searchParams.get('session_id') || '';
  const tier = searchParams.get('tier') || 'credits';
  const amount = searchParams.get('amount') || '';

  const [referralCode, setReferralCode] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Tier display configuration
  const tierConfig: Record<string, { name: string; color: string; bgColor: string }> = {
    starter: { name: 'Starter', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    pro: { name: 'Pro', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    max: { name: 'Max', color: 'text-purple-600', bgColor: 'bg-purple-100' },
    enterprise: { name: 'Enterprise', color: 'text-amber-600', bgColor: 'bg-amber-100' },
    credits: { name: 'Credits', color: 'text-green-600', bgColor: 'bg-green-100' },
  };

  const currentTier = tierConfig[tier.toLowerCase()] || tierConfig.credits;

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

  const shareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Gatewayz',
          text: 'Sign up for Gatewayz and get bonus credits! Use my referral link:',
          url: referralLink,
        });
      } catch (error) {
        // User cancelled or share failed, fallback to copy
        copyToClipboard(referralLink);
      }
    } else {
      copyToClipboard(referralLink);
    }
  };

  // Show authentication required message if not authenticated
  if (!loading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Session Expired</h3>
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
            Your <span className={`font-semibold ${currentTier.color}`}>{currentTier.name}</span> have been added to your account.
          </p>
        </div>

        {/* Order Confirmation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Order Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Purchase</span>
                <span className={`font-semibold px-3 py-1 rounded-full text-sm ${currentTier.bgColor} ${currentTier.color}`}>
                  {currentTier.name}
                </span>
              </div>
              {amount && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">${amount}</span>
                </div>
              )}
              {sessionId && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono text-sm text-muted-foreground">{sessionId.slice(0, 20)}...</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Status</span>
                <span className="flex items-center gap-2 text-green-600 font-semibold">
                  <CheckCircle className="h-4 w-4" />
                  Complete
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral CTA - Main Focus */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Gift className="h-6 w-6 text-primary" />
              Earn Free Credits!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-lg">
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

            {/* Share Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                size="lg"
                onClick={shareReferralLink}
                disabled={loading || !referralLink}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Referral Link
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => copyToClipboard(referralLink)}
                disabled={loading || !referralLink}
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>

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

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/settings/referrals'}
          >
            View Referral Dashboard
          </Button>
          <Button
            onClick={() => window.location.href = '/chat'}
          >
            Start Using Gatewayz
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SuccessPageContent />
    </Suspense>
  );
}
