import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  
  // Log the scan
  try {
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : null;
    
    await supabase.from('qr_scans').insert({
      qr_code_id: qrCode.id,
      receipt_id: receipt_id || null,
      store_id: qrCode.store_id || null,
      user_agent: userAgent,
      ip_address: null, // Could add IP logging if needed
      referrer: null, // Could add referrer tracking if needed
    });
  } catch (logError) {
    // Log error but don't block redirect
    console.error('Failed to log QR scan:', logError);
  }
  
  // Redirect to target URL
  redirect(qrCode.target_url);
}
