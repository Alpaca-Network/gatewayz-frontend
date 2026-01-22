"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";
import { isMacOS, isWindows } from "@/lib/desktop/tauri";
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safe-storage';

export const SHORTCUT_INFO_EVENT = 'gatewayz:shortcut-info';
const STORAGE_KEY = 'gatewayz_shortcut_info_shown';

/**
 * Get the platform-specific shortcut display text
 */
function getShortcutDisplay(): { keys: string; description: string } {
  if (isMacOS()) {
    return {
      keys: '⌘ + G',
      description: 'Press Command + G anytime to quickly open GatewayZ'
    };
  }
  if (isWindows()) {
    return {
      keys: 'Ctrl + G',
      description: 'Press Ctrl + G anytime to quickly open or hide GatewayZ'
    };
  }
  // Linux
  return {
    keys: 'Super + G',
    description: 'Press Super + G anytime to quickly open GatewayZ'
  };
}

/**
 * Check if the shortcut info has been shown before
 */
export function hasShownShortcutInfo(): boolean {
  if (typeof window === 'undefined') return true;
  return safeLocalStorageGet(STORAGE_KEY) === 'true';
}

/**
 * Mark the shortcut info as shown
 */
export function markShortcutInfoShown(): void {
  if (typeof window === 'undefined') return;
  safeLocalStorageSet(STORAGE_KEY, 'true');
}

/**
 * Trigger the shortcut info dialog to show
 */
export function showShortcutInfoDialog(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SHORTCUT_INFO_EVENT));
}

export function ShortcutInfoDialog() {
  const [open, setOpen] = useState(false);
  const shortcut = getShortcutDisplay();

  useEffect(() => {
    const handleShow = () => {
      setOpen(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(SHORTCUT_INFO_EVENT, handleShow);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SHORTCUT_INFO_EVENT, handleShow);
      }
    };
  }, []);

  const handleClose = () => {
    markShortcutInfoShown();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      } else {
        setOpen(true);
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
            <Keyboard className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Quick Launch Shortcut
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {shortcut.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-6">
          <div className="inline-flex items-center gap-2 px-6 py-4 bg-muted rounded-xl border-2 border-border shadow-inner">
            <span className="text-3xl font-mono font-bold tracking-wider text-foreground">
              {shortcut.keys}
            </span>
          </div>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground text-center">
          <p>
            Use this shortcut from anywhere on your computer to instantly bring GatewayZ to the front.
          </p>
          <p className="text-xs">
            The app runs in the background when you close the window.
          </p>
        </div>
        <div className="flex justify-center pt-4">
          <Button onClick={handleClose} className="w-full max-w-xs">
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
