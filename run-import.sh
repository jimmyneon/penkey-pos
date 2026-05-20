#!/bin/bash

# Loyverse Historical Data Import Runner
# This script helps you run the import with proper credentials

echo "🔐 Loyverse Historical Data Import"
echo "===================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local file not found"
    echo ""
    echo "Please create .env.local with your Supabase credentials:"
    echo ""
    echo "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
    echo "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
    echo ""
    echo "You can find these in your Supabase project settings:"
    echo "  1. Go to https://supabase.com/dashboard"
    echo "  2. Select your project"
    echo "  3. Settings > API"
    echo "  4. Copy 'Project URL' and 'service_role' key"
    echo ""
    exit 1
fi

# Check if credentials are set
source .env.local

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing credentials in .env.local"
    echo ""
    echo "Make sure .env.local contains:"
    echo "  NEXT_PUBLIC_SUPABASE_URL=..."
    echo "  SUPABASE_SERVICE_ROLE_KEY=..."
    echo ""
    exit 1
fi

echo "✅ Credentials found"
echo ""
echo "📊 This will import:"
echo "  - 4,049 sales receipts"
echo "  - 7,516 line items"
echo "  - £33,758.50 in revenue"
echo "  - Date range: Aug 2023 - May 2026"
echo ""
read -p "Continue with import? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Import cancelled"
    exit 0
fi

echo ""
echo "🚀 Starting import..."
echo ""

# Run the import
node import-loyverse-history.js

echo ""
echo "✅ Import script completed"
echo ""
echo "📝 Next steps:"
echo "  1. Verify import in Supabase dashboard"
echo "  2. Check receipt count: SELECT COUNT(*) FROM receipts;"
echo "  3. Check revenue: SELECT SUM(total) FROM receipts;"
echo "  4. Clear browser IndexedDB and refresh POS"
