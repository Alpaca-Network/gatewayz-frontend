import { ReactNode } from 'react';

/**
 * Static generation params for desktop static export.
 * Returns an empty array since organization names are dynamic and loaded from API.
 * This allows the page to exist in static export builds without pre-rendering.
 */
export function generateStaticParams(): { name: string }[] {
  return [];
}

/**
 * Allow dynamic params not in generateStaticParams.
 */
export const dynamicParams = true;

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ name: string }>;
}

export default async function OrganizationLayout({
  children,
}: LayoutProps) {
  return <>{children}</>;
}
