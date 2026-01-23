"use client";

import { useEffect } from "react";

/**
 * Inbox layout that ensures proper viewport filling for the embedded Terragon inbox.
 *
 * This layout:
 * 1. Sets up the container to fill the remaining viewport after the header (65px)
 * 2. Uses CSS classes to hide the footer on inbox pages
 * 3. Prevents double scrolling by containing scroll within the inbox iframe
 */
export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Add a class to body to indicate we're on an inbox page
  // This allows other components (like AppFooter) to hide themselves
  useEffect(() => {
    document.body.classList.add("inbox-page");
    // Also hide overflow on body to prevent double scrolling
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("inbox-page");
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="inbox-container h-[calc(100dvh-65px)] w-full overflow-hidden"
      style={{
        // Ensure the inbox fills the entire remaining viewport
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}
