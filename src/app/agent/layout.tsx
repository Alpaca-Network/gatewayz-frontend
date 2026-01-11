"use client";

import { useEffect } from "react";

/**
 * Agent layout that ensures proper viewport filling for the embedded coding agent.
 *
 * This layout:
 * 1. Sets up the container to fill the remaining viewport after the header (65px)
 * 2. Uses CSS classes to hide the footer on agent pages
 * 3. Prevents double scrolling by containing scroll within the agent iframe
 */
export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Add a class to body to indicate we're on an agent page
  // This allows other components (like AppFooter) to hide themselves
  useEffect(() => {
    document.body.classList.add("agent-page");
    // Also hide overflow on body to prevent double scrolling
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("agent-page");
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="agent-container h-[calc(100dvh-65px)] w-full overflow-hidden"
      style={{
        // Ensure the agent fills the entire remaining viewport
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}
