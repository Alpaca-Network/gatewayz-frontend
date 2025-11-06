"use client";

import { MiniChatWidget } from '@/components/chat/mini-chat-widget';

export default function TitleSection() {
    return(
        <>
          <div className="space-y-3 sm:space-y-4 md:space-y-6 px-0 sm:px-2 mx-auto text-center">
            {/* Headline */}
            <h1 className="text-3xl xs:text-3.5xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-balance animate-fade-in-up opacity-0 delay-100 px-1 sm:px-2 leading-tight">
                <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                    Gatewayz:
                </span>
                <span className="text-gray-900 dark:text-white"> One API for Any AI Model</span>
            </h1>

            {/* Subheadline */}
            <p className="text-sm xs:text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto text-balance leading-relaxed animate-fade-in-up opacity-0 delay-200 px-2 sm:px-3">
              Access 10,000+ AI models through one blazing-fast API. Lowest latency. Lowest cost.
            </p>

            {/* Chat Widget */}
            <div className="animate-fade-in-up opacity-0 delay-300 pt-3 sm:pt-4 md:pt-6">
              <MiniChatWidget />
            </div>
          </div>
        </>
    )
}