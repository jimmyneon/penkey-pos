import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SCAN_DEBOUNCE_MINUTES = 30;

interface PageProps {
  params: {
    code: string;
  };
  searchParams: {
    receipt_id?: string;
  };
}

export default async function QRRedirectPage({ params, searchParams }: PageProps) {
  const { code } = params;
  const { receipt_id } = searchParams;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Find QR code by unique code
  const { data: qrCode, error } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('unique_code', code.toUpperCase())
    .eq('is_active', true)
    .single();
  
  if (error || !qrCode) {
    // QR code not found or inactive, redirect to home
    redirect('/');
  }
  
  // Log the scan (with debounce to prevent duplicate scans from the same device)
  try {
    const headerList = headers();
    const userAgent = headerList.get('user-agent') || null;
    const forwarded = headerList.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : null;
    
    // Check for a recent scan from the same QR code within the debounce window
    const debounceCutoff = new Date(Date.now() - SCAN_DEBOUNCE_MINUTES * 60 * 1000).toISOString();
    
    let recentScanQuery = supabase
      .from('qr_scans')
      .select('id')
      .eq('qr_code_id', qrCode.id)
      .gte('scanned_at', debounceCutoff)
      .limit(1);
    
    if (ip) {
      recentScanQuery = recentScanQuery.eq('ip_address', ip);
    } else if (userAgent) {
      recentScanQuery = recentScanQuery.eq('user_agent', userAgent);
    }
    
    const { data: recentScan } = await recentScanQuery;
    
    // Only log if no recent scan found (debounce)
    if (!recentScan || recentScan.length === 0) {
      await supabase.from('qr_scans').insert({
        qr_code_id: qrCode.id,
        receipt_id: receipt_id || null,
        store_id: qrCode.store_id || null,
        user_agent: userAgent,
        ip_address: ip,
        referrer: headerList.get('referer') || null,
      });
    }
  } catch (logError) {
    // Log error but don't block redirect
    console.error('Failed to log QR scan:', logError);
  }
  
  // Redirect to target URL
  redirect(qrCode.target_url);
}
