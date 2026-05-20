#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSchema() {
  console.log('🔍 Checking receipts table schema...\n');
  
  // Try to get a sample receipt to see the structure
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Error:', error.message);
    
    // Try to insert a test record to see what columns are expected
    console.log('\n📝 Attempting test insert to discover schema...\n');
    
    const { error: insertError } = await supabase
      .from('receipts')
      .insert({
        org_id: '00000000-0000-0000-0000-000000000001',
        test: true
      });
    
    if (insertError) {
      console.log('Insert error details:', insertError);
    }
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ Receipts table columns:\n');
    const columns = Object.keys(data[0]);
    columns.forEach(col => {
      const value = data[0][col];
      const type = value === null ? 'null' : typeof value;
      console.log(`  - ${col} (${type})`);
    });
  } else {
    console.log('⚠️  No receipts found in database');
    console.log('\nTrying to get table structure from API...\n');
    
    // Try an empty insert to see required fields
    const { error: emptyError } = await supabase
      .from('receipts')
      .insert({});
    
    console.log('Error response:', emptyError);
  }
  
  // Also check payments table
  console.log('\n🔍 Checking payments table schema...\n');
  
  const { data: paymentData } = await supabase
    .from('payments')
    .select('*')
    .limit(1);
  
  if (paymentData && paymentData.length > 0) {
    console.log('✅ Payments table columns:\n');
    const columns = Object.keys(paymentData[0]);
    columns.forEach(col => {
      const value = paymentData[0][col];
      const type = value === null ? 'null' : typeof value;
      console.log(`  - ${col} (${type})`);
    });
  }
  
  // Check receipt_lines table
  console.log('\n🔍 Checking receipt_lines table schema...\n');
  
  const { data: linesData } = await supabase
    .from('receipt_lines')
    .select('*')
    .limit(1);
  
  if (linesData && linesData.length > 0) {
    console.log('✅ Receipt_lines table columns:\n');
    const columns = Object.keys(linesData[0]);
    columns.forEach(col => {
      const value = linesData[0][col];
      const type = value === null ? 'null' : typeof value;
      console.log(`  - ${col} (${type})`);
    });
  }
}

checkSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
