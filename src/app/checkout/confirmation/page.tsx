"use client";

/**
 * Checkout Confirmation Page - Post-purchase thank you page
 *
 * This page is shown after a successful payment to:
 * 1. Confirm the purchase was successful
 * 2. Allow analytics to track completed purchase conversions
 * 3. Encourage referrals with $10 credit incentive
 *
 * URL: /checkout/confirmation?session_id=XXX&type=credits|subscription&tier=pro|max
 */

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  Gift,
  Copy,
  Users,
  ArrowRight,
  Sparkles,
  Share2,
  Twitter,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { makeAuthenticatedRequest, getUserData, requestAuthRefresh, saveUserData } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';

// Confetti/Emoji explosion component
const EmojiExplosion = ({ onComplete }: { onComplete: () => void }) => {
  const emojis = ['🎉', '💰', '✨', '🚀', '💎', '⭐', '🔥', '💸', '🎊', '🌟'];
  const [particles, setParticles] = useState<Array<{
    id: number;
    emoji: string;
    x: number;
    y: number;
    rotation: number;
    velocity: { x: number; y: number };
    rotationSpeed: number;
  }>>([]);

  useEffect(() => {
    // Create 100 emoji particles for more coverage
    const newParticles = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      x: 50, // Start from center
      y: 50,
      rotation: Math.random() * 360,
      velocity: {
        x: (Math.random() - 0.5) * 100, // Much larger spread
        y: (Math.random() - 0.5) * 100, // Much larger spread
      },
      rotationSpeed: (Math.random() - 0.5) * 15,
    }));

    setParticles(newParticles);

    // Clean up after animation
    const timer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute text-8xl animate-emoji-explosion"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            transform: `translate(-50%, -50%) rotate(${particle.rotation}deg)`,
            animation: `emojiFloat 4s ease-out forwards`,
            '--tx': `${particle.velocity.x}vw`,
            '--ty': `${particle.velocity.y}vh`,
            '--rotation': `${particle.rotationSpeed * 360}deg`,
          } as React.CSSProperties}
        >
          {particle.emoji}
        </div>
      ))}
      <style jsx>{`
        @keyframes emojiFloat {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(0deg) scale(0);
          }
          5% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(0deg) scale(2);
          }
          100% {
            opacity: 0;
            transform: translate(
              calc(-50% + var(--tx)),
              calc(-50% + var(--ty))
            ) rotate(var(--rotation)) scale(1.5);
          }
        }
      `}</style>
    </div>
  );
};

function ConfirmationPageContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [showEmojiExplosion, setShowEmojiExplosion] = useState(true);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const hasInitialized = useRef(false);

  // Get purchase details from URL params
  const sessionId = searchParams?.get('session_id');
  const type = searchParams?.get('type') || 'credits';
  const tier = searchParams?.get('tier');
  const amount = searchParams?.get('amount');

  const isSubscription = type === 'subscription';
  const purchaseDescription = isSubscription
    ? `${tier?.charAt(0).toUpperCase()}${tier?.slice(1)} Plan subscription`
    : `$${amount} credits`;

  // Fetch referral code and update user data
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fetchData = async () => {
      // Wait for authentication
      let userData = getUserData();
      let retries = 0;
      const maxRetries = 5;

      while (!userData && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        userData = getUserData();
        retries++;
      }

      if (!userData) {
        setLoadingReferral(false);
        return;
      }

      try {
        // Fetch fresh user profile to update credits and tier
        const profileResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/user/profile`);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();

          // Update localStorage with fresh data
          const currentUserData = getUserData();
          if (currentUserData) {
            saveUserData({
              ...currentUserData,
              credits: profileData.credits || currentUserData.credits,
              tier: profileData.tier?.toLowerCase() || currentUserData.tier,
              tier_display_name: profileData.tier_display_name || currentUserData.tier_display_name,
              subscription_status: profileData.subscription_status || currentUserData.subscription_status,
              subscription_end_date: profileData.subscription_end_date || currentUserData.subscription_end_date
            });
            window.dispatchEvent(new Event('storage'));
            requestAuthRefresh();
          }
          setDataFetched(true);
        }

        // Fetch referral code
        const codeResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/referral/code`);
        if (codeResponse.ok) {
          const codeData = await codeResponse.json();
          setReferralCode(codeData.referral_code || '');
          setReferralLink(`${window.location.origin}/signup?ref=${codeData.referral_code}`);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingReferral(false);
      }
    };

    fetchData();
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard!` });
    } catch (error) {
      toast({
        title: `Failed to copy ${label.toLowerCase()}`,
        variant: "destructive",
      });
    }
  };

  const shareOnTwitter = () => {
    const text = `I just upgraded my Gatewayz AI account! Use my referral link to get started and we'll both earn $10 in credits: ${referralLink}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4">
      {/* Emoji explosion animation */}
      {showEmojiExplosion && (
        <EmojiExplosion onComplete={() => setShowEmojiExplosion(false)} />
      )}

      <div className="max-w-2xl mx-auto space-y-8">
        {/* Success message */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Payment Successful!</h1>
          <p className="text-lg text-muted-foreground">
            Thank you for your purchase of {purchaseDescription}.
          </p>
          <p className="text-muted-foreground">
            Your credits are now available in your account.
          </p>
        </div>

        {/* Refer a friend card - Main CTA */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-2">
              <Gift className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Earn $10 in Credits!
              <Sparkles className="h-5 w-5 text-yellow-500" />
            </CardTitle>
            <CardDescription className="text-base">
              Share Gatewayz with friends and you'll both receive <strong className="text-foreground">$10 in credits</strong> when they make their first purchase.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Referral link section */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Your Referral Link</label>
              <div className="flex gap-2">
                <Input
                  value={loadingReferral ? "Loading..." : referralLink}
                  readOnly
                  className="font-mono text-sm bg-background"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(referralLink, "Referral link")}
                  disabled={loadingReferral || !referralLink}
                  className="flex-shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Referral code */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Referral Code</label>
              <div className="flex gap-2">
                <Input
                  value={loadingReferral ? "Loading..." : referralCode}
                  readOnly
                  className="font-mono text-lg bg-background"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(referralCode, "Referral code")}
                  disabled={loadingReferral || !referralCode}
                  className="flex-shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Share buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => copyToClipboard(referralLink, "Referral link")}
                disabled={loadingReferral || !referralLink}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={shareOnTwitter}
                disabled={loadingReferral || !referralLink}
              >
                <Twitter className="h-4 w-4 mr-2" />
                Share on X
              </Button>
            </div>

            {/* How it works */}
            <div className="bg-background/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                How it works
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col items-center text-center p-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary font-bold">1</div>
                  <p>Share your link with friends</p>
                </div>
                <div className="flex flex-col items-center text-center p-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary font-bold">2</div>
                  <p>They sign up and make a purchase</p>
                </div>
                <div className="flex flex-col items-center text-center p-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary font-bold">3</div>
                  <p>You both get $10 in credits!</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation options */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/chat" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto h-12 px-8" size="lg">
              Start Using AI
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
          <Link href="/settings/credits" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto h-12 px-8" size="lg">
              View Credits
            </Button>
          </Link>
          <Link href="/settings/referrals" className="flex-1 sm:flex-none">
            <Button variant="ghost" className="w-full sm:w-auto h-12 px-8" size="lg">
              Referral Dashboard
            </Button>
          </Link>
        </div>

        {/* Receipt note */}
        <p className="text-center text-sm text-muted-foreground">
          A receipt has been sent to your email address.
        </p>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading confirmation...</p>
        </div>
      </div>
    }>
      <ConfirmationPageContent />
    </Suspense>
  );
}
