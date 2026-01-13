import { ReactNode } from 'react';

/**
 * Static generation params for desktop static export.
 * Returns an empty array since asset IDs are dynamic and loaded from API.
 * This allows the page to exist in static export builds without pre-rendering.
 */
export function generateStaticParams(): { id: string }[] {
  return [];
}

/**
 * Allow dynamic params not in generateStaticParams.
 * This enables the page to work normally in server mode while also
 * supporting static export by providing an empty generateStaticParams.
 */
export const dynamicParams = true;

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function AssetDetailLayout({
  children,
}: LayoutProps) {
  return <>{children}</>;
}
