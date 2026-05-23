const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedGoogleReviewQR() {
  // Default Google Review URL - replace with your actual Google Business Profile review link
  const GOOGLE_REVIEW_URL = 'https://g.page/r/YOUR_GOOGLE_BUSINESS_ID/review';
  
  // Get the first org (Penkey)
  const { data: orgs, error: orgError } = await supabase
    .from('orgs')
    .select('id')
    .limit(1);
  
  if (orgError) {
    console.error('Error fetching org:', orgError);
    process.exit(1);
  }
  
  if (!orgs || orgs.length === 0) {
    console.error('No org found. Please create an org first.');
    process.exit(1);
  }
  
  const orgId = orgs[0].id;
  console.log(`Using org: ${orgId}`);
  
  // Check if Google Review QR code already exists
  const { data: existingQR, error: checkError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('org_id', orgId)
    .eq('code_type', 'google_review')
    .single();
  
  if (existingQR) {
    console.log('Google Review QR code already exists:', existingQR);
    console.log('Updating target URL...');
    
    // Update the target URL
    const { error: updateError } = await supabase
      .from('qr_codes')
      .update({ target_url: GOOGLE_REVIEW_URL })
      .eq('id', existingQR.id);
    
    if (updateError) {
      console.error('Error updating QR code:', updateError);
      process.exit(1);
    }
    
    console.log('✅ Updated Google Review QR code');
    console.log(`Tracking URL: https://your-domain.com/qr/${existingQR.unique_code}`);
  } else {
    // Generate unique code
    const uniqueCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Create new QR code
    const { data: newQR, error: createError } = await supabase
      .from('qr_codes')
      .insert({
        org_id: orgId,
        store_id: null,
        code_type: 'google_review',
        name: 'Google Reviews',
        target_url: GOOGLE_REVIEW_URL,
        unique_code: uniqueCode,
        is_active: true,
        config: {},
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating QR code:', createError);
      process.exit(1);
    }
    
    console.log('✅ Created Google Review QR code');
    console.log(`ID: ${newQR.id}`);
    console.log(`Unique Code: ${newQR.unique_code}`);
    console.log(`Tracking URL: https://your-domain.com/qr/${newQR.unique_code}`);
  }
  
  console.log('\n⚠️  IMPORTANT: Update GOOGLE_REVIEW_URL in this script with your actual Google Business Profile review link');
  console.log('Then run this script again to update the URL.');
}

seedGoogleReviewQR()
  .then(() => {
    console.log('\n✅ Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
