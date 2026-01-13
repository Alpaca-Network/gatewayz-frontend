import { ReactNode } from 'react';

/**
 * Static generation params for desktop static export.
 * Returns an empty array since organization names are dynamic and loaded from API.
 * For static export (desktop builds), this route won't be pre-rendered.
 * For server mode (web), dynamic routing still works normally.
 */
export function generateStaticParams(): { name: string }[] {
  return [];
}

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ name: string }>;
}

export default async function OrganizationLayout({
  children,
}: LayoutProps) {
  return <>{children}</>;
}
