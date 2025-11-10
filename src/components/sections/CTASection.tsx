import { ArrowRight } from "lucide-react";
import WaitlistForm from "@/components/WaitlistForm";

export function CTASection() {
  return (
    <section id="waitlist" className="py-12 md:py-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-muted/30 to-background scroll-mt-20">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-card rounded-2xl p-8 md:p-10 border border-border shadow-xl relative overflow-hidden">
          {/* Decorative gradient */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl -z-10 opacity-50" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-primary/10 to-transparent rounded-full blur-3xl -z-10 opacity-50" />
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 mb-1">
              <ArrowRight className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Get Started with Free Credits</h2>
            <p className="text-base text-foreground max-w-xl mx-auto leading-relaxed">
              Join our beta program and get <strong className="text-primary">$10 in free credits</strong> to explore 10,000+ AI models. No credit card required.
            </p>

            <div className="max-w-md mx-auto pt-1">
              <WaitlistForm compact={true} />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-sm text-foreground">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-600 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Instant Access</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-600 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>No Credit Card</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-600 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>10,000+ Models</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
