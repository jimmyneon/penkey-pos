"use client";

import { useState, useEffect } from "react";
import { Mail, Send } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";

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
    if (open && defaultEmail) {
      setEmail(defaultEmail);
    }
  }, [open, defaultEmail]);

  const handleSend = async () => {
    if (!isValidEmail(email)) {
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
    setSending(false);
    onClose();
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title="Email Receipt"
      icon={<Mail className="h-5 w-5 text-gray-400" />}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Send receipt <span className="text-white font-medium">{receiptNumber}</span> to customer via email
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Customer Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full pl-10 pr-4 py-3 bg-[#2d2d2d] border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-penkey-orange transition-colors"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValidEmail(email)) {
                  handleSend();
                }
              }}
            />
          </div>
        </div>

        <div className="bg-[#2d2d2d] border border-gray-700 rounded-lg p-3">
          <p className="text-sm text-gray-400">
            The receipt will be sent as a formatted HTML email with a summary of the transaction.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleClose}
            disabled={sending}
            className="flex-1 px-4 py-3 bg-[#4d4d4d] hover:bg-[#5d5d5d] disabled:opacity-50 text-white font-medium rounded-lg transition-colors border border-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!isValidEmail(email) || sending}
            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
