import { ReactNode } from 'react';

/**
 * Static generation params for desktop static export.
 * Returns an empty array since sandbox IDs are dynamic.
 * For static export (desktop builds), this route won't be pre-rendered.
 * For server mode (web), dynamic routing still works normally.
 */
export function generateStaticParams(): { sandboxId: string }[] {
  return [];
}

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ sandboxId: string }>;
}

export default async function SandboxLayout({
  children,
}: LayoutProps) {
  return <>{children}</>;
}
