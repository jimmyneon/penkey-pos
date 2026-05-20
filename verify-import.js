#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyImport() {
  console.log('📊 Verifying Loyverse Import\n');
  console.log('='.repeat(60));
  
  // Count receipts
  const { count: receiptCount } = await supabase
    .from('receipts')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', ORG_ID);
  
  console.log(`\n✅ Total Receipts: ${receiptCount}`);
  
  // Count receipt lines
  const { count: linesCount } = await supabase
    .from('receipt_lines')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', ORG_ID);
  
  console.log(`✅ Total Receipt Lines: ${linesCount}`);
  
  // Get total revenue
  const { data: revenueData } = await supabase
    .from('receipts')
    .select('total')
    .eq('org_id', ORG_ID)
    .eq('status', 'completed');
  
  const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total || 0), 0) || 0;
  console.log(`✅ Total Revenue: £${totalRevenue.toFixed(2)}`);
  
  // Get date range
  const { data: dateRange } = await supabase
    .from('receipts')
    .select('created_at')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: true })
    .limit(1);
  
  const { data: latestDate } = await supabase
    .from('receipts')
    .select('created_at')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (dateRange && dateRange[0] && latestDate && latestDate[0]) {
    const earliest = new Date(dateRange[0].created_at).toLocaleDateString();
    const latest = new Date(latestDate[0].created_at).toLocaleDateString();
    console.log(`✅ Date Range: ${earliest} to ${latest}`);
  }
  
  // Count lines with null item_id (historical items)
  const { count: historicalCount } = await supabase
    .from('receipt_lines')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', ORG_ID)
    .is('item_id', null);
  
  console.log(`\n📦 Historical Items (no longer in catalog): ${historicalCount} line items`);
  
  // Count payments
  const { count: paymentsCount } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true });
  
  console.log(`💳 Total Payments: ${paymentsCount}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Import verification complete!');
  console.log('='.repeat(60));
}

verifyImport().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
