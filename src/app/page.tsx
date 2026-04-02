"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function POSHome() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already authenticated
    const authToken = localStorage.getItem("pos_auth_token");
    const authExpiry = localStorage.getItem("pos_auth_expiry");
    
    if (authToken && authExpiry) {
      const expiryDate = new Date(authExpiry);
      if (expiryDate > new Date()) {
        // Still valid, redirect to lock screen
        router.push("/lock");
        return;
      } else {
        // Expired, clear storage
        localStorage.removeItem("pos_auth_token");
        localStorage.removeItem("pos_auth_expiry");
        localStorage.removeItem("pos_user");
      }
    }
    
    // Not authenticated, redirect to login
    router.push("/login");
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-[#2d2d2d]">
      <div className="max-w-md w-full">
        <div className="bg-[#3d3d3d] rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-heading font-bold text-white text-center mb-2">
            Penkey POS
          </h1>
          <p className="text-center text-gray-400 mb-8">
            Point of Sale
          </p>
          
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-penkey-orange"></div>
          </div>
          
          <p className="text-center text-gray-400 mt-4">
            Loading...
          </p>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-4">
          v1.0.0 • Offline-capable PWA
        </p>
      </div>
    </main>
  );
}
