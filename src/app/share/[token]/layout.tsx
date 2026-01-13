import { ReactNode } from 'react';

/**
 * Static generation params for desktop static export.
 * Returns an empty array since share tokens are dynamic.
 * This allows the page to exist in static export builds without pre-rendering.
 */
export function generateStaticParams(): { token: string }[] {
  return [];
}

/**
 * Allow dynamic params not in generateStaticParams.
 */
export const dynamicParams = true;

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ token: string }>;
}

export default async function ShareLayout({
  children,
}: LayoutProps) {
  return <>{children}</>;
}
