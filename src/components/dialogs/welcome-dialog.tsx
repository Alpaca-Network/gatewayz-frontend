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
import { Sparkles } from "lucide-react";

export const NEW_USER_WELCOME_EVENT = 'gatewayz:new-user-welcome';

export function WelcomeDialog() {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(3);

  useEffect(() => {
    const handleWelcome = (event: Event) => {
      const customEvent = event as CustomEvent<{ credits: number }>;
      setCredits(customEvent.detail?.credits || 3);
      setOpen(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(NEW_USER_WELCOME_EVENT, handleWelcome as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(NEW_USER_WELCOME_EVENT, handleWelcome as EventListener);
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Welcome to Gatewayz!
          </DialogTitle>
          <DialogDescription className="text-center">
            ${credits} in credits has been added to your account. Enjoy your 3-day trial and explore all the features Gatewayz has to offer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="pt-2 space-y-2 text-sm text-left">
            <div className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Access to 300+ AI models</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Intelligent model routing</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Pay-as-you-go pricing</span>
            </div>
          </div>
        </div>
        <div className="flex justify-center pt-4">
          <Button onClick={() => setOpen(false)} className="w-full">
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
