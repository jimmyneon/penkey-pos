#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Penkey POS Deployment Readiness...\n');

let allGood = true;
const issues = [];
const warnings = [];

// Check 1: PWA Icons
console.log('📱 Checking PWA Icons...');
const icon192 = path.join(__dirname, '../public/icon-192.png');
const icon512 = path.join(__dirname, '../public/icon-512.png');

if (!fs.existsSync(icon192)) {
  issues.push('❌ Missing: icon-192.png');
  allGood = false;
} else {
  console.log('  ✅ icon-192.png exists');
}

if (!fs.existsSync(icon512)) {
  issues.push('❌ Missing: icon-512.png');
  allGood = false;
} else {
  console.log('  ✅ icon-512.png exists');
}

// Check 2: Manifest
console.log('\n📄 Checking PWA Manifest...');
const manifestPath = path.join(__dirname, '../public/manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('  ✅ manifest.json is valid');
    console.log(`  ℹ️  App name: ${manifest.name}`);
    console.log(`  ℹ️  Theme color: ${manifest.theme_color}`);
  } catch (e) {
    issues.push('❌ manifest.json is invalid JSON');
    allGood = false;
  }
} else {
  issues.push('❌ Missing: manifest.json');
  allGood = false;
}

// Check 3: Offline page
console.log('\n🌐 Checking Offline Support...');
const offlinePath = path.join(__dirname, '../public/offline.html');
if (fs.existsSync(offlinePath)) {
  console.log('  ✅ offline.html exists');
} else {
  warnings.push('⚠️  Missing: offline.html (optional but recommended)');
}

// Check 4: Deployment config
console.log('\n⚙️  Checking Deployment Config...');
const netlifyToml = path.join(__dirname, '../netlify.toml');
if (fs.existsSync(netlifyToml)) {
  console.log('  ✅ netlify.toml exists');
} else {
  issues.push('❌ Missing: netlify.toml');
  allGood = false;
}

// Check 5: Environment variables
console.log('\n🔐 Checking Environment Setup...');
const envLocal = path.join(__dirname, '../.env.local');
if (fs.existsSync(envLocal)) {
  console.log('  ✅ .env.local exists (for local dev)');
  const envContent = fs.readFileSync(envLocal, 'utf8');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      console.log(`  ✅ ${varName} is set`);
    } else {
      warnings.push(`⚠️  ${varName} not found in .env.local`);
    }
  });
} else {
  warnings.push('⚠️  No .env.local file (needed for local dev)');
}

console.log('\n  ℹ️  Remember: Set environment variables in deployment platform!');

// Check 6: Next.js config
console.log('\n⚡ Checking Next.js Config...');
const nextConfig = path.join(__dirname, '../next.config.js');
if (fs.existsSync(nextConfig)) {
  const configContent = fs.readFileSync(nextConfig, 'utf8');
  if (configContent.includes('withPWA')) {
    console.log('  ✅ PWA plugin configured');
  } else {
    warnings.push('⚠️  PWA plugin not found in next.config.js');
  }
  if (configContent.includes('transpilePackages')) {
    console.log('  ✅ Workspace packages configured');
  }
} else {
  issues.push('❌ Missing: next.config.js');
  allGood = false;
}

// Check 7: Package.json
console.log('\n📦 Checking Package Configuration...');
const packageJson = path.join(__dirname, '../package.json');
if (fs.existsSync(packageJson)) {
  const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  console.log('  ✅ package.json exists');
  
  if (pkg.scripts && pkg.scripts.build) {
    console.log('  ✅ Build script configured');
  } else {
    issues.push('❌ No build script in package.json');
    allGood = false;
  }
  
  if (pkg.dependencies && pkg.dependencies['next-pwa']) {
    console.log('  ✅ next-pwa installed');
  } else {
    warnings.push('⚠️  next-pwa not found in dependencies');
  }
}

// Check 8: .gitignore
console.log('\n🚫 Checking .gitignore...');
const gitignore = path.join(__dirname, '../.gitignore');
if (fs.existsSync(gitignore)) {
  console.log('  ✅ .gitignore exists');
} else {
  warnings.push('⚠️  No .gitignore file');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 DEPLOYMENT READINESS SUMMARY');
console.log('='.repeat(60));

if (allGood && issues.length === 0) {
  console.log('\n🎉 ALL CHECKS PASSED!');
  console.log('\n✅ Your app is ready to deploy!');
  console.log('\nNext steps:');
  console.log('1. Generate PWA icons if not done (icon-generator.html)');
  console.log('2. Set environment variables in deployment platform');
  console.log('3. Deploy using: npm run deploy or Netlify/Vercel dashboard');
} else {
  console.log('\n⚠️  ISSUES FOUND - Please fix before deploying:\n');
  issues.forEach(issue => console.log(issue));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (optional but recommended):\n');
  warnings.forEach(warning => console.log(warning));
}

console.log('\n' + '='.repeat(60));
console.log('\n💡 For detailed deployment guide, see: READY_TO_DEPLOY.md');
console.log('💡 For troubleshooting, see: DEPLOYMENT_CHECKLIST.md\n');

process.exit(allGood && issues.length === 0 ? 0 : 1);
