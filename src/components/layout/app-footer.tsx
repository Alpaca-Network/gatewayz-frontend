
"use client";

import Link from 'next/link';
import { Twitter } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export function AppFooter() {
  const pathname = usePathname();
  const [isChatPage, setIsChatPage] = useState(false);
  const [isModelsPage, setIsModelsPage] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  const [hasScrolledPastFold, setHasScrolledPastFold] = useState(false);

  useEffect(() => {
    setIsChatPage(pathname?.startsWith('/chat') ?? false);
    setIsModelsPage(pathname?.startsWith('/models') ?? false);
  }, [pathname]);

  // Track if user has scrolled past the initial viewport on homepage
  useEffect(() => {
    const isHomepage = pathname === '/';

    if (!isHomepage) {
      // Show footer immediately on non-homepage routes
      setShowFooter(true);
      return;
    }

    // On homepage, only show footer after scrolling past the fold
    const handleScroll = () => {
      const scrollThreshold = window.innerHeight * 0.8; // Show footer when scrolled 80% of viewport height
      const hasScrolled = window.scrollY > scrollThreshold;
      setHasScrolledPastFold(hasScrolled);
      setShowFooter(hasScrolled);
    };

    // Check initial scroll position
    handleScroll();

    // Listen for scroll events
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  // Hide footer on models page (has sidebar layout)
  if (isModelsPage) {
    return null;
  }

  // Don't render footer until conditions are met
  if (!showFooter) {
    return null;
  }

  // Hide footer on mobile for chat page
  if (isChatPage) {
    return null;
  }

  return (
    <footer className={`w-full border-t border-border py-12 bg-background transition-opacity duration-500 ${hasScrolledPastFold ? 'opacity-100' : 'opacity-0'}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between gap-8 mb-8">
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Product</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="#features"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <Link href="https://docs.gatewayz.ai/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Documentation
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-foreground">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="https://blog.gatewayz.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/*<div>
            <h3 className="font-semibold mb-4 text-gray-900">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>*/}

          <div>
            <h3 className="font-semibold mb-4 text-foreground">Connect</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="https://x.com/AlpacaNetworkAI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Twitter className="h-4 w-4" />
                  <span>X</span>
                </Link>
              </li>
              <li>
                <Link
                  href="https://discord.gg/TEZDnb9EHE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  <span>Discord</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
          <div className="flex items-center gap-2">
            <img
              src="/logo_black.svg"
              alt="Gatewayz"
              className="h-6 w-6 dark:invert"
            />
            <span className="font-semibold text-foreground">Gatewayz</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Augmented Intelligence Humans Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
