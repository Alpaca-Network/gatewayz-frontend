import type { Metadata } from 'next';
import { ProviderPortalClient } from '@/components/gpu/provider/ProviderPortalClient';

export const metadata: Metadata = {
  title: 'GPU Provider Portal | Gatewayz',
  description: 'Register GPU nodes, monitor status, and track WAYZ earnings as a Gatewayz community compute provider.',
};

export default function GpuProviderPage() {
  return <ProviderPortalClient />;
}
