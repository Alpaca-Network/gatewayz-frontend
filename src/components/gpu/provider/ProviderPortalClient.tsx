"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { isGpuMarketplaceEnabled } from '@/lib/gpu/flag';
import { useMyGpuProvider } from '@/lib/hooks/use-gpu-provider';
import { GpuProviderApiError } from '@/lib/gpu/provider-api';
import { RegisterProviderForm } from './RegisterProviderForm';
import { NodesList } from './NodesList';
import { EarningsSection } from './EarningsSection';

const STATUS_COPY: Record<string, string> = {
  pending: 'Pending admin approval',
  approved: 'Approved',
  suspended: 'Suspended',
};

export function ProviderPortalClient() {
  const router = useRouter();
  const { status: authStatus } = useGatewayzAuth();
  const enabled = isGpuMarketplaceEnabled();

  const providerQuery = useMyGpuProvider({ enabled: enabled && authStatus === 'authenticated' });

  useEffect(() => {
    if (enabled && authStatus === 'unauthenticated') {
      router.push('/');
    }
  }, [enabled, authStatus, router]);

  if (!enabled) {
    return null;
  }

  if (authStatus !== 'authenticated') {
    return null;
  }

  if (providerQuery.isLoading) {
    return (
      <div className="container mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const notRegistered =
    providerQuery.isError &&
    providerQuery.error instanceof GpuProviderApiError &&
    providerQuery.error.code === 'not_found';

  if (notRegistered) {
    return (
      <div className="container mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <h1 className="text-2xl font-bold">GPU Provider Portal</h1>
        <RegisterProviderForm />
      </div>
    );
  }

  if (providerQuery.isError || !providerQuery.data) {
    return (
      <div className="container mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <p className="text-sm text-muted-foreground">Failed to load your provider. Please try again.</p>
      </div>
    );
  }

  const { provider, nodes } = providerQuery.data;

  return (
    <div className="container mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{provider.display_name}</CardTitle>
          <Badge variant={provider.status === 'approved' ? 'default' : 'secondary'}>
            {STATUS_COPY[provider.status] ?? provider.status}
          </Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {provider.status === 'pending' &&
            "You're registered — an admin needs to approve your provider before you can add nodes."}
          {provider.status === 'suspended' && 'Your provider is suspended. Contact support for details.'}
          {provider.status === 'approved' && 'Your provider is approved. Add a node to start serving traffic.'}
        </CardContent>
      </Card>

      <NodesList nodes={nodes} />

      <EarningsSection />
    </div>
  );
}
