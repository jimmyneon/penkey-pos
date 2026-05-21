#!/usr/bin/env node

/**
 * Verify Report Data - Check if imported Loyverse data is correct
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // .env.local doesn't exist, will use process.env
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyData() {
  console.log('🔍 Verifying Report Data\n');
  console.log('='.repeat(60));
  
  // Check receipts
  const { data: receipts, error: receiptsError } = await supabase
    .from('receipts')
    .select('id, total, subtotal, tax_total, discount_total, created_at, receipt_number')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false });
  
  if (receiptsError) {
    console.error('❌ Error fetching receipts:', receiptsError);
    return;
  }
  
  console.log(`\n📊 RECEIPTS SUMMARY`);
  console.log(`Total receipts: ${receipts.length}`);
  
  if (receipts.length > 0) {
    const totalRevenue = receipts.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    const totalSubtotal = receipts.reduce((sum, r) => sum + parseFloat(r.subtotal || 0), 0);
    const totalTax = receipts.reduce((sum, r) => sum + parseFloat(r.tax_total || 0), 0);
    const totalDiscount = receipts.reduce((sum, r) => sum + parseFloat(r.discount_total || 0), 0);
    
    console.log(`Total revenue (sum of total): £${totalRevenue.toFixed(2)}`);
    console.log(`Total subtotal: £${totalSubtotal.toFixed(2)}`);
    console.log(`Total tax: £${totalTax.toFixed(2)}`);
    console.log(`Total discounts: £${totalDiscount.toFixed(2)}`);
    console.log(`Date range: ${receipts[receipts.length - 1].created_at} to ${receipts[0].created_at}`);
    
    // Sample receipts
    console.log(`\n📝 Sample receipts (first 5):`);
    receipts.slice(0, 5).forEach(r => {
      console.log(`  ${r.receipt_number}: £${r.total} (subtotal: £${r.subtotal}, tax: £${r.tax_total}, discount: £${r.discount_total})`);
    });
  }
  
  // Check receipt lines
  const { data: lines, error: linesError } = await supabase
    .from('receipt_lines')
    .select('id, name, quantity, unit_price, line_total, receipt_id')
    .limit(10000);
  
  if (linesError) {
    console.error('❌ Error fetching receipt lines:', linesError);
    return;
  }
  
  console.log(`\n📦 RECEIPT LINES SUMMARY`);
  console.log(`Total line items: ${lines.length}`);
  
  if (lines.length > 0) {
    const totalLineRevenue = lines.reduce((sum, l) => sum + parseFloat(l.line_total || 0), 0);
    const totalQuantity = lines.reduce((sum, l) => sum + parseFloat(l.quantity || 0), 0);
    
    console.log(`Total line revenue: £${totalLineRevenue.toFixed(2)}`);
    console.log(`Total quantity sold: ${totalQuantity}`);
    
    // Group by item
    const itemMap = new Map();
    lines.forEach(line => {
      const name = line.name;
      if (!itemMap.has(name)) {
        itemMap.set(name, { quantity: 0, revenue: 0 });
      }
      const item = itemMap.get(name);
      item.quantity += parseFloat(line.quantity || 0);
      item.revenue += parseFloat(line.line_total || 0);
    });
    
    const topItems = Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
    
    console.log(`\n🏆 Top 10 selling items:`);
    topItems.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.name}: ${item.quantity} sold, £${item.revenue.toFixed(2)} revenue`);
    });
  }
  
  // Check payments
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, method, amount, receipt_id')
    .limit(10000);
  
  if (paymentsError) {
    console.error('❌ Error fetching payments:', paymentsError);
    return;
  }
  
  console.log(`\n💳 PAYMENTS SUMMARY`);
  console.log(`Total payment records: ${payments.length}`);
  
  if (payments.length > 0) {
    const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    console.log(`Total payment amount: £${totalPayments.toFixed(2)}`);
    
    // Group by method
    const methodMap = new Map();
    payments.forEach(payment => {
      const method = payment.method || 'unknown';
      if (!methodMap.has(method)) {
        methodMap.set(method, { count: 0, amount: 0 });
      }
      const data = methodMap.get(method);
      data.count += 1;
      data.amount += parseFloat(payment.amount || 0);
    });
    
    console.log(`\nPayment methods:`);
    Array.from(methodMap.entries()).forEach(([method, data]) => {
      console.log(`  ${method}: ${data.count} transactions, £${data.amount.toFixed(2)}`);
    });
  }
  
  // Check for discrepancies
  console.log(`\n⚠️  POTENTIAL ISSUES:`);
  
  if (receipts.length > 0 && lines.length > 0) {
    const totalReceiptRevenue = receipts.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    const totalLineRevenue = lines.reduce((sum, l) => sum + parseFloat(l.line_total || 0), 0);
    const diff = Math.abs(totalReceiptRevenue - totalLineRevenue);
    
    if (diff > 1) {
      console.log(`  ❌ Revenue mismatch: Receipts total (£${totalReceiptRevenue.toFixed(2)}) != Line items total (£${totalLineRevenue.toFixed(2)})`);
      console.log(`     Difference: £${diff.toFixed(2)}`);
    } else {
      console.log(`  ✅ Revenue matches between receipts and line items`);
    }
  }
  
  if (receipts.length > 0 && payments.length > 0) {
    const totalReceiptRevenue = receipts.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const diff = Math.abs(totalReceiptRevenue - totalPayments);
    
    if (diff > 1) {
      console.log(`  ❌ Payment mismatch: Receipts total (£${totalReceiptRevenue.toFixed(2)}) != Payments total (£${totalPayments.toFixed(2)})`);
      console.log(`     Difference: £${diff.toFixed(2)}`);
    } else {
      console.log(`  ✅ Payments match receipt totals`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

verifyData().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
