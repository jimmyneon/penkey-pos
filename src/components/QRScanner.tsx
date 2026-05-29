"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let scanner: any = null;

    const startScanner = async () => {
      try {
        // Dynamically import html5-qrcode to avoid SSR issues
        const { Html5Qrcode } = await import("html5-qrcode");
        
        scanner = new Html5Qrcode("qr-reader");
        
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            setScanning(false);
            onScan(decodedText);
            scanner.stop().catch(console.error);
          },
          (errorMessage: string) => {
            // Ignore scan errors (they happen frequently while searching)
          }
        );
      } catch (err) {
        console.error("Scanner error:", err);
        setError("Failed to start camera. Please check permissions.");
      }
    };

    startScanner();

    return () => {
      if (scanner) {
        scanner.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <h2 className="text-white text-lg font-semibold">Scan QR Code</h2>
        <button
          onClick={onClose}
          className="text-white p-2 hover:bg-white/10 rounded-full"
        >
          <X size={24} />
        </button>
      </div>

      {/* Scanner View */}
      <div className="flex-1 flex items-center justify-center">
        <div id="qr-reader" className="w-full h-full" />
      </div>

      {/* Scanning Indicator */}
      {scanning && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Scanning...</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-8 left-4 right-4 bg-red-500/90 text-white p-4 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
