#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function convertSVGtoPNG() {
  try {
    const sharp = require('sharp');
    const publicDir = path.join(__dirname, '..', 'public');
    
    console.log('🔄 Converting SVG to PNG...');
    
    // Convert 192x192
    await sharp(path.join(publicDir, 'icon-192.svg'))
      .png()
      .toFile(path.join(publicDir, 'icon-192.png'));
    console.log('✅ Generated icon-192.png');
    
    // Convert 512x512
    await sharp(path.join(publicDir, 'icon-512.svg'))
      .png()
      .toFile(path.join(publicDir, 'icon-512.png'));
    console.log('✅ Generated icon-512.png');
    
    console.log('🎉 PNG icons ready!');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('❌ Sharp not installed. Installing...');
      console.log('Run: npm install sharp --save-dev');
    } else {
      console.error('Error:', error.message);
    }
  }
}

convertSVGtoPNG();
