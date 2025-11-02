
"use client";

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { usePrivy, type LinkedAccountWithMetadata, type EmailWithMetadata, type GoogleOAuthWithMetadata, type GithubOAuthWithMetadata } from '@privy-io/react-auth';
import { getUserData } from '@/lib/api';

interface StripePaymentMethod {
  id: string;
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
}

export default function AccountPage() {
  const { user: privyUser, logout } = usePrivy();
  const [mounted, setMounted] = useState(false);
  const [stripePaymentMethods, setStripePaymentMethods] = useState<StripePaymentMethod[]>([]);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Stripe customer data
  useEffect(() => {
    const fetchStripeData = async () => {
      if (!privyUser) return;

      const email = getUserEmail();
      if (!email || email === 'No email') return;

      try {
        setLoadingStripe(true);
        const response = await fetch(`/api/stripe/customer?email=${encodeURIComponent(email)}`);

        if (response.ok) {
          const data = await response.json();
          setStripePaymentMethods(data.paymentMethods || []);
          if (data.customer?.name) {
            setCustomerName(data.customer.name);
          }
        }
      } catch (error) {
        console.log('Failed to fetch Stripe data:', error);
      } finally {
        setLoadingStripe(false);
      }
    };

    if (mounted && privyUser) {
      fetchStripeData();
    }
  }, [mounted, privyUser]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const isEmailAccount = (account: LinkedAccountWithMetadata): account is EmailWithMetadata =>
    account.type === 'email';

  const isGoogleAccount = (account: LinkedAccountWithMetadata): account is GoogleOAuthWithMetadata =>
    account.type === 'google_oauth';

  const isGithubAccount = (account: LinkedAccountWithMetadata): account is GithubOAuthWithMetadata =>
    account.type === 'github_oauth';

  const isGoogleOrGithubAccount = (
    account: LinkedAccountWithMetadata
  ): account is GoogleOAuthWithMetadata | GithubOAuthWithMetadata =>
    isGoogleAccount(account) || isGithubAccount(account);

  const getUserEmail = () => {
    const emailAccount = privyUser?.linkedAccounts?.find(isEmailAccount);
    const googleAccount = privyUser?.linkedAccounts?.find(isGoogleAccount);
    return emailAccount?.address || googleAccount?.email || 'No email';
  };

  const getUserName = () => {
    const googleAccount = privyUser?.linkedAccounts?.find(isGoogleAccount);
    const userData = getUserData();
    return googleAccount?.name || userData?.display_name || 'User';
  };

  const getConnectedAccounts = () => {
    if (!privyUser?.linkedAccounts) return [];
    return privyUser.linkedAccounts.filter(isGoogleOrGithubAccount);
  };

  if (!mounted) {
    return (
      <div className="space-y-8 lg:min-w-[600px] xl:min-w-[1000px]">
        <div className="flex justify-center">
          <h1 className="text-3xl font-bold">Account</h1>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!privyUser) {
    return (
      <div className="space-y-8 lg:min-w-[600px] xl:min-w-[1000px]">
        <div className="flex justify-center">
          <h1 className="text-3xl font-bold">Account</h1>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Please sign in to view your account details.</p>
        </div>
      </div>
    );
  }

  const userEmail = getUserEmail();
  const userName = getUserName();
  const connectedAccounts = getConnectedAccounts();

  const openStripePortal = async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        console.log('Failed to create portal session');
      }
    } catch (error) {
      console.log('Error opening Stripe portal:', error);
    }
  };

  const getBrandLogo = (brand?: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return '/formkit_visa.svg';
      case 'mastercard':
        return '/mastercard-logo.svg';
      case 'amex':
        return '/amex-logo.svg';
      default:
        return '/formkit_visa.svg';
    }
  };

  return (
    <div className="space-y-8 lg:min-w-[600px] xl:min-w-[1000px]">
      <div className="flex justify-center">
        <h1 className="text-3xl font-bold">Account</h1>
      </div>
      
      <div className="max-w-4xl mx-auto space-y-8">

      {/* Account Details Section */}
      <div className="space-y-0">
        <h2 className="text-lg mb-6 font-bold">Account Details</h2>
        
        {/* Profile */}
        <div className="flex items-center py-4 border-y border-border">
          <div className="w-1/3 text-base font-medium">Profile</div>
          <div className="w-1/3 flex items-center justify-center gap-3">
            {isEditingProfile ? (
              <Input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={() => {
                  // Save logic would go here
                  setIsEditingProfile(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Save logic would go here
                    setIsEditingProfile(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingProfile(false);
                  }
                }}
                autoFocus
                className="max-w-[200px]"
              />
            ) : (
              <>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-card border border-gray-300">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-base">{userName}</span>
              </>
            )}
          </div>
          <div className="w-1/3 flex items-center justify-end">
            <Button
              variant="link"
              className="text-blue-400 p-0 h-auto text-base"
              onClick={() => {
                setEditedName(userName);
                setIsEditingProfile(true);
              }}
            >
              {isEditingProfile ? 'Cancel' : 'Update Profile'}
            </Button>
          </div>
        </div>

        {/* Email Addresses */}
        <div className="flex items-center py-4 border-b border-border">
          <div className="w-1/3 text-base font-medium">Email Addresses</div>
          <div className="w-1/3 flex flex-col items-center justify-center gap-1">
            <span className="text-base">{userEmail}</span>
            <Button
              variant="link"
              className="text-blue-400 p-0 h-auto text-base"
              onClick={() => alert('Add email functionality coming soon')}
            >
              Add Email Address
            </Button>
          </div>
          <div className="w-1/3 flex items-center justify-end">
            <Button
              variant="link"
              className="text-blue-400 p-0 h-auto text-base"
              onClick={() => alert('Email management coming soon')}
            >
              Manage
            </Button>
          </div>
        </div>

        {/* Connected Accounts */}
        <div className="flex items-center py-4 border-b border-border">
          <div className="w-1/3 text-base font-medium">Connected Accounts</div>
          <div className="w-1/3 flex flex-col items-center justify-center gap-1">
            {connectedAccounts.length > 0 ? (
              connectedAccounts.map((account, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded text-white text-xs flex items-center justify-center font-bold">
                    {account.type === 'google_oauth' && <img src="/ri_google-fill.svg" alt="Google" className="w-6 h-6" />}
                    {account.type === 'github_oauth' && <img src="/github-logo.svg" alt="GitHub" className="w-6 h-6" />}
                  </div>
                  <span className="text-base">{account.email || account.name}</span>
                </div>
              ))
            ) : (
              <span className="text-base text-muted-foreground">No accounts connected</span>
            )}
            <Button
              variant="link"
              className="text-blue-400 p-0 h-auto text-base"
              onClick={() => alert('Connect account functionality coming soon')}
            >
              Connect Account
            </Button>
          </div>
          <div className="w-1/3 flex items-center justify-end">
            <Button
              variant="link"
              className="text-blue-400 p-0 h-auto text-base"
              onClick={() => {
                const account = connectedAccounts[0];
                if (account) {
                  if (confirm(`Disconnect ${account.type === 'google_oauth' ? 'Google' : 'GitHub'} account?`)) {
                    alert('Disconnect functionality coming soon');
                  }
                }
              }}
              disabled={connectedAccounts.length === 0}
            >
              Manage
            </Button>
          </div>
        </div>

      </div>

      {/* Billing Details Section */}
      <div className="space-y-0">
        <h2 className="text-lg font-bold mb-6">Billing Details</h2>
        
        {/* Full Name */}
        <div className="flex items-center py-4 border-y border-border">
          <div className="w-1/3 text-base font-medium">Full Name</div>
          <div className="w-1/3 flex justify-center">
            <span className="text-base">{customerName || userName}</span>
          </div>
          <div className="w-1/3 flex items-center justify-end">
            <Button
              variant="link"
              className="text-blue-400 p-0 h-auto text-base"
              onClick={openStripePortal}
              disabled={!stripePaymentMethods.length}
            >
              Edit Name
            </Button>
          </div>
        </div>

        {/* Payment Method */}
        <div className="flex items-center py-4 border-b border-border">
          <div className="w-1/3 text-base font-medium">Payment Method</div>
          <div className="w-1/3 flex flex-col items-center justify-center gap-2">
            {loadingStripe ? (
              <span className="text-base text-muted-foreground">Loading...</span>
            ) : stripePaymentMethods.length > 0 ? (
              <>
                {stripePaymentMethods.map((pm, index) => (
                  <div key={pm.id} className="flex items-center gap-2">
                    <div className="w-8 h-5 rounded text-white text-xs flex items-center justify-center font-bold">
                      <img src={getBrandLogo(pm.brand)} alt={pm.brand || 'Card'} className="w-6 h-6" />
                    </div>
                    <span className="text-base">**** {pm.last4}</span>
                    {index === 0 && (
                      <span className="text-xs bg-muted px-1 py-1 rounded border border-border">Primary</span>
                    )}
                  </div>
                ))}
                <Button
                  variant="link"
                  className="text-blue-400 p-0 h-auto text-base"
                  onClick={openStripePortal}
                >
                  Manage Payment Methods
                </Button>
              </>
            ) : (
              <>
                <span className="text-base text-muted-foreground">No payment method</span>
                <Button
                  variant="link"
                  className="text-blue-400 p-0 h-auto text-base"
                  onClick={openStripePortal}
                  disabled
                >
                  Add Payment Method
                </Button>
              </>
            )}
          </div>
          <div className="w-1/3 flex items-center justify-end">
            <Button
              variant="link"
              className="text-blue-400 p-0 h-auto text-base"
              onClick={openStripePortal}
              disabled={!stripePaymentMethods.length}
            >
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Account Termination Section */}
      <div className="space-y-0">
        <h2 className="text-lg font-bold mb-6">Account Termination</h2>
        
        {/* Delete Account */}
        <div className="flex items-center py-4 border-y border-border">
          <div className="w-1/3 text-base font-medium">Delete Account</div>
          <div className="w-1/3"></div>
          <div className="w-1/3 flex items-center justify-end">
            <Button variant="link" className="text-red-400 p-0 h-auto text-base">
              Delete
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
