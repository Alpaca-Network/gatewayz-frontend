"use client";

import { useEffect, useState } from "react";
import { getApiKey, getUserData } from "@/lib/api";

/**
 * Debug panel to help diagnose auth failures
 * Shows auth state, localStorage contents, and error messages
 */
export function AuthDebugPanel() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Update state on mount and when auth changes
    setApiKey(getApiKey());
    setUserData(getUserData());

    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      const msg = args.join(" ");
      if (msg.includes("[Auth]")) {
        setConsoleLogs((prev) => [...prev.slice(-20), msg]); // Keep last 20
      }
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      const msg = args.join(" ");
      if (msg.includes("[Auth]")) {
        setConsoleLogs((prev) => [...prev.slice(-20), `ERROR: ${msg}`]);
      }
      originalError.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-slate-900 text-white rounded-lg p-4 text-xs border border-red-500 z-50 max-h-96 overflow-y-auto">
      <div className="font-bold mb-2">AUTH DEBUG PANEL</div>

      <div className="mb-2">
        <span className="font-semibold">API Key:</span>{" "}
        {apiKey ? `${apiKey.substring(0, 20)}...` : "NOT SET"}
      </div>

      {userData && (
        <div className="mb-2 p-2 bg-slate-800 rounded">
          <span className="font-semibold">User ID:</span> {userData.user_id}
          <br />
          <span className="font-semibold">Email:</span> {userData.email}
          <br />
          <span className="font-semibold">Credits:</span> {userData.credits}
        </div>
      )}

      {consoleLogs.length > 0 && (
        <div className="mb-2 p-2 bg-slate-800 rounded">
          <span className="font-semibold">Recent Logs ({consoleLogs.length}):</span>
          <div className="text-xs mt-1 space-y-1 max-h-40 overflow-y-auto font-mono">
            {consoleLogs.map((log, i) => (
              <div key={i} className={log.includes("ERROR") ? "text-red-300" : "text-gray-300"}>
                {log.substring(0, 100)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400 mt-2 border-t border-gray-600 pt-2">
        📝 Check browser DevTools Console for full "[Auth]" logs
      </div>
    </div>
  );
}
