'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@penkey/ui";
import { QRCodeSVG } from 'qrcode.react';
import { X, Star } from 'lucide-react';

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  qrCodeUrl: string;
  title?: string;
  description?: string;
  receiptId?: string;
}

export function QRCodeModal({ 
  open, 
  onClose, 
  qrCodeUrl, 
  title = "Leave a Review",
  description = "Scan this QR code to leave us a review on Google",
  receiptId 
}: QRCodeModalProps) {
  // Build tracking URL with receipt ID if provided
  const trackingUrl = receiptId 
    ? `${qrCodeUrl}?receipt_id=${receiptId}`
    : qrCodeUrl;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#3d3d3d] text-white border-gray-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-400" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG
              value={trackingUrl}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Description */}
          <p className="text-center text-gray-300 text-sm">
            {description}
          </p>

          {/* Instructions */}
          <div className="text-center text-xs text-gray-400 space-y-1">
            <p>1. Open your phone's camera app</p>
            <p>2. Point at the QR code</p>
            <p>3. Tap the link that appears</p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-[#5d5d5d] hover:bg-[#6d6d6d] text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
