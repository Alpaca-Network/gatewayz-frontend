interface LogoMarqueeProps {
  compact?: boolean;
  className?: string;
}

export default function LogoMarquee({ compact = false, className = "" }: LogoMarqueeProps) {
  const logos = [
    { original: "/OpenAI_Logo-black.svg", name: "OpenAI" },
    { original: "/Google_Logo-black.svg", name: "Google" },
    { original: "/anthropic-logo.svg", name: "Anthropic" },
    { original: "/Meta_Logo-black.svg", name: "Meta" },
    { original: "/deepseek-icon.svg", name: "DeepSeek" },
    { original: "/xai-logo.svg", name: "xAI" },
    { original: "/OpenAI_Logo-black.svg", name: "OpenAI" },
    { original: "/Google_Logo-black.svg", name: "Google" },
    { original: "/anthropic-logo.svg", name: "Anthropic" },
    { original: "/Meta_Logo-black.svg", name: "Meta" }
  ] as const;

  return (
    <div className="flex justify-center w-full">
      <div className={`w-full max-w-6xl overflow-hidden relative ${className}`}>
        <div className="marquee-container">
          <div className="marquee-track">
            {[...logos, ...logos].map((logo, idx) => (
              <div
                key={`logo-${idx}`}
                className={
                  (compact ? "h-20" : "h-24") +
                  " flex-shrink-0 flex items-center justify-center p-2.5"
                }
                aria-label={idx < logos.length ? `logo ${idx + 1}` : undefined}
                title={idx < logos.length ? `logo ${(idx % logos.length) + 1}` : undefined}
              >
                <img
                  src={logo.original}
                  alt={idx < logos.length ? logo.name : ""}
                  loading="lazy"
                  decoding="async"
                  className="h-12 sm:h-16 md:h-20 w-auto object-contain grayscale contrast-75 opacity-70"
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-gradient-to-r from-white via-white/90 via-white/60 to-transparent dark:from-slate-950 dark:via-slate-950/90 dark:via-slate-950/60 dark:to-transparent pointer-events-none z-10" />

        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white via-white/90 via-white/60 to-transparent dark:from-slate-950 dark:via-slate-950/90 dark:via-slate-950/60 dark:to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}