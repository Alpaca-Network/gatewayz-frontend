"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, UserPlus, Gift, Users, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { makeAuthenticatedRequest, getUserData } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { normalizeReferralData, calculateStats, ReferralTransaction } from '@/lib/referral-utils';

// Stats card component
const StatCard = ({
  title,
  value,
  icon: Icon,
  description
}: {
  title: string;
  value: string | number;
  icon: any;
  description?: string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </CardContent>
  </Card>
);

// Referral row component
const ReferralRow = ({ referral }: { referral: ReferralTransaction }) => {
  // Add safety checks for referral data
  if (!referral) {
    return (
      <div className="px-4 py-3 hover:bg-muted/50">
        <div className="text-sm text-muted-foreground">Invalid referral data</div>
      </div>
    );
  }
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div className="px-4 py-3 hover:bg-muted/50">
      <div className="grid grid-cols-4 gap-4 items-center text-sm">
        <div className="font-medium truncate">{referral.referee_email || 'N/A'}</div>
        <div className="flex items-center gap-2">
          {(referral.status || 'pending') === 'completed' ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Completed</span>
            </>
          ) : (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/50" />
              <span className="text-muted-foreground">Pending</span>
            </>
          )}
        </div>
        <div className="font-medium text-green-600">
          +${(referral.reward_amount || 0).toFixed(2)}
        </div>
        <div className="text-right text-muted-foreground">
          {formatDate(referral.completed_at || referral.created_at)}
        </div>
      </div>
    </div>
  );
};

function ReferralsPageContent() {
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  const [referrals, setReferrals] = useState<ReferralTransaction[]>([]);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    completedReferrals: 0,
    totalEarned: 0
  });
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const fetchReferralData = async () => {
      setLoading(true);

      // Wait for authentication to complete with multiple retries
      let userData = getUserData();
      let retries = 0;
      const maxRetries = 5;

      while (!userData && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        userData = getUserData();
        retries++;
      }

      // Check if user is authenticated after retries
      if (!userData) {
        console.warn('No user data available after retries - user may not be authenticated');
        setLoading(false);
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);

      try {
        console.log('Fetching referral code from:', `${API_BASE_URL}/referral/code`);
        // Fetch referral code
        const codeResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/referral/code`);
        console.log('Referral code response status:', codeResponse.status);

        if (codeResponse.ok) {
          const codeData = await codeResponse.json();
          console.log('Referral code data:', { referral_code: codeData.referral_code });
          setReferralCode(codeData.referral_code || '');
          setReferralLink(`${window.location.origin}/signup?ref=${codeData.referral_code}`);
        } else {
          const errorText = await codeResponse.text();
          console.error('Failed to fetch referral code:', codeResponse.status, errorText);
          if (codeResponse.status === 401) {
            toast({
              title: "Session Expired",
              description: "Please log in again",
              variant: "destructive"
            });
          }
        }

        console.log('Fetching referral stats from:', `${API_BASE_URL}/referral/stats`);
        // Fetch referral stats
        const statsResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/referral/stats`);
        console.log('Referral stats response status:', statsResponse.status);

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          console.log('Referral stats data:', statsData);
          console.log('Full API response structure:', JSON.stringify(statsData, null, 2));

          // Normalize referral data first so we can use it for both display and stats
          let normalizedReferrals: ReferralTransaction[] = [];

          // Set referrals from stats response
          if (Array.isArray(statsData.referrals)) {
            console.log('Referrals array:', statsData.referrals);
            console.log('First referral:', statsData.referrals[0]);
            if (statsData.referrals.length > 0) {
              console.log('First referral keys:', Object.keys(statsData.referrals[0]));
              console.log('First referral values:', Object.values(statsData.referrals[0]));
              console.log('Normalized first referral:', normalizeReferralData(statsData.referrals[0]));
            }
            // Normalize the referral data
            normalizedReferrals = statsData.referrals.map(normalizeReferralData);
            setReferrals(normalizedReferrals);
          } else {
            console.log('Referrals is not an array:', typeof statsData.referrals, statsData.referrals);
          }

          // Set stats from response - use normalized data for completedReferrals count
          setStats(calculateStats(statsData, normalizedReferrals));
        } else {
          const errorText = await statsResponse.text();
          console.error('Failed to fetch referral stats:', statsResponse.status, errorText);
          if (statsResponse.status === 401) {
            toast({
              title: "Session Expired",
              description: "Please log in again",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('Error fetching referral data:', error);
        toast({
          title: "Error loading referral data",
          description: error instanceof Error ? error.message : "Please try again later",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard` });
    } catch (error) {
      toast({
        title: `Failed to copy ${label.toLowerCase()}`,
        variant: "destructive",
      });
    }
  };

  // Show authentication required message if not authenticated
  if (!loading && !isAuthenticated) {
    return (
      <div className="space-y-8">
        <div className="flex justify-center">
          <h1 className="text-3xl font-bold">Referrals</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <UserPlus className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Authentication Required</h3>
                <p className="text-muted-foreground mt-2">
                  Please log in to view your referral information
                </p>
              </div>
              <Button onClick={() => window.location.href = '/chat'}>
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <h1 className="text-3xl font-bold">Referrals</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Referrals"
          value={loading ? "..." : stats.totalReferrals}
          icon={Users}
          description="People you've invited"
        />
        <StatCard
          title="Completed"
          value={loading ? "..." : stats.completedReferrals}
          icon={CheckCircle}
          description="Referrals that made a purchase"
        />
        <StatCard
          title="Total Earned"
          value={loading ? "..." : `$${(stats.totalEarned || 0).toFixed(2)}`}
          icon={Gift}
          description="Credits earned from referrals"
        />
      </div>

      {/* Referral Code Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Your Referral Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Referral Code</label>
            <div className="flex gap-2">
              <Input
                value={loading ? "Loading..." : referralCode}
                readOnly
                className="font-mono text-lg"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(referralCode, "Referral code")}
                disabled={loading || !referralCode}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Referral Link</label>
            <div className="flex gap-2">
              <Input
                value={loading ? "Loading..." : referralLink}
                readOnly
                className="text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(referralLink, "Referral link")}
                disabled={loading || !referralLink}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">How it works</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Share your referral code or link with friends</li>
              <li>They sign up and make their first purchase</li>
              <li>You both receive bonus credits</li>
              <li>Track your referrals and earnings here</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Referrals</h2>
        <div className="border border-border overflow-hidden border-x-0">
          <div className="bg-muted/50 px-4 py-3 border-b border-border">
            <div className="grid grid-cols-4 gap-4 text-sm font-medium">
              <div>Email</div>
              <div>Status</div>
              <div>Reward</div>
              <div className="text-right">Date</div>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                Loading referrals...
              </div>
            ) : referrals.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                No referrals yet. Share your referral code to get started!
              </div>
            ) : (
              referrals.map((referral) => (
                <ReferralRow key={referral.id} referral={referral} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-8">
        <div className="flex justify-center">
          <h1 className="text-3xl font-bold">Referrals</h1>
        </div>
        <div className="text-center py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4 mx-auto"></div>
            <div className="h-4 bg-muted rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    }>
      <ReferralsPageContent />
    </Suspense>
  );
}
