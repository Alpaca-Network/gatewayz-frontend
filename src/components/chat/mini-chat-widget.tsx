"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SURPRISE_PROMPTS } from '@/lib/surprise-prompts';

interface MiniChatWidgetProps {
  className?: string;
}

export function MiniChatWidget({ className = '' }: MiniChatWidgetProps) {
  const [message, setMessage] = useState('');
  const [isMagicAnimating, setIsMagicAnimating] = useState(false);
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleSendMessage = () => {
    if (message.trim()) {
      // Navigate to chat page with the message
      router.push(`/chat?message=${encodeURIComponent(message)}`);
    }
  };

  const handleSurpriseMe = () => {
    // Trigger magical animation
    setIsMagicAnimating(true);

    // Create sparkle particles
    if (buttonRef.current) {
      createSparkleEffect(buttonRef.current);
    }

    // Pick a random surprise prompt after brief animation delay
    setTimeout(() => {
      const randomPrompt = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
      // Navigate to chat page with the surprise prompt
      router.push(`/chat?message=${encodeURIComponent(randomPrompt)}`);
    }, 300);
  };

  // Create sparkle particle effect
  const createSparkleEffect = (button: HTMLElement) => {
    const rect = button.getBoundingClientRect();
    const sparkleCount = 12;
    let completedCount = 0;

    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle-particle';
      sparkle.style.cssText = `
        position: fixed;
        left: ${rect.left + rect.width / 2}px;
        top: ${rect.top + rect.height / 2}px;
        width: 8px;
        height: 8px;
        background: linear-gradient(45deg, #FFD700, #FFA500);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        box-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
      `;

      document.body.appendChild(sparkle);

      // Animate sparkle
      const angle = (i / sparkleCount) * Math.PI * 2;
      const distance = 60 + Math.random() * 40;
      const duration = 600 + Math.random() * 200;

      sparkle.animate([
        {
          transform: 'translate(0, 0) scale(1)',
          opacity: 1
        },
        {
          transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`,
          opacity: 0
        }
      ], {
        duration,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }).onfinish = () => {
        sparkle.remove();
        completedCount++;
        if (completedCount === sparkleCount) {
          setIsMagicAnimating(false);
        }
      };
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const [placeholder] = useState("What's on your mind?");

  return (
    <div className={`w-full max-w-3xl mx-auto px-2 sm:px-0 ${className}`}>
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 rounded-2xl opacity-15 sm:opacity-20 group-hover:opacity-30 sm:group-hover:opacity-40 blur transition duration-300"></div>

        {/* Main chat input */}
        <div className="relative bg-card border-2 border-border rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 p-2.5 xs:p-3 sm:p-4">
            {/* Icon */}
            <div className="flex-shrink-0 w-9 h-9 xs:w-10 xs:h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 text-white" />
            </div>

            {/* Input */}
            <Input
              type="text"
              placeholder={placeholder}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1 border-0 bg-transparent text-sm xs:text-base sm:text-lg focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            />

            {/* Send button - shows Send icon when message is entered, Sparkles when empty */}
            <Button
              ref={buttonRef}
              onClick={message.trim() ? handleSendMessage : handleSurpriseMe}
              size="icon"
              disabled={isMagicAnimating}
              className={`flex-shrink-0 w-9 h-9 xs:w-10 xs:h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-md transition-all ${
                isMagicAnimating ? 'animate-pulse scale-110' : ''
              }`}
              title={message.trim() ? "Send message" : "Surprise me!"}
            >
              {message.trim() ? (
                <Send className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-white" />
              ) : (
                <Sparkles className={`w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-white ${
                  isMagicAnimating ? 'animate-spin' : ''
                }`} />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p className="mt-2.5 xs:mt-3 sm:mt-4 text-center text-xs text-muted-foreground animate-fade-in-up opacity-0 delay-300">
        Powered by 10,000+ AI models • Try it for free
      </p>
    </div>
  );
}
