interface LogoMarqueeProps {
  compact?: boolean;
  className?: string;
}

export default function LogoMarquee({ compact = false, className = "" }: LogoMarqueeProps) {
  const logos = [
    { original: "/lovable-uploads/2286600f-ae43-4ffe-9b0d-ebfc58c4ef0d.png", optimized: "/lovable-uploads/2286600f-ae43-4ffe-9b0d-ebfc58c4ef0d-80.png" },
    { original: "/lovable-uploads/4b5c9ffc-f176-4c33-b876-eb2342426993.png", optimized: "/lovable-uploads/4b5c9ffc-f176-4c33-b876-eb2342426993-80.png" },
    { original: "/lovable-uploads/4fcb39d4-c7b2-4600-9b00-cdb65a525fe5.png", optimized: "/lovable-uploads/4fcb39d4-c7b2-4600-9b00-cdb65a525fe5-80.png" },
    { original: "/lovable-uploads/6719ef290663cc656604ec2e_bittensor-tao-logo.webp", optimized: "/lovable-uploads/6719ef290663cc656604ec2e_bittensor-tao-logo.webp" },
    { original: "/lovable-uploads/70dbda95-1907-4de3-a519-fbadd7052fdd.png", optimized: "/lovable-uploads/70dbda95-1907-4de3-a519-fbadd7052fdd-80.png" },
    { original: "/lovable-uploads/7c79e893-1a5c-4a50-8091-b8961310f79c.png", optimized: "/lovable-uploads/7c79e893-1a5c-4a50-8091-b8961310f79c-80.png" },
    { original: "/lovable-uploads/7fa9ac22-517e-46d2-8f49-219be13bd323.png", optimized: "/lovable-uploads/7fa9ac22-517e-46d2-8f49-219be13bd323.png" },
    { original: "/lovable-uploads/96d69d38-420f-400f-bb6d-8633b495053a.png", optimized: "/lovable-uploads/96d69d38-420f-400f-bb6d-8633b495053a-80.png" },
    { original: "/lovable-uploads/a172d35d-e296-48d9-b12f-d9bd3f3f8252.png", optimized: "/lovable-uploads/a172d35d-e296-48d9-b12f-d9bd3f3f8252-80.png" },
    { original: "/lovable-uploads/a5babe9f-46af-466e-84e9-62817a6c3356.png", optimized: "/lovable-uploads/a5babe9f-46af-466e-84e9-62817a6c3356-80.png" },
    { original: "/lovable-uploads/e368240b-0a3a-4ecb-9941-1febd9a8e71f.png", optimized: "/lovable-uploads/e368240b-0a3a-4ecb-9941-1febd9a8e71f-80.png" },
    { original: "/lovable-uploads/f6578a6f-a460-4455-b3d5-15eb46ba5f63.png", optimized: "/lovable-uploads/f6578a6f-a460-4455-b3d5-15eb46ba5f63-80.png" },
    { original: "/lovable-uploads/flux.png", optimized: "/lovable-uploads/flux-80.png" },
    { original: "/lovable-uploads/hunyuan.png", optimized: "/lovable-uploads/hunyuan-80.png" },
    { original: "/lovable-uploads/msft.png", optimized: "/lovable-uploads/msft.png" },
    { original: "/lovable-uploads/nousresearch.png", optimized: "/lovable-uploads/nousresearch-80.png" },
    { original: "/lovable-uploads/prime-intellect.png", optimized: "/lovable-uploads/prime-intellect-80.png" },
    { original: "/lovable-uploads/rendr.png", optimized: "/lovable-uploads/rendr-80.png" },
    { original: "/lovable-uploads/sentient.png", optimized: "/lovable-uploads/sentient-80.png" },
    { original: "/lovable-uploads/tencent-logo-black-and-white.png", optimized: "/lovable-uploads/tencent-logo-black-and-white-80.png" }
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
                  alt={idx < logos.length ? `logo ${(idx % logos.length) + 1}` : ""}
                  loading="lazy"
                  decoding="async"
                  className="h-12 sm:h-16 md:h-20 w-auto object-contain grayscale contrast-75 opacity-70"
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-gradient-to-r from-white via-white/90 via-white/60 to-transparent pointer-events-none z-10" />
        
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white via-white/90 via-white/60 to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}