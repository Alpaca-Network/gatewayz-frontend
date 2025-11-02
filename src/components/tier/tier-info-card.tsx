'use client';

import { useTier } from '@/hooks/use-tier';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TierInfoCard() {
  const { tier, tierInfo, hasSubscription, subscriptionStatusText, renewalDate, isExpiringSoon } = useTier();

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
  };

  const formattedRenewalDate = renewalDate?.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subscription Plan</CardTitle>
            <CardDescription>Manage your account tier and billing</CardDescription>
          </div>
          <Badge className={cn(tierColors[tier])}>
            {tierInfo.displayName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Description */}
        <div>
          <p className="text-sm font-medium text-gray-700">Current Plan</p>
          <p className="text-sm text-gray-600">{tierInfo.description}</p>
        </div>

        {/* Pricing */}
        {tierInfo.monthlyPrice !== 'Pay-per-use' && (
          <div>
            <p className="text-sm font-medium text-gray-700">Monthly Cost</p>
            <p className="text-lg font-semibold text-gray-900">{tierInfo.monthlyPrice}</p>
          </div>
        )}

        {/* Subscription Status */}
        {hasSubscription && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Subscription Status</p>
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
                <p className="text-sm font-medium text-gray-700">Next Billing Date</p>
                <div className="mt-2 flex items-center gap-2">
                  {isExpiringSoon ? (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={cn('text-sm', isExpiringSoon ? 'font-semibold text-yellow-700' : 'text-gray-600')}>
                    {formattedRenewalDate}
                    {isExpiringSoon && ' (expires soon)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Subscription Notice */}
        {!hasSubscription && tier === 'basic' && (
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-900">
              You're using the pay-per-use plan. Upgrade to Pro or Max for monthly billing and benefits.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
