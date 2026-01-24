
"use client";

/**
 * Credits Page - Reusable Data Table Implementation
 * 
 * This page demonstrates how to create a reusable data table using mock data.
 * To use with real data:
 * 1. Replace mockTransactions with your actual data source (API call, props, etc.)
 * 2. Update the Transaction interface if your data structure differs
 * 3. The TransactionRow component will automatically render all transactions
 * 4. Add loading states, error handling, and pagination as needed
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Info, RefreshCw, ArrowUpRight, ChevronLeft, ChevronRight, CreditCard, MoreHorizontal, CheckCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirectToCheckout } from '@/lib/stripe';
import { getUserData, makeAuthenticatedRequest, requestAuthRefresh, saveUserData } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { TierInfoCard } from '@/components/tier/tier-info-card';
import { PricingSection } from '@/components/pricing/pricing-section';

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

// Credit package tier type
interface CreditPackage {
  id: string;
  name: string;
  creditValue: number; // Total credit value
  price: number; // Discounted price
  discount: string; // Discount percentage display
  popular?: boolean;
}

// Monthly credit packages with tiered discounts
const creditPackages: CreditPackage[] = [
  {
    id: 'tier1',
    name: 'Starter',
    creditValue: 10,
    price: 9,
    discount: '10% off',
  },
  {
    id: 'tier2',
    name: 'Growth',
    creditValue: 100,
    price: 75,
    discount: '25% off',
    popular: true,
  },
  {
    id: 'tier3',
    name: 'Scale',
    creditValue: 250,
    price: 175,
    discount: '30% off',
  },
];

// Transaction data type
interface Transaction {
  id: number;
  amount: number;
  transaction_type: string;
  created_at: string;
  description?: string;
  status?: string;
  balance?: number; // Running balance after this transaction
}

// Reusable TransactionRow component
const TransactionRow = ({ transaction }: { transaction: Transaction }) => {
  const handleMoreClick = () => {
    // Handle more options click
    console.log('More options clicked for transaction:', transaction.id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getTransactionType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'trial': 'Trial Credits',
      'purchase': 'Purchase',
      'admin_credit': 'Admin Credit',
      'admin_debit': 'Admin Debit',
      'api_usage': 'API Usage',
      'refund': 'Refund',
      'bonus': 'Bonus',
      'transfer': 'Transfer'
    };

    return typeMap[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="px-4 py-3 hover:bg-muted/50">
      {/* Desktop view - 5 columns */}
      <div className="hidden md:grid md:grid-cols-5 gap-4 items-center text-sm">
        <div className="font-medium">
          {getTransactionType(transaction.transaction_type)}
          {transaction.description && (
            <span className="text-muted-foreground ml-2">- {transaction.description}</span>
          )}
        </div>
        <div className={`font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
        </div>
        <div className="font-medium">{formatDate(transaction.created_at)}</div>
        <div className="font-medium text-right">
          {transaction.balance !== undefined ? `$${transaction.balance.toFixed(2)}` : '-'}
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleMoreClick}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile view - stacked layout */}
      <div className="md:hidden space-y-2 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium flex-1 min-w-0">
            {getTransactionType(transaction.transaction_type)}
            {transaction.description && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{transaction.description}</div>
            )}
          </div>
          <div className={`font-semibold flex-shrink-0 ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDate(transaction.created_at)}</span>
          <span>
            Balance: {transaction.balance !== undefined ? `$${transaction.balance.toFixed(2)}` : '-'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Component that uses useSearchParams - must be wrapped in Suspense
function CreditsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showEmojiExplosion, setShowEmojiExplosion] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);

  // Check for buy parameter to auto-open dialog
  useEffect(() => {
    const buyParam = searchParams?.get('buy');
    if (buyParam === 'true') {
      setShowDialog(true);
      // Clean up URL
      window.history.replaceState({}, '', '/settings/credits');
    }
  }, [searchParams]);

  // Check for success message from Stripe redirect
  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    if (sessionId) {
      setShowSuccessMessage(true);
      setShowEmojiExplosion(true); // Trigger emoji explosion!

      // Auto-hide success message after 10 seconds
      setTimeout(() => setShowSuccessMessage(false), 10000);

      // Fetch fresh credits and transactions after successful payment
      const fetchFreshData = async () => {
        try {
          let currentCredits: number | undefined;
          let tierUpdated = false;

          // Fetch user profile with tier and subscription info
          const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user/profile`);
          if (response.ok) {
            const data = await response.json();
            if (data.credits !== undefined) {
              currentCredits = data.credits;
              setCredits(data.credits);
            }

            // Update localStorage with fresh credits, tier, subscription info, and tiered credit fields
            const userData = getUserData();
            if (userData) {
              const updatedUserData = {
                ...userData,
                credits: data.credits || userData.credits,
                // Tiered credit fields (in cents from backend)
                subscription_allowance: data.subscription_allowance ?? userData.subscription_allowance,
                purchased_credits: data.purchased_credits ?? userData.purchased_credits,
                total_credits: data.total_credits ?? userData.total_credits,
                allowance_reset_date: data.allowance_reset_date || userData.allowance_reset_date,
                // Ensure tier is normalized to lowercase
                tier: data.tier ? data.tier.toLowerCase() : userData.tier,
                tier_display_name: data.tier_display_name || userData.tier_display_name,
                subscription_status: data.subscription_status || userData.subscription_status,
                subscription_end_date: data.subscription_end_date || userData.subscription_end_date
              };

              // Only save if we have valid tier information
              if (updatedUserData.tier && updatedUserData.subscription_status === 'active') {
                tierUpdated = true;
                saveUserData(updatedUserData);
                // Trigger a storage event manually since same-tab updates don't fire storage events
                window.dispatchEvent(new Event('storage'));
              } else if (!updatedUserData.tier) {
                console.warn('Plan upgrade detected but tier field missing from backend response. Scheduling retry...');
              }
            }
          } else {
            console.error('Failed to fetch user profile after payment:', response.status);
          }

          // Fetch transactions
          const txnResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/user/credit-transactions?limit=50`);
          if (txnResponse.ok) {
            const txnData = await txnResponse.json();
            if (Array.isArray(txnData.transactions)) {
              const mappedTransactions = txnData.transactions.map((txn: any, index: number) => ({
                id: txn.id,
                amount: txn.amount,
                transaction_type: txn.transaction_type,
                created_at: txn.created_at,
                description: txn.description,
                // For the most recent transaction, use current credits for accuracy
                balance: index === 0 && currentCredits !== undefined ? currentCredits : txn.balance_after
              }));
              setTransactions(mappedTransactions);
            }
          }

          // Trigger auth refresh to update tier and subscription info in context
          requestAuthRefresh();

          // If tier was not updated, retry after a short delay (backend might still be processing)
          if (!tierUpdated) {
            console.log('Scheduling tier verification retry in 2 seconds...');
            setTimeout(async () => {
              try {
                const retryResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/user/profile`);
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  if (retryData.tier && retryData.subscription_status === 'active') {
                    const retryUserData = getUserData();
                    if (retryUserData) {
                      saveUserData({
                        ...retryUserData,
                        // Tiered credit fields (in cents from backend)
                        subscription_allowance: retryData.subscription_allowance ?? retryUserData.subscription_allowance,
                        purchased_credits: retryData.purchased_credits ?? retryUserData.purchased_credits,
                        total_credits: retryData.total_credits ?? retryUserData.total_credits,
                        allowance_reset_date: retryData.allowance_reset_date || retryUserData.allowance_reset_date,
                        tier: retryData.tier.toLowerCase(),
                        tier_display_name: retryData.tier_display_name,
                        subscription_status: retryData.subscription_status,
                        subscription_end_date: retryData.subscription_end_date
                      });
                      window.dispatchEvent(new Event('storage'));
                      requestAuthRefresh();
                      console.log('Tier updated on retry:', retryData.tier);
                    }
                  }
                }
              } catch (retryError) {
                console.log('Tier verification retry failed:', retryError);
              }
            }, 2000);
          }
        } catch (error) {
          console.error('Error fetching fresh data after payment:', error);
        }
      };

      fetchFreshData();

      // Clean up URL
      window.history.replaceState({}, '', '/settings/credits');
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      // First try to get credits from local storage immediately
      const userData = getUserData();
      if (userData && userData.credits !== undefined) {
        setCredits(userData.credits);
        setLoadingCredits(false);
      }

      // Wait a bit for authentication to complete if no user data yet
      if (!userData) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      let currentCredits = userData?.credits;

      try {
        // Fetch fresh data from API
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user/profile`);
        if (response.ok) {
          const data = await response.json();
          if (data.credits !== undefined) {
            currentCredits = data.credits;
            setCredits(data.credits);
            // Update localStorage with fresh tier, subscription info, and tiered credit fields
            const userData = getUserData();
            if (userData) {
              saveUserData({
                ...userData,
                credits: data.credits,
                // Tiered credit fields (in cents from backend)
                subscription_allowance: data.subscription_allowance ?? userData.subscription_allowance,
                purchased_credits: data.purchased_credits ?? userData.purchased_credits,
                total_credits: data.total_credits ?? userData.total_credits,
                allowance_reset_date: data.allowance_reset_date || userData.allowance_reset_date,
                // Normalize tier to lowercase to match frontend expectations
                tier: data.tier?.toLowerCase(),
                tier_display_name: data.tier_display_name,
                subscription_status: data.subscription_status,
                subscription_end_date: data.subscription_end_date
              });
              // Trigger a storage event manually since same-tab updates don't fire storage events
              window.dispatchEvent(new Event('storage'));
            }
          }
        }
      } catch (error) {
        // Silently handle error - we already have local storage data
        console.log('Could not fetch fresh credits data');
      } finally {
        setLoadingCredits(false);
      }

      // Fetch transactions (all credit transactions - trial, purchases, usage, admin, etc.)
      try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user/credit-transactions?limit=50`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.transactions)) {
            // Transactions already include balance_after from the database
            const mappedTransactions = data.transactions.map((txn: any, index: number) => ({
              id: txn.id,
              amount: txn.amount,
              transaction_type: txn.transaction_type,
              created_at: txn.created_at,
              description: txn.description,
              // For the most recent transaction (index 0), use current credits for accuracy
              balance: index === 0 && currentCredits !== undefined ? currentCredits : txn.balance_after
            }));

            setTransactions(mappedTransactions);
          }
        }
      } catch (error) {
        console.log('Could not fetch transactions');
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchData();
  }, []);

  const handleBuyCredits = () => {
    setShowDialog(true);
  };

  const handleSelectPackage = (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPackage) {
      alert('Please select a credit package');
      return;
    }

    setIsLoading(true);
    setShowDialog(false);

    try {
      const userData = getUserData();

      if (!userData || !userData.api_key) {
        alert('Please wait for authentication to complete, then try again.');
        setIsLoading(false);
        return;
      }

      // Redirect to checkout page with package info
      router.push(`/checkout?package=${selectedPackage.id}&mode=credits`);
    } catch (error) {
      console.log('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(false);
      setSelectedPackage(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-0 pb-24 lg:pb-0">
      {/* Emoji explosion animation */}
      {showEmojiExplosion && (
        <EmojiExplosion onComplete={() => setShowEmojiExplosion(false)} />
      )}

      <div className="flex justify-center">
        <h1 className="text-2xl sm:text-3xl font-bold">Credits</h1>
        {/* <Button variant="ghost" size="icon" className="text-muted-foreground">
          <RefreshCw className="h-5 w-5" />
        </Button> */}
      </div>

      {/* Subscription Tier Information */}
      <div className="max-w-2xl mx-auto">
        <TierInfoCard />
      </div>

      {/* Pricing Section */}
      <PricingSection />

      {/* Success message after Stripe payment */}
      {showSuccessMessage && (
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-in slide-in-from-top duration-500">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-green-900 dark:text-green-100">🎉 Payment successful!</p>
              <p className="text-sm text-green-700 dark:text-green-300">Your credits have been added to your account.</p>
            </div>
            <button
              onClick={() => setShowSuccessMessage(false)}
              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-semibold">Available Balance</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <Card
              className="w-full sm:w-auto sm:min-w-[240px] h-14 text-xl md:text-2xl font-semibold bg-muted/50 border-border px-4 sm:px-8"
            >
              <CardContent className="py-[13px] flex items-center justify-center">
                {loadingCredits ? (
                  <span className="text-xl md:text-2xl font-bold text-muted-foreground">Loading...</span>
                ) : credits !== null ? (
                  <span className="text-xl md:text-2xl font-bold">${credits.toFixed(2)}</span>
                ) : (
                  <span className="text-xl md:text-2xl font-bold text-muted-foreground">$0.00</span>
                )}
              </CardContent>
            </Card>
            <Button
              className="bg-black text-white h-12 px-6 sm:px-12 w-full sm:w-auto"
              onClick={handleBuyCredits}
              disabled={isLoading || loadingCredits}
            >
              {isLoading ? 'Loading...' : loadingCredits ? 'Authenticating...' : 'Buy Credits'}
            </Button>
          </div>
        </div>

        {/* Credit Breakdown for Pro/Max Users */}
        {(() => {
          const userData = getUserData();
          const tier = userData?.tier?.toLowerCase();
          const isPaidTier = tier === 'pro' || tier === 'max';
          const hasActiveSubscription = userData?.subscription_status === 'active';

          if (!isPaidTier || !hasActiveSubscription || !userData) return null;

          const subscriptionAllowance = (userData.subscription_allowance ?? 0) / 100;
          const purchasedCredits = (userData.purchased_credits ?? 0) / 100;
          const totalCredits = (userData.total_credits ?? userData.credits ?? 0) / 100;

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Monthly Allowance Card */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-green-900 dark:text-green-100">Monthly Allowance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                    ${subscriptionAllowance.toFixed(2)}
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Resets on billing date
                  </p>
                </CardContent>
              </Card>

              {/* Purchased Credits Card */}
              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-blue-900 dark:text-blue-100">Purchased Credits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    ${purchasedCredits.toFixed(2)}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Never expire
                  </p>
                </CardContent>
              </Card>

              {/* Total Available Card */}
              <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-purple-900 dark:text-purple-100">Total Available</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    ${totalCredits.toFixed(2)}
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    Combined balance
                  </p>
                </CardContent>
              </Card>
            </div>
          );
        })()}
      </div>

      {/* Purchase Credits Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) setSelectedPackage(null);
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Purchase Credits</DialogTitle>
            <DialogDescription>
              Choose a credit package. Larger packages offer bigger savings!
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
            {creditPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`relative cursor-pointer transition-all hover:shadow-md ${
                  selectedPackage?.id === pkg.id
                    ? 'border-primary border-2 shadow-md'
                    : 'border-border hover:border-primary/50'
                } ${pkg.popular ? 'ring-1 ring-primary/20' : ''}`}
                onClick={() => handleSelectPackage(pkg)}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Best Value
                  </div>
                )}
                <CardContent className="p-4 pt-5 text-center">
                  <h3 className="font-semibold text-base mb-1">{pkg.name}</h3>
                  <div className="mb-2">
                    <span className="text-2xl font-bold">${pkg.creditValue}</span>
                    <span className="text-sm text-muted-foreground ml-1">credits</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold text-primary">
                      ${pkg.price}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-muted-foreground line-through">${pkg.creditValue}</span>
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                        {pkg.discount}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Save ${pkg.creditValue - pkg.price}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="sm:order-1">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmPurchase}
              disabled={!selectedPackage}
              className="sm:order-2"
            >
              {selectedPackage
                ? `Buy $${selectedPackage.creditValue} Credits for $${selectedPackage.price}`
                : 'Select a Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl"> */}
        {/* <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Buy Credits</CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span>Use crypto</span>
                <Switch />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button size="lg" className="w-full">Add Credits</Button>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1">
              View Usage <ArrowUpRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card> */}
        
        {/* <Card>
          <CardHeader>
            <CardTitle className="text-lg">Auto Top-Up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              To activate auto-top-up, you'll need a payment method that supports offline charging.
            </p> */}
            {/* <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full">Add a Payment Method</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add a Payment Method</DialogTitle>
                  <DialogDescription>
                    Enter your payment details below. Your payment information is securely stored.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="card-name">Cardholder Name</Label>
                    <Input id="card-name" placeholder="John Doe" value={cardName} onChange={(e) => setCardName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card-number">Card Number</Label>
                    <div className="relative">
                      <Input id="card-number" placeholder="**** **** **** 1234" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
                      <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry-date">Expiry Date</Label>
                      <Input id="expiry-date" placeholder="MM/YY" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvc">CVC</Label>
                      <Input id="cvc" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value)} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="secondary">Cancel</Button>
                  <Button type="submit">Save Card</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog> */}
          {/* </CardContent>
        </Card> */}
      {/* </div> */}

      <div className="space-y-4">
        <div className="border border-border overflow-hidden border-x-0">
          <div className="bg-muted/50 px-4 py-3 border-b border-border">
            {/* Desktop header - 5 columns */}
            <div className="hidden md:grid md:grid-cols-5 gap-4 text-sm font-medium">
              <div>Recent Transactions</div>
              <div>Amount</div>
              <div>Date</div>
              <div className="text-right">Balance After</div>
              <div></div>
            </div>
            {/* Mobile header - simple heading */}
            <div className="md:hidden text-sm font-medium">
              Recent Transactions
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {loadingTransactions ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                Loading transactions...
              </div>
            ) : transactions.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              transactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function CreditsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-8">
        <div className="flex justify-center">
          <h1 className="text-3xl font-bold">Credits</h1>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CreditsPageContent />
    </Suspense>
  );
}
