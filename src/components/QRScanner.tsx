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
  const [elementMounted, setElementMounted] = useState(false);
  const scannerRef = useRef<any>(null);
  const isRunningRef = useRef(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Start scanner only after element is mounted
  useEffect(() => {
    if (!elementMounted) return;

    const startScanner = async () => {
      try {
        console.log("[QR Scanner] Starting scanner...");
        // Dynamically import html5-qrcode to avoid SSR issues
        const { Html5Qrcode } = await import("html5-qrcode");
        
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        
        // Try with a larger scan area and higher FPS for better detection
        const scanBoxSize = Math.min(window.innerWidth, window.innerHeight) * 0.7;
        
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 20, // Higher FPS for better detection
            qrbox: { width: scanBoxSize, height: scanBoxSize },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            // Safety check for undefined/null values
            if (!decodedText || typeof decodedText !== 'string') {
              console.warn("[QR Scanner] Invalid scan result:", decodedText);
              return;
            }
            
            console.log("[QR Scanner] QR code detected:", decodedText);
            console.log("[QR Scanner] QR code length:", decodedText.length);
            console.log("[QR Scanner] QR code type:", typeof decodedText);
            setScanning(false);
            isRunningRef.current = false;
            onScan(decodedText);
            // Stop scanner after successful scan
            if (scannerRef.current) {
              scannerRef.current.stop().catch((err: any) => {
                // Ignore "not running" errors during cleanup
                if (!err.message?.includes("not running")) {
                  console.error("[QR Scanner] Stop error:", err);
                }
              });
            }
          },
          (errorMessage: string) => {
            // Ignore scan errors (they happen frequently while searching)
            // Only log non-"No barcode" errors for debugging
            if (!errorMessage.includes("No barcode") && !errorMessage.includes("No MultiFormat")) {
              console.log("[QR Scanner] Scan error:", errorMessage);
            }
          }
        );
        
        isRunningRef.current = true;
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
      if (scannerRef.current && isRunningRef.current) {
        console.log("[QR Scanner] Stopping scanner...");
        isRunningRef.current = false;
        scannerRef.current.stop().catch((err: any) => {
          // Ignore "not running" errors during cleanup
          if (!err.message?.includes("not running")) {
            console.error("[QR Scanner] Stop error:", err);
          }
        });
      }
    };
  }, [onScan, elementMounted]);

  // Set element mounted after render
  useEffect(() => {
    setElementMounted(true);
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
        <h2 className="text-white text-xl font-bold">Scan QR Code</h2>
        <button
          onClick={onClose}
          className="text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Scanner View - Full screen */}
      <div className="absolute inset-0">
        <div id="qr-reader" className="w-full h-full" />
        
        {/* Square scan guide overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-72 h-72 border-2 border-white/30 rounded-2xl relative bg-white/5 backdrop-blur-sm">
            {/* Corner markers */}
            <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-penkey-orange rounded-tl-2xl" />
            <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-penkey-orange rounded-tr-2xl" />
            <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-penkey-orange rounded-bl-2xl" />
            <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-penkey-orange rounded-br-2xl" />
            
            {/* Scan line animation */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-penkey-orange/70 animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      </div>

      {/* Scanning Indicator */}
      {scanning && cameraStarted && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/20 z-10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
            <span className="font-medium">Scanning...</span>
          </div>
        </div>
      )}

      {/* Camera starting indicator */}
      {scanning && !cameraStarted && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/20 z-10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse shadow-lg shadow-yellow-500/50" />
            <span className="font-medium">Starting camera...</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-24 left-4 right-4 bg-red-500/95 backdrop-blur-md text-white p-4 rounded-xl border border-red-400/30 shadow-lg z-10">
          {error}
        </div>
      )}
    </div>
  );
}
