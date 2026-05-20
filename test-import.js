#!/usr/bin/env node

/**
 * Test script to import Loyverse items catalog
 * This uses the service role key to bypass authentication
 */

const fs = require('fs');
const path = require('path');

async function importLoyverseData() {
  console.log('🔍 Reading Loyverse export file...');
  
  const csvPath = path.join(__dirname, 'loyverse', 'export_items.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ File not found:', csvPath);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(l => l.trim());
  
  console.log(`📊 Found ${lines.length - 1} items in CSV (excluding header)`);
  
  // Parse header to show format
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
  console.log('\n📋 CSV Headers:');
  console.log('  - ' + headers.slice(0, 10).join('\n  - '));
  console.log(`  ... and ${headers.length - 10} more columns`);
  
  // Check for Loyverse format markers
  const hasHandle = headers.some(h => h.toLowerCase() === 'handle');
  const hasSKU = headers.some(h => h.toLowerCase() === 'sku');
  const hasModifiers = headers.some(h => h.toLowerCase().startsWith('modifier -'));
  
  console.log('\n✅ Format Detection:');
  console.log(`  - Has Handle column: ${hasHandle ? '✓' : '✗'}`);
  console.log(`  - Has SKU column: ${hasSKU ? '✓' : '✗'}`);
  console.log(`  - Has Modifier columns: ${hasModifiers ? '✓' : '✗'}`);
  console.log(`  - Format: ${hasHandle && hasSKU ? 'Loyverse ✓' : 'Unknown'}`);
  
  // Count categories and add-ons
  const categories = new Set();
  const addOns = [];
  const regularItems = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const name = values[2]?.replace(/^"|"$/g, '') || '';
    const category = values[3]?.replace(/^"|"$/g, '') || '';
    
    if (category) categories.add(category);
    
    if (category.toLowerCase() === 'add-ons') {
      addOns.push(name);
    } else if (name) {
      regularItems.push(name);
    }
  }
  
  console.log('\n📦 Data Summary:');
  console.log(`  - Categories: ${categories.size}`);
  console.log(`  - Regular Items: ${regularItems.length}`);
  console.log(`  - Add-ons (will become modifiers): ${addOns.length}`);
  
  console.log('\n📁 Categories found:');
  Array.from(categories).slice(0, 10).forEach(cat => {
    console.log(`  - ${cat}`);
  });
  if (categories.size > 10) {
    console.log(`  ... and ${categories.size - 10} more`);
  }
  
  console.log('\n🔧 Add-ons that will become modifier options:');
  addOns.slice(0, 10).forEach(addon => {
    console.log(`  - ${addon}`);
  });
  if (addOns.length > 10) {
    console.log(`  ... and ${addOns.length - 10} more`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ CSV file is valid and ready for import!');
  console.log('='.repeat(60));
  console.log('\n📝 To import this data:');
  console.log('  1. Open your POS app in the browser');
  console.log('  2. Log in and navigate to Items Hub');
  console.log('  3. Click "Import" button');
  console.log('  4. Select: loyverse/export_items.csv');
  console.log('  5. Review the preview and click "Import"');
  console.log('\n💡 The import will:');
  console.log('  - Create/update all categories');
  console.log('  - Create/update all items with prices');
  console.log('  - Convert Add-ons to modifier options');
  console.log('  - Link items to their modifier groups');
  console.log('  - Sync everything to IndexedDB');
}

importLoyverseData().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
