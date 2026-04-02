"use client";

import { Toast } from "@/lib/hooks/use-toast";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`w-full p-4 shadow-lg flex items-center gap-3 animate-in slide-in-from-top ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-orange-500 text-white"
          }`}
        >
          {toast.type === "success" && <CheckCircle className="h-5 w-5 flex-shrink-0" />}
          {toast.type === "error" && <AlertCircle className="h-5 w-5 flex-shrink-0" />}
          {toast.type === "info" && <Info className="h-5 w-5 flex-shrink-0" />}
          
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          
          <button
            onClick={() => onDismiss(toast.id)}
            className="flex-shrink-0 hover:opacity-70 transition-opacity active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
