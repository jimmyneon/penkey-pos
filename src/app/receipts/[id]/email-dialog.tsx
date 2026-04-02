"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button, Input } from "@penkey/ui";
import { Mail, Send } from "lucide-react";

interface EmailDialogProps {
  open: boolean;
  onClose: () => void;
  onSend: (email: string) => void;
  receiptNumber: string;
  defaultEmail?: string;
}

export function EmailDialog({ 
  open, 
  onClose, 
  onSend, 
  receiptNumber,
  defaultEmail 
}: EmailDialogProps) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      return () => {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      };
    } else {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [open]);

  const handleSend = async () => {
    if (!isValidEmail(email)) {
      alert("Please enter a valid email address");
      return;
    }
    
    setSending(true);
    try {
      await onSend(email);
      handleClose();
    } catch (error) {
      console.error("Failed to send email:", error);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setEmail(defaultEmail || "");
    setSending(false);
    onClose();
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white mx-4">
        <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="h-6 w-6 text-penkey-orange" />
          Email Receipt
        </DialogTitle>
        <DialogDescription className="text-gray-600">
          Send receipt {receiptNumber} to customer via email
        </DialogDescription>

        <div className="space-y-4 mt-4">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="pl-10"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValidEmail(email)) {
                    handleSend();
                  }
                }}
              />
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              The receipt will be sent as a PDF attachment with a summary of the transaction.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={sending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={!isValidEmail(email) || sending}
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
