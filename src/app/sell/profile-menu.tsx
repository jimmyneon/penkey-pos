"use client";

import { useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@penkey/ui";
import { User, LogOut, Settings } from "lucide-react";

interface ProfileMenuProps {
  open: boolean;
  onClose: () => void;
  onLock: () => void;
  employeeName: string;
  employeeRole: string;
}

export function ProfileMenu({ open, onClose, onLock, employeeName, employeeRole }: ProfileMenuProps) {
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
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs bg-[#3d3d3d] p-0 border-0">
        <DialogTitle className="sr-only">Profile Menu</DialogTitle>
        <DialogDescription className="sr-only">User profile and settings</DialogDescription>
        <div className="flex flex-col text-white">
          {/* Profile Info */}
          <div className="p-6 bg-penkey-orange text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{employeeName}</h3>
                <p className="text-sm opacity-90">{employeeRole}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-4">
            <button 
              onClick={() => {
                onClose();
                alert('Profile settings - Coming soon\n\nHere you can:\n- Change your PIN\n- Update your profile\n- Set preferences');
              }}
              className="w-full h-12 flex items-center gap-3 px-4 rounded-lg hover:bg-white/10 transition-colors text-left"
            >
              <Settings className="h-5 w-5" />
              <span>Profile Settings</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onLock();
              }}
              className="w-full h-12 flex items-center gap-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-left"
            >
              <LogOut className="h-5 w-5" />
              <span>Lock POS</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
