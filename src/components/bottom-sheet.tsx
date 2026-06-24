"use client";

import { useEffect, useState, ReactNode } from "react";
import { X } from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { usePullToDismiss } from "@/hooks/use-pull-to-dismiss";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, icon, children }: BottomSheetProps) {
  useScrollLock(open);

  const [visible, setVisible] = useState(false);

  const { dragOffset, isDragging, handlers: pullHandlers } = usePullToDismiss({
    onDismiss: onClose,
    threshold: 100,
  });

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? "none" : undefined,
        }}
        className={`relative w-full max-w-md bg-[#3d3d3d] text-white rounded-t-2xl border-t border-gray-700 shadow-2xl transition-transform duration-300 ease-out ${visible ? "translate-y-0" : "translate-y-full"} max-h-[85vh] flex flex-col`}
      >
        <div
          {...pullHandlers}
          className="flex justify-center pt-2 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        <div
          {...pullHandlers}
          className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-gray-700"
        >
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-behavior-contain flex-1" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
