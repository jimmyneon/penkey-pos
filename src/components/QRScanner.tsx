"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

// Type declaration for BarcodeDetector API
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [cameraStarted, setCameraStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRunningRef = useRef(false);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        console.log("[QR Scanner] Starting scanner...");
        
        // Check if BarcodeDetector is supported
        if (!('BarcodeDetector' in window)) {
          throw new Error("BarcodeDetector not supported in this browser");
        }

        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

        // Get the video element
        const videoElement = videoRef.current;
        if (!videoElement) {
          throw new Error("Video element not found");
        }

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        
        streamRef.current = stream;
        videoElement.srcObject = stream;
        
        await videoElement.play();
        setCameraStarted(true);
        isRunningRef.current = true;
        console.log("[QR Scanner] Camera started successfully");

        // Scan for QR codes periodically
        scanIntervalRef.current = setInterval(async () => {
          if (!isRunningRef.current || !videoElement) return;

          try {
            const barcodes = await barcodeDetector.detect(videoElement);
            if (barcodes.length > 0) {
              const result = barcodes[0].rawValue;
              console.log("[QR Scanner] QR code detected:", result);
              setScanning(false);
              isRunningRef.current = false;
              onScan(result);
              
              // Stop scanning
              if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
              }
              
              // Stop camera
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
              }
            }
          } catch (err) {
            // Detection errors are normal while scanning
          }
        }, 500); // Scan every 500ms

      } catch (err) {
        console.error("[QR Scanner] Error:", err);
        setError("Failed to start camera. Please check permissions.");
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      isRunningRef.current = false;
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan]);

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

      {/* Scanner View - Full screen camera */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ 
            width: '100vw',
            height: '100vh',
            objectFit: 'cover'
          }}
          muted
          playsInline
        />
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
