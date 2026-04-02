import sharp from 'sharp';

export interface CompressedImage {
  thumbnail: Buffer;
  full: Buffer;
  format: 'webp' | 'jpeg';
}

/**
 * Compress image to two sizes: thumbnail (200px) and full (800px)
 * Generates WebP format with JPEG fallback
 */
export async function compressImage(buffer: Buffer): Promise<CompressedImage> {
  try {
    // Validate input
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty image buffer');
    }

    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('Image exceeds 5MB limit');
    }

    // Try WebP first (better compression)
    try {
      const thumbnail = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .resize(200, 200, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 70 })
        .toBuffer();

      const full = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .resize(800, 800, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 })
        .toBuffer();

      return {
        thumbnail,
        full,
        format: 'webp',
      };
    } catch (webpError) {
      // Fallback to JPEG if WebP fails
      console.warn('[ImageCompression] WebP failed, falling back to JPEG:', webpError);

      const thumbnail = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .resize(200, 200, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 70 })
        .toBuffer();

      const full = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .resize(800, 800, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      return {
        thumbnail,
        full,
        format: 'jpeg',
      };
    }
  } catch (error) {
    console.error('[ImageCompression] Error compressing image:', error);
    throw new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate image file
 */
export function validateImageFile(buffer: Buffer, mimeType: string): boolean {
  // Check size
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Image exceeds 5MB limit');
  }

  // Check MIME type
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimes.includes(mimeType)) {
    throw new Error(`Invalid image format. Allowed: ${allowedMimes.join(', ')}`);
  }

  return true;
}

/**
 * Get file extension based on format
 */
export function getFileExtension(format: 'webp' | 'jpeg'): string {
  return format === 'webp' ? 'webp' : 'jpg';
}
