export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { compressImage, validateImageFile } from '@/lib/services/image-compression';
import { uploadToR2 } from '@/lib/services/r2-upload';

/**
 * POST /api/items/upload-image
 * Upload and compress product image
 * 
 * Request body: FormData with 'image' file and 'itemId' field
 * Response: { thumbnailUrl, fullUrl, format }
 */
export async function POST(request: NextRequest) {
  try {
    // Validate session using standard POS auth
    const session = await validatePOSSession(request);
    if (!session) {
      console.warn('[ImageUpload] Failed: Invalid or missing session');
      return unauthorizedResponse();
    }

    const userId = session.user_id;
    const orgId = session.org_id;

    console.log(`[ImageUpload] POST /api/items/upload-image - User: ${userId}, Org: ${orgId}`);

    // Parse form data
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const itemId = formData.get('itemId') as string;

    if (!imageFile || !itemId) {
      return NextResponse.json(
        { error: 'Missing image file or itemId' },
        { status: 400 }
      );
    }

    // Validate item belongs to org
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, org_id')
      .eq('id', itemId)
      .eq('org_id', orgId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Item not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await imageFile.arrayBuffer());

    // Validate image
    validateImageFile(buffer, imageFile.type);

    // Compress image
    const { thumbnail, full, format } = await compressImage(buffer);

    // Upload to R2
    const { thumbnailUrl, fullUrl } = await uploadToR2(
      orgId,
      itemId,
      thumbnail,
      full,
      format
    );

    // Update item with image URL (store full image URL)
    const { error: updateError } = await supabase
      .from('items')
      .update({
        image_url: fullUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error('[UploadImage] Error updating item:', updateError);
      return NextResponse.json(
        { error: 'Failed to save image URL to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      thumbnailUrl,
      fullUrl,
      format,
    });
  } catch (error) {
    console.error('[UploadImage] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to upload image',
      },
      { status: 500 }
    );
  }
}

/**
 * Rate limiting helper (simple in-memory for single server)
 */
const uploadCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = uploadCounts.get(userId);

  if (!userLimit || userLimit.resetTime < now) {
    uploadCounts.set(userId, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }

  if (userLimit.count >= 10) {
    return false; // 10 uploads per minute
  }

  userLimit.count++;
  return true;
}
