import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface R2UploadResult {
  thumbnailUrl: string;
  fullUrl: string;
  format: 'webp' | 'jpeg';
}

/**
 * Initialize R2 client (S3-compatible)
 */
function getR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing Cloudflare R2 credentials in environment variables');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Upload compressed images to R2
 */
export async function uploadToR2(
  orgId: string,
  itemId: string,
  thumbnailBuffer: Buffer,
  fullBuffer: Buffer,
  format: 'webp' | 'jpeg'
): Promise<R2UploadResult> {
  const client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_BUCKET_NAME;
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  if (!bucketName || !publicUrl) {
    throw new Error('Missing R2 bucket configuration');
  }

  const ext = format === 'webp' ? 'webp' : 'jpg';
  const contentType = format === 'webp' ? 'image/webp' : 'image/jpeg';

  try {
    // Upload thumbnail
    const thumbnailKey = `${orgId}/${itemId}/thumbnail.${ext}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=2592000', // 30 days
      })
    );

    // Upload full image
    const fullKey = `${orgId}/${itemId}/full.${ext}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fullKey,
        Body: fullBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=2592000', // 30 days
      })
    );

    return {
      thumbnailUrl: `${publicUrl}/${thumbnailKey}`,
      fullUrl: `${publicUrl}/${fullKey}`,
      format,
    };
  } catch (error) {
    console.error('[R2Upload] Error uploading to R2:', error);
    throw new Error(`Failed to upload image to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete image from R2
 */
export async function deleteFromR2(orgId: string, itemId: string, format: 'webp' | 'jpeg'): Promise<void> {
  const client = getR2Client();
  const bucketName = process.env.CLOUDFLARE_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('Missing R2 bucket configuration');
  }

  const ext = format === 'webp' ? 'webp' : 'jpg';

  try {
    // Delete both versions
    const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
    
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: [
            { Key: `${orgId}/${itemId}/thumbnail.${ext}` },
            { Key: `${orgId}/${itemId}/full.${ext}` },
          ],
        },
      })
    );
  } catch (error) {
    console.error('[R2Upload] Error deleting from R2:', error);
    // Don't throw - deletion failure shouldn't block item deletion
  }
}
