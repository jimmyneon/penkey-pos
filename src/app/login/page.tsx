"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import UserOnboarding from "@/components/onboarding/user-onboarding";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingUser, setOnboardingUser] = useState<{ id: string; email: string } | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check", {
          method: "GET",
          credentials: "include",
        });
        
        if (response.ok) {
          router.push("/lock");
          return; // stay in checking state — we're navigating away
        }
      } catch {
        // Not authenticated, fall through to show the form
      }
      setAuthChecking(false);
    };
    
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ✅ SECURITY: Include cookies for httpOnly cookie
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Check if user needs onboarding
      if (data.needsOnboarding) {
        setOnboardingUser(data.user);
        setNeedsOnboarding(true);
        return;
      }

      // ✅ SECURITY: Session is now stored in httpOnly cookie (set by server)
      // No need to store anything in localStorage
      // Redirect to lock screen for PIN entry
      router.push("/lock");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
    // Redirect to lock screen after onboarding
    router.push("/lock");
  };

  if (authChecking) {
    return <div className="min-h-screen bg-[#2d2d2d]" />;
  }

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Show onboarding if needed */}
        {needsOnboarding && onboardingUser ? (
          <UserOnboarding
            userId={onboardingUser.id}
            email={onboardingUser.email}
            onComplete={handleOnboardingComplete}
          />
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-heading font-bold text-white mb-2">
                Penkey POS
              </h1>
              <p className="text-gray-400">Sign in to continue</p>
            </div>

            {/* Login Form */}
            <div className="bg-[#3d3d3d] rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-penkey-orange transition-colors disabled:opacity-50"
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-penkey-orange transition-colors disabled:opacity-50"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-[#2d2d2d] text-penkey-orange focus:ring-penkey-orange focus:ring-offset-0"
                />
                <span className="text-sm text-gray-300">Remember me for 30 days</span>
              </label>
              <a
                href="/forgot-password"
                className="text-sm text-penkey-orange hover:text-orange-400 transition-colors"
              >
                Forgot password?
              </a>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff6b35] hover:bg-[#ff8c5a] disabled:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn className="h-5 w-5" />
                  Sign In
                </span>
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-600">
            <p className="text-center text-sm text-gray-400">
              Need help? Contact your administrator
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            v1.0.0 • Offline-capable PWA
          </p>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
