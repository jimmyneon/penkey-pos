#!/usr/bin/env node

/**
 * Preview Loyverse Historical Data Import
 * Shows what will be imported WITHOUT actually importing
 */

const fs = require('fs');
const path = require('path');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function previewImport() {
  console.log('📊 Loyverse Historical Data Preview\n');
  console.log('='.repeat(60));
  
  // Read receipts file
  const receiptsPath = path.join(__dirname, 'loyverse-data', 'receipts-2023-08-01-2026-05-20.csv');
  const receiptsContent = fs.readFileSync(receiptsPath, 'utf-8');
  const receiptsLines = receiptsContent.split('\n').filter(l => l.trim());
  
  // Read receipts-by-item file
  const itemsPath = path.join(__dirname, 'loyverse-data', 'receipts-by-item-2023-08-01-2026-05-20.csv');
  const itemsContent = fs.readFileSync(itemsPath, 'utf-8');
  const itemsLines = itemsContent.split('\n').filter(l => l.trim());
  
  console.log(`📄 Total receipts: ${receiptsLines.length - 1}`);
  console.log(`📦 Total line items: ${itemsLines.length - 1}\n`);
  
  // Parse headers
  const receiptHeaders = parseCSVLine(receiptsLines[0]);
  const receiptMap = new Map(receiptHeaders.map((h, i) => [h.toLowerCase(), i]));
  
  // Analyze data
  let sales = 0;
  let refunds = 0;
  let totalRevenue = 0;
  const paymentMethods = new Map();
  const dateRange = { earliest: null, latest: null };
  const itemsSold = new Map();
  
  for (let i = 1; i < receiptsLines.length; i++) {
    const values = parseCSVLine(receiptsLines[i]);
    
    const receiptType = values[receiptMap.get('receipt type')];
    const netSales = parseFloat(values[receiptMap.get('net sales')]) || 0;
    const paymentType = values[receiptMap.get('payment type')] || 'Unknown';
    const dateStr = values[receiptMap.get('date')];
    const status = values[receiptMap.get('status')];
    
    if (status === 'Closed') {
      if (receiptType === 'Sale') {
        sales++;
        totalRevenue += netSales;
      } else if (receiptType === 'Refund') {
        refunds++;
        totalRevenue += netSales; // netSales is negative for refunds
      }
      
      paymentMethods.set(paymentType, (paymentMethods.get(paymentType) || 0) + 1);
      
      // Track date range
      if (!dateRange.earliest || dateStr < dateRange.earliest) {
        dateRange.earliest = dateStr;
      }
      if (!dateRange.latest || dateStr > dateRange.latest) {
        dateRange.latest = dateStr;
      }
    }
  }
  
  // Analyze items
  const itemHeaders = parseCSVLine(itemsLines[0]);
  const itemMap = new Map(itemHeaders.map((h, i) => [h.toLowerCase(), i]));
  
  for (let i = 1; i < itemsLines.length; i++) {
    const values = parseCSVLine(itemsLines[i]);
    const item = values[itemMap.get('item')];
    const quantity = parseFloat(values[itemMap.get('quantity')]) || 0;
    
    if (item) {
      itemsSold.set(item, (itemsSold.get(item) || 0) + Math.abs(quantity));
    }
  }
  
  console.log('📈 Summary Statistics:\n');
  console.log(`  Date Range: ${dateRange.earliest} to ${dateRange.latest}`);
  console.log(`  Total Sales: ${sales}`);
  console.log(`  Total Refunds: ${refunds}`);
  console.log(`  Net Revenue: £${totalRevenue.toFixed(2)}`);
  console.log(`  Unique Items: ${itemsSold.size}\n`);
  
  console.log('💳 Payment Methods:\n');
  for (const [method, count] of Array.from(paymentMethods.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${method}: ${count} receipts`);
  }
  
  console.log('\n🏆 Top 10 Items Sold:\n');
  const topItems = Array.from(itemsSold.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  for (const [item, qty] of topItems) {
    console.log(`  ${item}: ${qty} units`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📝 What will be imported:\n');
  console.log(`  ✅ ${sales} sales receipts`);
  console.log(`  ⏭️  ${refunds} refunds (will be skipped)`);
  console.log(`  📦 ${itemsLines.length - 1} line items`);
  console.log(`  💰 £${totalRevenue.toFixed(2)} total revenue`);
  console.log('\n⚠️  NOTE: Refunds will be skipped in the import');
  console.log('⚠️  NOTE: Items must already exist in your catalog');
  console.log('='.repeat(60));
  
  console.log('\n🚀 To run the actual import:');
  console.log('   node import-loyverse-history.js\n');
}

previewImport().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
