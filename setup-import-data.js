#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupImportData() {
  console.log('🔧 Setting up required data for import...\n');
  
  // Check for employee
  const { data: employee } = await supabase
    .from('org_members')
    .select('id, first_name, last_name')
    .eq('org_id', ORG_ID)
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (employee) {
    console.log(`✅ Employee found: ${employee.first_name} ${employee.last_name} (${employee.id})`);
  } else {
    console.log('❌ No active employee found');
  }
  
  // Check for store
  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('org_id', ORG_ID)
    .limit(1)
    .single();
  
  if (store) {
    console.log(`✅ Store found: ${store.name} (${store.id})`);
  } else {
    console.log('❌ No store found - creating one...');
    
    const { data: newStore, error } = await supabase
      .from('stores')
      .insert({
        org_id: ORG_ID,
        name: 'Penkey Coffee and Gifts',
        address: '',
        phone: '',
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to create store:', error);
    } else {
      console.log(`✅ Created store: ${newStore.name} (${newStore.id})`);
    }
  }
  
  // Check for register
  const { data: register } = await supabase
    .from('registers')
    .select('id, name')
    .limit(1)
    .single();
  
  if (register) {
    console.log(`✅ Register found: ${register.name} (${register.id})`);
  } else {
    console.log('❌ No register found - creating one...');
    
    // Get store ID for the register
    const { data: storeForRegister } = await supabase
      .from('stores')
      .select('id')
      .eq('org_id', ORG_ID)
      .limit(1)
      .single();
    
    if (!storeForRegister) {
      console.error('Cannot create register without a store');
      return;
    }
    
    const { data: newRegister, error } = await supabase
      .from('registers')
      .insert({
        store_id: storeForRegister.id,
        name: 'Main Register',
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to create register:', error);
    } else {
      console.log(`✅ Created register: ${newRegister.name} (${newRegister.id})`);
    }
  }
  
  console.log('\n✅ Setup complete! Ready to import.');
}

setupImportData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
