import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { PWAUpdateNotifier } from "@/components/pwa-update-notifier";
import { NetworkStatusIndicator } from "@/components/network-status-indicator";
import { ScrollLockRecovery } from "@/components/scroll-lock-recovery";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { TestingIntegration } from "@/components/testing-integration";
import { QueryProvider } from "@/lib/query/provider";
import { ToastProvider } from "@/components/toast-provider";
import { WorkboxErrorHandler } from "@/components/workbox-error-handler";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Penkey POS",
  description: "Point of sale for Penkey Délicaf & Gifts",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Penkey POS",
    startupImage: [
      {
        url: "/icon-512.png",
        media: "(device-width: 768px) and (device-height: 1024px)",
      },
    ],
  },
  applicationName: "Penkey POS",
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2d2d2d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body>
        <QueryProvider>
          <ToastProvider>
            <WorkboxErrorHandler />
            {children}
            <ServiceWorkerRegister />
            <NetworkStatusIndicator />
            <PWAInstallPrompt />
            <PWAUpdateNotifier />
            <ScrollLockRecovery />
            <TestingIntegration />
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
