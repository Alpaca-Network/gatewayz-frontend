import type { Metadata } from 'next';
import { sandboxMetadata } from './metadata';
import { SandboxLayoutClient } from './sandbox-layout-client';

export const metadata: Metadata = sandboxMetadata;

/**
 * Sandbox layout (server component) that exports metadata for OG tags
 * and wraps the client-side layout for DOM manipulation.
 */
export default function SandboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SandboxLayoutClient>{children}</SandboxLayoutClient>;
}
