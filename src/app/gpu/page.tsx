import type { Metadata } from 'next';
import { GpuPageClient } from '@/components/gpu/GpuPageClient';

export const metadata: Metadata = {
  title: 'GPU Marketplace | Gatewayz',
  description:
    'Live transparency dashboard for the community GPU nodes serving open-weight models on Gatewayz — active nodes, utilization, and model coverage.',
};

export default function GpuPage() {
  return <GpuPageClient />;
}
