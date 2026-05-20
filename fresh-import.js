#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function freshImport() {
  console.log('🧹 Deleting all Loyverse receipts for fresh import...\n');
  
  // Delete payments
  console.log('Deleting payments...');
  const { data: receiptsToDelete } = await supabase
    .from('receipts')
    .select('id')
    .eq('org_id', ORG_ID)
    .like('receipt_number', '3-%');
  
  const receiptIds = receiptsToDelete?.map(r => r.id) || [];
  console.log(`Found ${receiptIds.length} Loyverse receipts to delete`);
  
  if (receiptIds.length > 0) {
    // Delete in batches
    for (let i = 0; i < receiptIds.length; i += 100) {
      const batch = receiptIds.slice(i, i + 100);
      await supabase.from('payments').delete().in('receipt_id', batch);
      await supabase.from('receipt_lines').delete().in('receipt_id', batch);
      console.log(`Deleted batch ${Math.floor(i/100) + 1}/${Math.ceil(receiptIds.length/100)}`);
    }
    
    // Delete receipts
    await supabase
      .from('receipts')
      .delete()
      .eq('org_id', ORG_ID)
      .like('receipt_number', '3-%');
    
    console.log('✅ Deletion complete\n');
  }
  
  // Verify
  const { count } = await supabase
    .from('receipts')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', ORG_ID);
  
  console.log(`Remaining receipts: ${count}\n`);
  
  // Re-import
  console.log('🚀 Starting fresh import with fixed script...\n');
  console.log('='.repeat(60));
  execSync('node import-loyverse-history.js', { stdio: 'inherit' });
}

freshImport().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
