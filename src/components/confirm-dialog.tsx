"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { AlertTriangle } from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  // Use scroll lock hook to manage scroll state
  useScrollLock(open);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-md bg-[#2d2d2d] text-white border-2 border-gray-700 rounded-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
            {variant === "danger" && <AlertTriangle className="h-6 w-6 text-red-400" />}
            {variant === "warning" && <AlertTriangle className="h-6 w-6 text-yellow-400" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <p className="text-gray-300 text-base leading-relaxed">{message}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            onClick={handleConfirm}
            className={`w-full h-14 text-lg font-semibold active:scale-95 transition-transform ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : variant === "warning"
                ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                : "bg-penkey-orange hover:bg-penkey-orange/90 text-white"
            }`}
          >
            {confirmText}
          </Button>
          <Button
            size="lg"
            onClick={onClose}
            className="w-full h-14 text-lg font-semibold bg-gray-600 hover:bg-gray-700 text-white active:scale-95 transition-transform"
          >
            {cancelText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
