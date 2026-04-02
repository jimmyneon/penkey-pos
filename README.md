# 🏪 Penkey POS

Modern Progressive Web App (PWA) point-of-sale system built with Next.js.

## 🚀 Quick Start

### Development
```bash
npm run dev
```
Runs on `http://localhost:3001`

### Production Build
```bash
npm run build
npm start
```

## 📦 Features

- ✅ **PWA Support** - Install on any device, works offline
- ✅ **Real-time Sync** - Supabase integration with live updates
- ✅ **Touch Optimized** - Perfect for tablets and touch screens
- ✅ **Payment Integration** - SumUp payment processing
- ✅ **Printer Support** - Receipt printing via adapters
- ✅ **Inventory Management** - Track stock in real-time
- ✅ **Reports & Analytics** - Sales insights and natural language queries
- ✅ **Multi-user** - Staff management with passcodes
- ✅ **Offline Mode** - Continue selling without internet

## 🎨 PWA Icons

Generate icons before deployment:

1. Open `http://localhost:3001/icon-generator.html`
2. Click download buttons for both sizes
3. Icons will be saved to your downloads
4. Move them to `/public/` folder

## 🔧 Environment Variables

Create `.env.local` with:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_POS_URL=http://localhost:3001

# Optional: SumUp
SUMUP_API_KEY=your-key
NEXT_PUBLIC_SUMUP_APP_ID=your-app-id
```

## 📱 PWA Installation

### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"

### Android (Chrome)
1. Open the app in Chrome
2. Tap the menu (3 dots)
3. Select "Install app" or "Add to Home Screen"

### Desktop (Chrome/Edge)
1. Look for install icon in address bar
2. Click "Install"

## 🏗️ Tech Stack

- **Framework:** Next.js 15
- **Database:** Supabase (PostgreSQL)
- **State:** Zustand + React Query
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **PWA:** next-pwa
- **Payments:** SumUp SDK

## 📂 Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
│   ├── pos/         # POS-specific components
│   ├── pwa/         # PWA components (install prompt, etc.)
│   └── ui/          # Shared UI components
├── hooks/           # Custom React hooks
├── lib/             # Utilities and helpers
└── stores/          # Zustand state stores

public/
├── manifest.json    # PWA manifest
├── offline.html     # Offline fallback page
└── icon-*.png       # PWA icons
```

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- Environment variables for sensitive data
- Secure authentication via Supabase Auth
- HTTPS required in production

## 📊 Performance

- Lighthouse PWA Score: 100/100
- Service Worker caching for offline support
- Optimistic UI updates
- Image optimization via Next.js

## 🐛 Troubleshooting

### Service Worker not updating
```bash
# Clear cache and hard reload
# Chrome: Ctrl+Shift+R (Cmd+Shift+R on Mac)
```

### Database connection issues
- Check Supabase URL and keys
- Verify RLS policies
- Check network connectivity

### Build errors
```bash
# Clean build
rm -rf .next
npm run build
```

## 📝 License

Private - Penkey Délicaf & Gifts

## 🤝 Support

For issues or questions, contact the development team.
