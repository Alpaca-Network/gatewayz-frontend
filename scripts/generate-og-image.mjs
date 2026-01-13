#!/usr/bin/env node
/**
 * Generate Open Graph social sharing image for Gatewayz
 * Creates a 1200x630 PNG image optimized for social media platforms
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Gatewayz logo as embedded SVG path (G with arrow)
const logoPath = `
  <g transform="translate(540, 215) scale(0.4)">
    <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256c28.3 0 55.7-4.6 81.2-13.1-7.7-7.7-12.5-18.3-12.5-30.1v-34.8c-21.7 6.2-44.7 9.5-68.7 9.5-106 0-192-86-192-192S150 64 256 64c55.1 0 104.8 23.2 139.8 60.4l-67.6 67.6c-18.6-18.6-44.3-30.1-72.7-30.1-56.8 0-102.9 46.1-102.9 102.9s46.1 102.9 102.9 102.9c28.4 0 54.1-11.5 72.7-30.1l30.1 30.1c-26.8 26.8-63.8 43.4-104.8 43.4-82.4 0-149.3-66.9-149.3-149.3s66.9-149.3 149.3-149.3c42 0 80 17.4 107.1 45.4l67.6-67.6C374.2 34.6 318.3 0 256 0z" fill="white"/>
    <path d="M384 128v128l128-128H384z" fill="white"/>
    <path d="M384 128L256 256" stroke="white" stroke-width="60" stroke-linecap="round"/>
  </g>
`;

// Create SVG with gradient background, logo, and text
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradient background -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0f1e;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#111827;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0a0f1e;stop-opacity:1" />
    </linearGradient>

    <!-- Subtle accent glow -->
    <radialGradient id="accentGlow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0" />
    </radialGradient>

    <!-- Grid pattern -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGradient)"/>

  <!-- Grid overlay -->
  <rect width="1200" height="630" fill="url(#grid)"/>

  <!-- Accent glow -->
  <rect width="1200" height="630" fill="url(#accentGlow)"/>

  <!-- Decorative circles -->
  <circle cx="100" cy="530" r="200" fill="rgba(59, 130, 246, 0.05)"/>
  <circle cx="1100" cy="100" r="150" fill="rgba(139, 92, 246, 0.05)"/>

  <!-- Logo (G with arrow) -->
  <g transform="translate(540, 140) scale(0.35)">
    <!-- Main G shape -->
    <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256c28.3 0 55.7-4.6 81.2-13.1c0-20-8-38.2-21-51.4c-21.7 6.2-39.5 7-60.2 7c-97.2 0-176-78.8-176-176s78.8-176 176-176c50.5 0 96.1 21.3 128.2 55.4l-60 60c-17-17-40.5-27.5-66.5-27.5c-52 0-94.2 42.2-94.2 94.2s42.2 94.2 94.2 94.2c26 0 49.5-10.5 66.5-27.5l27.5 27.5c-24.5 24.5-58.4 39.7-96 39.7c-75.5 0-136.7-61.2-136.7-136.7s61.2-136.7 136.7-136.7c38.5 0 73.3 15.9 98.1 41.5l60-60C363.1 31.7 312.1 0 256 0z" fill="white"/>
    <!-- Arrow -->
    <polygon points="384,128 512,128 384,256" fill="white"/>
    <line x1="384" y1="128" x2="256" y2="256" stroke="white" stroke-width="55" stroke-linecap="round"/>
  </g>

  <!-- Brand name -->
  <text x="600" y="380"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="72"
        font-weight="700"
        fill="white"
        text-anchor="middle"
        letter-spacing="-2">Gatewayz</text>

  <!-- Tagline -->
  <text x="600" y="440"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="28"
        font-weight="400"
        fill="rgba(255,255,255,0.8)"
        text-anchor="middle">One Interface To Work With Any LLM</text>

  <!-- Feature pills -->
  <g transform="translate(600, 500)" text-anchor="middle">
    <!-- Pill backgrounds -->
    <rect x="-340" y="-20" width="100" height="40" rx="20" fill="rgba(59, 130, 246, 0.2)"/>
    <rect x="-200" y="-20" width="120" height="40" rx="20" fill="rgba(139, 92, 246, 0.2)"/>
    <rect x="-40" y="-20" width="80" height="40" rx="20" fill="rgba(236, 72, 153, 0.2)"/>
    <rect x="80" y="-20" width="130" height="40" rx="20" fill="rgba(34, 197, 94, 0.2)"/>
    <rect x="250" y="-20" width="90" height="40" rx="20" fill="rgba(251, 191, 36, 0.2)"/>

    <!-- Pill text -->
    <text x="-290" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="500"
          fill="rgba(96, 165, 250, 1)">OpenAI</text>
    <text x="-140" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="500"
          fill="rgba(167, 139, 250, 1)">Anthropic</text>
    <text x="0" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="500"
          fill="rgba(244, 114, 182, 1)">Google</text>
    <text x="145" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="500"
          fill="rgba(74, 222, 128, 1)">DeepSeek</text>
    <text x="295" y="8"
          font-family="Inter, sans-serif"
          font-size="16"
          font-weight="500"
          fill="rgba(251, 191, 36, 1)">xAI</text>
  </g>

  <!-- Subtle border -->
  <rect x="2" y="2" width="1196" height="626" rx="0" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
</svg>`;

// Write the SVG file
const svgPath = join(__dirname, '..', 'public', 'og-image.svg');
writeFileSync(svgPath, svg);
console.log('✓ Created og-image.svg');

// Now convert to PNG using sharp if available
async function convertToPng() {
  try {
    const sharp = (await import('sharp')).default;
    const pngPath = join(__dirname, '..', 'public', 'og-image.png');

    await sharp(Buffer.from(svg))
      .png()
      .toFile(pngPath);

    console.log('✓ Created og-image.png (1200x630)');
    console.log('\n✅ OG image generated successfully!');
    console.log(`   SVG: ${svgPath}`);
    console.log(`   PNG: ${pngPath}`);
  } catch (error) {
    console.log('\n⚠️  Sharp not available for PNG conversion.');
    console.log('   SVG created. Convert manually or use online converter.');
    console.log(`   SVG: ${svgPath}`);
  }
}

convertToPng();
