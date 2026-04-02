"use client";

import { useEffect, useState } from "react";
import { X, Download, Smartphone, Apple, Chrome } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type BrowserType = "ios" | "android-chrome" | "android-firefox" | "android-samsung" | "desktop";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [browserType, setBrowserType] = useState<BrowserType>("desktop");
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initPWA = async () => {
      try {
        // Wait for service worker to register (max 5 seconds)
        // Skip in development mode
        let swRegistered = false;
        let attempts = 0;
        const isDev = process.env.NODE_ENV !== "production";
        const maxAttempts = isDev ? 5 : 50; // Fewer attempts in dev
        
        while (!swRegistered && attempts < maxAttempts) {
          if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (!isDev) {
              console.log("[PWA] Service worker registrations:", registrations.length);
              registrations.forEach((reg) => {
                console.log("[PWA] SW scope:", reg.scope, "Active:", !!reg.active);
              });
            }
            if (registrations.length > 0) {
              swRegistered = true;
              console.log("[PWA] Service worker is ready");
            }
          }
          if (!swRegistered) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
          }
        }

        // Check if already installed
        const isInStandaloneMode =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as any).standalone ||
          document.referrer.includes("android-app://");

        setIsStandalone(isInStandaloneMode);
        console.log("[PWA] Standalone mode:", isInStandaloneMode);

        // Detect browser type
        const ua = navigator.userAgent;
        let detected: BrowserType = "desktop";

        if (/iPad|iPhone|iPod/.test(ua)) {
          detected = "ios";
        } else if (/Android/.test(ua)) {
          if (/SamsungBrowser/.test(ua)) {
            detected = "android-samsung";
          } else if (/Firefox/.test(ua)) {
            detected = "android-firefox";
          } else {
            detected = "android-chrome";
          }
        }

        setBrowserType(detected);
        console.log("[PWA] Browser detected:", detected, "UA:", ua);

        // Check if user has dismissed the prompt before
        const dismissed = localStorage.getItem("pwa-install-dismissed");
        const dismissedTime = dismissed ? parseInt(dismissed) : 0;
        const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

        console.log("[PWA] Dismissed check - days since:", daysSinceDismissed, "dismissed time:", dismissedTime);

        // Show prompt if not installed, not dismissed recently (7 days)
        if (!isInStandaloneMode && daysSinceDismissed > 7) {
          console.log("[PWA] Conditions met, showing prompt");
          if (detected === "ios") {
            // Show iOS instructions after a delay
            console.log("[PWA] iOS detected, showing instructions");
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
          } else {
            // Listen for beforeinstallprompt event
            const handler = (e: Event) => {
              console.log("[PWA] beforeinstallprompt event fired");
              e.preventDefault();
              setDeferredPrompt(e as BeforeInstallPromptEvent);
              setTimeout(() => setShowPrompt(true), 3000);
            };

            window.addEventListener("beforeinstallprompt", handler);
            console.log("[PWA] Listening for beforeinstallprompt event");

            return () => {
              window.removeEventListener("beforeinstallprompt", handler);
            };
          }
        } else {
          console.log("[PWA] Conditions NOT met - standalone:", isInStandaloneMode, "dismissed recently:", daysSinceDismissed <= 7);
        }
      } catch (error) {
        console.error("[PWA] Install prompt error:", error);
      }
    };

    initPWA();
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
    setShowPrompt(false);
  };

  const handleReset = () => {
    localStorage.removeItem("pwa-install-dismissed");
    setDeferredPrompt(null);
    setShowPrompt(false);
    window.location.reload();
  };

  if (isStandalone || !showPrompt) return null;

  const getInstructions = () => {
    switch (browserType) {
      case "ios":
        return {
          title: "Add to Home Screen",
          icon: Apple,
          steps: [
            "Tap the Share button at the bottom",
            'Select "Add to Home Screen"',
            "Tap Add in the top right",
          ],
          description: "Get instant access to Penkey POS from your home screen",
        };
      case "android-chrome":
        return {
          title: "Install App",
          icon: Chrome,
          steps: [
            "Tap the menu (⋮) at the top right",
            'Select "Install app"',
            "Tap Install to confirm",
          ],
          description: "Fast, offline-capable app experience",
        };
      case "android-firefox":
        return {
          title: "Add to Home Screen",
          icon: Smartphone,
          steps: [
            "Tap the menu (⋯) at the bottom right",
            'Select "Add to Home Screen"',
            "Tap Add to confirm",
          ],
          description: "Quick access from your home screen",
        };
      case "android-samsung":
        return {
          title: "Install App",
          icon: Smartphone,
          steps: [
            "Tap the menu (⋮) at the top right",
            'Select "Install app"',
            "Tap Install to confirm",
          ],
          description: "Optimized for Samsung devices",
        };
      default:
        return {
          title: "Install Penkey POS",
          icon: Download,
          steps: [],
          description: "Get faster access and offline support",
        };
    }
  };

  const instructions = getInstructions();
  const IconComponent = instructions.icon;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 animate-in slide-in-from-bottom-5">
      {/* Dark theme card matching design system */}
      <div className="bg-[#3d3d3d] rounded-lg shadow-2xl border border-[#5d5d5d] p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Icon container */}
          <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
            <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
              {instructions.title}
            </h3>

            {/* Description */}
            <p className="text-xs sm:text-sm text-gray-300 mb-3">
              {instructions.description}
            </p>

            {/* Steps for mobile browsers */}
            {instructions.steps.length > 0 && (
              <div className="mb-3 space-y-1">
                {instructions.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-semibold text-orange-400">
                      {idx + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-gray-300 pt-0.5">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {deferredPrompt && browserType !== "ios" && (
                <button
                  onClick={handleInstall}
                  className="px-3 sm:px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs sm:text-sm font-semibold rounded-md hover:from-orange-600 hover:to-orange-700 active:scale-95 transition-all duration-150 shadow-lg"
                >
                  Install Now
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="px-3 sm:px-4 py-2 bg-[#5d5d5d] text-gray-200 text-xs sm:text-sm font-medium rounded-md hover:bg-[#6d6d6d] active:scale-95 transition-all duration-150"
              >
                Later
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-200 active:scale-90 transition-all duration-150 p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
