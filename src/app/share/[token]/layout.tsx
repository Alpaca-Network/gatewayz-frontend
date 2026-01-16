import { ReactNode } from 'react';

/**
 * Static generation params for desktop static export.
 * Returns an empty array since share tokens are dynamic.
 * For static export (desktop builds), this route won't be pre-rendered.
 * For server mode (web), dynamic routing still works normally.
 */
export function generateStaticParams(): { token: string }[] {
  return [];
}

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ token: string }>;
}

export default async function ShareLayout({
  children,
}: LayoutProps) {
  return <>{children}</>;
}
