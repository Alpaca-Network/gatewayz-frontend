"use client";

import { useEffect } from "react";

/**
 * Sandbox layout that ensures proper viewport filling for embedded sandbox apps.
 *
 * This layout:
 * 1. Sets up the container to fill the remaining viewport after the header (65px or 115px with onboarding banner)
 * 2. Uses CSS classes to hide the footer on sandbox pages
 * 3. Prevents double scrolling by containing scroll within the sandbox
 */
export default function SandboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Add a class to body to indicate we're on a sandbox page
  // This allows other components (like AppFooter) to hide themselves
  useEffect(() => {
    document.body.classList.add("sandbox-page");
    // Also hide overflow on body to prevent double scrolling
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("sandbox-page");
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="sandbox-container flex flex-col h-[calc(100dvh-65px)] has-onboarding-banner:h-[calc(100dvh-115px)] w-full overflow-hidden">
      {children}
    </div>
  );
}
