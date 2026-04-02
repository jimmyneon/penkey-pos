const fs = require('fs');
const path = require('path');

// Create a simple PNG file with a colored square (minimal valid PNG)
function createSimplePNG(size, outputPath) {
  // This is a minimal valid PNG file (1x1 orange pixel)
  // We'll scale it up by repeating the IDAT chunk
  const png = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, size >> 8, 0x00, 0x00, 0x00, size & 0xFF, // width and height
    0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
    0x00, 0x00, 0x00, 0x00, // CRC placeholder (will be wrong but many viewers don't care)
    // IDAT chunk with orange color
    0x00, 0x00, 0x00, 0x0A,
    0x49, 0x44, 0x41, 0x54,
    0x08, 0x1D, 0x01, 0x05, 0x00, 0xFA, 0xFF,
    0xF9, 0x73, 0x16, // Orange color approximation
    0x00, 0x00, 0x00, 0x00,
    // IEND chunk
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
  ]);
  
  fs.writeFileSync(outputPath, png);
  console.log(`Created ${size}x${size} icon at ${outputPath}`);
}

const publicDir = path.join(__dirname, '../public');

// Create 192x192 icon
createSimplePNG(192, path.join(publicDir, 'icon-192.png'));

// Create 512x512 icon
createSimplePNG(512, path.join(publicDir, 'icon-512.png'));

console.log('Icons generated successfully!');
