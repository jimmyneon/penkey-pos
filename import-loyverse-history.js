#!/usr/bin/env node

/**
 * Import Loyverse Historical Transaction Data
 * This script imports all historical receipts and line items from Loyverse into Penkey POS
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Try to load from .env.local if it exists, otherwise use environment variables
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // .env.local doesn't exist, will use process.env
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001'; // Penkey org ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set environment variables:');
  console.error('  export NEXT_PUBLIC_SUPABASE_URL=your_url');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY=your_key');
  console.error('\nOr create .env.local with these values');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

function parseLoyverseDate(dateStr) {
  // Format: "20/05/2026 16:50" -> ISO timestamp
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/');
  return new Date(`${year}-${month}-${day}T${timePart}:00Z`).toISOString();
}

async function getItemIdByName(itemName) {
  const { data } = await supabase
    .from('items')
    .select('id')
    .eq('org_id', ORG_ID)
    .eq('name', itemName)
    .single();
  return data?.id || null;
}

async function getEmployeeIdByName(employeeName) {
  if (!employeeName || employeeName === 'Owner') {
    // Get first active employee
    const { data } = await supabase
      .from('org_members')
      .select('id')
      .eq('org_id', ORG_ID)
      .eq('is_active', true)
      .limit(1)
      .single();
    return data?.id || null;
  }
  
  const { data } = await supabase
    .from('org_members')
    .select('id')
    .eq('org_id', ORG_ID)
    .ilike('first_name', `%${employeeName}%`)
    .single();
  return data?.id || null;
}

async function importHistoricalData() {
  console.log('📊 Importing Loyverse Historical Data\n');
  console.log('='.repeat(60));
  
  // Read receipts file
  const receiptsPath = path.join(__dirname, 'loyverse-data', 'receipts-2023-08-01-2026-05-20.csv');
  const receiptsContent = fs.readFileSync(receiptsPath, 'utf-8');
  const receiptsLines = receiptsContent.split('\n').filter(l => l.trim());
  
  // Read receipts-by-item file
  const itemsPath = path.join(__dirname, 'loyverse-data', 'receipts-by-item-2023-08-01-2026-05-20.csv');
  const itemsContent = fs.readFileSync(itemsPath, 'utf-8');
  const itemsLines = itemsContent.split('\n').filter(l => l.trim());
  
  console.log(`📄 Found ${receiptsLines.length - 1} receipts`);
  console.log(`📦 Found ${itemsLines.length - 1} line items\n`);
  
  // Parse headers
  const receiptHeaders = parseCSVLine(receiptsLines[0]);
  const itemHeaders = parseCSVLine(itemsLines[0]);
  
  // Create header maps
  const receiptMap = new Map(receiptHeaders.map((h, i) => [h.toLowerCase(), i]));
  const itemMap = new Map(itemHeaders.map((h, i) => [h.toLowerCase(), i]));
  
  // Group line items by receipt number
  const lineItemsByReceipt = new Map();
  
  console.log('🔄 Processing line items...');
  for (let i = 1; i < itemsLines.length; i++) {
    const values = parseCSVLine(itemsLines[i]);
    const receiptNumber = values[itemMap.get('receipt number')];
    
    if (!lineItemsByReceipt.has(receiptNumber)) {
      lineItemsByReceipt.set(receiptNumber, []);
    }
    
    lineItemsByReceipt.get(receiptNumber).push({
      item: values[itemMap.get('item')],
      sku: values[itemMap.get('sku')],
      category: values[itemMap.get('category')],
      quantity: parseFloat(values[itemMap.get('quantity')]) || 0,
      gross_sales: parseFloat(values[itemMap.get('gross sales')]) || 0,
      discounts: parseFloat(values[itemMap.get('discounts')]) || 0,
      net_sales: parseFloat(values[itemMap.get('net sales')]) || 0,
      modifiers: values[itemMap.get('modifiers applied')] || ''
    });
  }
  
  console.log(`✅ Grouped ${lineItemsByReceipt.size} unique receipts\n`);
  
  // Get default employee, store, and register
  const { data: defaultEmployee } = await supabase
    .from('org_members')
    .select('id')
    .eq('org_id', ORG_ID)
    .eq('is_active', true)
    .limit(1)
    .single();
  
  const { data: defaultStore } = await supabase
    .from('stores')
    .select('id')
    .eq('org_id', ORG_ID)
    .limit(1)
    .single();
  
  const { data: defaultRegister } = await supabase
    .from('registers')
    .select('id')
    .limit(1)
    .single();
  
  if (!defaultEmployee || !defaultStore || !defaultRegister) {
    console.error('❌ Missing default employee, store, or register');
    process.exit(1);
  }
  
  console.log(`👤 Default employee: ${defaultEmployee.id}`);
  console.log(`🏪 Default store: ${defaultStore.id}`);
  console.log(`🖥️  Default register: ${defaultRegister.id}\n`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  console.log('🚀 Starting import...\n');
  
  // Process receipts in batches
  const BATCH_SIZE = 50;
  for (let i = 1; i < receiptsLines.length; i += BATCH_SIZE) {
    const batch = receiptsLines.slice(i, Math.min(i + BATCH_SIZE, receiptsLines.length));
    
    for (const line of batch) {
      const values = parseCSVLine(line);
      
      const receiptNumber = values[receiptMap.get('receipt number')];
      const receiptType = values[receiptMap.get('receipt type')];
      const dateStr = values[receiptMap.get('date')];
      const grossSales = parseFloat(values[receiptMap.get('gross sales')]) || 0;
      const discounts = parseFloat(values[receiptMap.get('discounts')]) || 0;
      const netSales = parseFloat(values[receiptMap.get('net sales')]) || 0;
      const paymentType = values[receiptMap.get('payment type')]?.toLowerCase() || 'cash';
      const cashierName = values[receiptMap.get('cashier name')];
      const status = values[receiptMap.get('status')]?.toLowerCase();
      
      if (receiptType === 'Refund') {
        skipped++;
        continue; // Skip refunds for now
      }
      
      if (status !== 'closed') {
        skipped++;
        continue; // Skip non-closed receipts
      }
      
      try {
        const createdAt = parseLoyverseDate(dateStr);
        
        // Check if receipt already exists
        const { data: existing } = await supabase
          .from('receipts')
          .select('id')
          .eq('org_id', ORG_ID)
          .eq('receipt_number', receiptNumber)
          .maybeSingle();
        
        if (existing) {
          skipped++;
          continue;
        }
        
        // Create receipt
        const { data: receipt, error: receiptError } = await supabase
          .from('receipts')
          .insert({
            org_id: ORG_ID,
            store_id: defaultStore.id,
            register_id: defaultRegister.id,
            member_id: defaultEmployee.id,
            receipt_number: receiptNumber,
            subtotal: grossSales,
            discount_total: discounts,
            tax_total: 0,
            tip_total: 0,
            total: netSales,
            paid_amount: netSales,
            change_amount: 0,
            status: 'completed',
            dining_option: 'takeaway',
            created_at: createdAt
          })
          .select()
          .single();
        
        if (receiptError) {
          console.error(`❌ Error creating receipt ${receiptNumber}:`, receiptError.message);
          errors++;
          continue;
        }
        
        // Create payment record
        await supabase
          .from('payments')
          .insert({
            receipt_id: receipt.id,
            method: paymentType === 'sumup' ? 'card' : 'cash',
            amount: netSales,
            created_at: createdAt
          });
        
        // Create line items
        const lineItems = lineItemsByReceipt.get(receiptNumber) || [];
        
        for (let j = 0; j < lineItems.length; j++) {
          const item = lineItems[j];
          const itemId = await getItemIdByName(item.item);
          
          // If item doesn't exist in current catalog, still create the line with null item_id
          // This preserves historical data even for deleted/changed menu items
          if (!itemId) {
            console.warn(`⚠️  Item not in current catalog: ${item.item} (receipt ${receiptNumber}) - storing as historical data`);
          }
          
          await supabase
            .from('receipt_lines')
            .insert({
              receipt_id: receipt.id,
              org_id: ORG_ID,
              item_id: itemId || null, // null for historical items no longer in catalog
              name: item.item, // Always store the actual item name from Loyverse
              quantity: Math.abs(item.quantity),
              unit_price: item.quantity !== 0 ? Math.abs(item.net_sales / item.quantity) : 0,
              discount_amount: 0,
              tax_rate: 0,
              tax_amount: 0,
              line_total: Math.abs(item.net_sales),
              modifiers: item.modifiers ? [{ name: item.modifiers, price_adjustment: 0 }] : null,
              sort_order: j
            });
        }
        
        imported++;
        
        if (imported % 100 === 0) {
          console.log(`✅ Imported ${imported} receipts...`);
        }
        
      } catch (err) {
        console.error(`❌ Error processing receipt ${receiptNumber}:`, err.message);
        errors++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Import Complete!\n');
  console.log(`✅ Imported: ${imported} receipts`);
  console.log(`⏭️  Skipped: ${skipped} receipts (refunds or duplicates)`);
  console.log(`❌ Errors: ${errors} receipts`);
  console.log('='.repeat(60));
}

importHistoricalData().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
