"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [cameraStarted, setCameraStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    const startScanner = async () => {
      try {
        console.log("[QR Scanner] Starting scanner...");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        // Get the video element
        const videoElement = videoRef.current;
        if (!videoElement) {
          throw new Error("Video element not found");
        }

        // Try with back camera first, then fallback to any camera
        let cameraStarted = false;
        const cameraIds = await reader.listVideoInputDevices();
        
        // Try to find back camera
        const backCamera = cameraIds.find((device: any) => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('environment')
        );

        const deviceId = backCamera ? backCamera.deviceId : null;

        try {
          // Start decoding from the video device
          await reader.decodeFromVideoDevice(
            deviceId,
            videoElement,
            (result, error) => {
              if (result) {
                console.log("[QR Scanner] QR code detected:", result.getText());
                setScanning(false);
                isRunningRef.current = false;
                onScan(result.getText());
                // Stop scanner after successful scan
                if (readerRef.current) {
                  readerRef.current.reset();
                }
              }
              if (error && !(error instanceof NotFoundException)) {
                console.log("[QR Scanner] Scan error:", error);
              }
            }
          );
          cameraStarted = true;
        } catch (err) {
          console.warn("[QR Scanner] Failed with specific camera, trying any camera:", err);
          // Fallback to any camera
          await reader.decodeFromVideoDevice(
            null,
            videoElement,
            (result, error) => {
              if (result) {
                console.log("[QR Scanner] QR code detected:", result.getText());
                setScanning(false);
                isRunningRef.current = false;
                onScan(result.getText());
                // Stop scanner after successful scan
                if (readerRef.current) {
                  readerRef.current.reset();
                }
              }
              if (error && !(error instanceof NotFoundException)) {
                console.log("[QR Scanner] Scan error:", error);
              }
            }
          );
          cameraStarted = true;
        }

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
      if (readerRef.current && isRunningRef.current) {
        console.log("[QR Scanner] Stopping scanner...");
        isRunningRef.current = false;
        readerRef.current.reset();
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
          autoPlay
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
