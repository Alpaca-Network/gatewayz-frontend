"use client";

import { MiniChatWidget } from '@/components/chat/mini-chat-widget';

export default function TitleSection() {
    return(
        <>
          <div className="space-y-4 md:space-y-6 px-2 sm:px-4 mx-auto text-center">
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance animate-fade-in-up opacity-0 delay-100 px-2">
                <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                    Gatewayz:
                </span>
                <span className="text-gray-900 dark:text-white"> One API for Any AI Model</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto text-balance leading-relaxed animate-fade-in-up opacity-0 delay-200 px-4">
              Access 10,000+ AI models through one blazing-fast API. Lowest latency. Lowest cost.
            </p>

            {/* Chat Widget */}
            <div className="animate-fade-in-up opacity-0 delay-300 pt-4 md:pt-6">
              <MiniChatWidget />
            </div>
          </div>
        </>
    )
}