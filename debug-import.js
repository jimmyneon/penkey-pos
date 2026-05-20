#!/usr/bin/env node

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

// Read receipts-by-item file
const itemsPath = path.join(__dirname, 'loyverse-data', 'receipts-by-item-2023-08-01-2026-05-20.csv');
const itemsContent = fs.readFileSync(itemsPath, 'utf-8');
const itemsLines = itemsContent.split('\n').filter(l => l.trim());

console.log('📊 Debugging Line Items Import\n');
console.log('='.repeat(60));

// Parse headers
const itemHeaders = parseCSVLine(itemsLines[0]);
const itemMap = new Map(itemHeaders.map((h, i) => [h.toLowerCase(), i]));

console.log('\n📋 CSV Headers:');
itemHeaders.forEach((h, i) => console.log(`  ${i}: ${h}`));

// Group line items by receipt number
const lineItemsByReceipt = new Map();

for (let i = 1; i < Math.min(itemsLines.length, 100); i++) {
  const values = parseCSVLine(itemsLines[i]);
  const receiptNumber = values[itemMap.get('receipt number')];
  
  if (!lineItemsByReceipt.has(receiptNumber)) {
    lineItemsByReceipt.set(receiptNumber, []);
  }
  
  lineItemsByReceipt.get(receiptNumber).push({
    item: values[itemMap.get('item')],
    quantity: parseFloat(values[itemMap.get('quantity')]) || 0,
    net_sales: parseFloat(values[itemMap.get('net sales')]) || 0,
  });
}

console.log(`\n✅ Grouped ${lineItemsByReceipt.size} unique receipts from first 100 lines`);

// Show a sample
const sampleReceipt = '3-1772';
const sampleItems = lineItemsByReceipt.get(sampleReceipt);

console.log(`\n📦 Sample Receipt: ${sampleReceipt}`);
if (sampleItems) {
  console.log(`  Line items: ${sampleItems.length}`);
  sampleItems.forEach((item, i) => {
    console.log(`    ${i + 1}. ${item.item} x${item.quantity} = £${item.net_sales}`);
  });
} else {
  console.log('  ⚠️  No line items found for this receipt!');
}

console.log('\n' + '='.repeat(60));
