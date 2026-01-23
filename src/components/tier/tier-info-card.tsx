'use client';

import { useTier } from '@/hooks/use-tier';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TierInfoCard() {
  const {
    tier,
    tierInfo,
    hasSubscription,
    subscriptionStatusText,
    renewalDate,
    isExpiringSoon,
    isTrial,
    trialExpired,
    trialExpirationDate,
    trialDaysRemaining,
    trialExpiringSoon,
    userData,
  } = useTier();

  const tierColors = {
    basic: 'bg-slate-100 text-slate-900',
    pro: 'bg-blue-100 text-blue-900',
    max: 'bg-purple-100 text-purple-900',
  };

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    past_due: 'bg-orange-100 text-orange-800',
    inactive: 'bg-gray-100 text-gray-800',
    trial: 'bg-emerald-100 text-emerald-800',
    expired: 'bg-red-100 text-red-800',
  };

  const formattedRenewalDate = renewalDate?.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTrialExpirationDate = trialExpirationDate?.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate days until credit renewal for Pro/Max users
  const daysUntilRenewal = renewalDate
    ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Pro/Max users get monthly credit allocation
  const isPaidTier = tier === 'pro' || tier === 'max';
  const showCreditRenewal = isPaidTier && hasSubscription && subscriptionStatusText === 'Active';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subscription Plan</CardTitle>
            <CardDescription>Manage your account tier and billing</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isTrial && (
              <Badge className={cn(statusColors.trial)}>
                <Sparkles className="h-3 w-3 mr-1" />
                Trial
              </Badge>
            )}
            {trialExpired && (
              <Badge className={cn(statusColors.expired)}>
                <AlertCircle className="h-3 w-3 mr-1" />
                Expired
              </Badge>
            )}
            <Badge className={cn(tierColors[tier])}>
              {tierInfo.displayName}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trial Status */}
        {isTrial && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                You're on a free trial!
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700 dark:text-emerald-300">Days Remaining</span>
                <span className={cn(
                  "font-semibold",
                  trialExpiringSoon
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-emerald-900 dark:text-emerald-100"
                )}>
                  {trialDaysRemaining !== null ? `${trialDaysRemaining} days` : 'Unknown'}
                  {trialExpiringSoon && ' (ending soon!)'}
                </span>
              </div>
              {formattedTrialExpirationDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300">Expires On</span>
                  <span className="text-emerald-900 dark:text-emerald-100">{formattedTrialExpirationDate}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Upgrade to a paid plan to continue using all features after your trial ends.
            </p>
          </div>
        )}

        {/* Expired Trial Notice */}
        {trialExpired && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                Your trial has expired
              </p>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300">
              Upgrade to a paid plan to continue using all features and access your credits.
            </p>
          </div>
        )}

        {/* Plan Description - only show for non-trial users */}
        {!isTrial && !trialExpired && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Plan</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{tierInfo.description}</p>
          </div>
        )}

        {/* Pricing */}
        {tierInfo.monthlyPrice !== 'Pay-per-use' && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Cost</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tierInfo.monthlyPrice}</p>
          </div>
        )}

        {/* Subscription Status */}
        {hasSubscription && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Subscription Status</p>
              <div className="mt-2 flex items-center gap-2">
                {subscriptionStatusText === 'Active' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className={cn('px-3 py-1 rounded-full text-sm font-medium', statusColors.active)}>
                      {subscriptionStatusText}
                    </span>
                  </>
                )}
                {subscriptionStatusText === 'Past due' && (
                  <>
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className={cn('px-3 py-1 rounded-full text-sm font-medium', statusColors.past_due)}>
                      {subscriptionStatusText}
                    </span>
                  </>
                )}
                {subscriptionStatusText === 'Cancelled' && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className={cn('px-3 py-1 rounded-full text-sm font-medium', statusColors.cancelled)}>
                      {subscriptionStatusText}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Renewal Date */}
            {renewalDate && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Next Billing Date</p>
                <div className="mt-2 flex items-center gap-2">
                  {isExpiringSoon ? (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={cn('text-sm', isExpiringSoon ? 'font-semibold text-yellow-700' : 'text-gray-600 dark:text-gray-400')}>
                    {formattedRenewalDate}
                    {isExpiringSoon && ' (expires soon)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Credit Renewal Info for Pro/Max users */}
        {showCreditRenewal && renewalDate && daysUntilRenewal !== null && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Credit Renewal
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300">Days until renewal</span>
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  {daysUntilRenewal <= 0 ? 'Today' : `${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300">Renewal date</span>
                <span className="text-blue-900 dark:text-blue-100">{formattedRenewalDate}</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Your credits will be replenished on your billing date.
            </p>
          </div>
        )}

        {/* Credit Breakdown for Pro/Max users */}
        {isPaidTier && hasSubscription && subscriptionStatusText === 'Active' && userData && (
          <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-4 space-y-3 border border-green-200 dark:border-green-800">
            <div>
              <p className="text-sm font-semibold text-green-900 dark:text-green-100">Credit Breakdown</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-green-700 dark:text-green-300">Monthly Allowance</span>
                <span className="font-semibold text-green-900 dark:text-green-100">
                  ${((userData.subscription_allowance ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 ml-4">
                Resets on billing date
              </div>
              <div className="flex justify-between text-sm pt-2">
                <span className="text-blue-700 dark:text-blue-300">Purchased Credits</span>
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  ${((userData.purchased_credits ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 ml-4">
                Never expire
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-green-300 dark:border-green-700">
                <span className="font-semibold text-green-900 dark:text-green-100">Total Available</span>
                <span className="font-bold text-lg text-green-900 dark:text-green-100">
                  ${((userData.total_credits ?? userData.credits ?? 0) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* No Subscription Notice - only show for basic tier users who are not on trial */}
        {!hasSubscription && tier === 'basic' && !isTrial && !trialExpired && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              You're using the pay-per-use plan. Upgrade to Pro or Max for monthly billing and benefits.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
