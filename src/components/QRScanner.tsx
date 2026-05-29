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
  const [cameraStarted, setCameraStarted] = useState(false);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        console.log("[QR Scanner] Starting scanner...");
        // Dynamically import html5-qrcode to avoid SSR issues
        const { Html5Qrcode } = await import("html5-qrcode");
        
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        
        // Calculate square scan box based on viewport
        const scanBoxSize = Math.min(window.innerWidth, window.innerHeight) * 0.6;
        
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: scanBoxSize, height: scanBoxSize },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            console.log("[QR Scanner] QR code detected:", decodedText);
            setScanning(false);
            onScan(decodedText);
            // Stop scanner after successful scan
            scanner.stop().catch(console.error);
          },
          (errorMessage: string) => {
            // Ignore scan errors (they happen frequently while searching)
            // Only log for debugging
            if (errorMessage.includes("No barcode")) {
              // Normal - no QR in view
            } else {
              console.log("[QR Scanner] Scan error:", errorMessage);
            }
          }
        );
        
        setCameraStarted(true);
        console.log("[QR Scanner] Camera started successfully");
      } catch (err) {
        console.error("[QR Scanner] Error:", err);
        setError("Failed to start camera. Please check permissions.");
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        console.log("[QR Scanner] Stopping scanner...");
        scannerRef.current.stop().catch(console.error);
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
      <div className="flex-1 flex items-center justify-center relative">
        <div id="qr-reader" className="w-full h-full" />
        
        {/* Square scan guide overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 border-4 border-white/50 rounded-lg relative">
            {/* Corner markers */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-penkey-orange rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-penkey-orange rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-penkey-orange rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-penkey-orange rounded-br-lg" />
          </div>
        </div>
      </div>

      {/* Scanning Indicator */}
      {scanning && cameraStarted && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Scanning...</span>
          </div>
        </div>
      )}

      {/* Camera starting indicator */}
      {scanning && !cameraStarted && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span>Starting camera...</span>
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
