#!/usr/bin/env node
/**
 * Generate Open Graph social sharing image for Gatewayz
 * Creates a 1200x630 PNG image optimized for social media platforms
 * Uses the actual logo PNG file provided
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create SVG background (without logo - we'll composite the PNG logo separately)
const svgBackground = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Light gradient background -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#f8fafc;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f1f5f9;stop-opacity:1" />
    </linearGradient>

    <!-- Subtle blue accent glow -->
    <radialGradient id="accentGlow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.08" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0" />
    </radialGradient>

    <!-- Soft grid pattern -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.03)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGradient)"/>

  <!-- Grid overlay -->
  <rect width="1200" height="630" fill="url(#grid)"/>

  <!-- Accent glow -->
  <rect width="1200" height="630" fill="url(#accentGlow)"/>

  <!-- Decorative circles -->
  <circle cx="100" cy="530" r="200" fill="rgba(59, 130, 246, 0.04)"/>
  <circle cx="1100" cy="100" r="150" fill="rgba(139, 92, 246, 0.04)"/>
  <circle cx="600" cy="315" r="280" fill="rgba(59, 130, 246, 0.03)"/>

  <!-- Logo will be composited here - no background circle for light theme -->

  <!-- Brand name -->
  <text x="600" y="340"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="72"
        font-weight="700"
        fill="#0f172a"
        text-anchor="middle"
        letter-spacing="-2">Gatewayz</text>

  <!-- Tagline -->
  <text x="600" y="400"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="28"
        font-weight="500"
        fill="#475569"
        text-anchor="middle">Enterprise AI For Everyone</text>

  <!-- Feature pills -->
  <g transform="translate(600, 500)" text-anchor="middle">
    <!-- Pill backgrounds -->
    <rect x="-340" y="-20" width="100" height="40" rx="20" fill="rgba(59, 130, 246, 0.12)"/>
    <rect x="-200" y="-20" width="120" height="40" rx="20" fill="rgba(139, 92, 246, 0.12)"/>
    <rect x="-40" y="-20" width="80" height="40" rx="20" fill="rgba(236, 72, 153, 0.12)"/>
    <rect x="80" y="-20" width="130" height="40" rx="20" fill="rgba(34, 197, 94, 0.12)"/>
    <rect x="250" y="-20" width="90" height="40" rx="20" fill="rgba(251, 191, 36, 0.12)"/>

    <!-- Pill text -->
    <text x="-290" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="600"
          fill="#2563eb">OpenAI</text>
    <text x="-140" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="600"
          fill="#7c3aed">Anthropic</text>
    <text x="0" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="600"
          fill="#db2777">Google</text>
    <text x="145" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="600"
          fill="#16a34a">DeepSeek</text>
    <text x="295" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="600"
          fill="#ca8a04">xAI</text>
  </g>

  <!-- Subtle border -->
  <rect x="2" y="2" width="1196" height="626" rx="0" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="2"/>
</svg>`;

// Write the SVG file
const svgOutputPath = join(__dirname, '..', 'public', 'og-image.svg');
writeFileSync(svgOutputPath, svgBackground);
console.log('✓ Created og-image.svg');

// Now create PNG with the actual logo composited
async function createOgImage() {
  try {
    const sharp = (await import('sharp')).default;
    const pngPath = join(__dirname, '..', 'public', 'og-image.png');
    const logoPath = join(__dirname, '..', 'public', 'gatewayz-logo-icon.png');

    // Create base image from SVG
    const baseImage = sharp(Buffer.from(svgBackground))
      .png();

    // Resize the logo and invert colors (white logo -> black for light background)
    const logoSize = 150;
    const resizedLogo = await sharp(logoPath)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .negate({ alpha: false }) // Invert colors but keep alpha channel
      .toBuffer();

    // Composite the logo onto the base image
    // Logo should be centered at (600, 180) - the center of the dark circle
    await baseImage
      .composite([
        {
          input: resizedLogo,
          top: Math.round(180 - logoSize/2),  // Center vertically at y=180
          left: Math.round(600 - logoSize/2), // Center horizontally at x=600
        }
      ])
      .toFile(pngPath);

    console.log('✓ Created og-image.png (1200x630) with logo');
    console.log('\n✅ OG image generated successfully!');
    console.log(`   SVG: ${svgOutputPath}`);
    console.log(`   PNG: ${pngPath}`);
  } catch (error) {
    console.log('\n⚠️  Error creating OG image:');
    console.error(error);
  }
}

createOgImage();
