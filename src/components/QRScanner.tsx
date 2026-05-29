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
            fps: 10, // Lower FPS to reduce library errors
            qrbox: { width: scanBoxSize, height: scanBoxSize },
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

    // Add global error handler for html5-qrcode library errors
    const errorHandler = (event: ErrorEvent) => {
      if (event.message?.includes('charAt') || event.message?.includes('undefined')) {
        console.warn("[QR Scanner] Caught library error:", event.message);
        event.preventDefault();
      }
    };
    
    window.addEventListener('error', errorHandler);
    startScanner();

    return () => {
      window.removeEventListener('error', errorHandler);
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
      <div className="flex items-center justify-between p-4 bg-black/50 absolute top-0 left-0 right-0 z-10">
        <h2 className="text-white text-lg font-semibold">Scan QR Code</h2>
        <button
          onClick={onClose}
          className="text-white p-2 hover:bg-white/10 rounded-full"
        >
          <X size={24} />
        </button>
      </div>

      {/* Scanner View - Full screen camera only */}
      <div className="absolute inset-0">
        <div id="qr-reader" className="w-full h-full" />
      </div>

      {/* Scanning Indicator */}
      {scanning && cameraStarted && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Scanning...</span>
          </div>
        </div>
      )}

      {/* Camera starting indicator */}
      {scanning && !cameraStarted && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span>Starting camera...</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-8 left-4 right-4 bg-red-500/90 text-white p-4 rounded-lg z-10">
          {error}
        </div>
      )}
    </div>
  );
}
