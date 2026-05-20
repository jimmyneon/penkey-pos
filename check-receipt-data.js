#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkReceiptData() {
  console.log('🔍 Checking Receipt Data Structure\n');
  console.log('='.repeat(60));
  
  // Get a sample imported receipt (from Loyverse)
  const { data: sampleReceipt } = await supabase
    .from('receipts')
    .select('*')
    .eq('org_id', ORG_ID)
    .like('receipt_number', '3-%')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (sampleReceipt) {
    console.log('\n📄 Sample Imported Receipt:');
    console.log(`  Receipt Number: ${sampleReceipt.receipt_number}`);
    console.log(`  Date: ${new Date(sampleReceipt.created_at).toLocaleString()}`);
    console.log(`  Total: £${sampleReceipt.total}`);
    console.log(`  Status: ${sampleReceipt.status}`);
    console.log(`  Store ID: ${sampleReceipt.store_id}`);
    console.log(`  Register ID: ${sampleReceipt.register_id}`);
    console.log(`  Member ID: ${sampleReceipt.member_id}`);
    
    // Get line items for this receipt
    const { data: lines } = await supabase
      .from('receipt_lines')
      .select('*')
      .eq('receipt_id', sampleReceipt.id);
    
    console.log(`\n📦 Line Items (${lines?.length || 0} items):`);
    if (lines && lines.length > 0) {
      lines.forEach((line, i) => {
        console.log(`\n  Item ${i + 1}:`);
        console.log(`    Name: ${line.name}`);
        console.log(`    Item ID: ${line.item_id || 'null (historical item)'}`);
        console.log(`    Quantity: ${line.quantity}`);
        console.log(`    Unit Price: £${line.unit_price}`);
        console.log(`    Line Total: £${line.line_total}`);
        console.log(`    Modifiers: ${line.modifiers ? JSON.stringify(line.modifiers) : 'none'}`);
      });
    } else {
      console.log('  ⚠️  NO LINE ITEMS FOUND!');
    }
    
    // Get payment for this receipt
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('receipt_id', sampleReceipt.id)
      .single();
    
    console.log(`\n💳 Payment:`);
    if (payment) {
      console.log(`  Method: ${payment.method}`);
      console.log(`  Amount: £${payment.amount}`);
      console.log(`  Transaction ID: ${payment.metadata?.transaction_id || 'none (imported data)'}`);
    } else {
      console.log('  ⚠️  NO PAYMENT FOUND!');
    }
  }
  
  // Check if there are receipts with missing line items
  const { data: receiptsWithoutLines } = await supabase.rpc('check_receipts_without_lines', {
    p_org_id: ORG_ID
  }).catch(() => null);
  
  // Alternative check
  const { data: allReceipts } = await supabase
    .from('receipts')
    .select('id, receipt_number')
    .eq('org_id', ORG_ID)
    .limit(100);
  
  let missingLines = 0;
  if (allReceipts) {
    for (const receipt of allReceipts) {
      const { count } = await supabase
        .from('receipt_lines')
        .select('*', { count: 'exact', head: true })
        .eq('receipt_id', receipt.id);
      
      if (count === 0) {
        missingLines++;
      }
    }
  }
  
  console.log(`\n\n📊 Data Integrity Check:`);
  console.log(`  Receipts checked: ${allReceipts?.length || 0}`);
  console.log(`  Receipts with NO line items: ${missingLines}`);
  
  if (missingLines > 0) {
    console.log(`\n⚠️  WARNING: ${missingLines} receipts have no line items!`);
    console.log('  This will cause receipts to appear empty in the UI.');
  }
  
  console.log('\n' + '='.repeat(60));
}

checkReceiptData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
