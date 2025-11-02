import React from 'react';
import Image from 'next/image';

interface GatewayzLogoProps {
  className?: string;
  size?: number;
}

export function GatewayzLogo({ className = "", size = 24 }: GatewayzLogoProps) {
  return (
    <>
      <Image
        src="/logo.png"
        alt="Gatewayz Logo"
        width={size}
        height={size}
        className={`${className} dark:hidden`}
        priority
      />
      <Image
        src="/logo_white.png"
        alt="Gatewayz Logo"
        width={size}
        height={size}
        className={`${className} hidden dark:block`}
        priority
      />
    </>
  );
}

export default GatewayzLogo;
