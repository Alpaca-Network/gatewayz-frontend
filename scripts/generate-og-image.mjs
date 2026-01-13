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

// Read the logo PNG and convert to base64 for embedding
const logoPath = join(__dirname, '..', 'public', 'gatewayz-logo-icon.png');
let logoBase64 = '';
try {
  const logoBuffer = readFileSync(logoPath);
  logoBase64 = logoBuffer.toString('base64');
} catch (e) {
  console.log('Warning: Could not read logo file, using fallback');
}

// Create SVG with light, bright design
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
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

  <!-- Logo container with dark background -->
  <circle cx="600" cy="200" r="90" fill="#0f172a"/>

  <!-- Logo (embedded as black version for dark circle) -->
  <g transform="translate(510, 110) scale(0.04)">
    <!-- Main G shape -->
    <path d="M2218.5 0C993.9 0 0 993.9 0 2218.5s993.9 2218.5 2218.5 2218.5c245.4 0 483-39.9 704.4-113.6c0-173.4-69.4-331.3-182.1-445.8c-188.1 53.8-342.6 60.7-522.3 60.7c-843 0-1526.4-683.4-1526.4-1526.4s683.4-1526.4 1526.4-1526.4c438 0 833.4 184.8 1111.9 480.5l-520.4 520.4c-147.4-147.4-351.3-238.6-577-238.6c-451 0-816.9 365.9-816.9 816.9s365.9 816.9 816.9 816.9c225.5 0 429.4-91.2 577-238.6l238.6 238.6c-212.5 212.5-506.5 344.2-832.6 344.2c-654.7 0-1185.5-530.8-1185.5-1185.5s530.8-1185.5 1185.5-1185.5c333.8 0 635.7 137.9 851 359.8l520.4-520.4C3149.1 275 2707.6 0 2218.5 0z" fill="white"/>
    <!-- Arrow -->
    <polygon points="3329.3,1109.6 4437,1109.6 3329.3,2218.5" fill="white"/>
    <line x1="3329.3" y1="1109.6" x2="2218.5" y2="2218.5" stroke="white" stroke-width="477" stroke-linecap="round"/>
  </g>

  <!-- Brand name -->
  <text x="600" y="360"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="72"
        font-weight="700"
        fill="#0f172a"
        text-anchor="middle"
        letter-spacing="-2">Gatewayz</text>

  <!-- Tagline -->
  <text x="600" y="420"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="28"
        font-weight="500"
        fill="#475569"
        text-anchor="middle">Enterprise AI For Everyone</text>

  <!-- Feature pills -->
  <g transform="translate(600, 520)" text-anchor="middle">
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
writeFileSync(svgOutputPath, svg);
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
    console.log(`   SVG: ${svgOutputPath}`);
    console.log(`   PNG: ${pngPath}`);
  } catch (error) {
    console.log('\n⚠️  Sharp not available for PNG conversion.');
    console.log('   SVG created. Convert manually or use online converter.');
    console.log(`   SVG: ${svgOutputPath}`);
    console.error(error);
  }
}

convertToPng();
