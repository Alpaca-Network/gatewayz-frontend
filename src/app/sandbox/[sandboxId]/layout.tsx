import { ReactNode } from 'react';

/**
 * Static generation params for desktop static export.
 * Returns an empty array since sandbox IDs are dynamic.
 * This allows the page to exist in static export builds without pre-rendering.
 */
export function generateStaticParams(): { sandboxId: string }[] {
  return [];
}

/**
 * Allow dynamic params not in generateStaticParams.
 */
export const dynamicParams = true;

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ sandboxId: string }>;
}

export default async function SandboxLayout({
  children,
}: LayoutProps) {
  return <>{children}</>;
}
