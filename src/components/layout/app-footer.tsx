
"use client";

import Link from 'next/link';
import { Twitter } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme-provider';

export function AppFooter() {
  const pathname = usePathname();
  const [isChatPage, setIsChatPage] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const { theme } = useTheme();

  useEffect(() => {
    setIsChatPage(pathname?.startsWith('/chat') ?? false);
  }, [pathname]);

  useEffect(() => {
    // Determine the actual theme being used
    const getResolvedTheme = () => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return theme as 'light' | 'dark';
    };

    setResolvedTheme(getResolvedTheme());

    // Listen for system theme changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => setResolvedTheme(getResolvedTheme());
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Hide footer on mobile for chat page
  if (isChatPage) {
    return (
      <footer className="hidden md:flex sticky bottom-0 z-50 w-full h-[65px] border-t border-footer-border bg-header items-center">
        <div className="container flex h-14 justify-center items-center px-4 sm:px-6 lg:px-8 mx-auto">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center">
              <img
                src="/alpaca-logo.png"
                alt="Alpaca Network"
                className="h-8 w-auto"
                style={{ filter: resolvedTheme === 'light' ? 'invert(1)' : 'none' }}
              />
            </Link>
            <Link href="/" className="flex items-center">
              <img
                src="/gatewayz-logo.png"
                alt="Gatewayz"
                className="h-8 w-auto"
                style={{ filter: resolvedTheme === 'dark' ? 'invert(1)' : 'none' }}
              />
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="sticky bottom-0 z-50 w-full h-[65px] border-t border-footer-border bg-header flex items-center">
      <div className="container flex h-14 justify-center items-center px-4 sm:px-6 lg:px-8 mx-auto">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            <img
              src="/alpaca-logo.png"
              alt="Alpaca Network"
              className="h-8 w-auto"
              style={{ filter: resolvedTheme === 'light' ? 'invert(1)' : 'none' }}
            />
          </Link>
          <Link href="/" className="flex items-center">
            <img
              src="/gatewayz-logo.png"
              alt="Gatewayz"
              className="h-8 w-auto"
              style={{ filter: resolvedTheme === 'dark' ? 'invert(1)' : 'none' }}
            />
          </Link>
        </div>
      </div>
    </footer>
  );
}
