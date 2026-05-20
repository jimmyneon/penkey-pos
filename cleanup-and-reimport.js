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

async function cleanupAndReimport() {
  console.log('🧹 Cleaning up receipts without line items...\n');
  
  // Find receipts with no line items
  const { data: receiptsWithoutLines } = await supabase
    .from('receipts')
    .select('id, receipt_number')
    .eq('org_id', ORG_ID);
  
  let emptyReceipts = [];
  for (const receipt of receiptsWithoutLines || []) {
    const { count } = await supabase
      .from('receipt_lines')
      .select('*', { count: 'exact', head: true })
      .eq('receipt_id', receipt.id);
    
    if (count === 0) {
      emptyReceipts.push(receipt);
    }
  }
  
  console.log(`Found ${emptyReceipts.length} receipts without line items`);
  
  if (emptyReceipts.length === 0) {
    console.log('✅ No cleanup needed!');
    return;
  }
  
  // Delete payments for these receipts
  console.log('\n🗑️  Deleting payments...');
  for (const receipt of emptyReceipts) {
    await supabase
      .from('payments')
      .delete()
      .eq('receipt_id', receipt.id);
  }
  
  // Delete the receipts
  console.log('🗑️  Deleting receipts...');
  for (const receipt of emptyReceipts) {
    await supabase
      .from('receipts')
      .delete()
      .eq('id', receipt.id);
  }
  
  console.log(`✅ Deleted ${emptyReceipts.length} empty receipts\n`);
  
  // Re-import
  console.log('🚀 Re-importing with fixed script...\n');
  execSync('node import-loyverse-history.js', { stdio: 'inherit' });
}

cleanupAndReimport().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
