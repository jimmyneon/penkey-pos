#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Generate SVG icon
function generateSVG(size) {
  const iconSize = size * 0.5;
  const padding = (size - iconSize) / 2;
  const strokeWidth = size / 24;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#f97316"/>
  
  <!-- Store Icon (Lucide) -->
  <g transform="translate(${padding}, ${padding}) scale(${iconSize / 24})">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" 
          fill="none" 
          stroke="#ffffff" 
          stroke-width="${strokeWidth * 24 / iconSize}" 
          stroke-linecap="round" 
          stroke-linejoin="round"/>
    <path d="M9 22V12h6v10" 
          fill="none" 
          stroke="#ffffff" 
          stroke-width="${strokeWidth * 24 / iconSize}" 
          stroke-linecap="round" 
          stroke-linejoin="round"/>
  </g>
</svg>`;
}

// Generate icons
console.log('🎨 Generating PWA icons for Penkey POS...');

const publicDir = path.join(__dirname, '..', 'public');

// Generate and save SVG files
const svg192 = generateSVG(192);
const svg512 = generateSVG(512);

fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), svg192);
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), svg512);

console.log('✅ Generated icon-192.svg');
console.log('✅ Generated icon-512.svg');
console.log('');
console.log('📝 To convert to PNG, you can:');
console.log('   1. Use an online converter like cloudconvert.com');
console.log('   2. Install sharp: npm install sharp');
console.log('   3. Or open in browser and screenshot');
console.log('');
console.log('🎉 SVG icons ready in apps/pos/public/');
