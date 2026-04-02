'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Upload, X, Loader2, AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadDialogProps {
  itemId: string;
  itemName: string;
  currentImageUrl?: string;
  onUploadComplete: (imageUrl: string) => void;
  onClose: () => void;
}

export function ImageUploadDialog({
  itemId,
  itemName,
  currentImageUrl,
  onUploadComplete,
  onClose,
}: ImageUploadDialogProps) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    // Detect if mobile device
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
    setIsMobile(isMobileDevice);
  }, []);

  const handleFileSelect = async (file: File) => {
    console.log('[ImageUpload] File selected:', file.name, file.size);
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      console.log('[ImageUpload] Invalid file type:', file.type);
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      console.log('[ImageUpload] File too large:', file.size);
      setError('Image must be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      console.log('[ImageUpload] Preview loaded');
      setPreview(e.target?.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);

    // Upload
    await uploadImage(file);
  };

  const uploadImage = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('itemId', itemId);

      // Get session token from sessionStorage (same as POS auth)
      const sessionData = sessionStorage.getItem('pos_session');
      if (!sessionData) {
        throw new Error('Session not found. Please log in again.');
      }

      const response = await fetch('/api/items/upload-image', {
        method: 'POST',
        headers: {
          'x-pos-session': sessionData,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      onUploadComplete(data.fullUrl);
      setPreview(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  const content = (
    <div className="fixed inset-0 bg-black/50 flex items-end z-[9999] pointer-events-auto" onClick={onClose}>
      <div 
        className="w-full bg-[#2d2d2d] rounded-t-lg p-4 max-h-[90vh] overflow-y-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Upload Image</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#3d3d3d] rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Item name */}
        <p className="text-sm text-gray-400 mb-4">{itemName}</p>

        {/* Preview */}
        {preview && (
          <div className="mb-4">
            <div className="relative w-full aspect-square bg-[#3d3d3d] rounded-lg overflow-hidden mb-3">
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-cover"
              />
            </div>
            {/* Upload button (appears after preview) */}
            <button
              type="button"
              onClick={async () => {
                console.log('[ImageUpload] Upload button clicked');
                // Find the file input and get the file
                const fileInput = document.querySelector('input[type="file"][accept="image/*"]:not([capture])') as HTMLInputElement;
                if (fileInput?.files?.[0]) {
                  await uploadImage(fileInput.files[0]);
                }
              }}
              disabled={isLoading}
              className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition pointer-events-auto mb-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Photo
                </>
              )}
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="mb-4 p-4 bg-[#3d3d3d] rounded-lg flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
            <span className="text-sm text-gray-300">Uploading and compressing...</span>
          </div>
        )}

        {/* Desktop camera info */}
        {!isMobile && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
            <p className="text-sm text-blue-400">
              💡 Camera is only available on mobile devices. Use "Choose from Files" to select an image.
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          {/* Camera button (Mobile only) */}
          {isMobile && (
            <button
              type="button"
              onClick={(e) => {
                console.log('[ImageUpload] Camera button clicked');
                e.preventDefault();
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              disabled={isLoading}
              className="w-full min-h-[44px] bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition pointer-events-auto"
            >
              <Camera className="w-5 h-5" />
              Take Photo
            </button>
          )}

          {/* File picker button */}
          <button
            type="button"
            onClick={(e) => {
              console.log('[ImageUpload] File picker button clicked');
              e.preventDefault();
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={isLoading}
            className="w-full min-h-[44px] bg-[#3d3d3d] hover:bg-[#4d4d4d] disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition pointer-events-auto"
          >
            <Upload className="w-5 h-5" />
            Choose from Files
          </button>

          {/* Cancel button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full min-h-[44px] bg-[#3d3d3d] hover:bg-[#4d4d4d] disabled:bg-gray-600 text-white rounded-lg font-medium transition pointer-events-auto"
          >
            Cancel
          </button>

          {/* Remove image button (if exists) */}
          {currentImageUrl && (
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onUploadComplete(''); // Clear image
                onClose();
              }}
              disabled={isLoading}
              className="w-full min-h-[44px] bg-red-900/20 hover:bg-red-900/30 disabled:bg-gray-600 text-red-400 rounded-lg font-medium transition pointer-events-auto"
            >
              Remove Image
            </button>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
